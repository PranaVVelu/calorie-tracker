'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import type { Food } from '@/lib/types';
import { parseMeasuredServing, round, scaleNutrition } from '@/lib/nutrition';
import { parseDecimal, validateServings } from '@/lib/validation';
import { ServingsInput } from '@/components/ui/ServingsInput';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { NutritionSummary } from './NutritionSummary';
import { cn } from '@/components/ui/Card';

const QUICK = [0.5, 1, 1.5, 2];

/**
 * Portion step: pick an amount (servings, or grams/ml when the serving is a
 * plain weight) and see live nutrition before adding.
 */
export function PortionEditor({
    food,
    initialServings = 1,
    submitLabel,
    onSubmit,
    onBack,
    onToggleFavorite,
    secondaryLabel,
    onSecondary,
}: {
    food: Food;
    initialServings?: number;
    submitLabel: (kcal: number) => string;
    onSubmit: (servings: number) => Promise<void> | void;
    onBack?: () => void;
    onToggleFavorite?: () => void;
    secondaryLabel?: string;
    onSecondary?: (servings: number) => Promise<void> | void;
}) {
    const measured = parseMeasuredServing(food.servingSize);
    const [unit, setUnit] = useState<'servings' | 'amount'>('servings');
    const [raw, setRaw] = useState(String(round(initialServings, 2)));
    const [busy, setBusy] = useState<'main' | 'secondary' | null>(null);
    const [touched, setTouched] = useState(false);
    const busyRef = useRef(false);

    const servings = useMemo(() => {
        const v = parseDecimal(raw);
        if (v == null) return null;
        return unit === 'amount' && measured ? v / measured.amount : v;
    }, [raw, unit, measured]);
    const error = validateServings(servings);
    const n = scaleNutrition(food, servings ?? 0);

    const switchUnit = (u: 'servings' | 'amount') => {
        if (!measured || u === unit) return;
        const s = servings ?? 1;
        setRaw(String(u === 'amount' ? round(s * measured.amount, 1) : round(s, 2)));
        setUnit(u);
    };

    const run = async (which: 'main' | 'secondary') => {
        setTouched(true);
        if (error || servings == null || busyRef.current) return;
        busyRef.current = true;
        setBusy(which);
        try {
            await (which === 'main' ? onSubmit(servings) : onSecondary?.(servings));
        } finally {
            busyRef.current = false;
            setBusy(null);
        }
    };

    return (
        <form
            className="animate-fade-up space-y-4"
            onSubmit={e => {
                e.preventDefault();
                run('main');
            }}
        >
            <div className="flex items-start gap-2">
                {onBack && (
                    <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to list" className="-ml-1 mt-0.5">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                )}
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-ink">{food.name}</h3>
                    <p className="text-[13px] text-ink-3">
                        1 serving = {food.servingSize} · {Math.round(food.calories)} kcal
                    </p>
                </div>
                {onToggleFavorite && (
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={onToggleFavorite}
                        aria-pressed={!!food.favorite}
                        aria-label={food.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        className={food.favorite ? 'text-warn' : undefined}
                    >
                        <Star className="h-4 w-4" fill={food.favorite ? 'currentColor' : 'none'} />
                    </Button>
                )}
            </div>

            {measured && (
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-ink-3">Enter as</span>
                    <Segmented
                        size="sm"
                        label="Amount unit"
                        value={unit}
                        onChange={switchUnit}
                        options={[
                            { value: 'servings', label: 'Servings' },
                            { value: 'amount', label: measured.unit === 'g' ? 'Grams' : 'Millilitres' },
                        ]}
                    />
                </div>
            )}
            <Field
                label="Amount"
                error={touched ? error : null}
                hint={unit === 'amount' && servings != null && !error ? `${round(servings, 2)} servings` : 'Decimals like 1.5 or 0.25 work'}
            >
                {p => (
                    <ServingsInput
                        id={p.id}
                        describedBy={p['aria-describedby']}
                        invalid={touched && !!error}
                        value={raw}
                        onChange={v => {
                            setRaw(v);
                            setTouched(true);
                        }}
                        step={unit === 'amount' && measured ? (measured.amount >= 100 ? 10 : 5) : 0.25}
                        unit={unit === 'amount' && measured ? measured.unit : 'servings'}
                    />
                )}
            </Field>

            {unit === 'servings' && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick amounts">
                    {QUICK.map(q => (
                        <button
                            key={q}
                            type="button"
                            onClick={() => setRaw(String(q))}
                            aria-pressed={servings === q}
                            className={cn(
                                'num rounded-lg border px-3 py-1.5 text-[13px] font-medium',
                                servings === q ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line-strong text-ink-2 hover:text-ink'
                            )}
                        >
                            {q}×
                        </button>
                    ))}
                </div>
            )}

            <NutritionSummary n={n} />

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                {secondaryLabel && onSecondary && (
                    <Button type="button" variant="secondary" size="lg" loading={busy === 'secondary'} disabled={!!busy} onClick={() => run('secondary')}>
                        {secondaryLabel}
                    </Button>
                )}
                <Button type="submit" variant="primary" size="lg" loading={busy === 'main'} disabled={!!busy} className="sm:min-w-44">
                    {submitLabel(Math.round(n.calories))}
                </Button>
            </div>
        </form>
    );
}
