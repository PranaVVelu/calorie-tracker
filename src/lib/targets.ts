import { calculateBMR, calculateCalorieTarget, calculateMacroTargets, calculateTDEE } from '@/utils/algorithms';
import type { ProfileInput, Targets } from './types';

export interface TargetBreakdown {
    bmr: number;
    tdee: number;
    adjustment: number; // kcal/day added (+) or removed (-) for the goal
    floorApplied: boolean; // safety minimum raised the target
    targets: Targets;
}

/** Explains how calculated targets are derived from the profile (Mifflin-St Jeor). */
export function computeTargets(p: Pick<ProfileInput, 'weight' | 'height' | 'age' | 'gender' | 'activityLevel' | 'goalType' | 'goalRate'>): TargetBreakdown {
    const bmr = calculateBMR(p.weight, p.height, p.age, p.gender);
    const tdee = calculateTDEE(bmr, p.activityLevel);
    const calories = calculateCalorieTarget(tdee, p.goalType, p.goalRate, p.gender);
    const raw = p.goalType === 'lose' ? tdee - p.goalRate * 1100 : p.goalType === 'gain' ? tdee + p.goalRate * 1100 : tdee;
    const macros = calculateMacroTargets(p.weight, calories, p.goalType);
    return {
        bmr,
        tdee,
        adjustment: Math.round(calories - tdee),
        floorApplied: calories > Math.round(raw),
        targets: { calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
    };
}

export function sanitizeTargets(t: Targets): Targets {
    const n = (v: unknown, min: number, max: number) => {
        const x = Math.round(Number(v));
        if (!Number.isFinite(x) || x < min || x > max) throw new Error('Invalid target');
        return x;
    };
    return { calories: n(t.calories, 800, 10000), protein: n(t.protein, 0, 1000), carbs: n(t.carbs, 0, 2000), fat: n(t.fat, 0, 1000) };
}
