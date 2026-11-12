'use client';

import { useState } from 'react';
import { Bookmark, Pencil, Plus, Star, Trash2, PenLine } from 'lucide-react';
import { useMutation, useQuery } from '@/lib/data/DataProvider';
import { useApp } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Dialog } from '@/components/ui/Dialog';
import { MacroChips } from '@/components/ui/MacroBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { FoodRow } from '@/components/logging/FoodRow';
import { SavedMealEditor } from '@/components/foods/SavedMealEditor';
import { addToTotals, emptyTotals, round } from '@/lib/nutrition';
import type { Food, SavedMeal } from '@/lib/types';

type Tab = 'meals' | 'mine' | 'favorites';

export default function FoodsPage() {
    const [tab, setTab] = useState<Tab>('meals');
    const [editing, setEditing] = useState<{ meal: SavedMeal | null } | null>(null);

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="eyebrow">Library</p>
                    <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">Foods</h1>
                </div>
                {tab === 'meals' && (
                    <Button variant="primary" onClick={() => setEditing({ meal: null })}>
                        <Plus className="h-4 w-4" aria-hidden /> New saved meal
                    </Button>
                )}
            </header>
            <Segmented
                label="Library section"
                value={tab}
                onChange={setTab}
                options={[
                    { value: 'meals', label: 'Saved meals' },
                    { value: 'mine', label: 'My foods' },
                    { value: 'favorites', label: 'Favorites' },
                ]}
            />
            {tab === 'meals' && <SavedMeals onEdit={m => setEditing({ meal: m })} onNew={() => setEditing({ meal: null })} />}
            {tab === 'mine' && <MyFoods />}
            {tab === 'favorites' && <Favorites />}
            <SavedMealEditor open={!!editing} meal={editing?.meal ?? null} onClose={() => setEditing(null)} />
        </div>
    );
}

function GridSkeleton() {
    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-40 rounded-[1.25rem]" />
            ))}
        </div>
    );
}

function SavedMeals({ onEdit, onNew }: { onEdit: (m: SavedMeal) => void; onNew: () => void }) {
    const q = useQuery('saved-meals', api => api.getSavedMeals());
    const { openLogger } = useApp();
    const mutate = useMutation();
    const toast = useToast();
    const [confirm, setConfirm] = useState<SavedMeal | null>(null);
    const [busy, setBusy] = useState(false);

    if (q.error) return <Card><ErrorState error={q.error} onRetry={q.reload} /></Card>;
    if (q.loading) return <GridSkeleton />;
    if (!q.data!.length)
        return (
            <Card>
                <EmptyState
                    icon={<Bookmark className="h-5 w-5" />}
                    title="No saved meals yet"
                    body="Save meals you repeat, like your usual breakfast, then log them in one step."
                    action={
                        <Button variant="primary" onClick={onNew}>
                            <Plus className="h-4 w-4" aria-hidden /> Create one
                        </Button>
                    }
                />
            </Card>
        );

    return (
        <>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {q.data!.map(m => {
                    const t = m.items.reduce((acc, i) => addToTotals(acc, i.food, i.servings), emptyTotals());
                    return (
                        <li key={m.id}>
                            <Card as="article" className="flex h-full flex-col p-4" aria-label={m.name}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h2 className="truncate text-[15px] font-semibold text-ink">{m.name}</h2>
                                        <p className="mt-0.5 text-xs text-ink-3">{m.items.length} items</p>
                                    </div>
                                    <p className="num shrink-0 text-xl font-semibold text-ink">
                                        {Math.round(t.calories)}
                                        <span className="text-xs font-normal text-ink-3"> kcal</span>
                                    </p>
                                </div>
                                <MacroChips className="mt-2" protein={t.protein} carbs={t.carbs} fat={t.fat} />
                                <ul className="mt-3 flex-1 space-y-1 text-[13px] text-ink-2">
                                    {m.items.map((i, idx) => (
                                        <li key={i.foodId + idx} className="flex justify-between gap-2">
                                            <span className="truncate">{i.food.name}</span>
                                            <span className="num shrink-0 text-ink-3">{round(i.servings, 2)}×</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 flex gap-1.5">
                                    <Button size="sm" variant="subtle" className="flex-1" onClick={() => openLogger({ tab: 'saved', savedMealId: m.id })}>
                                        <Plus className="h-3.5 w-3.5" aria-hidden /> Log
                                    </Button>
                                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${m.name}`} onClick={() => onEdit(m)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${m.name}`} onClick={() => setConfirm(m)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </Card>
                        </li>
                    );
                })}
            </ul>
            <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete saved meal?" description={confirm ? `“${confirm.name}” will be removed. Meals you already logged stay unchanged.` : undefined} size="sm">
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setConfirm(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        loading={busy}
                        onClick={async () => {
                            if (!confirm) return;
                            setBusy(true);
                            try {
                                await mutate(api => api.deleteSavedMeal(confirm.id));
                                toast({ message: `Deleted “${confirm.name}”` });
                                setConfirm(null);
                            } catch {
                                toast({ message: 'Could not delete', tone: 'error' });
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Delete
                    </Button>
                </div>
            </Dialog>
        </>
    );
}

function useFavToggle() {
    const mutate = useMutation();
    const toast = useToast();
    return async (f: Food) => {
        try {
            await mutate(api => api.setFavorite(f.id, !f.favorite));
        } catch {
            toast({ message: 'Could not update favorite', tone: 'error' });
        }
    };
}

function MyFoods() {
    const q = useQuery('my-foods', api => api.getMyFoods());
    const fav = useFavToggle();
    const { openLogger } = useApp();
    if (q.error) return <Card><ErrorState error={q.error} onRetry={q.reload} /></Card>;
    if (q.loading) return <Skeleton className="h-48 rounded-[1.25rem]" />;
    if (!q.data!.length)
        return (
            <Card>
                <EmptyState
                    icon={<PenLine className="h-5 w-5" />}
                    title="No custom foods yet"
                    body="Foods you enter manually are saved here so you can reuse them."
                    action={
                        <Button variant="subtle" onClick={() => openLogger({ tab: 'manual' })}>
                            Add a food
                        </Button>
                    }
                />
            </Card>
        );
    return (
        <Card className="p-2">
            <ul>
                {q.data!.map(f => (
                    <FoodRow
                        key={f.id}
                        food={f}
                        meta={f.protein == null || f.carbs == null || f.fat == null ? 'some macros unknown' : undefined}
                        onSelect={() => openLogger({ tab: 'search' })}
                        onToggleFavorite={() => fav(f)}
                    />
                ))}
            </ul>
        </Card>
    );
}

function Favorites() {
    const q = useQuery('favorites', api => api.getFavorites());
    const fav = useFavToggle();
    const { openLogger } = useApp();
    if (q.error) return <Card><ErrorState error={q.error} onRetry={q.reload} /></Card>;
    if (q.loading) return <Skeleton className="h-48 rounded-[1.25rem]" />;
    if (!q.data!.length)
        return (
            <Card>
                <EmptyState icon={<Star className="h-5 w-5" />} title="No favorites yet" body="Star foods while logging to keep them one tap away." />
            </Card>
        );
    return (
        <Card className="p-2">
            <ul>
                {q.data!.map(f => (
                    <FoodRow key={f.id} food={f} onSelect={() => openLogger({ tab: 'favorites' })} onToggleFavorite={() => fav(f)} />
                ))}
            </ul>
        </Card>
    );
}

