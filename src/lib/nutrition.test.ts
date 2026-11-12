import { addToTotals, calorieStatus, emptyTotals, groupByMeal, macroCalories, parseMeasuredServing, round, scaleNutrition, sumEntries, targetsForDate } from './nutrition';
import { parseDecimal, parseManualFood, validateServings } from './validation';
import { keyToStorageDate, shiftKey, storageDateToKey, keysBetween, todayKey } from './dates';
import type { GoalPeriod, LogEntry } from './types';

const entry = (over: Partial<LogEntry>): LogEntry => ({
    id: 'e',
    date: '2026-11-12',
    mealType: 'Lunch',
    servings: 1,
    foodId: 'f',
    name: 'Food',
    servingSize: '100g',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    savedMealId: null,
    createdAt: '2026-11-12T12:00:00Z',
    ...over,
});

describe('portion math', () => {
    it('scales decimal servings without float noise', () => {
        const n = scaleNutrition({ calories: 206, protein: 22.1, carbs: 0, fat: 12.3 }, 1.5);
        expect(round(n.calories, 1)).toBe(309);
        expect(round(n.protein!, 2)).toBe(33.15);
        expect(round(0.1 + 0.2, 2)).toBe(0.3);
    });

    it('keeps unknown macros unknown when scaling', () => {
        const n = scaleNutrition({ calories: 350, protein: 4.5, carbs: null, fat: null }, 0.5);
        expect(n).toEqual({ calories: 175, protein: 2.25, carbs: null, fat: null });
    });

    it('converts measured servings (grams) to servings', () => {
        expect(parseMeasuredServing('100g')).toEqual({ amount: 100, unit: 'g' });
        expect(parseMeasuredServing('250 ml')).toEqual({ amount: 250, unit: 'ml' });
        expect(parseMeasuredServing('1 medium (182g)')).toBeNull();
    });
});

describe('totals', () => {
    it('sums servings × per-serving values', () => {
        const t = sumEntries([entry({ servings: 0.5, calories: 379, protein: 13.2 }), entry({ servings: 1.5, calories: 165, protein: 31 })]);
        expect(t.calories).toBeCloseTo(437, 6);
        expect(t.protein).toBeCloseTo(53.1, 6);
        expect(t.count).toBe(2);
    });

    it('excludes unknown macros from sums and counts them', () => {
        const t = sumEntries([entry({ carbs: null, fat: null }), entry({})]);
        expect(t.carbs).toBe(10);
        expect(t.unknown).toEqual({ protein: 0, carbs: 1, fat: 1 });
    });

    it('treats a zero macro as known', () => {
        const t = addToTotals(emptyTotals(), { calories: 165, protein: 31, carbs: 0, fat: 3.6 });
        expect(t.unknown.carbs).toBe(0);
    });

    it('groups by meal in fixed order', () => {
        const g = groupByMeal([entry({ id: 'a', mealType: 'Dinner' }), entry({ id: 'b', mealType: 'Breakfast' })]);
        expect(Object.keys(g)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
        expect(g.Dinner.map(e => e.id)).toEqual(['a']);
    });
});

describe('calorie status wording', () => {
    it('reports remaining', () => expect(calorieStatus(1500, 2000)).toMatchObject({ remaining: 500, over: 0, label: '500 kcal left' }));
    it('reports overage neutrally', () => expect(calorieStatus(2320.4, 2000)).toMatchObject({ remaining: 0, over: 320, label: '320 kcal over target' }));
});

describe('goal periods', () => {
    const periods: GoalPeriod[] = [
        { effectiveFrom: '1970-01-01', calories: 2200, protein: 160, carbs: 250, fat: 60, mode: 'calculated' },
        { effectiveFrom: '2026-11-01', calories: 2000, protein: 170, carbs: 200, fat: 60, mode: 'manual' },
    ];
    const fallback = { calories: 1, protein: 1, carbs: 1, fat: 1 };
    it('uses the target in effect on that day', () => {
        expect(targetsForDate(periods, '2026-10-31', fallback).calories).toBe(2200);
        expect(targetsForDate(periods, '2026-11-01', fallback).calories).toBe(2000);
        expect(targetsForDate(periods, '2026-12-25', fallback).calories).toBe(2000);
    });
    it('falls back when no period exists', () => expect(targetsForDate([], '2026-11-01', fallback)).toBe(fallback));
    it('computes macro calories', () => expect(macroCalories({ protein: 100, carbs: 200, fat: 50 })).toBe(1650));
});

describe('validation', () => {
    it('parses decimals including commas', () => {
        expect(parseDecimal('1.5')).toBe(1.5);
        expect(parseDecimal('0,5')).toBe(0.5);
        expect(parseDecimal('.25')).toBe(0.25);
        expect(parseDecimal('')).toBeNull();
        expect(parseDecimal('1.2.3')).toBeNull();
        expect(parseDecimal('abc')).toBeNull();
    });
    it('validates servings', () => {
        expect(validateServings(null)).toBeTruthy();
        expect(validateServings(0)).toBeTruthy();
        expect(validateServings(0.25)).toBeNull();
        expect(validateServings(101)).toBeTruthy();
    });
    it('turns blank macros into unknown (null), not zero', () => {
        const { value } = parseManualFood({ name: ' Cake ', calories: '350', protein: '4.5', carbs: '', fat: ' ', servingSize: '' });
        expect(value).toEqual({ name: 'Cake', calories: 350, protein: 4.5, carbs: null, fat: null, servingSize: '1 serving' });
    });
    it('reports field errors', () => {
        const { value, errors } = parseManualFood({ name: '', calories: '', protein: '-1', carbs: 'x', fat: '', servingSize: '' });
        expect(value).toBeNull();
        expect(Object.keys(errors).sort()).toEqual(['calories', 'carbs', 'name', 'protein']);
    });
});

describe('local dates', () => {
    it('stores a calendar day as UTC midnight and reads it back', () => {
        expect(keyToStorageDate('2026-03-08').toISOString()).toBe('2026-03-08T00:00:00.000Z');
        expect(storageDateToKey(keyToStorageDate('2026-03-08'))).toBe('2026-03-08');
    });
    it('maps legacy server-local midnights to the intended day', () => {
        // Old rows: US Pacific midnight (08:00Z) and India midnight (18:30Z the previous UTC day).
        expect(storageDateToKey(new Date('2026-11-11T08:00:00Z'))).toBe('2026-11-11');
        expect(storageDateToKey(new Date('2026-11-10T18:30:00Z'))).toBe('2026-11-11');
    });
    it('shifts across month and DST boundaries', () => {
        expect(shiftKey('2026-03-08', 1)).toBe('2026-03-09');
        expect(shiftKey('2026-11-01', -1)).toBe('2026-10-31');
        expect(keysBetween('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    });
    it('uses local calendar date for today', () => {
        expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });
});
