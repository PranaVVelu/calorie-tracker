import type { Nutrition } from '@/lib/types';
import { round } from '@/lib/nutrition';
import { MACRO_META } from '@/components/ui/MacroBar';
import { cn } from '@/components/ui/Card';

/** Live nutrition readout for a portion. Unknown macros show as "Unknown", never 0. */
export function NutritionSummary({ n, className, unknownCount }: { n: Nutrition; className?: string; unknownCount?: Partial<Record<'protein' | 'carbs' | 'fat', number>> }) {
    return (
        <div className={cn('grid grid-cols-4 gap-2 rounded-2xl border border-line bg-surface-2 p-3', className)} aria-live="polite">
            <div>
                <p className="eyebrow">Calories</p>
                <p className="num mt-0.5 text-xl font-semibold text-ink">{Math.round(n.calories)}</p>
            </div>
            {(['protein', 'carbs', 'fat'] as const).map(m => {
                const v = n[m];
                const unk = unknownCount?.[m] ?? 0;
                return (
                    <div key={m}>
                        <p className="eyebrow flex items-center gap-1">
                            <span className={cn('h-1.5 w-1.5 rounded-full', MACRO_META[m].bgClass)} aria-hidden />
                            {MACRO_META[m].label}
                        </p>
                        {v == null ? (
                            <p className="mt-1 text-[13px] font-medium text-warn">Unknown</p>
                        ) : (
                            <p className="num mt-0.5 text-xl font-semibold text-ink">
                                {round(v, 1)}
                                <span className="text-xs font-normal text-ink-3"> g</span>
                                {unk > 0 && <span className="ml-1 text-[11px] font-normal text-warn">+{unk}?</span>}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
