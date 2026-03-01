export type GoalType = 'lose' | 'maintain' | 'gain';
export type GenderType = 'male' | 'female';
export type ActivityLevel = 1.2 /* Sedentary */ | 1.375 /* Lightly active */ | 1.55 /* Moderately active */ | 1.725 /* Very active */ | 1.9 /* Extra active */;

/**
 * Calculate Base Metabolic Rate using Mifflin-St Jeor formula
 */
export function calculateBMR(weightKg: number, heightCm: number, ageYears: number, gender: GenderType): number {
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  }
}

/**
 * Calculate Total Daily Energy Expenditure
 */
export function calculateTDEE(bmr: number, activityMultiplier: ActivityLevel | number): number {
  return bmr * activityMultiplier;
}

/**
 * Calculate Daily Calorie Target with built-in safety guardrails
 * 1 kg fat ~ 7700 kcal -> required daily deficit/surplus = rate * 7700 / 7 = rate * 1100
 */
export function calculateCalorieTarget(
  tdee: number,
  goalType: GoalType,
  goalRateKgPerWeek: number,
  gender: GenderType
): number {
  const diffPerDay = goalRateKgPerWeek * 1100;
  let target = tdee;

  if (goalType === 'lose') {
    target = tdee - diffPerDay;
  } else if (goalType === 'gain') {
    target = tdee + diffPerDay;
  } // maintain stays at tdee

  // Guardrails
  const minCals = gender === 'male' ? 1500 : 1200;
  return Math.max(Math.round(target), minCals);
}

/**
 * Calculate Default Macro Targets
 * Protein: 2.0g/kg for loss/gain, 1.8 for maintain (simplified default rule)
 * Fat: 25% of calories
 * Carbs: remainder
 */
export function calculateMacroTargets(weightKg: number, calorieTarget: number, goalType: GoalType) {
  const proteinMultiplier = goalType === 'maintain' ? 1.8 : 2.0;
  
  const proteinGrams = Math.round(weightKg * proteinMultiplier);
  const proteinCals = proteinGrams * 4;

  const fatCals = calorieTarget * 0.25;
  const fatGrams = Math.round(fatCals / 9);

  const remainingCals = Math.max(0, calorieTarget - proteinCals - fatCals);
  const carbsGrams = Math.round(remainingCals / 4);

  return {
    protein: proteinGrams,
    fat: fatGrams,
    carbs: carbsGrams
  };
}

/**
 * Estimate Weeks to Goal
 */
export function estimateWeeksToGoal(
  currentWeightKg: number,
  goalWeightKg: number,
  averageIntakeCals: number,
  tdee: number
): number | null {
  const dailyDiff = tdee - averageIntakeCals; // positive means deficit
  
  // If aiming for loss but eating surplus, or gaining but eating deficit -> never reach goal
  if (currentWeightKg > goalWeightKg && dailyDiff <= 0) return null;
  if (currentWeightKg < goalWeightKg && dailyDiff >= 0) return null;

  const weightToChange = Math.abs(currentWeightKg - goalWeightKg);
  const kcalToChange = weightToChange * 7700;
  
  const days = kcalToChange / Math.abs(dailyDiff);
  return Math.max(0, days / 7);
}

/**
 * Linear Regression for weight trend estimation
 */
export function predictDateFromScaleTrend(weights: {date: Date, weight: number}[], targetWeight: number): Date | null {
  if (weights.length < 2) return null;

  // simple linear regression y = mx + b (where x is milliseconds, y is weight)
  const n = weights.length;
  const sumX = weights.reduce((acc, val) => acc + val.date.getTime(), 0);
  const sumY = weights.reduce((acc, val) => acc + val.weight, 0);
  const sumXY = weights.reduce((acc, val) => acc + (val.date.getTime() * val.weight), 0);
  const sumX2 = weights.reduce((acc, val) => acc + (val.date.getTime() * val.date.getTime()), 0);

  const denominator = (n * sumX2 - sumX * sumX);
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  
  // slope = weight change per millisecond
  if (Math.abs(slope) < 1e-12) return null; // flat

  const intercept = (sumY - slope * sumX) / n;
  
  // targetWeight = slope * targetTime + intercept
  // targetTime = (targetWeight - intercept) / slope
  const targetTimeMs = (targetWeight - intercept) / slope;
  
  // Sanity check: if target time is in past when we still haven't reached it
  const latestDate = Math.max(...weights.map(w => w.date.getTime()));
  if (targetTimeMs < latestDate) return null;

  return new Date(targetTimeMs);
}
