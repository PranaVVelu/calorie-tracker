import type { GoalPeriod, LogEntry, MealType, Nutrition, Targets, DateKey } from './types';
import { MEAL_TYPES } from './types';

export type MacroKey = 'protein' | 'carbs' | 'fat';
export const MACROS: MacroKey[] = ['protein', 'carbs', 'fat'];

export interface Totals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Number of items whose value for that macro is unknown (excluded from the sum). */
    unknown: Record<MacroKey, number>;
    count: number;
}

export function emptyTotals(): Totals {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, unknown: { protein: 0, carbs: 0, fat: 0 }, count: 0 };
}

/** Round to a fixed number of decimals without float noise (e.g. 0.1+0.2). */
export function round(value: number, decimals = 1): number {
    const f = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * f) / f;
}

/** Nutrition for a quantity of servings. Unknown macros stay unknown. */
export function scaleNutrition(n: Nutrition, servings: number): Nutrition {
    return {
        calories: n.calories * servings,
        protein: n.protein == null ? null : n.protein * servings,
        carbs: n.carbs == null ? null : n.carbs * servings,
        fat: n.fat == null ? null : n.fat * servings,
    };
}

export function addToTotals(t: Totals, n: Nutrition, servings = 1): Totals {
    const s = scaleNutrition(n, servings);
    const next: Totals = { ...t, unknown: { ...t.unknown }, count: t.count + 1 };
    next.calories += s.calories;
    for (const m of MACROS) {
        const v = s[m];
        if (v == null) next.unknown[m] += 1;
        else next[m] += v;
    }
    return next;
}

export function sumEntries(entries: Pick<LogEntry, keyof Nutrition | 'servings'>[]): Totals {
    return entries.reduce((t, e) => addToTotals(t, e, e.servings), emptyTotals());
}

export function groupByMeal<T extends { mealType: MealType }>(entries: T[]): Record<MealType, T[]> {
    const out = Object.fromEntries(MEAL_TYPES.map(m => [m, [] as T[]])) as unknown as Record<MealType, T[]>;
    for (const e of entries) (out[e.mealType] ?? out.Snack).push(e);
    return out;
}

/** Remaining vs target, with neutral wording for overages. */
export function calorieStatus(consumed: number, target: number) {
    const diff = Math.round(target - consumed);
    if (diff >= 0) return { remaining: diff, over: 0, label: `${diff.toLocaleString()} kcal left` };
    return { remaining: 0, over: -diff, label: `${(-diff).toLocaleString()} kcal over target` };
}

/** Targets in effect on a given day (latest period starting on/before it). */
export function targetsForDate(periods: GoalPeriod[], date: DateKey, fallback: Targets): Targets {
    let best: GoalPeriod | null = null;
    for (const p of periods) {
        if (p.effectiveFrom <= date && (!best || p.effectiveFrom > best.effectiveFrom)) best = p;
    }
    return best ? { calories: best.calories, protein: best.protein, carbs: best.carbs, fat: best.fat } : fallback;
}

/** Calories implied by macro grams (4/4/9). */
export function macroCalories(t: Pick<Targets, 'protein' | 'carbs' | 'fat'>): number {
    return t.protein * 4 + t.carbs * 4 + t.fat * 9;
}

/** If a serving size is a plain weight/volume ("100g", "250 ml"), return amount + unit. */
export function parseMeasuredServing(servingSize: string): { amount: number; unit: 'g' | 'ml' } | null {
    const m = /^\s*(\d+(?:\.\d+)?)\s*(g|ml)\s*$/i.exec(servingSize);
    if (!m) return null;
    const amount = Number(m[1]);
    if (!(amount > 0)) return null;
    return { amount, unit: m[2].toLowerCase() as 'g' | 'ml' };
}

export function formatServings(servings: number): string {
    return `${round(servings, 2)}×`;
}
