import type { ManualFoodInput } from './types';

export const MAX_SERVINGS = 100;

/**
 * Parse a user-typed decimal. Accepts "1.5", "1,5", ".5" and surrounding spaces.
 * Returns null for empty or non-numeric input.
 */
export function parseDecimal(raw: string | number | null | undefined): number | null {
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const s = raw.trim().replace(',', '.');
    if (s === '') return null;
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

export function validateServings(value: number | null): string | null {
    if (value == null) return 'Enter an amount';
    if (value <= 0) return 'Amount must be more than 0';
    if (value > MAX_SERVINGS) return `Max ${MAX_SERVINGS} servings`;
    return null;
}

export type ManualFoodErrors = Partial<Record<keyof ManualFoodInput, string>>;

/** Validate raw manual-entry fields. Blank macros are allowed and become null (unknown). */
export function parseManualFood(raw: {
    name: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    servingSize: string;
}): { value: ManualFoodInput | null; errors: ManualFoodErrors } {
    const errors: ManualFoodErrors = {};
    const name = raw.name.trim();
    if (!name) errors.name = 'Name is required';
    else if (name.length > 100) errors.name = 'Keep it under 100 characters';

    const calories = parseDecimal(raw.calories);
    if (calories == null) errors.calories = 'Calories are required';
    else if (calories < 0) errors.calories = 'Cannot be negative';
    else if (calories > 10000) errors.calories = 'That looks too high';

    const macro = (key: 'protein' | 'carbs' | 'fat') => {
        if (raw[key].trim() === '') return null;
        const v = parseDecimal(raw[key]);
        if (v == null) errors[key] = 'Enter a number or leave blank';
        else if (v < 0) errors[key] = 'Cannot be negative';
        else if (v > 1000) errors[key] = 'That looks too high';
        return v;
    };
    const protein = macro('protein');
    const carbs = macro('carbs');
    const fat = macro('fat');

    const servingSize = raw.servingSize.trim().slice(0, 50) || '1 serving';

    if (Object.keys(errors).length) return { value: null, errors };
    return { value: { name, calories: calories!, protein, carbs, fat, servingSize }, errors };
}

/** Server-side guard: coerce untrusted nutrition input. Throws on invalid values. */
export function sanitizeManualFood(input: ManualFoodInput): ManualFoodInput {
    const num = (v: unknown, max: number, nullable: boolean) => {
        if (v == null && nullable) return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > max) throw new Error('Invalid nutrition value');
        return n;
    };
    const name = String(input.name ?? '').trim().slice(0, 100);
    if (!name) throw new Error('Name is required');
    return {
        name,
        calories: num(input.calories, 10000, false) as number,
        protein: num(input.protein, 1000, true),
        carbs: num(input.carbs, 1000, true),
        fat: num(input.fat, 1000, true),
        servingSize: String(input.servingSize ?? '1 serving').trim().slice(0, 50) || '1 serving',
    };
}

export function assertServings(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_SERVINGS) throw new Error('Invalid servings');
    return n;
}
