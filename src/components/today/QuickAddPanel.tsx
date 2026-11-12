'use client';

import { useState } from 'react';
import { Bookmark, ChevronRight, Clock, Search } from 'lucide-react';
import { useMutation, useQuery } from '@/lib/data/DataProvider';
import { useApp, defaultMealType } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/Toast';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/States';
import { FoodRow } from '@/components/logging/FoodRow';
import { newId } from '@/lib/ids';
import { addToTotals, emptyTotals } from '@/lib/nutrition';
import { MEAL_TYPES, type MealType, type RecentFood } from '@/lib/types';
import { formatDayLabel } from '@/lib/dates';

/** One-tap re-logging of recent foods and fast access to saved meals. */
export function QuickAddPanel({ date }: { date: string }) {
    const { openLogger, flash } = useApp();
    const mutate = useMutation();
    const toast = useToast();
    const [mealType, setMealType] = useState<MealType>(defaultMealType());
    const [quick, setQuick] = useState<Record<string, 'pending' | 'done'>>({});
    const recent = useQuery('recent', api => api.getRecentFoods());
    const saved = useQuery('saved-meals', api => api.getSavedMeals());

    const add = async (f: RecentFood) => {
        if (quick[f.id]) return;
        setQuick(q => ({ ...q, [f.id]: 'pending' }));
        try {
            const entry = await mutate(api => api.logFood({ date, mealType, foodId: f.id, servings: f.lastServings, requestId: newId('q_') }));
            flash([entry.id]);
            setQuick(q => ({ ...q, [f.id]: 'done' }));
            toast({
                message: `Added ${f.name} to ${mealType}`,
                action: { label: 'Undo', onClick: () => void mutate(api => api.deleteEntry(entry.id)) },
            });
        } catch (e) {
            toast({ message: e instanceof Error ? e.message : 'Could not add', tone: 'error' });
        } finally {
            setTimeout(() => setQuick(q => Object.fromEntries(Object.entries(q).filter(([k]) => k !== f.id))), 1500);
        }
    };

    return (
        <>
            <Card>
                <CardHeader
                    title={
                        <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-ink-3" aria-hidden /> Quick add
                        </span>
                    }
                    subtitle={`To ${/^(Today|Yesterday|Tomorrow)$/.test(formatDayLabel(date)) ? formatDayLabel(date).toLowerCase() : formatDayLabel(date)} · uses your last portion`}
                />
                <div className="px-5 pt-3">
                    <Segmented size="sm" label="Quick add meal" value={mealType} onChange={setMealType} options={MEAL_TYPES.map(m => ({ value: m, label: m }))} className="w-full" />
                </div>
                <div className="px-3 pb-3 pt-2">
                    {recent.loading ? (
                        <div className="space-y-2 px-2 py-1">
                            {[0, 1, 2].map(i => (
                                <Skeleton key={i} className="h-12" />
                            ))}
                        </div>
                    ) : recent.error ? (
                        <p className="px-2 py-3 text-[13px] text-ink-3">Recent foods unavailable.</p>
                    ) : recent.data!.length === 0 ? (
                        <p className="px-2 py-3 text-[13px] text-ink-3">Foods you log will appear here for one-tap adding.</p>
                    ) : (
                        <ul className="space-y-0.5">
                            {recent.data!.slice(0, 6).map(f => (
                                <FoodRow
                                    key={f.id}
                                    food={f}
                                    servings={f.lastServings}
                                    onSelect={() => openLogger({ date, mealType, tab: 'recent' })}
                                    onQuickAdd={() => add(f)}
                                    quickState={quick[f.id] ?? 'idle'}
                                    compact
                                />
                            ))}
                        </ul>
                    )}
                    <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => openLogger({ date, mealType, tab: 'search' })}>
                        <Search className="h-3.5 w-3.5" aria-hidden /> Search all foods
                    </Button>
                </div>
            </Card>

            <Card>
                <CardHeader
                    title={
                        <span className="flex items-center gap-2">
                            <Bookmark className="h-4 w-4 text-ink-3" aria-hidden /> Saved meals
                        </span>
                    }
                />
                <div className="p-3">
                    {saved.loading ? (
                        <Skeleton className="mx-2 h-12" />
                    ) : saved.error ? (
                        <p className="px-2 py-3 text-[13px] text-ink-3">Saved meals unavailable.</p>
                    ) : saved.data!.length === 0 ? (
                        <p className="px-2 py-2 text-[13px] text-ink-3">Use “Save as meal” on any logged meal to reuse it here.</p>
                    ) : (
                        <ul className="space-y-0.5">
                            {saved.data!.slice(0, 4).map(m => {
                                const kcal = Math.round(m.items.reduce((t, i) => addToTotals(t, i.food, i.servings), emptyTotals()).calories);
                                return (
                                    <li key={m.id}>
                                        <button
                                            type="button"
                                            onClick={() => openLogger({ date, mealType, tab: 'saved', savedMealId: m.id })}
                                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/[0.03]"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px] font-medium text-ink">{m.name}</span>
                                                <span className="block text-xs text-ink-3">{m.items.length} items</span>
                                            </span>
                                            <span className="num text-[13px] font-semibold text-ink">{kcal}</span>
                                            <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </Card>
        </>
    );
}
