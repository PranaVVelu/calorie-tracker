import type {
    DateKey,
    DayLog,
    Food,
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
} from './types';

export interface ItemInput {
    foodId: string;
    servings: number;
}

/**
 * The single data contract the UI talks to. Implemented by:
 *  - liveApi  → Next.js server actions backed by Prisma/Postgres
 *  - demoApi  → an isolated in-browser store (never touches the server DB)
 * Both return identical shapes so every screen behaves the same in demo mode.
 */
export interface DataApi {
    mode: 'live' | 'demo';

    getProfile(): Promise<Profile | null>;
    /** `today` is the user's local date; recalculated targets apply from it. */
    saveProfile(input: ProfileInput, today: DateKey): Promise<Profile>;
    /** mode 'calculated' recomputes from profile; 'manual' stores `targets`. Applies from `effectiveFrom`. */
    saveTargets(input: { mode: TargetMode; targets?: Targets; effectiveFrom: DateKey }): Promise<Profile>;

    getDay(date: DateKey): Promise<DayLog>;
    getRange(from: DateKey, to: DateKey): Promise<RangeData>;

    searchFoods(query: string): Promise<Food[]>;
    getRecentFoods(): Promise<RecentFood[]>;
    getFavorites(): Promise<Food[]>;
    getMyFoods(): Promise<Food[]>;
    setFavorite(foodId: string, favorite: boolean): Promise<void>;
    createFood(input: ManualFoodInput): Promise<Food>;

    logFood(input: { date: DateKey; mealType: MealType; foodId: string; servings: number; requestId: string }): Promise<LogEntry>;
    logManual(input: { date: DateKey; mealType: MealType; food: ManualFoodInput; servings: number; requestId: string }): Promise<LogEntry>;
    updateEntry(id: string, patch: { servings?: number; mealType?: MealType }): Promise<LogEntry>;
    deleteEntry(id: string): Promise<LogEntry>;
    restoreEntry(entry: LogEntry): Promise<LogEntry>;
    copyMeal(input: { fromDate: DateKey; fromMealType: MealType; toDate: DateKey; toMealType: MealType; requestId: string }): Promise<LogEntry[]>;

    getSavedMeals(): Promise<SavedMeal[]>;
    saveSavedMeal(input: { id?: string; name: string; items: ItemInput[] }): Promise<SavedMeal>;
    deleteSavedMeal(id: string): Promise<void>;
    logSavedMeal(input: { savedMealId: string; date: DateKey; mealType: MealType; items: ItemInput[]; requestId: string }): Promise<LogEntry[]>;

    getWeights(): Promise<WeightEntry[]>;
    logWeight(date: DateKey, kg: number): Promise<WeightEntry>;
    deleteWeight(date: DateKey): Promise<void>;
}
