'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useMutation, useQuery } from '@/lib/data/DataProvider';
import { useToast } from '@/components/ui/Toast';
import { addToTotals, emptyTotals } from '@/lib/nutrition';
import { parseDecimal, validateServings } from '@/lib/validation';
import type { Food, SavedMeal } from '@/lib/types';
import { NutritionSummary } from '@/components/logging/NutritionSummary';

type Row = { food: Food; raw: string };

/**
 * Create or edit a saved meal. Editing changes only the template; entries
 * already logged from it keep their own nutrition snapshot.
 */
export function SavedMealEditor({ meal, open, onClose }: { meal: SavedMeal | null; open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onClose={onClose} title={meal ? 'Edit saved meal' : 'New saved meal'} description={meal ? 'Past logs from this meal stay as they were.' : 'Group foods you often eat together.'} size="lg">
            {open && <EditorBody key={meal?.id ?? 'new'} meal={meal} onClose={onClose} />}
        </Dialog>
    );
}

function EditorBody({ meal, onClose }: { meal: SavedMeal | null; onClose: () => void }) {
    const mutate = useMutation();
    const toast = useToast();
    const [name, setName] = useState(meal?.name ?? '');
    const [rows, setRows] = useState<Row[]>(() => meal?.items.map(i => ({ food: i.food, raw: String(i.servings) })) ?? []);
    const [errors, setErrors] = useState<{ name?: string; items?: string }>({});
    const [busy, setBusy] = useState(false);
    const [text, setText] = useState('');
    const [debounced, setDebounced] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setDebounced(text.trim()), 220);
        return () => clearTimeout(t);
    }, [text]);
    const results = useQuery(debounced.length >= 2 ? `search:${debounced.toLowerCase()}` : null, api => api.searchFoods(debounced));

    const parsed = rows.map(r => ({ ...r, v: parseDecimal(r.raw), err: validateServings(parseDecimal(r.raw)) }));
    const totals = parsed.filter(r => !r.err).reduce((t, r) => addToTotals(t, r.food, r.v!), emptyTotals());

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        const errs: typeof errors = {};
        if (!name.trim()) errs.name = 'Give it a name you’ll recognize';
        if (!rows.length) errs.items = 'Add at least one food';
        else if (parsed.some(r => r.err)) errs.items = 'Check the amounts (must be more than 0)';
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setBusy(true);
        try {
            await mutate(api => api.saveSavedMeal({ id: meal?.id, name, items: parsed.map(r => ({ foodId: r.food.id, servings: r.v! })) }));
            toast({ message: meal ? 'Saved meal updated' : `Saved “${name.trim()}”` });
            onClose();
        } catch (err) {
            toast({ message: err instanceof Error ? err.message : 'Could not save', tone: 'error' });
            setBusy(false);
        }
    };

    return (
        <form onSubmit={save} className="space-y-4" noValidate>
            <Field label="Name" error={errors.name}>
                {p => <input {...p} className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Usual breakfast" maxLength={60} data-autofocus={!meal || undefined} />}
            </Field>

            <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-2">Foods</p>
                {rows.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-ink-3">Search below to add foods.</p>
                ) : (
                    <ul className="divide-y divide-line rounded-2xl border border-line">
                        {parsed.map((r, i) => (
                            <li key={r.food.id + i} className="flex items-center gap-3 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-ink">{r.food.name}</p>
                                    <p className="text-xs text-ink-3">
                                        {r.food.servingSize} · <span className="num">{r.err ? '–' : Math.round(r.food.calories * r.v!)}</span> kcal
                                    </p>
                                </div>
                                <label className="sr-only" htmlFor={`sme-${i}`}>
                                    Servings of {r.food.name}
                                </label>
                                <input
                                    id={`sme-${i}`}
                                    inputMode="decimal"
                                    value={r.raw}
                                    aria-invalid={!!r.err || undefined}
                                    onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, raw: e.target.value } : x)))}
                                    className="input num h-9 min-h-0 w-20 py-1 text-center"
                                />
                                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${r.food.name}`} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
                {errors.items && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                        {errors.items}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
                    <label htmlFor="sme-search" className="sr-only">
                        Search foods to add
                    </label>
                    <input id="sme-search" type="search" value={text} onChange={e => setText(e.target.value)} placeholder="Add a food…" className="input pl-9" autoComplete="off" />
                </div>
                {debounced.length >= 2 && (
                    <ul className="max-h-48 overflow-y-auto rounded-2xl border border-line">
                        {results.data?.length === 0 && <li className="px-3 py-3 text-[13px] text-ink-3">No matches.</li>}
                        {(results.data ?? []).map(f => (
                            <li key={f.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRows(rs => [...rs, { food: f, raw: '1' }]);
                                        setText('');
                                    }}
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.03]"
                                >
                                    <Plus className="h-4 w-4 text-accent" aria-hidden />
                                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{f.name}</span>
                                    <span className="num text-xs text-ink-3">{Math.round(f.calories)} kcal</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {rows.length > 0 && <NutritionSummary n={totals} unknownCount={totals.unknown} />}

            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" loading={busy}>
                    {meal ? 'Save changes' : 'Create meal'}
                </Button>
            </div>
        </form>
    );
}
