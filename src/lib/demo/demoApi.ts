import type { DataApi, ItemInput } from '../api';
import { generateDemoState, type DemoState } from './demoData';
import { shiftKey, todayKey, isDateKey } from '../dates';
import { targetsForDate } from '../nutrition';
import { computeTargets, sanitizeTargets } from '../targets';
import { assertServings, sanitizeManualFood } from '../validation';
import { newId } from '../ids';
import type { DateKey, Food, LogEntry, MealType, RecentFood, SavedMeal } from '../types';
import { MEAL_TYPES } from '../types';

/**
 * Demo mode data source. Everything lives in this browser's localStorage under
 * its own key; nothing is sent to the server database, so a visitor's edits can
 * never touch a real account.
 */
export const DEMO_STORAGE_KEY = 'macrotrack-demo-v1';

let state: DemoState | null = null;

function load(): DemoState {
    if (state) return state;
    try {
        const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as DemoState;
            if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
                state = parsed;
                return state;
            }
        }
    } catch {
        /* storage unavailable or corrupt → regenerate */
    }
    state = generateDemoState(todayKey());
    persist();
    return state;
}

function persist() {
    if (!state) return;
    try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* in-memory only (private mode / quota) */
    }
}

export function resetDemo() {
    state = generateDemoState(todayKey());
    persist();
}

export function clearDemo() {
    state = null;
    try {
        window.localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function mt(v: unknown): MealType {
    if (!(MEAL_TYPES as readonly string[]).includes(v as string)) throw new Error('Invalid meal type');
    return v as MealType;
}
function dk(v: unknown): DateKey {
    if (!isDateKey(v)) throw new Error('Invalid date');
    return v;
}

function food(s: DemoState, id: string): Food {
    const f = s.foods.find(x => x.id === id);
    if (!f) throw new Error('Food not found');
    return { ...f, favorite: s.favorites.includes(f.id) };
}

function makeEntry(s: DemoState, date: DateKey, mealType: MealType, f: Food, servings: number, extra: Partial<LogEntry> & { requestId?: string } = {}) {
    const e: LogEntry & { requestId?: string } = {
        id: newId('demo_'),
        date,
        mealType,
        servings,
        foodId: f.id,
        name: f.name,
        servingSize: f.servingSize,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        savedMealId: null,
        createdAt: new Date().toISOString(),
        ...extra,
    };
    s.entries.push(e);
    return e;
}

function strip(e: LogEntry & { requestId?: string }): LogEntry {
    const { requestId: _r, ...rest } = e;
    void _r;
    return clone(rest);
}

function byRequest(s: DemoState, requestId: string) {
    return s.entries.filter(e => e.requestId === requestId || e.requestId?.startsWith(requestId + ':'));
}

function toSaved(s: DemoState, m: DemoState['savedMeals'][number]): SavedMeal {
    return {
        id: m.id,
        name: m.name,
        updatedAt: m.updatedAt,
        items: m.items.filter(i => s.foods.some(f => f.id === i.foodId)).map(i => ({ ...i, food: food(s, i.foodId) })),
    };
}

async function done<T>(fn: () => T): Promise<T> {
    // Async boundary so callers behave the same as with server actions.
    await Promise.resolve();
    const out = fn();
    persist();
    return clone(out);
}

export const demoApi: DataApi = {
    mode: 'demo',

    getProfile: () => done(() => load().profile),

    saveProfile: (input, today) =>
        done(() => {
            const s = load();
            const calc = computeTargets(input);
            const manual = s.profile.targetMode === 'manual';
            s.profile = { ...input, tdee: calc.tdee, targets: manual ? s.profile.targets : calc.targets, targetMode: s.profile.targetMode };
            if (!manual) upsertPeriod(s, dk(today), calc.targets, 'calculated');
            return s.profile;
        }),

    saveTargets: input =>
        done(() => {
            const s = load();
            const targets = input.mode === 'manual' && input.targets ? sanitizeTargets(input.targets) : computeTargets(s.profile).targets;
            s.profile = { ...s.profile, targets, targetMode: input.mode };
            upsertPeriod(s, dk(input.effectiveFrom), targets, input.mode);
            return s.profile;
        }),

    getDay: date =>
        done(() => {
            const s = load();
            const key = dk(date);
            return {
                date: key,
                entries: s.entries.filter(e => e.date === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(strip),
                targets: targetsForDate(s.periods, key, s.profile.targets),
            };
        }),

    getRange: (from, to) =>
        done(() => {
            const s = load();
            const wFrom = shiftKey(dk(from), -6);
            return {
                from,
                to: dk(to),
                entries: s.entries.filter(e => e.date >= from && e.date <= to).map(strip),
                weights: s.weights.filter(w => w.date >= wFrom && w.date <= to).sort((a, b) => a.date.localeCompare(b.date)),
                periods: s.periods,
                fallbackTargets: s.profile.targets,
            };
        }),

    searchFoods: query =>
        done(() => {
            const s = load();
            const q = query.trim().toLowerCase();
            if (q.length < 2) return [];
            return s.foods
                .filter(f => f.name.toLowerCase().includes(q))
                .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
                .slice(0, 30)
                .map(f => ({ ...f, favorite: s.favorites.includes(f.id) }));
        }),

    getRecentFoods: () =>
        done(() => {
            const s = load();
            const seen = new Set<string>();
            const out: RecentFood[] = [];
            for (const e of [...s.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
                if (seen.has(e.foodId) || !s.foods.some(f => f.id === e.foodId)) continue;
                seen.add(e.foodId);
                out.push({ ...food(s, e.foodId), lastServings: e.servings, lastMealType: e.mealType, lastLoggedAt: e.createdAt });
                if (out.length >= 20) break;
            }
            return out;
        }),

    getFavorites: () =>
        done(() => {
            const s = load();
            return s.favorites.filter(id => s.foods.some(f => f.id === id)).map(id => food(s, id));
        }),

    getMyFoods: () =>
        done(() => {
            const s = load();
            return s.foods.filter(f => f.mine).reverse().map(f => ({ ...f, favorite: s.favorites.includes(f.id) }));
        }),

    setFavorite: (foodId, favorite) =>
        done(() => {
            const s = load();
            s.favorites = s.favorites.filter(id => id !== foodId);
            if (favorite) s.favorites.unshift(foodId);
        }),

    createFood: input =>
        done(() => {
            const s = load();
            const f: Food = { ...sanitizeManualFood(input), id: newId('my_'), source: 'user_manual', mine: true };
            s.foods.push(f);
            return f;
        }),

    logFood: input =>
        done(() => {
            const s = load();
            const prior = byRequest(s, input.requestId);
            if (prior.length) return strip(prior[0]);
            return strip(makeEntry(s, dk(input.date), mt(input.mealType), food(s, input.foodId), assertServings(input.servings), { requestId: input.requestId }));
        }),

    logManual: input =>
        done(() => {
            const s = load();
            const prior = byRequest(s, input.requestId);
            if (prior.length) return strip(prior[0]);
            const f: Food = { ...sanitizeManualFood(input.food), id: newId('my_'), source: 'user_manual', mine: true };
            s.foods.push(f);
            return strip(makeEntry(s, dk(input.date), mt(input.mealType), f, assertServings(input.servings), { requestId: input.requestId }));
        }),

    updateEntry: (id, patch) =>
        done(() => {
            const e = load().entries.find(x => x.id === id);
            if (!e) throw new Error('Entry not found');
            if (patch.servings != null) e.servings = assertServings(patch.servings);
            if (patch.mealType != null) e.mealType = mt(patch.mealType);
            return strip(e);
        }),

    deleteEntry: id =>
        done(() => {
            const s = load();
            const e = s.entries.find(x => x.id === id);
            if (!e) throw new Error('Entry not found');
            s.entries = s.entries.filter(x => x.id !== id);
            return strip(e);
        }),

    restoreEntry: entry =>
        done(() => {
            const s = load();
            const e = { ...clone(entry), id: newId('demo_') };
            s.entries.push(e);
            return strip(e);
        }),

    copyMeal: input =>
        done(() => {
            const s = load();
            const prior = byRequest(s, input.requestId);
            if (prior.length) return prior.map(strip);
            const source = s.entries.filter(e => e.date === input.fromDate && e.mealType === input.fromMealType);
            if (!source.length) throw new Error('Nothing to copy');
            const to = dk(input.toDate);
            const toType = mt(input.toMealType);
            return source.map((e, i) =>
                strip(
                    (() => {
                        const c = { ...clone(e), id: newId('demo_'), date: to, mealType: toType, createdAt: new Date().toISOString(), requestId: `${input.requestId}:${i}` };
                        s.entries.push(c);
                        return c;
                    })()
                )
            );
        }),

    getSavedMeals: () =>
        done(() => {
            const s = load();
            return [...s.savedMeals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(m => toSaved(s, m));
        }),

    saveSavedMeal: input =>
        done(() => {
            const s = load();
            const name = input.name.trim().slice(0, 60);
            if (!name) throw new Error('Give the meal a name');
            if (!input.items.length) throw new Error('Add at least one food');
            const items = input.items.map((i: ItemInput) => ({ foodId: food(s, i.foodId).id, servings: assertServings(i.servings) }));
            const updatedAt = new Date().toISOString();
            let m = input.id ? s.savedMeals.find(x => x.id === input.id) : undefined;
            if (input.id && !m) throw new Error('Saved meal not found');
            if (m) Object.assign(m, { name, items, updatedAt });
            else {
                m = { id: newId('demo_sm_'), name, items, updatedAt };
                s.savedMeals.push(m);
            }
            return toSaved(s, m);
        }),

    deleteSavedMeal: id =>
        done(() => {
            const s = load();
            s.savedMeals = s.savedMeals.filter(m => m.id !== id);
        }),

    logSavedMeal: input =>
        done(() => {
            const s = load();
            const prior = byRequest(s, input.requestId);
            if (prior.length) return prior.map(strip);
            if (!s.savedMeals.some(m => m.id === input.savedMealId)) throw new Error('Saved meal not found');
            const date = dk(input.date);
            const mealType = mt(input.mealType);
            const items = input.items.filter(i => i.servings > 0);
            if (!items.length) throw new Error('Nothing to log');
            return items.map((it, i) =>
                strip(makeEntry(s, date, mealType, food(s, it.foodId), assertServings(it.servings), { savedMealId: input.savedMealId, requestId: `${input.requestId}:${i}` }))
            );
        }),

    getWeights: () => done(() => [...load().weights].sort((a, b) => a.date.localeCompare(b.date))),

    logWeight: (date, kg) =>
        done(() => {
            const s = load();
            const key = dk(date);
            if (!Number.isFinite(kg) || kg < 20 || kg > 500) throw new Error('Enter a realistic weight');
            s.weights = s.weights.filter(w => w.date !== key);
            const w = { date: key, weight: kg };
            s.weights.push(w);
            return w;
        }),

    deleteWeight: date =>
        done(() => {
            const s = load();
            s.weights = s.weights.filter(w => w.date !== date);
        }),
};

function upsertPeriod(s: DemoState, from: DateKey, t: { calories: number; protein: number; carbs: number; fat: number }, mode: 'calculated' | 'manual') {
    s.periods = s.periods.filter(p => p.effectiveFrom !== from);
    s.periods.push({ effectiveFrom: from, mode, ...t });
    s.periods.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}
