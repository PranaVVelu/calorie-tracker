'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { todayKey } from '@/lib/dates';
import type { DateKey, MealType } from '@/lib/types';

export type LoggerTab = 'recent' | 'favorites' | 'search' | 'saved' | 'manual' | 'describe';

export interface LoggerRequest {
    date: DateKey;
    mealType: MealType;
    tab?: LoggerTab;
    /** Open straight into reviewing this saved meal. */
    savedMealId?: string;
}

/** Sensible default meal for the current local time. */
export function defaultMealType(now = new Date()): MealType {
    const h = now.getHours() + now.getMinutes() / 60;
    if (h < 10.5) return 'Breakfast';
    if (h < 15) return 'Lunch';
    if (h < 17.5) return 'Snack';
    if (h < 21.5) return 'Dinner';
    return 'Snack';
}

interface AppCtx {
    selectedDate: DateKey;
    setSelectedDate: (d: DateKey) => void;
    logger: LoggerRequest | null;
    openLogger: (req?: Partial<LoggerRequest>) => void;
    closeLogger: () => void;
    /** Entry ids to briefly highlight after they're added/changed. */
    highlights: Set<string>;
    flash: (ids: string[]) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [selectedDate, setSelectedDate] = useState<DateKey>(() => todayKey());
    const [logger, setLogger] = useState<LoggerRequest | null>(null);
    const [highlights, setHighlights] = useState<Set<string>>(new Set());
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openLogger = useCallback(
        (req?: Partial<LoggerRequest>) => setLogger({ date: req?.date ?? selectedDate, mealType: req?.mealType ?? defaultMealType(), tab: req?.tab, savedMealId: req?.savedMealId }),
        [selectedDate]
    );
    const closeLogger = useCallback(() => setLogger(null), []);
    const flash = useCallback((ids: string[]) => {
        setHighlights(new Set(ids));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setHighlights(new Set()), 1600);
    }, []);

    const value = useMemo(
        () => ({ selectedDate, setSelectedDate, logger, openLogger, closeLogger, highlights, flash }),
        [selectedDate, logger, openLogger, closeLogger, highlights, flash]
    );
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
    const c = useContext(Ctx);
    if (!c) throw new Error('useApp outside AppProvider');
    return c;
}
