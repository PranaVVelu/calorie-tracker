// Minimal browser globals for the demo store.
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
    localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    },
};

import { demoApi, resetDemo, DEMO_STORAGE_KEY } from './demoApi';
import { generateDemoState, DEMO_DAYS } from './demoData';
import { todayKey, shiftKey } from '../dates';
import { sumEntries } from '../nutrition';

beforeEach(() => {
    store.clear();
    resetDemo();
});

describe('demo data', () => {
    it('generates several weeks of labelled sample data with gaps', () => {
        const s = generateDemoState('2026-11-12');
        expect(s.profile.name).toMatch(/sample/i);
        const days = new Set(s.entries.map(e => e.date));
        expect(days.size).toBeGreaterThan(30);
        expect(days.size).toBeLessThan(DEMO_DAYS + 1); // some days intentionally unlogged
        expect(s.weights.length).toBeGreaterThan(20);
        expect(s.savedMeals.length).toBeGreaterThanOrEqual(3);
        expect(s.entries.some(e => e.protein == null)).toBe(true); // shows unknown macros
    });
    it('is deterministic for a given day', () => {
        expect(generateDemoState('2026-11-12').entries.length).toBe(generateDemoState('2026-11-12').entries.length);
    });
});

describe('demoApi', () => {
    it('persists only to its own localStorage key', async () => {
        await demoApi.getProfile();
        expect([...store.keys()]).toEqual([DEMO_STORAGE_KEY]);
    });

    it('logs, edits, and deletes with totals staying consistent', async () => {
        const today = todayKey();
        const before = sumEntries((await demoApi.getDay(today)).entries).calories;
        const e = await demoApi.logFood({ date: today, mealType: 'Dinner', foodId: 'cat_salmon', servings: 1.5, requestId: 'r1' });
        expect(sumEntries((await demoApi.getDay(today)).entries).calories).toBeCloseTo(before + 309, 6);
        await demoApi.updateEntry(e.id, { servings: 2 });
        expect(sumEntries((await demoApi.getDay(today)).entries).calories).toBeCloseTo(before + 412, 6);
        const removed = await demoApi.deleteEntry(e.id);
        expect(sumEntries((await demoApi.getDay(today)).entries).calories).toBeCloseTo(before, 6);
        await demoApi.restoreEntry(removed);
        expect(sumEntries((await demoApi.getDay(today)).entries).calories).toBeCloseTo(before + 412, 6);
    });

    it('ignores duplicate submissions with the same request id', async () => {
        const today = todayKey();
        const n = (await demoApi.getDay(today)).entries.length;
        const a = await demoApi.logFood({ date: today, mealType: 'Snack', foodId: 'cat_apple', servings: 1, requestId: 'dup' });
        const b = await demoApi.logFood({ date: today, mealType: 'Snack', foodId: 'cat_apple', servings: 1, requestId: 'dup' });
        expect(a.id).toBe(b.id);
        expect((await demoApi.getDay(today)).entries.length).toBe(n + 1);

        const meals = await demoApi.getSavedMeals();
        const items = meals[0].items.map(i => ({ foodId: i.foodId, servings: i.servings }));
        await demoApi.logSavedMeal({ savedMealId: meals[0].id, date: today, mealType: 'Dinner', items, requestId: 'sm' });
        await demoApi.logSavedMeal({ savedMealId: meals[0].id, date: today, mealType: 'Dinner', items, requestId: 'sm' });
        expect((await demoApi.getDay(today)).entries.length).toBe(n + 1 + items.length);
    });

    it('keeps history intact when a saved meal is edited afterwards', async () => {
        const today = todayKey();
        const [meal] = await demoApi.getSavedMeals();
        const items = meal.items.map(i => ({ foodId: i.foodId, servings: i.servings * 2 })); // adjusted portions
        const logged = await demoApi.logSavedMeal({ savedMealId: meal.id, date: today, mealType: 'Lunch', items, requestId: 'x' });
        const kcal = sumEntries(logged).calories;
        await demoApi.saveSavedMeal({ id: meal.id, name: 'Renamed', items: [{ foodId: 'cat_apple', servings: 1 }] });
        const after = (await demoApi.getDay(today)).entries.filter(e => logged.some(l => l.id === e.id));
        expect(sumEntries(after).calories).toBeCloseTo(kcal, 6);
        await demoApi.deleteSavedMeal(meal.id);
        expect((await demoApi.getDay(today)).entries.filter(e => logged.some(l => l.id === e.id))).toHaveLength(items.length);
    });

    it('copies a meal to another day and meal type', async () => {
        const today = todayKey();
        const tomorrow = shiftKey(today, 1);
        const src = (await demoApi.getDay(today)).entries.filter(e => e.mealType === 'Breakfast');
        const copied = await demoApi.copyMeal({ fromDate: today, fromMealType: 'Breakfast', toDate: tomorrow, toMealType: 'Lunch', requestId: 'c' });
        expect(copied).toHaveLength(src.length);
        const t = (await demoApi.getDay(tomorrow)).entries;
        expect(t.every(e => e.mealType === 'Lunch')).toBe(true);
        expect(sumEntries(t).calories).toBeCloseTo(sumEntries(src).calories, 6);
    });

    it('applies new targets from the effective date only', async () => {
        const today = todayKey();
        const yesterday = shiftKey(today, -1);
        const before = (await demoApi.getDay(yesterday)).targets.calories;
        await demoApi.saveTargets({ mode: 'manual', targets: { calories: 1900, protein: 170, carbs: 180, fat: 60 }, effectiveFrom: today });
        expect((await demoApi.getDay(today)).targets.calories).toBe(1900);
        expect((await demoApi.getDay(yesterday)).targets.calories).toBe(before);
    });

    it('upserts one weigh-in per day and validates input', async () => {
        const today = todayKey();
        await demoApi.logWeight(today, 80.25);
        await demoApi.logWeight(today, 80.5);
        expect((await demoApi.getWeights()).filter(w => w.date === today)).toEqual([{ date: today, weight: 80.5 }]);
        await expect(demoApi.logWeight(today, 5)).rejects.toThrow();
        await demoApi.deleteWeight(today);
        expect((await demoApi.getWeights()).some(w => w.date === today)).toBe(false);
    });

    it('rejects invalid servings', async () => {
        await expect(demoApi.logFood({ date: todayKey(), mealType: 'Lunch', foodId: 'cat_apple', servings: 0, requestId: 'bad' })).rejects.toThrow();
    });
});
