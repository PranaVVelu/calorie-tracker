'use server';

import prisma from '@/lib/prisma';
import { calculateBMR, calculateMacroTargets, calculateTDEE } from '@/utils/algorithms';
import { GoalType, GenderType } from '@/utils/algorithms';

/**
 * For this demo app, we're assuming a single logged-in user to avoid full auth setup,
 * but these actions accept email/userId to make it extensible.
 */

export async function getUserProfile(email: string) {
    return await prisma.user.findUnique({
        where: { email },
        include: { weightEntries: { orderBy: { date: 'desc' } } }
    });
}

export async function upsertUserProfile(data: {
    email: string;
    name: string;
    age: number;
    gender: GenderType;
    height: number;
    weight: number;
    activityLevel: number;
    goalType: GoalType;
    goalRate: number;
    goalWeight: number;
}) {
    const bmr = calculateBMR(data.weight, data.height, data.age, data.gender);
    const tdee = calculateTDEE(bmr, data.activityLevel);

    // We need to calculate targets from /algorithms.ts but adjust logic since calculateCalorieTarget needs target not tdee directly
    // Actually, calculateCalorieTarget takes (tdee, goalType, goalRate, gender)
    // Let's import it again to use it properly
    const { calculateCalorieTarget } = await import('@/utils/algorithms');

    const calorieTarget = calculateCalorieTarget(tdee, data.goalType, data.goalRate, data.gender);
    const macros = calculateMacroTargets(data.weight, calorieTarget, data.goalType);

    const user = await prisma.user.upsert({
        where: { email: data.email },
        update: {
            ...data,
            tdee,
            calorieTarget,
            proteinTarget: macros.protein,
            carbsTarget: macros.carbs,
            fatTarget: macros.fat,
        },
        create: {
            ...data,
            tdee,
            calorieTarget,
            proteinTarget: macros.protein,
            carbsTarget: macros.carbs,
            fatTarget: macros.fat,
        }
    });

    return user;
}

export async function logWeight(userId: string, weight: number, dateStr: string) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    // Upsert to ensure only one weight per day
    return await prisma.weightEntry.upsert({
        where: {
            userId_date: {
                userId,
                date
            }
        },
        update: { weight },
        create: {
            userId,
            date,
            weight
        }
    });
}
