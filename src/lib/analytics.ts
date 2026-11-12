import type { DateKey, LogEntry, RangeData, Targets, WeightEntry } from './types';
import { keysBetween, shiftKey } from './dates';
import { sumEntries, targetsForDate, round, type Totals } from './nutrition';

export const ROLLING_WINDOW_DAYS = 7;
/** A day counts as "near target" when within ±10% of its calorie target. */
export const NEAR_TARGET_TOLERANCE = 0.1;

export interface DayPoint {
    date: DateKey;
    logged: boolean;
    /** null when the day has no entries (missing data, not zero). */
    calories: number | null;
    protein: number | null;
    proteinUnknownItems: number;
    entryCount: number;
    targets: Targets;
    weight: number | null;
    /** Trailing 7-day mean of weigh-ins ending on this day. */
    weightAvg: number | null;
    weightAvgCount: number;
    isToday: boolean;
}

export function groupEntriesByDate(entries: LogEntry[]): Map<DateKey, LogEntry[]> {
    const map = new Map<DateKey, LogEntry[]>();
    for (const e of entries) {
        const list = map.get(e.date);
        if (list) list.push(e);
        else map.set(e.date, [e]);
    }
    return map;
}

/**
 * Trailing rolling mean of weigh-ins. For each day, averages all weigh-ins in
 * the `window` days ending that day (inclusive). Days with no weigh-ins in the
 * window get null. Weigh-ins before the visible range still contribute.
 */
export function rollingWeightAverage(
    weights: WeightEntry[],
    days: DateKey[],
    window = ROLLING_WINDOW_DAYS
): Map<DateKey, { avg: number; count: number }> {
    const byDate = new Map(weights.map(w => [w.date, w.weight]));
    const out = new Map<DateKey, { avg: number; count: number }>();
    for (const d of days) {
        let sum = 0;
        let count = 0;
        for (let i = 0; i < window; i++) {
            const v = byDate.get(shiftKey(d, -i));
            if (v != null) {
                sum += v;
                count++;
            }
        }
        if (count > 0) out.set(d, { avg: sum / count, count });
    }
    return out;
}

export function buildDaySeries(range: RangeData, today: DateKey): DayPoint[] {
    const days = keysBetween(range.from, range.to);
    const byDate = groupEntriesByDate(range.entries);
    const weightByDate = new Map(range.weights.map(w => [w.date, w.weight]));
    const rolling = rollingWeightAverage(range.weights, days);

    return days.map(date => {
        const entries = byDate.get(date) ?? [];
        const totals: Totals | null = entries.length ? sumEntries(entries) : null;
        const r = rolling.get(date);
        return {
            date,
            logged: entries.length > 0,
            calories: totals ? round(totals.calories, 0) : null,
            protein: totals ? round(totals.protein, 1) : null,
            proteinUnknownItems: totals?.unknown.protein ?? 0,
            entryCount: entries.length,
            targets: targetsForDate(range.periods, date, range.fallbackTargets),
            weight: weightByDate.get(date) ?? null,
            weightAvg: r ? round(r.avg, 2) : null,
            weightAvgCount: r?.count ?? 0,
            isToday: date === today,
        };
    });
}

export interface RangeSummary {
    totalDays: number;
    /** Completed days (before today) that have at least one entry. */
    loggedDays: number;
    avgCalories: number | null;
    avgCalorieTarget: number | null;
    avgProtein: number | null;
    avgProteinTarget: number | null;
    nearTargetDays: number;
    weighIns: number;
    weightChange: number | null; // kg, first → last rolling average in range
    weightStart: number | null;
    weightEnd: number | null;
    includesToday: boolean;
}

/**
 * Summaries use only logged, completed days. Unlogged days are missing data and
 * are excluded from every average. Today is excluded because it is in progress.
 */
export function summarize(series: DayPoint[]): RangeSummary {
    const complete = series.filter(d => d.logged && !d.isToday);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

    const nearTargetDays = complete.filter(
        d => d.calories != null && Math.abs(d.calories - d.targets.calories) <= d.targets.calories * NEAR_TARGET_TOLERANCE
    ).length;

    const avgPoints = series.filter(d => d.weightAvg != null);
    const weightStart = avgPoints.length ? avgPoints[0].weightAvg : null;
    const weightEnd = avgPoints.length ? avgPoints[avgPoints.length - 1].weightAvg : null;
    const weighIns = series.filter(d => d.weight != null).length;

    return {
        totalDays: series.length,
        loggedDays: complete.length,
        avgCalories: mean(complete.map(d => d.calories!)),
        avgCalorieTarget: mean(complete.map(d => d.targets.calories)),
        avgProtein: mean(complete.map(d => d.protein!)),
        avgProteinTarget: mean(complete.map(d => d.targets.protein)),
        nearTargetDays,
        weighIns,
        weightChange: avgPoints.length >= 2 && weighIns >= 2 ? round(weightEnd! - weightStart!, 2) : null,
        weightStart,
        weightEnd,
        includesToday: series.some(d => d.isToday),
    };
}
