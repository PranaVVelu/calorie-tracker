'use server';

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { FoodItem, MealFood, User } from '@prisma/client';
import { keyToStorageDate, storageDateToKey, isDateKey, shiftKey } from '@/lib/dates';
import { assertServings, sanitizeManualFood } from '@/lib/validation';
import { computeTargets, sanitizeTargets } from '@/lib/targets';
import { targetsForDate } from '@/lib/nutrition';
import type {
    DateKey,
    DayLog,
    Food,
    GoalPeriod,
    LogEntry,
    ManualFoodInput,
    MealType,
    Profile,
    ProfileInput,
    RangeData,
    RecentFood,
    SavedMeal,
    Targets,
    TargetMode,
    WeightEntry,
} from '@/lib/types';
import { MEAL_TYPES } from '@/lib/types';

/**
 * Single-user app: there is no auth yet, so the "current user" is resolved on
 * the server from MACROTRACK_USER_EMAIL (default: the seeded demo account).
 * The client never supplies a user id.
 */
const USER_EMAIL = process.env.MACROTRACK_USER_EMAIL || 'loser@test.com';

async function currentUser(): Promise<User | null> {
    // Demo-only deploys never touch the database, even if a request reaches the server.
    if (process.env.NEXT_PUBLIC_DEMO_ONLY === 'true') throw new Error('This deployment runs in demo mode only.');
    return prisma.user.findUnique({ where: { email: USER_EMAIL } });
}

async function requireUser(): Promise<User> {
    const u = await currentUser();
    if (!u) throw new Error('Set up your profile first.');
    return u;
}

// ---------- mapping ----------

type FoodRow = FoodItem & { favorites?: { userId: string }[] };

function toFood(f: FoodRow, userId?: string): Food {
    return {
        id: f.id,
        name: f.name,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        servingSize: f.servingSize,
        source: f.source,
        mine: !!userId && f.userId === userId,
        favorite: f.favorites ? f.favorites.length > 0 : undefined,
    };
}

function asMealType(v: string): MealType {
    return (MEAL_TYPES as readonly string[]).includes(v) ? (v as MealType) : 'Snack';
}

function assertMealType(v: unknown): MealType {
    if (!(MEAL_TYPES as readonly string[]).includes(v as string)) throw new Error('Invalid meal type');
    return v as MealType;
}

function assertDate(v: unknown): DateKey {
    if (!isDateKey(v)) throw new Error('Invalid date');
    return v;
}

function toEntry(mf: MealFood & { foodItem: FoodItem; mealEntry: { date: Date } }): LogEntry {
    // Snapshot columns are authoritative; legacy rows without a snapshot fall back to the food.
    const snap = mf.calories != null;
    return {
        id: mf.id,
        date: storageDateToKey(mf.mealEntry.date),
        mealType: asMealType(mf.mealType),
        servings: mf.servings,
        foodId: mf.foodItemId,
        name: mf.name ?? mf.foodItem.name,
        servingSize: mf.servingSize ?? mf.foodItem.servingSize,
        calories: snap ? mf.calories! : mf.foodItem.calories,
        protein: snap ? mf.protein : mf.foodItem.protein,
        carbs: snap ? mf.carbs : mf.foodItem.carbs,
        fat: snap ? mf.fat : mf.foodItem.fat,
        savedMealId: mf.savedMealId,
        createdAt: mf.createdAt.toISOString(),
    };
}

const entryInclude = { foodItem: true, mealEntry: { select: { date: true } } } as const;

function userTargets(u: User): Targets {
    return { calories: u.calorieTarget, protein: u.proteinTarget, carbs: u.carbsTarget, fat: u.fatTarget };
}

function toProfile(u: User): Profile {
    return {
        name: u.name ?? '',
        age: u.age,
        gender: u.gender as Profile['gender'],
        height: u.height,
        weight: u.weight,
        activityLevel: u.activityLevel,
        goalType: u.goalType as Profile['goalType'],
        goalRate: u.goalRate,
        goalWeight: u.goalWeight,
        tdee: u.tdee,
        targets: userTargets(u),
        targetMode: (u.targetMode as TargetMode) ?? 'calculated',
    };
}

async function getPeriods(userId: string): Promise<GoalPeriod[]> {
    const rows = await prisma.goalPeriod.findMany({ where: { userId }, orderBy: { effectiveFrom: 'asc' } });
    return rows.map(r => ({
        effectiveFrom: storageDateToKey(r.effectiveFrom),
        calories: r.calorieTarget,
        protein: r.proteinTarget,
        carbs: r.carbsTarget,
        fat: r.fatTarget,
        mode: r.mode as TargetMode,
    }));
}

/** Find or create the day container. Tolerates legacy non-midnight timestamps. */
async function dayContainer(tx: Prisma.TransactionClient, userId: string, date: DateKey) {
    const d = keyToStorageDate(date);
    const existing = await tx.mealEntry.findFirst({
        where: { userId, date: { gte: new Date(d.getTime() - 12 * 3600e3), lt: new Date(d.getTime() + 12 * 3600e3) } },
    });
    if (existing) return existing;
    return tx.mealEntry.create({ data: { userId, date: d } });
}

function isUniqueViolation(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

async function entriesByRequest(userId: string, requestId: string) {
    const rows = await prisma.mealFood.findMany({
        where: { mealEntry: { userId }, OR: [{ requestId }, { requestId: { startsWith: requestId + ':' } }] },
        include: entryInclude,
        orderBy: { createdAt: 'asc' },
    });
    return rows.map(toEntry);
}

function snapshot(f: { name: string; calories: number; protein: number | null; carbs: number | null; fat: number | null; servingSize: string }) {
    return { name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, servingSize: f.servingSize };
}

// ---------- profile & goals ----------

export async function getProfile(): Promise<Profile | null> {
    const u = await currentUser();
    return u ? toProfile(u) : null;
}

export async function saveProfile(input: ProfileInput, today: DateKey): Promise<Profile> {
    const effective = assertDate(today);
    const p = {
        name: String(input.name ?? '').trim().slice(0, 60),
        age: Math.round(Number(input.age)),
        gender: input.gender === 'female' ? 'female' : 'male',
        height: Number(input.height),
        weight: Number(input.weight),
        activityLevel: Number(input.activityLevel),
        goalType: (['lose', 'maintain', 'gain'] as const).includes(input.goalType) ? input.goalType : 'maintain',
        goalRate: Number(input.goalRate),
        goalWeight: Number(input.goalWeight),
    } as ProfileInput;
    if (!(p.age >= 13 && p.age <= 120) || !(p.height > 50 && p.height < 300) || !(p.weight > 20 && p.weight < 500)) {
        throw new Error('Please check age, height and weight.');
    }
    const calc = computeTargets(p);
    const existing = await currentUser();
    const manual = existing?.targetMode === 'manual';
    const targets = manual && existing ? userTargets(existing) : calc.targets;
    const data = {
        ...p,
        tdee: calc.tdee,
        calorieTarget: targets.calories,
        proteinTarget: targets.protein,
        carbsTarget: targets.carbs,
        fatTarget: targets.fat,
    };
    const u = await prisma.user.upsert({ where: { email: USER_EMAIL }, update: data, create: { ...data, email: USER_EMAIL } });
    if (!manual) await upsertPeriod(u.id, effective, targets, 'calculated', !existing);
    return toProfile(u);
}

async function upsertPeriod(userId: string, from: DateKey, t: Targets, mode: TargetMode, isFirst = false) {
    const effectiveFrom = isFirst ? keyToStorageDate('1970-01-01') : keyToStorageDate(from);
    const data = { calorieTarget: t.calories, proteinTarget: t.protein, carbsTarget: t.carbs, fatTarget: t.fat, mode };
    await prisma.goalPeriod.upsert({
        where: { userId_effectiveFrom: { userId, effectiveFrom } },
        update: data,
        create: { userId, effectiveFrom, ...data },
    });
}

export async function saveTargets(input: { mode: TargetMode; targets?: Targets; effectiveFrom: DateKey }): Promise<Profile> {
    const u = await requireUser();
    const from = assertDate(input.effectiveFrom);
    const targets =
        input.mode === 'manual' && input.targets
            ? sanitizeTargets(input.targets)
            : computeTargets(toProfile(u)).targets;
    const updated = await prisma.user.update({
        where: { id: u.id },
        data: {
            targetMode: input.mode === 'manual' ? 'manual' : 'calculated',
            calorieTarget: targets.calories,
            proteinTarget: targets.protein,
            carbsTarget: targets.carbs,
            fatTarget: targets.fat,
        },
    });
    // New targets apply from `from` onward; earlier days keep the goal that applied then.
    await upsertPeriod(u.id, from, targets, input.mode);
    return toProfile(updated);
}

// ---------- days & ranges ----------

export async function getDay(date: DateKey): Promise<DayLog> {
    const u = await requireUser();
    const key = assertDate(date);
    const d = keyToStorageDate(key);
    const rows = await prisma.mealFood.findMany({
        where: {
            mealEntry: { userId: u.id, date: { gte: new Date(d.getTime() - 12 * 3600e3), lt: new Date(d.getTime() + 12 * 3600e3) } },
        },
        include: entryInclude,
        orderBy: { createdAt: 'asc' },
    });
    const periods = await getPeriods(u.id);
    return { date: key, entries: rows.map(toEntry), targets: targetsForDate(periods, key, userTargets(u)) };
}

export async function getRange(from: DateKey, to: DateKey): Promise<RangeData> {
    const u = await requireUser();
    assertDate(from);
    assertDate(to);
    const start = new Date(keyToStorageDate(from).getTime() - 12 * 3600e3);
    const end = new Date(keyToStorageDate(to).getTime() + 12 * 3600e3);
    // Weights include the 6 days before the range so the rolling average is defined from day one.
    const wStart = new Date(keyToStorageDate(shiftKey(from, -6)).getTime() - 12 * 3600e3);
    const [rows, weights, periods] = await Promise.all([
        prisma.mealFood.findMany({
            where: { mealEntry: { userId: u.id, date: { gte: start, lt: end } } },
            include: entryInclude,
            orderBy: { createdAt: 'asc' },
        }),
        prisma.weightEntry.findMany({ where: { userId: u.id, date: { gte: wStart, lt: end } }, orderBy: { date: 'asc' } }),
        getPeriods(u.id),
    ]);
    return {
        from,
        to,
        entries: rows.map(toEntry),
        weights: weights.map(w => ({ date: storageDateToKey(w.date), weight: w.weight })),
        periods,
        fallbackTargets: userTargets(u),
    };
}

// ---------- foods ----------

function favInclude(userId: string) {
    return { favorites: { where: { userId }, select: { userId: true } } };
}

export async function searchFoods(query: string): Promise<Food[]> {
    const u = await currentUser();
    const q = String(query ?? '').trim().slice(0, 60);
    if (q.length < 2) return [];
    const rows = await prisma.foodItem.findMany({
        where: {
            name: { contains: q, mode: 'insensitive' },
            OR: [{ userId: null }, ...(u ? [{ userId: u.id }] : [])],
        },
        include: u ? favInclude(u.id) : undefined,
        orderBy: [{ name: 'asc' }],
        take: 30,
    });
    // Prefer names that start with the query.
    const lower = q.toLowerCase();
    rows.sort((a, b) => Number(!a.name.toLowerCase().startsWith(lower)) - Number(!b.name.toLowerCase().startsWith(lower)));
    return rows.map(r => toFood(r, u?.id));
}

export async function getRecentFoods(): Promise<RecentFood[]> {
    const u = await requireUser();
    const rows = await prisma.mealFood.findMany({
        where: { mealEntry: { userId: u.id } },
        include: { foodItem: { include: favInclude(u.id) } },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });
    const seen = new Set<string>();
    const out: RecentFood[] = [];
    for (const r of rows) {
        if (seen.has(r.foodItemId)) continue;
        seen.add(r.foodItemId);
        out.push({
            ...toFood(r.foodItem, u.id),
            lastServings: r.servings,
            lastMealType: asMealType(r.mealType),
            lastLoggedAt: r.createdAt.toISOString(),
        });
        if (out.length >= 20) break;
    }
    return out;
}

export async function getFavorites(): Promise<Food[]> {
    const u = await requireUser();
    const rows = await prisma.favoriteFood.findMany({
        where: { userId: u.id },
        include: { foodItem: true },
        orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => ({ ...toFood(r.foodItem, u.id), favorite: true }));
}

export async function getMyFoods(): Promise<Food[]> {
    const u = await requireUser();
    const rows = await prisma.foodItem.findMany({
        where: { userId: u.id },
        include: favInclude(u.id),
        orderBy: { createdAt: 'desc' },
        take: 200,
    });
    return rows.map(r => toFood(r, u.id));
}

export async function setFavorite(foodId: string, favorite: boolean): Promise<void> {
    const u = await requireUser();
    if (favorite) {
        await prisma.favoriteFood.upsert({
            where: { userId_foodItemId: { userId: u.id, foodItemId: foodId } },
            update: {},
            create: { userId: u.id, foodItemId: foodId },
        });
    } else {
        await prisma.favoriteFood.deleteMany({ where: { userId: u.id, foodItemId: foodId } });
    }
}

export async function createFood(input: ManualFoodInput): Promise<Food> {
    const u = await requireUser();
    const f = await prisma.foodItem.create({ data: { ...sanitizeManualFood(input), source: 'user_manual', userId: u.id } });
    return toFood(f, u.id);
}

// ---------- logging ----------

export async function logFood(input: { date: DateKey; mealType: MealType; foodId: string; servings: number; requestId: string }): Promise<LogEntry> {
    const u = await requireUser();
    const date = assertDate(input.date);
    const mealType = assertMealType(input.mealType);
    const servings = assertServings(input.servings);
    const requestId = String(input.requestId).slice(0, 80);
    const prior = await entriesByRequest(u.id, requestId);
    if (prior.length) return prior[0];

    const food = await prisma.foodItem.findUnique({ where: { id: input.foodId } });
    if (!food || (food.userId && food.userId !== u.id)) throw new Error('Food not found');
    try {
        const row = await prisma.$transaction(async tx => {
            const day = await dayContainer(tx, u.id, date);
            return tx.mealFood.create({
                data: { mealEntryId: day.id, foodItemId: food.id, mealType, servings, requestId, ...snapshot(food) },
                include: entryInclude,
            });
        });
        return toEntry(row);
    } catch (e) {
        if (isUniqueViolation(e)) return (await entriesByRequest(u.id, requestId))[0];
        throw e;
    }
}

export async function logManual(input: { date: DateKey; mealType: MealType; food: ManualFoodInput; servings: number; requestId: string }): Promise<LogEntry> {
    const u = await requireUser();
    const date = assertDate(input.date);
    const mealType = assertMealType(input.mealType);
    const servings = assertServings(input.servings);
    const requestId = String(input.requestId).slice(0, 80);
    const prior = await entriesByRequest(u.id, requestId);
    if (prior.length) return prior[0];
    const clean = sanitizeManualFood(input.food);
    try {
        const row = await prisma.$transaction(async tx => {
            const food = await tx.foodItem.create({ data: { ...clean, source: 'user_manual', userId: u.id } });
            const day = await dayContainer(tx, u.id, date);
            return tx.mealFood.create({
                data: { mealEntryId: day.id, foodItemId: food.id, mealType, servings, requestId, ...snapshot(food) },
                include: entryInclude,
            });
        });
        return toEntry(row);
    } catch (e) {
        if (isUniqueViolation(e)) return (await entriesByRequest(u.id, requestId))[0];
        throw e;
    }
}

async function ownedEntry(userId: string, id: string) {
    const row = await prisma.mealFood.findFirst({ where: { id, mealEntry: { userId } }, include: entryInclude });
    if (!row) throw new Error('Entry not found');
    return row;
}

export async function updateEntry(id: string, patch: { servings?: number; mealType?: MealType }): Promise<LogEntry> {
    const u = await requireUser();
    await ownedEntry(u.id, id);
    const row = await prisma.mealFood.update({
        where: { id },
        data: {
            ...(patch.servings != null ? { servings: assertServings(patch.servings) } : {}),
            ...(patch.mealType != null ? { mealType: assertMealType(patch.mealType) } : {}),
        },
        include: entryInclude,
    });
    return toEntry(row);
}

export async function deleteEntry(id: string): Promise<LogEntry> {
    const u = await requireUser();
    const row = await ownedEntry(u.id, id);
    await prisma.mealFood.delete({ where: { id } });
    return toEntry(row);
}

/** Re-creates a deleted entry (undo) from its snapshot. */
export async function restoreEntry(entry: LogEntry): Promise<LogEntry> {
    const u = await requireUser();
    const date = assertDate(entry.date);
    const food = await prisma.foodItem.findUnique({ where: { id: entry.foodId } });
    if (!food) throw new Error('Food no longer exists');
    const row = await prisma.$transaction(async tx => {
        const day = await dayContainer(tx, u.id, date);
        return tx.mealFood.create({
            data: {
                mealEntryId: day.id,
                foodItemId: food.id,
                mealType: assertMealType(entry.mealType),
                servings: assertServings(entry.servings),
                savedMealId: entry.savedMealId,
                name: entry.name,
                calories: entry.calories,
                protein: entry.protein,
                carbs: entry.carbs,
                fat: entry.fat,
                servingSize: entry.servingSize,
                createdAt: new Date(entry.createdAt),
            },
            include: entryInclude,
        });
    });
    return toEntry(row);
}

export async function copyMeal(input: { fromDate: DateKey; fromMealType: MealType; toDate: DateKey; toMealType: MealType; requestId: string }): Promise<LogEntry[]> {
    const u = await requireUser();
    const requestId = String(input.requestId).slice(0, 80);
    const prior = await entriesByRequest(u.id, requestId);
    if (prior.length) return prior;
    const source = (await getDay(assertDate(input.fromDate))).entries.filter(e => e.mealType === assertMealType(input.fromMealType));
    if (!source.length) throw new Error('Nothing to copy');
    const toDate = assertDate(input.toDate);
    const toMealType = assertMealType(input.toMealType);
    try {
        const rows = await prisma.$transaction(async tx => {
            const day = await dayContainer(tx, u.id, toDate);
            const created = [];
            for (const [i, e] of source.entries()) {
                created.push(
                    await tx.mealFood.create({
                        data: {
                            mealEntryId: day.id,
                            foodItemId: e.foodId,
                            mealType: toMealType,
                            servings: e.servings,
                            savedMealId: e.savedMealId,
                            requestId: `${requestId}:${i}`,
                            name: e.name,
                            calories: e.calories,
                            protein: e.protein,
                            carbs: e.carbs,
                            fat: e.fat,
                            servingSize: e.servingSize,
                        },
                        include: entryInclude,
                    })
                );
            }
            return created;
        });
        return rows.map(toEntry);
    } catch (e) {
        if (isUniqueViolation(e)) return entriesByRequest(u.id, requestId);
        throw e;
    }
}

// ---------- saved meals ----------

const savedInclude = (userId: string) =>
    ({ items: { orderBy: { position: 'asc' }, include: { foodItem: { include: favInclude(userId) } } } }) as const;

function toSaved(
    m: { id: string; name: string; updatedAt: Date; items: { foodItemId: string; servings: number; foodItem: FoodRow }[] },
    userId: string
): SavedMeal {
    return {
        id: m.id,
        name: m.name,
        updatedAt: m.updatedAt.toISOString(),
        items: m.items.map(i => ({ foodId: i.foodItemId, servings: i.servings, food: toFood(i.foodItem, userId) })),
    };
}

export async function getSavedMeals(): Promise<SavedMeal[]> {
    const u = await requireUser();
    const rows = await prisma.savedMeal.findMany({ where: { userId: u.id }, include: savedInclude(u.id), orderBy: { updatedAt: 'desc' } });
    return rows.map(r => toSaved(r, u.id));
}

export async function saveSavedMeal(input: { id?: string; name: string; items: { foodId: string; servings: number }[] }): Promise<SavedMeal> {
    const u = await requireUser();
    const name = String(input.name ?? '').trim().slice(0, 60);
    if (!name) throw new Error('Give the meal a name');
    if (!input.items?.length) throw new Error('Add at least one food');
    const items = input.items.map((it, position) => ({ foodItemId: String(it.foodId), servings: assertServings(it.servings), position }));
    const row = await prisma.$transaction(async tx => {
        if (input.id) {
            const owned = await tx.savedMeal.findFirst({ where: { id: input.id, userId: u.id } });
            if (!owned) throw new Error('Saved meal not found');
            await tx.savedMealItem.deleteMany({ where: { savedMealId: input.id } });
            return tx.savedMeal.update({ where: { id: input.id }, data: { name, items: { create: items } }, include: savedInclude(u.id) });
        }
        return tx.savedMeal.create({ data: { name, userId: u.id, items: { create: items } }, include: savedInclude(u.id) });
    });
    return toSaved(row, u.id);
}

export async function deleteSavedMeal(id: string): Promise<void> {
    const u = await requireUser();
    // Logged entries keep their snapshot; only the template is removed.
    await prisma.savedMeal.deleteMany({ where: { id, userId: u.id } });
}

export async function logSavedMeal(input: { savedMealId: string; date: DateKey; mealType: MealType; items: { foodId: string; servings: number }[]; requestId: string }): Promise<LogEntry[]> {
    const u = await requireUser();
    const requestId = String(input.requestId).slice(0, 80);
    const prior = await entriesByRequest(u.id, requestId);
    if (prior.length) return prior;
    const date = assertDate(input.date);
    const mealType = assertMealType(input.mealType);
    const meal = await prisma.savedMeal.findFirst({ where: { id: input.savedMealId, userId: u.id } });
    if (!meal) throw new Error('Saved meal not found');
    const items = input.items.filter(i => Number(i.servings) > 0);
    if (!items.length) throw new Error('Nothing to log');
    const foods = await prisma.foodItem.findMany({ where: { id: { in: items.map(i => i.foodId) } } });
    const byId = new Map(foods.map(f => [f.id, f]));
    try {
        const rows = await prisma.$transaction(async tx => {
            const day = await dayContainer(tx, u.id, date);
            const created = [];
            for (const [i, it] of items.entries()) {
                const f = byId.get(it.foodId);
                if (!f) continue;
                created.push(
                    await tx.mealFood.create({
                        data: {
                            mealEntryId: day.id,
                            foodItemId: f.id,
                            mealType,
                            servings: assertServings(it.servings),
                            savedMealId: meal.id,
                            requestId: `${requestId}:${i}`,
                            ...snapshot(f),
                        },
                        include: entryInclude,
                    })
                );
            }
            return created;
        });
        return rows.map(toEntry);
    } catch (e) {
        if (isUniqueViolation(e)) return entriesByRequest(u.id, requestId);
        throw e;
    }
}

// ---------- weight ----------

export async function getWeights(): Promise<WeightEntry[]> {
    const u = await requireUser();
    const rows = await prisma.weightEntry.findMany({ where: { userId: u.id }, orderBy: { date: 'asc' } });
    return rows.map(w => ({ date: storageDateToKey(w.date), weight: w.weight }));
}

export async function logWeight(date: DateKey, kg: number): Promise<WeightEntry> {
    const u = await requireUser();
    const key = assertDate(date);
    const weight = Number(kg);
    if (!Number.isFinite(weight) || weight < 20 || weight > 500) throw new Error('Enter a realistic weight');
    const d = keyToStorageDate(key);
    // Correcting an existing day replaces it (tolerating legacy timestamps).
    await prisma.weightEntry.deleteMany({
        where: { userId: u.id, date: { gte: new Date(d.getTime() - 12 * 3600e3), lt: new Date(d.getTime() + 12 * 3600e3) }, NOT: { date: d } },
    });
    const w = await prisma.weightEntry.upsert({
        where: { userId_date: { userId: u.id, date: d } },
        update: { weight },
        create: { userId: u.id, date: d, weight },
    });
    return { date: storageDateToKey(w.date), weight: w.weight };
}

export async function deleteWeight(date: DateKey): Promise<void> {
    const u = await requireUser();
    const d = keyToStorageDate(assertDate(date));
    await prisma.weightEntry.deleteMany({
        where: { userId: u.id, date: { gte: new Date(d.getTime() - 12 * 3600e3), lt: new Date(d.getTime() + 12 * 3600e3) } },
    });
}
