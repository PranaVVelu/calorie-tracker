import {
    calculateBMR,
    calculateTDEE,
    calculateCalorieTarget,
    calculateMacroTargets,
    estimateWeeksToGoal
} from './algorithms';

describe('Algorithm Utilities', () => {
    describe('BMR & TDEE', () => {
        it('calculates BMR for male correctly', () => {
            // 10 * 80 + 6.25 * 180 - 5 * 30 + 5 
            // = 800 + 1125 - 150 + 5 = 1780
            expect(calculateBMR(80, 180, 30, 'male')).toBe(1780);
        });

        it('calculates BMR for female correctly', () => {
            // 10 * 65 + 6.25 * 165 - 5 * 25 - 161
            // = 650 + 1031.25 - 125 - 161 = 1395.25
            expect(calculateBMR(65, 165, 25, 'female')).toBe(1395.25);
        });

        it('calculates TDEE correctly', () => {
            expect(calculateTDEE(2000, 1.2)).toBe(2400);
            expect(calculateTDEE(1500, 1.55)).toBe(2325);
        });
    });

    describe('Calorie Target', () => {
        it('calculates loss target properly', () => {
            // 0.5kg/wk loss = ~550 kcal/day deficit (0.5 * 1100 = 550)
            const target = calculateCalorieTarget(2550, 'lose', 0.5, 'male');
            expect(target).toBe(2000); // 2550 - 550 = 2000
        });

        it('calculates gain target properly', () => {
            // 0.25kg/wk gain = ~275 kcal/day surplus
            const target = calculateCalorieTarget(2500, 'gain', 0.25, 'male');
            expect(target).toBe(2775); // 2500 + 275
        });

        it('respects male guardrails around 1500 kcal', () => {
            // TDEE 1800, goal lose 1kg/wk (1100 kcal deficit)-> 700 kcal target
            // Should cap at 1500
            const target = calculateCalorieTarget(1800, 'lose', 1.0, 'male');
            expect(target).toBe(1500);
        });

        it('respects female guardrails around 1200 kcal', () => {
            const target = calculateCalorieTarget(1600, 'lose', 0.8, 'female');
            expect(target).toBe(1200);
        });
    });

    describe('Macro Targets', () => {
        it('calculates macros for maintain', () => {
            // Weight 70kg, Target 2000 kcal
            // Protein: 70 * 1.8 = 126g
            // Fat: 2000 * 0.25 = 500 kcal -> 56g
            // Carbs: (2000 - (126*4) - 500) / 4 = (2000 - 504 - 500) / 4 = 996 / 4 = 249g
            const macros = calculateMacroTargets(70, 2000, 'maintain');
            expect(macros.protein).toBe(126);
            expect(macros.fat).toBe(56);
            expect(macros.carbs).toBe(249);
        });

        it('calculates macros for lose', () => {
            // Weight 90kg, target 1800 kcal
            // Protein: 90 * 2.0 = 180g (720 kcal)
            // Fat: 1800 * 0.25 = 450 kcal -> 50g
            // Carbs: 1800 - 720 - 450 = 630 / 4 = 158g
            const macros = calculateMacroTargets(90, 1800, 'lose');
            expect(macros.protein).toBe(180);
            expect(macros.fat).toBe(50);
            expect(macros.carbs).toBe(158); // Math.round(630/4)
        });
    });

    describe('Time to Goal', () => {
        it('estimates weeks to goal correctly for loss', () => {
            // 90 -> 80kg (10kg = 77000kcal)
            // TDEE 2500, Intake 2000 -> Diff = 500
            // 77000 / 500 = 154 days = 22 weeks
            expect(estimateWeeksToGoal(90, 80, 2000, 2500)).toBeCloseTo(22);
        });

        it('returns null if moving wrong direction (eating surplus but trying to lose)', () => {
            expect(estimateWeeksToGoal(90, 80, 2600, 2500)).toBeNull();
        });
    });
});
