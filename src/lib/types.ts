// Shared domain types used by both the live (Prisma) and demo (local) data sources.
// All calendar days are `DateKey` strings ("yyyy-MM-dd") in the user's local time.

export type DateKey = string;

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type GoalType = 'lose' | 'maintain' | 'gain';
export type GenderType = 'male' | 'female';
export type TargetMode = 'calculated' | 'manual';

/** Per-serving nutrition. Macros are `null` when unknown (not the same as 0). */
export interface Nutrition {
    calories: number;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
}

export interface Food extends Nutrition {
    id: string;
    name: string;
    servingSize: string;
    source: 'seed' | 'user_manual' | 'ai' | string;
    mine: boolean; // created by this user
    favorite?: boolean;
}

export interface RecentFood extends Food {
    lastServings: number;
    lastMealType: MealType;
    lastLoggedAt: string; // ISO
}

/** A logged item. Nutrition is the per-serving snapshot taken at log time. */
export interface LogEntry extends Nutrition {
    id: string;
    date: DateKey;
    mealType: MealType;
    servings: number;
    foodId: string;
    name: string;
    servingSize: string;
    savedMealId: string | null;
    createdAt: string; // ISO
}

export interface Targets {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface GoalPeriod extends Targets {
    effectiveFrom: DateKey;
    mode: TargetMode;
}

export interface Profile {
    name: string;
    age: number;
    gender: GenderType;
    height: number; // cm
    weight: number; // kg
    activityLevel: number;
    goalType: GoalType;
    goalRate: number; // kg/week
    goalWeight: number; // kg
    tdee: number;
    targets: Targets;
    targetMode: TargetMode;
}

export type ProfileInput = Omit<Profile, 'tdee' | 'targets' | 'targetMode'>;

export interface WeightEntry {
    date: DateKey;
    weight: number; // kg
}

export interface SavedMealItem {
    foodId: string;
    servings: number;
    food: Food;
}

export interface SavedMeal {
    id: string;
    name: string;
    items: SavedMealItem[];
    updatedAt: string;
}

export interface DayLog {
    date: DateKey;
    entries: LogEntry[];
    targets: Targets;
}

export interface RangeData {
    from: DateKey;
    to: DateKey;
    entries: LogEntry[];
    periods: GoalPeriod[];
    weights: WeightEntry[];
    fallbackTargets: Targets;
}

export interface ManualFoodInput {
    name: string;
    calories: number;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    servingSize: string;
}
