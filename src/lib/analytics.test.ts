import { buildDaySeries, rollingWeightAverage, summarize } from './analytics';
import type { LogEntry, RangeData } from './types';

const e = (date: string, calories: number, protein: number | null = 100, servings = 1): LogEntry => ({
    id: `${date}-${calories}`,
    date,
    mealType: 'Lunch',
    servings,
    foodId: 'f',
    name: 'x',
    servingSize: '1',
    calories,
    protein,
    carbs: 0,
    fat: 0,
    savedMealId: null,
    createdAt: `${date}T12:00:00Z`,
});

const base: Omit<RangeData, 'entries' | 'weights'> = {
    from: '2026-11-06',
    to: '2026-11-12',
    periods: [
        { effectiveFrom: '1970-01-01', calories: 2000, protein: 150, carbs: 200, fat: 60, mode: 'calculated' },
        { effectiveFrom: '2026-11-10', calories: 1800, protein: 160, carbs: 180, fat: 60, mode: 'manual' },
    ],
    fallbackTargets: { calories: 9999, protein: 0, carbs: 0, fat: 0 },
};

describe('rolling weight average', () => {
    it('averages weigh-ins in the trailing 7 days, including ones before the range', () => {
        const days = ['2026-11-10', '2026-11-11'];
        const r = rollingWeightAverage(
            [
                { date: '2026-11-03', weight: 90 }, // outside window for 11-10 (8 days back)
                { date: '2026-11-04', weight: 84 },
                { date: '2026-11-10', weight: 82 },
            ],
            days
        );
        expect(r.get('2026-11-10')).toEqual({ avg: 83, count: 2 });
        expect(r.get('2026-11-11')).toEqual({ avg: 82, count: 1 }); // 11-04 has now left the window
    });
    it('leaves days with no weigh-ins in the window undefined', () => {
        expect(rollingWeightAverage([{ date: '2026-10-01', weight: 80 }], ['2026-11-10']).size).toBe(0);
    });
});

describe('day series & summaries', () => {
    const range: RangeData = {
        ...base,
        entries: [
            e('2026-11-06', 1000, 50),
            e('2026-11-06', 900, 50), // 1900 total
            e('2026-11-08', 2100, 120),
            e('2026-11-10', 1700, null), // protein unknown
            e('2026-11-12', 500, 30), // today, in progress
        ],
        weights: [
            { date: '2026-11-06', weight: 80 },
            { date: '2026-11-12', weight: 79 },
        ],
    };
    const series = buildDaySeries(range, '2026-11-12');
    const s = summarize(series);

    it('treats unlogged days as missing, not zero', () => {
        expect(series.find(d => d.date === '2026-11-07')).toMatchObject({ logged: false, calories: null, protein: null });
    });

    it('applies the target in effect each day', () => {
        expect(series.find(d => d.date === '2026-11-09')!.targets.calories).toBe(2000);
        expect(series.find(d => d.date === '2026-11-10')!.targets.calories).toBe(1800);
    });

    it('averages only completed logged days and reports the count', () => {
        expect(s.loggedDays).toBe(3); // 11-06, 11-08, 11-10 (today excluded)
        expect(s.totalDays).toBe(7);
        expect(s.avgCalories).toBeCloseTo((1900 + 2100 + 1700) / 3, 6);
        expect(s.avgCalorieTarget).toBeCloseTo((2000 + 2000 + 1800) / 3, 6);
    });

    it('counts near-target days within ±10%', () => {
        // 1900 vs 2000 (5%) ✓, 2100 vs 2000 (5%) ✓, 1700 vs 1800 (5.6%) ✓
        expect(s.nearTargetDays).toBe(3);
    });

    it('flags unknown protein items rather than inventing values', () => {
        const d = series.find(x => x.date === '2026-11-10')!;
        expect(d.protein).toBe(0);
        expect(d.proteinUnknownItems).toBe(1);
    });

    it('computes weight change from the rolling average', () => {
        // 11-06 avg = 80 (1 weigh-in); 11-12 avg = (80+79)/2 = 79.5 (11-06 is 6 days back, still in window)
        expect(s.weightStart).toBe(80);
        expect(s.weightEnd).toBe(79.5);
        expect(s.weightChange).toBe(-0.5);
        expect(s.weighIns).toBe(2);
    });

    it('handles an empty range gracefully', () => {
        const empty = summarize(buildDaySeries({ ...base, entries: [], weights: [] }, '2026-11-12'));
        expect(empty).toMatchObject({ loggedDays: 0, avgCalories: null, weightChange: null, nearTargetDays: 0 });
    });
});
