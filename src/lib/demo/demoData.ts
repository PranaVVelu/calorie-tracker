import { FOOD_CATALOG } from '../foodCatalog';
import { shiftKey } from '../dates';
import { computeTargets } from '../targets';
import { round } from '../nutrition';
import type { DateKey, Food, GoalPeriod, LogEntry, MealType, Profile, WeightEntry } from '../types';

export interface DemoSavedMeal {
    id: string;
    name: string;
    items: { foodId: string; servings: number }[];
    updatedAt: string;
}

export interface DemoState {
    version: 1;
    generatedFor: DateKey;
    profile: Profile;
    periods: GoalPeriod[];
    foods: Food[];
    favorites: string[];
    entries: (LogEntry & { requestId?: string })[];
    savedMeals: DemoSavedMeal[];
    weights: WeightEntry[];
}

export const DEMO_DAYS = 45;

function mulberry32(seed: number) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const fid = (key: string) => `cat_${key}`;

type Template = [string, number][];

const BREAKFASTS: Template[] = [
    [['oats', 0.5], ['blueberries', 1], ['greek-yogurt', 1.5], ['honey', 1]],
    [['egg', 2], ['wholewheat-bread', 2], ['avocado', 0.5], ['coffee-latte', 1]],
    [['greek-yogurt', 2], ['granola', 0.4], ['strawberries', 1]],
    [['bagel', 1], ['cottage-cheese', 1], ['orange-juice', 1]],
];
const LUNCHES: Template[] = [
    [['chicken-breast', 1.5], ['brown-rice', 1.5], ['broccoli', 1], ['olive-oil', 0.1]],
    [['caesar-salad', 1], ['sourdough', 1]],
    [['burrito', 1]],
    [['tuna', 1], ['mixed-greens', 1], ['quinoa', 1.5], ['feta', 1], ['hummus', 1]],
    [['poke-bowl', 1]],
];
const DINNERS: Template[] = [
    [['salmon', 1.5], ['sweet-potato', 2], ['green-beans', 1.5], ['butter', 0.5]],
    [['steak', 1.5], ['potato', 2], ['mixed-greens', 1], ['olive-oil', 0.1]],
    [['pasta', 2], ['ground-beef', 1], ['tomato', 1], ['mozzarella', 1]],
    [['tofu', 1.5], ['white-rice', 1.5], ['bell-pepper', 1], ['soy-sauce', 1], ['edamame', 0.5]],
    [['pad-thai', 1]],
    [['pizza', 2], ['beer', 1]],
];
const SNACKS: Template[] = [
    [['protein-bar', 1]],
    [['apple', 1], ['almonds', 0.2]],
    [['whey', 1], ['banana', 1], ['almond-milk', 1]],
    [['dark-chocolate', 1]],
    [['greek-yogurt', 1.5], ['blueberries', 0.75]],
];

const PROFILE_BASE = {
    name: 'Alex (sample)',
    age: 32,
    gender: 'male' as const,
    height: 178,
    activityLevel: 1.55,
    goalType: 'lose' as const,
    goalRate: 0.5,
    goalWeight: 78,
};

/** Builds a fresh, deterministic sample dataset ending on `today`. */
export function generateDemoState(today: DateKey): DemoState {
    const rand = mulberry32(20261112);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

    const foods: Food[] = FOOD_CATALOG.map(f => ({
        id: fid(f.key),
        name: f.name,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        servingSize: f.servingSize,
        source: 'seed',
        mine: false,
    }));
    const pastry: Food = {
        id: 'my_cafe-pastry',
        name: 'Café almond croissant (estimate)',
        calories: 420,
        protein: null,
        carbs: null,
        fat: null,
        servingSize: '1 pastry',
        source: 'user_manual',
        mine: true,
    };
    const shake: Food = {
        id: 'my_gym-smoothie',
        name: 'Gym bar smoothie',
        calories: 310,
        protein: 25,
        carbs: 42,
        fat: null,
        servingSize: '16 fl oz',
        source: 'user_manual',
        mine: true,
    };
    foods.push(pastry, shake);
    const byId = new Map(foods.map(f => [f.id, f]));

    // Weight trend: ~0.45 kg/week down with day-to-day noise.
    const startWeight = 84.2;
    const weights: WeightEntry[] = [];
    for (let i = DEMO_DAYS; i >= 0; i--) {
        if (i !== 0 && rand() < 0.3) continue; // skipped weigh-ins
        const trend = startWeight - ((DEMO_DAYS - i) * 0.45) / 7;
        const noise = (rand() - 0.5) * 0.8;
        weights.push({ date: shiftKey(today, -i), weight: round(trend + noise, 1) });
    }
    const currentWeight = weights[weights.length - 1].weight;

    // Goal history: recalculated three weeks ago after some weight came off.
    const p1 = computeTargets({ ...PROFILE_BASE, weight: startWeight }).targets;
    const p2From = shiftKey(today, -21);
    const p2 = computeTargets({ ...PROFILE_BASE, weight: weights.find(w => w.date >= p2From)?.weight ?? currentWeight }).targets;
    const periods: GoalPeriod[] = [
        { effectiveFrom: '1970-01-01', mode: 'calculated', ...p1 },
        { effectiveFrom: p2From, mode: 'calculated', ...p2 },
    ];
    const calc = computeTargets({ ...PROFILE_BASE, weight: currentWeight });
    const profile: Profile = {
        ...PROFILE_BASE,
        weight: currentWeight,
        tdee: calc.tdee,
        targets: p2,
        targetMode: 'calculated',
    };

    const entries: DemoState['entries'] = [];
    let seq = 0;
    const add = (date: DateKey, mealType: MealType, foodId: string, servings: number, savedMealId: string | null = null) => {
        const f = byId.get(foodId);
        if (!f) return;
        const hour = { Breakfast: 8, Lunch: 12, Dinner: 19, Snack: 16 }[mealType];
        entries.push({
            id: `demo_e${++seq}`,
            date,
            mealType,
            servings,
            foodId,
            name: f.name,
            servingSize: f.servingSize,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
            savedMealId,
            createdAt: new Date(`${date}T${String(hour).padStart(2, '0')}:${String(seq % 60).padStart(2, '0')}:00`).toISOString(),
        });
    };
    const addTemplate = (date: DateKey, mealType: MealType, t: Template) => t.forEach(([k, s]) => add(date, mealType, fid(k), s));

    for (let i = DEMO_DAYS; i >= 1; i--) {
        const date = shiftKey(today, -i);
        if (rand() < 0.14) continue; // unlogged day (missing data)
        addTemplate(date, 'Breakfast', pick(BREAKFASTS));
        addTemplate(date, 'Lunch', pick(LUNCHES));
        if (rand() < 0.92) addTemplate(date, 'Dinner', pick(DINNERS));
        if (rand() < 0.75) addTemplate(date, 'Snack', pick(SNACKS));
        if (rand() < 0.2) add(date, 'Snack', pick([pastry.id, shake.id]), 1);
    }
    // Today: in progress.
    addTemplate(today, 'Breakfast', BREAKFASTS[0]);
    addTemplate(today, 'Lunch', LUNCHES[0]);
    add(today, 'Snack', pastry.id, 1);

    const savedMeals: DemoSavedMeal[] = [
        { id: 'demo_sm1', name: 'Usual breakfast', items: BREAKFASTS[0].map(([k, s]) => ({ foodId: fid(k), servings: s })), updatedAt: new Date().toISOString() },
        { id: 'demo_sm2', name: 'Chicken rice bowl', items: LUNCHES[0].map(([k, s]) => ({ foodId: fid(k), servings: s })), updatedAt: new Date().toISOString() },
        { id: 'demo_sm3', name: 'Post-workout shake', items: SNACKS[2].map(([k, s]) => ({ foodId: fid(k), servings: s })), updatedAt: new Date().toISOString() },
    ];

    return {
        version: 1,
        generatedFor: today,
        profile,
        periods,
        foods,
        favorites: [fid('greek-yogurt'), fid('chicken-breast'), fid('banana'), fid('whey'), fid('egg')],
        entries,
        savedMeals,
        weights,
    };
}
