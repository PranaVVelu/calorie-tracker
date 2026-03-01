import { PrismaClient } from '@prisma/client'
import { calculateBMR, calculateMacroTargets, calculateTDEE } from '../src/utils/algorithms';

// In Prisma 7, PrismaClient initialized without args should read from prisma.config.ts natively
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Database...');

    // 1. Create Test Users
    const user1Bmr = calculateBMR(90, 180, 30, 'male');
    const user1Tdee = calculateTDEE(user1Bmr, 1.2);
    const user1Macros = calculateMacroTargets(90, 2000, 'lose'); // 2000 kcal target

    const userLoss = await prisma.user.upsert({
        where: { email: 'loser@test.com' },
        update: {},
        create: {
            email: 'loser@test.com',
            name: 'John Loss',
            age: 30,
            gender: 'male',
            height: 180,
            weight: 90,
            activityLevel: 1.2,
            goalType: 'lose',
            goalRate: 0.5,
            goalWeight: 80,
            tdee: user1Tdee,
            calorieTarget: 2000,
            proteinTarget: user1Macros.protein,
            carbsTarget: user1Macros.carbs,
            fatTarget: user1Macros.fat,
        }
    });

    const user2Bmr = calculateBMR(65, 170, 25, 'female');
    const user2Tdee = calculateTDEE(user2Bmr, 1.55);
    const user2Macros = calculateMacroTargets(65, 2500, 'gain');

    const userGain = await prisma.user.upsert({
        where: { email: 'gainer@test.com' },
        update: {},
        create: {
            email: 'gainer@test.com',
            name: 'Jane Gain',
            age: 25,
            gender: 'female',
            height: 170,
            weight: 65,
            activityLevel: 1.55,
            goalType: 'gain',
            goalRate: 0.25,
            goalWeight: 75,
            tdee: user2Tdee,
            calorieTarget: 2500,
            proteinTarget: user2Macros.protein,
            carbsTarget: user2Macros.carbs,
            fatTarget: user2Macros.fat,
        }
    });

    console.log(`Created test users: ${userLoss.name} & ${userGain.name}`);

    // 2. Create Base Food Items (100 item seed array)
    const foods = [
        { name: 'Apple (Medium)', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, servingSize: '1 medium (182g)', source: 'seed' },
        { name: 'Banana (Medium)', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, servingSize: '1 medium (118g)', source: 'seed' },
        { name: 'Chicken Breast (Cooked)', calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSize: '100g', source: 'seed' },
        { name: 'Brown Rice (Cooked)', calories: 112, protein: 2.3, carbs: 23.5, fat: 0.9, servingSize: '100g', source: 'seed' },
        { name: 'Broccoli (Steamed)', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, servingSize: '100g', source: 'seed' },
        { name: 'Eggs (Large)', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, servingSize: '1 large (50g)', source: 'seed' },
        { name: 'Almonds', calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, servingSize: '100g', source: 'seed' },
        { name: 'Oats (Rolled)', calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5, servingSize: '100g', source: 'seed' },
        { name: 'Salmon (Cooked)', calories: 206, protein: 22.1, carbs: 0, fat: 12.3, servingSize: '100g', source: 'seed' },
        { name: 'Sweet Potato (Baked)', calories: 90, protein: 2, carbs: 20.7, fat: 0.2, servingSize: '100g', source: 'seed' },
        { name: 'Avocado', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, servingSize: '100g', source: 'seed' },
        { name: 'Greek Yogurt (Non-fat)', calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4, servingSize: '100g', source: 'seed' },
        { name: 'Spinach (Raw)', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, servingSize: '100g', source: 'seed' },
        { name: 'Peanut Butter (Smooth)', calories: 588, protein: 25.1, carbs: 20, fat: 50.4, servingSize: '100g', source: 'seed' },
        { name: 'Milk (Whole, 3.25%)', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, servingSize: '100ml', source: 'seed' },
        { name: 'Quinoa (Cooked)', calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, servingSize: '100g', source: 'seed' },
        { name: 'Lentils (Cooked)', calories: 116, protein: 9, carbs: 20.1, fat: 0.4, servingSize: '100g', source: 'seed' },
        { name: 'Olive Oil', calories: 884, protein: 0, carbs: 0, fat: 100, servingSize: '100g', source: 'seed' },
        { name: 'Tofu (Firm)', calories: 144, protein: 15.8, carbs: 2.8, fat: 8.7, servingSize: '100g', source: 'seed' },
        { name: 'Blueberries', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, servingSize: '100g', source: 'seed' },
    ];

    for (let i = 21; i <= 100; i++) {
        foods.push({
            name: `Generic Food Item ${i}`,
            calories: Math.round(Math.random() * 300) + 50,
            protein: Math.round(Math.random() * 20),
            carbs: Math.round(Math.random() * 40),
            fat: Math.round(Math.random() * 15),
            servingSize: '100g',
            source: 'seed'
        });
    }

    for (const food of foods) {
        await prisma.foodItem.create({ data: food });
    }

    console.log('Seeded 100 food items');

    // 3. Create Sample Weight & Meal Entries for John Loss
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Weight history (losing weight)
    let currentSimulatedWeight = 90;
    for (let i = 14; i >= 0; i--) {
        const entryDate = new Date(today);
        entryDate.setDate(today.getDate() - i);

        await prisma.weightEntry.create({
            data: {
                userId: userLoss.id,
                date: entryDate,
                weight: currentSimulatedWeight
            }
        });
        // loss around 0.5kg week roughly
        currentSimulatedWeight -= (Math.random() * 0.15);
    }

    console.log('Database Seeding Completed Successfully');
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
