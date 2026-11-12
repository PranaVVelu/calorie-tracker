import { addDays, format, parseISO } from 'date-fns';
import type { DateKey } from './types';

const DAY_MS = 86_400_000;

/** Today's calendar day in the user's local time zone. */
export function todayKey(now: Date = new Date()): DateKey {
    return format(now, 'yyyy-MM-dd');
}

export function isDateKey(value: unknown): value is DateKey {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
}

/** DateKey → the UTC-midnight Date used for storage. */
export function keyToStorageDate(key: DateKey): Date {
    if (!isDateKey(key)) throw new Error(`Invalid date: ${key}`);
    return new Date(key + 'T00:00:00.000Z');
}

/**
 * Stored Date → DateKey. Rounds to the nearest UTC midnight so legacy rows that
 * were stored as a server's local midnight still map to the intended day.
 */
export function storageDateToKey(date: Date): DateKey {
    const rounded = Math.round(date.getTime() / DAY_MS) * DAY_MS;
    return new Date(rounded).toISOString().slice(0, 10);
}

/** Local-time Date for a key (for display/formatting with date-fns). */
export function keyToLocalDate(key: DateKey): Date {
    return parseISO(key);
}

export function shiftKey(key: DateKey, days: number): DateKey {
    return format(addDays(parseISO(key), days), 'yyyy-MM-dd');
}

/** Inclusive list of keys from `from` to `to`. */
export function keysBetween(from: DateKey, to: DateKey): DateKey[] {
    const out: DateKey[] = [];
    let k = from;
    let guard = 0;
    while (k <= to && guard++ < 3700) {
        out.push(k);
        k = shiftKey(k, 1);
    }
    return out;
}

export function formatDayLabel(key: DateKey, today: DateKey = todayKey()): string {
    if (key === today) return 'Today';
    if (key === shiftKey(today, -1)) return 'Yesterday';
    if (key === shiftKey(today, 1)) return 'Tomorrow';
    const d = parseISO(key);
    return format(d, d.getFullYear() === parseISO(today).getFullYear() ? 'EEE, MMM d' : 'MMM d, yyyy');
}
