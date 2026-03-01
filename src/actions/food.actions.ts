'use server';

import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function getDailyMealEntry(userId: string, dateStr: string) {
    const date = startOfDay(new Date(dateStr));

    return await prisma.mealEntry.findUnique({
        where: {
            userId_date: {
                userId,
                date
            }
        },
        include: {
            mealFoods: {
                include: {
                    foodItem: true
                }
            }
        }
    });
}

export async function searchFoodItems(query: string) {
    if (!query || query.length < 2) return [];

    return await prisma.foodItem.findMany({
        where: {
            name: {
                contains: query
                // sqlite doesn't support insensitive directly in contains without a tweak, but usually it works fine enough locally
            }
        },
        take: 20
    });
}

export async function addFoodToMeal(
    userId: string,
    dateStr: string,
    foodItemId: string,
    mealType: string,
    servings: number = 1
) {
    const date = startOfDay(new Date(dateStr));

    // Find or Create the daily MealEntry
    const mealEntry = await prisma.mealEntry.upsert({
        where: {
            userId_date: {
                userId,
                date
            }
        },
        create: {
            userId,
            date
        },
        update: {} // nothing to update on the entry itself
    });

    // Add the Food to the Entry
    return await prisma.mealFood.create({
        data: {
            mealEntryId: mealEntry.id,
            foodItemId,
            mealType,
            servings
        }
    });
}

export async function deleteMealFood(mealFoodId: string) {
    return await prisma.mealFood.delete({
        where: { id: mealFoodId }
    });
}

export async function createCustomFoodAndAddToMeal(
    userId: string,
    dateStr: string,
    mealType: string,
    foodData: {
        name: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        servingSize: string;
    }
) {
    const customFood = await prisma.foodItem.create({
        data: {
            ...foodData,
            source: 'user_manual'
        }
    });

    return await addFoodToMeal(userId, dateStr, customFood.id, mealType, 1.0);
}
