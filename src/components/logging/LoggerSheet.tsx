'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Star, Search, Bookmark, PenLine, Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useApp, type LoggerTab } from '@/components/app/AppContext';
import { useData, useMutation, useQuery } from '@/lib/data/DataProvider';
import { useToast } from '@/components/ui/Toast';
import { formatDayLabel } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { MEAL_TYPES, type Food, type LogEntry, type MealType, type SavedMeal } from '@/lib/types';
import { addToTotals, emptyTotals } from '@/lib/nutrition';
import { FoodRow } from './FoodRow';
import { PortionEditor } from './PortionEditor';
import { ManualForm, emptyDraft, type ManualDraft } from './ManualForm';
import { SavedMealLogger } from './SavedMealLogger';
import { parseMealDescription } from '@/actions/ai.actions';
import { cn } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const TABS: { id: LoggerTab; label: string; icon: typeof Clock }[] = [
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'favorites', label: 'Favorites', icon: Star },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'saved', label: 'Saved meals', icon: Bookmark },
    { id: 'manual', label: 'Manual', icon: PenLine },
    { id: 'describe', label: 'Describe', icon: Sparkles },
];

export function LoggerSheet() {
    const { logger, closeLogger } = useApp();
    return (
        <Dialog open={!!logger} onClose={closeLogger} title="Log food" size="lg" className="sm:h-[min(760px,86dvh)]">
            {logger && <LoggerBody key={`${logger.date}-${logger.mealType}-${logger.tab}-${logger.savedMealId}`} />}
        </Dialog>
    );
}

type Selection = { kind: 'food'; food: Food; servings: number } | { kind: 'saved'; meal: SavedMeal } | null;

function LoggerBody() {
    const { logger, closeLogger, flash } = useApp();
    const { mode } = useData();
    const mutate = useMutation();
    const toast = useToast();

    const [date, setDate] = useState(logger!.date);
    const [mealType, setMealType] = useState<MealType>(logger!.mealType);
    const [tab, setTab] = useState<LoggerTab>(logger!.tab ?? 'recent');
    const [selection, setSelection] = useState<Selection>(null);
    const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null);
    const [quick, setQuick] = useState<Record<string, 'pending' | 'done'>>({});
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const tabs = TABS.filter(t => t.id !== 'describe' || mode === 'live');

    // Deep link into a specific saved meal (from Today or the Foods page).
    const preselect = logger!.savedMealId;
    const savedForPreselect = useQuery(preselect ? 'saved-meals' : null, api => api.getSavedMeals());
    const [preselectDone, setPreselectDone] = useState(false);
    if (preselect && !preselectDone && savedForPreselect.data) {
        setPreselectDone(true);
        const m = savedForPreselect.data.find(x => x.id === preselect);
        if (m) setSelection({ kind: 'saved', meal: m });
    }

    const undoable = (entries: LogEntry[], message: string) => {
        flash(entries.map(e => e.id));
        toast({
            message,
            action: {
                label: 'Undo',
                onClick: async () => {
                    await mutate(async api => {
                        for (const e of entries) await api.deleteEntry(e.id);
                    });
                    toast({ message: 'Removed', tone: 'info' });
                },
            },
        });
    };

    const logFood = async (food: Food, servings: number, requestId: string, keepOpen = false) => {
        try {
            const entry = await mutate(api => api.logFood({ date, mealType, foodId: food.id, servings, requestId }));
            undoable([entry], `Added ${food.name} to ${mealType}`);
            if (!keepOpen) closeLogger();
            else setSelection(null);
        } catch (e) {
            toast({ message: e instanceof Error ? e.message : 'Could not add food', tone: 'error' });
            throw e;
        }
    };

    const quickAdd = async (food: Food, servings: number) => {
        if (quick[food.id]) return;
        setQuick(q => ({ ...q, [food.id]: 'pending' }));
        try {
            const entry = await mutate(api => api.logFood({ date, mealType, foodId: food.id, servings, requestId: newId('q_') }));
            setQuick(q => ({ ...q, [food.id]: 'done' }));
            undoable([entry], `Added ${food.name} to ${mealType}`);
            setTimeout(() => setQuick(q => Object.fromEntries(Object.entries(q).filter(([k]) => k !== food.id))), 1800);
        } catch (e) {
            setQuick(q => Object.fromEntries(Object.entries(q).filter(([k]) => k !== food.id)));
            toast({ message: e instanceof Error ? e.message : 'Could not add food', tone: 'error' });
        }
    };

    const toggleFavorite = async (food: Food) => {
        try {
            await mutate(api => api.setFavorite(food.id, !food.favorite));
            if (selection?.kind === 'food' && selection.food.id === food.id) setSelection({ ...selection, food: { ...food, favorite: !food.favorite } });
        } catch {
            toast({ message: 'Could not update favorite', tone: 'error' });
        }
    };

    const onTabKey = (e: React.KeyboardEvent, i: number) => {
        let n = -1;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (n >= 0) {
            e.preventDefault();
            setTab(tabs[n].id);
            setSelection(null);
            tabRefs.current[n]?.focus();
        }
    };

    // Stable idempotency key for the current selection: a double submit maps to one entry.
    const requestKey = useRef(newId('r_'));
    useEffect(() => {
        requestKey.current = newId('r_');
    }, [selection, tab]);

    return (
        <div className="flex h-full flex-col gap-4">
            {/* Where it goes */}
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                    <label htmlFor="log-date" className="text-[13px] text-ink-3">
                        Day
                    </label>
                    <input
                        id="log-date"
                        type="date"
                        value={date}
                        onChange={e => e.target.value && setDate(e.target.value)}
                        className="input num h-9 min-h-0 w-auto py-1 text-[13px]"
                    />
                    <span className="text-[13px] font-medium text-ink">{formatDayLabel(date)}</span>
                </div>
                <Segmented
                    label="Meal"
                    value={mealType}
                    onChange={setMealType}
                    options={MEAL_TYPES.map(m => ({ value: m, label: m }))}
                    className="w-full sm:ml-auto sm:w-auto"
                />
            </div>

            {selection?.kind === 'food' ? (
                <PortionEditor
                    food={selection.food}
                    initialServings={selection.servings}
                    onBack={() => setSelection(null)}
                    onToggleFavorite={() => toggleFavorite(selection.food)}
                    submitLabel={kcal => `Add to ${mealType} · ${kcal} kcal`}
                    onSubmit={s => logFood(selection.food, s, requestKey.current)}
                    secondaryLabel="Add & log another"
                    onSecondary={s => logFood(selection.food, s, requestKey.current, true)}
                />
            ) : selection?.kind === 'saved' ? (
                <SavedMealLogger
                    meal={selection.meal}
                    mealTypeLabel={mealType}
                    onBack={() => setSelection(null)}
                    onSubmit={async items => {
                        try {
                            const entries = await mutate(api => api.logSavedMeal({ savedMealId: selection.meal.id, date, mealType, items, requestId: requestKey.current }));
                            undoable(entries, `Logged ${selection.meal.name} to ${mealType}`);
                            closeLogger();
                        } catch (e) {
                            toast({ message: e instanceof Error ? e.message : 'Could not log meal', tone: 'error' });
                        }
                    }}
                />
            ) : (
                <>
                    <div role="tablist" aria-label="Ways to log" className="scrollbar-none -mx-5 flex gap-1 overflow-x-auto px-5">
                        {tabs.map((t, i) => {
                            const active = t.id === tab;
                            return (
                                <button
                                    key={t.id}
                                    ref={el => {
                                        tabRefs.current[i] = el;
                                    }}
                                    role="tab"
                                    id={`tab-${t.id}`}
                                    aria-selected={active}
                                    aria-controls={`panel-${t.id}`}
                                    tabIndex={active ? 0 : -1}
                                    onKeyDown={e => onTabKey(e, i)}
                                    onClick={() => setTab(t.id)}
                                    className={cn(
                                        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                                        active ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line text-ink-3 hover:text-ink'
                                    )}
                                >
                                    <t.icon className="h-3.5 w-3.5" aria-hidden />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>
                    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1">
                        {tab === 'recent' && <RecentPanel quick={quick} onQuick={quickAdd} onSelect={(f, s) => setSelection({ kind: 'food', food: f, servings: s })} onFav={toggleFavorite} goSearch={() => setTab('search')} />}
                        {tab === 'favorites' && <FavoritesPanel quick={quick} onQuick={quickAdd} onSelect={f => setSelection({ kind: 'food', food: f, servings: 1 })} onFav={toggleFavorite} />}
                        {tab === 'search' && (
                            <SearchPanel
                                onSelect={f => setSelection({ kind: 'food', food: f, servings: 1 })}
                                onFav={toggleFavorite}
                                onManual={name => {
                                    setManualDraft({ ...emptyDraft, name });
                                    setTab('manual');
                                }}
                            />
                        )}
                        {tab === 'saved' && <SavedPanel onSelect={m => setSelection({ kind: 'saved', meal: m })} />}
                        {tab === 'manual' && (
                            <ManualForm
                                key={JSON.stringify(manualDraft)}
                                initial={manualDraft ?? emptyDraft}
                                note={
                                    manualDraft && manualDraft.calories ? (
                                        <p className="rounded-xl border border-accent/25 bg-accent-soft px-3 py-2 text-[13px] text-ink-2">
                                            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-accent" aria-hidden />
                                            AI estimate. Review the values before adding.
                                        </p>
                                    ) : undefined
                                }
                                submitLabel={`Add to ${mealType}`}
                                onSubmit={async (food, servings) => {
                                    try {
                                        const entry = await mutate(api => api.logManual({ date, mealType, food, servings, requestId: requestKey.current }));
                                        undoable([entry], `Added ${food.name} to ${mealType}`);
                                        closeLogger();
                                    } catch (e) {
                                        toast({ message: e instanceof Error ? e.message : 'Could not add food', tone: 'error' });
                                    }
                                }}
                            />
                        )}
                        {tab === 'describe' && (
                            <DescribePanel
                                onParsed={p => {
                                    setManualDraft({
                                        name: p.name,
                                        calories: String(p.calories),
                                        protein: String(p.protein),
                                        carbs: String(p.carbs),
                                        fat: String(p.fat),
                                        servingSize: p.servingSize,
                                    });
                                    setTab('manual');
                                }}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

type PanelProps = {
    quick: Record<string, 'pending' | 'done'>;
    onQuick: (f: Food, servings: number) => void;
    onFav: (f: Food) => void;
};

function ListSkeleton() {
    return (
        <div className="space-y-2" aria-label="Loading">
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
            ))}
        </div>
    );
}

function RecentPanel({ quick, onQuick, onSelect, onFav, goSearch }: PanelProps & { onSelect: (f: Food, s: number) => void; goSearch: () => void }) {
    const q = useQuery('recent', api => api.getRecentFoods());
    if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
    if (q.loading) return <ListSkeleton />;
    if (!q.data!.length)
        return (
            <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title="No recent foods yet"
                body="Foods you log show up here with the portion you used last."
                action={
                    <Button size="sm" variant="subtle" onClick={goSearch}>
                        Search foods
                    </Button>
                }
            />
        );
    return (
        <ul className="-mx-2 space-y-0.5">
            {q.data!.map(f => (
                <FoodRow
                    key={f.id}
                    food={f}
                    servings={f.lastServings}
                    meta={`last ${f.lastMealType.toLowerCase()}`}
                    onSelect={() => onSelect(f, f.lastServings)}
                    onQuickAdd={() => onQuick(f, f.lastServings)}
                    quickState={quick[f.id] ?? 'idle'}
                    onToggleFavorite={() => onFav(f)}
                />
            ))}
        </ul>
    );
}

function FavoritesPanel({ quick, onQuick, onSelect, onFav }: PanelProps & { onSelect: (f: Food) => void }) {
    const q = useQuery('favorites', api => api.getFavorites());
    if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
    if (q.loading) return <ListSkeleton />;
    if (!q.data!.length) return <EmptyState icon={<Star className="h-5 w-5" />} title="No favorites yet" body="Tap the star on any food to keep it one tap away." />;
    return (
        <ul className="-mx-2 space-y-0.5">
            {q.data!.map(f => (
                <FoodRow key={f.id} food={f} onSelect={() => onSelect(f)} onQuickAdd={() => onQuick(f, 1)} quickState={quick[f.id] ?? 'idle'} onToggleFavorite={() => onFav(f)} />
            ))}
        </ul>
    );
}

function SearchPanel({ onSelect, onFav, onManual }: { onSelect: (f: Food) => void; onFav: (f: Food) => void; onManual: (name: string) => void }) {
    const [text, setText] = useState('');
    const [debounced, setDebounced] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setDebounced(text.trim()), 220);
        return () => clearTimeout(t);
    }, [text]);
    const q = useQuery(debounced.length >= 2 ? `search:${debounced.toLowerCase()}` : null, api => api.searchFoods(debounced));
    const pending = text.trim() !== debounced || (debounced.length >= 2 && q.loading);

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <label htmlFor="food-search" className="sr-only">
                    Search foods
                </label>
                <input
                    id="food-search"
                    autoFocus
                    data-autofocus
                    type="search"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Search foods and your saved items"
                    className="input pl-9"
                    autoComplete="off"
                />
                {pending && text.trim().length >= 2 && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-3" aria-hidden />}
            </div>
            {debounced.length < 2 ? (
                <p className="px-1 text-[13px] text-ink-3">Type at least 2 letters.</p>
            ) : q.error ? (
                <ErrorState error={q.error} onRetry={q.reload} />
            ) : q.data && q.data.length === 0 && !pending ? (
                <EmptyState
                    icon={<Search className="h-5 w-5" />}
                    title={`No matches for “${debounced}”`}
                    body="Add it once with known calories and it’ll be here next time."
                    action={
                        <Button size="sm" variant="subtle" onClick={() => onManual(debounced)}>
                            <PenLine className="h-3.5 w-3.5" aria-hidden /> Enter manually
                        </Button>
                    }
                />
            ) : (
                <ul className={cn('-mx-2 space-y-0.5', q.refreshing && 'opacity-60')} aria-busy={pending}>
                    {(q.data ?? []).map(f => (
                        <FoodRow key={f.id} food={f} meta={f.mine ? 'your food' : undefined} onSelect={() => onSelect(f)} onToggleFavorite={() => onFav(f)} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function SavedPanel({ onSelect }: { onSelect: (m: SavedMeal) => void }) {
    const q = useQuery('saved-meals', api => api.getSavedMeals());
    if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
    if (q.loading) return <ListSkeleton />;
    if (!q.data!.length)
        return (
            <EmptyState
                icon={<Bookmark className="h-5 w-5" />}
                title="No saved meals yet"
                body="Save a logged meal from Today, or build one on the Foods page."
            />
        );
    return (
        <ul className="space-y-2">
            {q.data!.map(m => {
                const t = m.items.reduce((acc, i) => addToTotals(acc, i.food, i.servings), emptyTotals());
                return (
                    <li key={m.id}>
                        <button type="button" onClick={() => onSelect(m)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left hover:border-line-strong">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                                <Bookmark className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
                                <span className="block truncate text-xs text-ink-3">{m.items.map(i => i.food.name).join(', ')}</span>
                            </span>
                            <span className="num shrink-0 text-sm font-semibold text-ink">
                                {Math.round(t.calories)} <span className="text-xs font-normal text-ink-3">kcal</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

function DescribePanel({ onParsed }: { onParsed: (p: Awaited<ReturnType<typeof parseMealDescription>>) => void }) {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <form
            className="space-y-3"
            onSubmit={async e => {
                e.preventDefault();
                if (!text.trim() || busy) return;
                setBusy(true);
                setError(null);
                try {
                    onParsed(await parseMealDescription(text));
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not estimate that meal.');
                } finally {
                    setBusy(false);
                }
            }}
        >
            <label htmlFor="describe" className="block text-[13px] font-medium text-ink-2">
                Describe what you ate
            </label>
            <textarea
                id="describe"
                value={text}
                onChange={e => setText(e.target.value)}
                rows={3}
                placeholder="e.g. Grilled chicken sandwich with fries and a small side salad"
                className="input resize-none"
            />
            {error && (
                <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
                    {error}
                </p>
            )}
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-ink-3">Gemini estimates the nutrition; you review it before it’s added.</p>
                <Button type="submit" variant="primary" loading={busy} disabled={!text.trim()}>
                    <Sparkles className="h-4 w-4" aria-hidden /> Estimate
                </Button>
            </div>
        </form>
    );
}
