'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SavedMeal } from '@/lib/types';
import { addToTotals, emptyTotals, round } from '@/lib/nutrition';
import { parseDecimal, validateServings } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { NutritionSummary } from './NutritionSummary';
import { cn } from '@/components/ui/Card';

const SCALES = [0.5, 1, 1.5, 2];

/** Review a saved meal before logging: include/exclude items and adjust each portion. */
export function SavedMealLogger({
    meal,
    mealTypeLabel,
    onBack,
    onSubmit,
}: {
    meal: SavedMeal;
    mealTypeLabel: string;
    onBack: () => void;
    onSubmit: (items: { foodId: string; servings: number }[]) => Promise<void>;
}) {
    const [rows, setRows] = useState(() => meal.items.map(i => ({ ...i, raw: String(i.servings), on: true })));
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);

    const parsed = rows.map(r => ({ ...r, v: parseDecimal(r.raw), err: r.on ? validateServings(parseDecimal(r.raw)) : null }));
    const hasError = parsed.some(r => r.err);
    const included = parsed.filter(r => r.on && !r.err);

    const totals = useMemo(() => included.reduce((t, r) => addToTotals(t, r.food, r.v!), emptyTotals()), [included]);

    const scaleAll = (k: number) => setRows(rs => rs.map((r, i) => ({ ...r, raw: String(round(meal.items[i].servings * k, 2)) })));

    const submit = async () => {
        if (hasError || !included.length || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        try {
            await onSubmit(included.map(r => ({ foodId: r.foodId, servings: r.v! })));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };

    return (
        <div className="animate-fade-up space-y-4">
            <div className="flex items-start gap-2">
                <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to saved meals" className="-ml-1 mt-0.5">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink">{meal.name}</h3>
                    <p className="text-[13px] text-ink-3">Adjust portions before logging. Changes here don’t edit the saved meal.</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-[13px] text-ink-3">Scale all</span>
                <div className="flex gap-1.5" role="group" aria-label="Scale all portions">
                    {SCALES.map(k => (
                        <button key={k} type="button" onClick={() => scaleAll(k)} className="num rounded-lg border border-line-strong px-2.5 py-1 text-[13px] text-ink-2 hover:text-ink">
                            {k}×
                        </button>
                    ))}
                </div>
            </div>

            <ul className="divide-y divide-line rounded-2xl border border-line">
                {parsed.map((r, i) => (
                    <li key={r.foodId + i} className={cn('flex items-center gap-3 px-3 py-2.5', !r.on && 'opacity-50')}>
                        <input
                            type="checkbox"
                            checked={r.on}
                            onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                            className="h-4 w-4 accent-[var(--color-accent)]"
                            aria-label={`Include ${r.food.name}`}
                        />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{r.food.name}</p>
                            <p className="text-xs text-ink-3">
                                {r.food.servingSize} · <span className="num">{r.v != null && !r.err ? Math.round(r.food.calories * r.v) : '–'}</span> kcal
                            </p>
                        </div>
                        <div className="w-24">
                            <label className="sr-only" htmlFor={`sm-${i}`}>
                                Servings of {r.food.name}
                            </label>
                            <input
                                id={`sm-${i}`}
                                inputMode="decimal"
                                value={r.raw}
                                disabled={!r.on}
                                aria-invalid={!!r.err || undefined}
                                onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, raw: e.target.value } : x)))}
                                className="input num h-9 min-h-0 py-1 text-center"
                            />
                        </div>
                        <span className="w-6 text-xs text-ink-3" aria-hidden>
                            ×
                        </span>
                    </li>
                ))}
            </ul>
            {hasError && (
                <p className="text-xs text-danger" role="alert">
                    Check the highlighted amounts (must be more than 0).
                </p>
            )}

            <NutritionSummary n={totals} unknownCount={totals.unknown} />

            <div className="flex justify-end">
                <Button variant="primary" size="lg" loading={busy} disabled={hasError || !included.length} onClick={submit} className="w-full sm:w-auto">
                    Log {included.length} item{included.length === 1 ? '' : 's'} to {mealTypeLabel} · {Math.round(totals.calories)} kcal
                </Button>
            </div>
        </div>
    );
}
