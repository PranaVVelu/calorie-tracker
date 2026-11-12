'use client';

import { Minus, Plus } from 'lucide-react';
import { round } from '@/lib/nutrition';
import { parseDecimal, MAX_SERVINGS } from '@/lib/validation';
import { cn } from './Card';

/**
 * Decimal-friendly quantity stepper. Keeps the raw text so users can type
 * "1." or ".5" without the field fighting them.
 */
export function ServingsInput({
    value,
    onChange,
    step = 0.25,
    unit = 'servings',
    id,
    invalid,
    describedBy,
    className,
    label = 'Amount',
}: {
    value: string;
    onChange: (raw: string) => void;
    step?: number;
    unit?: string;
    id?: string;
    invalid?: boolean;
    describedBy?: string;
    className?: string;
    label?: string;
}) {
    const n = parseDecimal(value) ?? 0;
    const bump = (dir: 1 | -1) => {
        const next = Math.min(MAX_SERVINGS, Math.max(step, round(n + dir * step, 2)));
        onChange(String(next));
    };
    return (
        <div className={cn('flex items-stretch gap-2', className)}>
            <button type="button" onClick={() => bump(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-surface-2 text-ink-2 hover:text-ink" aria-label={`Decrease ${label.toLowerCase()}`}>
                <Minus className="h-4 w-4" />
            </button>
            <div className="relative min-w-0 flex-1">
                <input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className="input num pr-20 text-center text-lg font-semibold"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">{unit}</span>
            </div>
            <button type="button" onClick={() => bump(1)} className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-surface-2 text-ink-2 hover:text-ink" aria-label={`Increase ${label.toLowerCase()}`}>
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
}
