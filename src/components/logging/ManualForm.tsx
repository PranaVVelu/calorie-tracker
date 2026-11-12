'use client';

import { useRef, useState } from 'react';
import { parseManualFood, parseDecimal, validateServings, type ManualFoodErrors } from '@/lib/validation';
import { scaleNutrition } from '@/lib/nutrition';
import type { ManualFoodInput } from '@/lib/types';
import { Field } from '@/components/ui/Field';
import { ServingsInput } from '@/components/ui/ServingsInput';
import { Button } from '@/components/ui/Button';
import { NutritionSummary } from './NutritionSummary';

export interface ManualDraft {
    name: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    servingSize: string;
}

export const emptyDraft: ManualDraft = { name: '', calories: '', protein: '', carbs: '', fat: '', servingSize: '1 serving' };

/**
 * Manual entry for known calories with optional macros. Blank macros are saved
 * as unknown (not zero) so totals can flag them.
 */
export function ManualForm({
    initial = emptyDraft,
    note,
    submitLabel,
    onSubmit,
}: {
    initial?: ManualDraft;
    note?: React.ReactNode;
    submitLabel: string;
    onSubmit: (food: ManualFoodInput, servings: number) => Promise<void>;
}) {
    const [d, setD] = useState<ManualDraft>(initial);
    const [servings, setServings] = useState('1');
    const [errors, setErrors] = useState<ManualFoodErrors & { servings?: string }>({});
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);

    const set = (k: keyof ManualDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setD(prev => ({ ...prev, [k]: e.target.value }));

    const preview = parseManualFood(d).value;
    const sv = parseDecimal(servings);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busyRef.current) return;
        const { value, errors: errs } = parseManualFood(d);
        const sErr = validateServings(sv);
        setErrors({ ...errs, ...(sErr ? { servings: sErr } : {}) });
        if (!value || sErr) return;
        busyRef.current = true;
        setBusy(true);
        try {
            await onSubmit(value, sv!);
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="animate-fade-up space-y-4" noValidate>
            {note}
            <Field label="Food name" error={errors.name}>
                {p => <input {...p} className="input" value={d.name} onChange={set('name')} placeholder="e.g. Chicken wrap from café" autoComplete="off" />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Calories per serving" error={errors.calories}>
                    {p => <input {...p} className="input num" inputMode="decimal" value={d.calories} onChange={set('calories')} placeholder="kcal" />}
                </Field>
                <Field label="Serving size" optional>
                    {p => <input {...p} className="input" value={d.servingSize} onChange={set('servingSize')} placeholder="1 serving" />}
                </Field>
            </div>
            <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-ink-2">
                    Macros per serving <span className="font-normal text-ink-3">· leave blank if unknown</span>
                </legend>
                <div className="grid grid-cols-3 gap-3">
                    {(['protein', 'carbs', 'fat'] as const).map(m => (
                        <Field key={m} label={`${m[0].toUpperCase()}${m.slice(1)} (g)`} error={errors[m]}>
                            {p => <input {...p} className="input num" inputMode="decimal" value={d[m]} onChange={set(m)} placeholder="–" />}
                        </Field>
                    ))}
                </div>
            </fieldset>
            <Field label="Servings eaten" error={errors.servings}>
                {p => <ServingsInput id={p.id} describedBy={p['aria-describedby']} invalid={!!errors.servings} value={servings} onChange={setServings} />}
            </Field>
            {preview && sv != null && sv > 0 && <NutritionSummary n={scaleNutrition(preview, sv)} />}
            <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full sm:w-auto sm:min-w-44">
                    {submitLabel}
                </Button>
            </div>
            <p className="text-center text-xs text-ink-3 sm:text-right">Saved to your foods so you can reuse it.</p>
        </form>
    );
}
