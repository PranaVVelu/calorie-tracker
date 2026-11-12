import { PrismaClient } from '@prisma/client';
import { computeTargets } from '../src/lib/targets';
import { FOOD_CATALOG } from '../src/lib/foodCatalog';

// Seeds a fresh database with the reference food catalog and two sample users.
// Safe to re-run: users are upserted and catalog foods are only added if missing.
const prisma = new PrismaClient();

/** UTC midnight for a local calendar day `daysAgo` before today (matches app storage). */
function dayStorageDate(daysAgo: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return new Date(`${key}T00:00:00.000Z`);
}

async function upsertUser(email: string, p: { name: string; age: number; gender: 'male' | 'female'; height: number; weight: number; activityLevel: number; goalType: 'lose' | 'maintain' | 'gain'; goalRate: number; goalWeight: number }) {
    const calc = computeTargets(p);
    const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
            ...p,
            tdee: calc.tdee,
            calorieTarget: calc.targets.calories,
            proteinTarget: calc.targets.protein,
            carbsTarget: calc.targets.carbs,
            fatTarget: calc.targets.fat,
        },
    });
    await prisma.goalPeriod.upsert({
        where: { userId_effectiveFrom: { userId: user.id, effectiveFrom: new Date('1970-01-01T00:00:00.000Z') } },
        update: {},
        create: {
            userId: user.id,
            effectiveFrom: new Date('1970-01-01T00:00:00.000Z'),
            calorieTarget: user.calorieTarget,
            proteinTarget: user.proteinTarget,
            carbsTarget: user.carbsTarget,
            fatTarget: user.fatTarget,
        },
    });
    return user;
}

async function main() {
    console.log('Seeding database...');

    const userLoss = await upsertUser('loser@test.com', { name: 'John Loss', age: 30, gender: 'male', height: 180, weight: 90, activityLevel: 1.2, goalType: 'lose', goalRate: 0.5, goalWeight: 80 });
    const userGain = await upsertUser('gainer@test.com', { name: 'Jane Gain', age: 25, gender: 'female', height: 170, weight: 65, activityLevel: 1.55, goalType: 'gain', goalRate: 0.25, goalWeight: 75 });
    console.log(`Users: ${userLoss.name} & ${userGain.name}`);

    const existing = new Set((await prisma.foodItem.findMany({ where: { userId: null }, select: { name: true } })).map(f => f.name));
    const toCreate = FOOD_CATALOG.filter(f => !existing.has(f.name)).map(f => ({ name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, servingSize: f.servingSize, source: 'seed' }));
    if (toCreate.length) await prisma.foodItem.createMany({ data: toCreate });
    console.log(`Catalog: added ${toCreate.length} foods (${FOOD_CATALOG.length} total in catalog)`);

    // Sample weight history for John (only if he has none).
    if ((await prisma.weightEntry.count({ where: { userId: userLoss.id } })) === 0) {
        let w = 90;
        for (let i = 14; i >= 0; i--) {
            await prisma.weightEntry.create({ data: { userId: userLoss.id, date: dayStorageDate(i), weight: Math.round(w * 10) / 10 } });
            w -= Math.random() * 0.15;
        }
        console.log('Added 15 days of weight history');
    }

    console.log('Done.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
