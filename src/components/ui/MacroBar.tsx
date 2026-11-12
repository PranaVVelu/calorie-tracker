import type { MacroKey } from '@/lib/nutrition';
import { cn } from './Card';

export const MACRO_META: Record<MacroKey, { label: string; short: string; color: string; textClass: string; bgClass: string }> = {
    protein: { label: 'Protein', short: 'P', color: 'var(--color-protein)', textClass: 'text-protein', bgClass: 'bg-protein' },
    carbs: { label: 'Carbs', short: 'C', color: 'var(--color-carbs)', textClass: 'text-carbs', bgClass: 'bg-carbs' },
    fat: { label: 'Fat', short: 'F', color: 'var(--color-fat)', textClass: 'text-fat', bgClass: 'bg-fat' },
};

/** Macro progress row: label, consumed / target grams, bar, unknown-item note. */
export function MacroBar({ macro, value, target, unknown = 0, compact }: { macro: MacroKey; value: number; target: number; unknown?: number; compact?: boolean }) {
    const meta = MACRO_META[macro];
    const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
    const left = Math.round(target - value);
    return (
        <div className="min-w-0">
            <div className={cn('flex gap-x-2', compact ? 'items-baseline justify-between' : 'flex-col')}>
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
                    <span className={cn('h-2 w-2 rounded-full', meta.bgClass)} aria-hidden />
                    {meta.label}
                </span>
                <span className="num whitespace-nowrap text-[13px] text-ink-3">
                    <span className={cn('font-semibold text-ink', compact ? 'text-sm' : 'text-base sm:text-lg')}>{Math.round(value)}</span>
                    <span className="text-xs"> / {target} g</span>
                </span>
            </div>
            <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"
                role="progressbar"
                aria-label={`${meta.label}`}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.round(value)}
                aria-valuetext={`${Math.round(value)} of ${target} grams${unknown ? `, ${unknown} item${unknown > 1 ? 's' : ''} unknown` : ''}`}
            >
                <div className={cn('bar-fill h-full rounded-full', meta.bgClass)} style={{ width: `${pct}%` }} />
            </div>
            {!compact && (
                <p className="mt-1.5 text-[11px] leading-snug text-ink-3 sm:text-xs">
                    {left >= 0 ? `${left} g left` : `${-left} g over`}
                    {unknown > 0 && <span className="block text-warn">{unknown} item{unknown > 1 ? 's' : ''} unknown</span>}
                </p>
            )}
        </div>
    );
}

/** Inline macro chips for list rows. Unknown values render as "–". */
export function MacroChips({ protein, carbs, fat, className }: { protein: number | null; carbs: number | null; fat: number | null; className?: string }) {
    const v = (x: number | null) => (x == null ? '–' : Math.round(x * 10) / 10);
    return (
        <span className={cn('num inline-flex gap-2 text-xs text-ink-3', className)}>
            <span>
                <span className="text-protein">P</span> {v(protein)}
            </span>
            <span>
                <span className="text-carbs">C</span> {v(carbs)}
            </span>
            <span>
                <span className="text-fat">F</span> {v(fat)}
            </span>
        </span>
    );
}
