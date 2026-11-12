'use client';

import { createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from 'react';
import type { DataApi } from '../api';
import { liveApi } from '../liveApi';
import { demoApi, resetDemo, clearDemo } from '../demo/demoApi';

export type Mode = 'live' | 'demo';
const MODE_KEY = 'macrotrack-mode';

// ---------- mode store ----------

const modeListeners = new Set<() => void>();
let modeCache: Mode | null = null;

/** Public portfolio deploys set NEXT_PUBLIC_DEMO_ONLY=true: demo is the only mode. */
export const DEMO_ONLY = process.env.NEXT_PUBLIC_DEMO_ONLY === 'true';

function readMode(): Mode {
    if (DEMO_ONLY) return 'demo';
    if (modeCache) return modeCache;
    let m: Mode = 'live';
    try {
        const url = new URL(window.location.href);
        const q = url.searchParams.get('demo');
        if (q === '1' || q === 'true') {
            m = 'demo';
            window.localStorage.setItem(MODE_KEY, 'demo');
        } else if (q === '0') {
            window.localStorage.setItem(MODE_KEY, 'live');
        } else if (window.localStorage.getItem(MODE_KEY) === 'demo') {
            m = 'demo';
        }
        if (q != null) {
            // Consume the flag so a later reload respects Exit.
            url.searchParams.delete('demo');
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    } catch {
        /* storage blocked → live */
    }
    modeCache = m;
    return m;
}

function setModeStore(m: Mode) {
    modeCache = m;
    try {
        window.localStorage.setItem(MODE_KEY, m);
    } catch {
        /* ignore */
    }
    modeListeners.forEach(l => l());
}

// ---------- query cache ----------
// Tiny shared cache: every mutation bumps `generation`, which refetches all
// mounted queries so totals stay consistent across the whole interface.

type CacheEntry = { gen: number; status: 'loading' | 'success' | 'error'; data?: unknown; error?: Error };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
}

/** Marks every query stale. Mounted queries refetch while keeping their last data visible. */
export function invalidateAll() {
    generation++;
    emit();
}

function ensureFetched(key: string, gen: number, fetcher: () => Promise<unknown>) {
    const current = cache.get(key);
    if (current && current.gen === gen) return;
    const flightKey = `${gen}|${key}`;
    if (inflight.has(flightKey)) return;
    const promise = fetcher();
    inflight.set(flightKey, promise);
    cache.set(key, { gen, status: 'loading', data: current?.data });
    emit();
    promise.then(
        data => {
            inflight.delete(flightKey);
            if (cache.get(key)?.gen === gen) {
                cache.set(key, { gen, status: 'success', data });
                emit();
            }
        },
        (error: unknown) => {
            inflight.delete(flightKey);
            if (cache.get(key)?.gen === gen) {
                cache.set(key, { gen, status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
                emit();
            }
        }
    );
}

// ---------- context ----------

interface DataCtx {
    api: DataApi;
    mode: Mode;
    enterDemo: () => void;
    exitDemo: () => void;
    /** False on demo-only deploys (no real account to return to). */
    canExitDemo: boolean;
    resetDemoData: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
    const mode = useSyncExternalStore(
        l => {
            modeListeners.add(l);
            return () => modeListeners.delete(l);
        },
        readMode,
        () => null
    );

    const enterDemo = useCallback(() => {
        setModeStore('demo');
        invalidateAll();
    }, []);
    const exitDemo = useCallback(() => {
        setModeStore('live');
        invalidateAll();
    }, []);
    const resetDemoData = useCallback(() => {
        resetDemo();
        invalidateAll();
    }, []);

    const value = useMemo<DataCtx | null>(
        () => (mode ? { api: mode === 'demo' ? demoApi : liveApi, mode, enterDemo, exitDemo, resetDemoData, canExitDemo: !DEMO_ONLY } : null),
        [mode, enterDemo, exitDemo, resetDemoData]
    );

    // Before hydration we don't know the mode; render children only once known.
    if (!value) return <div className="min-h-screen" aria-busy="true" />;
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
    const c = useContext(Ctx);
    if (!c) throw new Error('useData outside DataProvider');
    return c;
}

export { clearDemo };

export interface QueryState<T> {
    data: T | undefined;
    error: Error | undefined;
    loading: boolean;
    /** True when showing data from a previous key/generation while refetching. */
    refreshing: boolean;
    reload: () => void;
}

export function useQuery<T>(key: string | null, fetcher: (api: DataApi) => Promise<T>): QueryState<T> {
    const { api, mode } = useData();
    const fullKey = key ? `${mode}:${key}` : null;
    const gen = useSyncExternalStore(subscribe, () => generation, () => 0);
    const entry = useSyncExternalStore(
        subscribe,
        () => (fullKey ? cache.get(fullKey) : undefined),
        () => undefined
    );
    const runFetch = useEffectEvent(() => fetcher(api));

    useEffect(() => {
        if (fullKey) ensureFetched(fullKey, gen, runFetch);
    }, [fullKey, gen]);

    // Keep the last successful data across key changes (e.g. switching days) to avoid flashing.
    const [prev, setPrev] = useState<{ data: T } | null>(null);
    if (entry?.data !== undefined && entry.data !== prev?.data) setPrev({ data: entry.data as T });

    const reload = useCallback(() => invalidateAll(), []);

    if (entry?.status === 'error' && entry.gen === gen) return { data: undefined, error: entry.error, loading: false, refreshing: false, reload };
    if (entry?.status === 'success' && entry.gen === gen) return { data: entry.data as T, error: undefined, loading: false, refreshing: false, reload };
    const fallback = (entry?.data as T | undefined) ?? prev?.data;
    return { data: fallback, error: undefined, loading: fallback === undefined, refreshing: fallback !== undefined, reload };
}

/** Wraps a mutation: runs it, then refreshes every mounted query. */
export function useMutation() {
    const { api } = useData();
    return useCallback(
        async <T,>(fn: (api: DataApi) => Promise<T>): Promise<T> => {
            const out = await fn(api);
            invalidateAll();
            return out;
        },
        [api]
    );
}
