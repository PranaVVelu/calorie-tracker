'use client';

import { Check, Plus, Star } from 'lucide-react';
import type { Food } from '@/lib/types';
import { MacroChips } from '@/components/ui/MacroBar';
import { cn } from '@/components/ui/Card';
import { round } from '@/lib/nutrition';

export function FoodRow({
    food,
    servings = 1,
    onSelect,
    onQuickAdd,
    onToggleFavorite,
    quickState,
    meta,
    compact,
}: {
    food: Food;
    servings?: number;
    onSelect: () => void;
    onQuickAdd?: () => void;
    onToggleFavorite?: () => void;
    quickState?: 'idle' | 'pending' | 'done';
    meta?: string;
    /** Hide macro chips (narrow containers). */
    compact?: boolean;
}) {
    return (
        <li className="group flex items-center gap-1 rounded-xl hover:bg-white/[0.03]">
            <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{food.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                        <span>
                            {servings !== 1 && <span className="text-ink-2">{round(servings, 2)} × </span>}
                            {food.servingSize}
                        </span>
                        {meta && <span>· {meta}</span>}
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                    <span className="num text-sm font-semibold text-ink">
                        {Math.round(food.calories * servings)}
                        <span className="text-xs font-normal text-ink-3"> kcal</span>
                    </span>
                    <MacroChips
                        className={cn('hidden', !compact && 'sm:inline-flex')}
                        protein={food.protein == null ? null : food.protein * servings}
                        carbs={food.carbs == null ? null : food.carbs * servings}
                        fat={food.fat == null ? null : food.fat * servings}
                    />
                </span>
            </button>
            {onToggleFavorite && (
                <button
                    type="button"
                    onClick={onToggleFavorite}
                    aria-pressed={!!food.favorite}
                    aria-label={food.favorite ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
                    className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', food.favorite ? 'text-warn' : 'text-ink-3 hover:text-ink')}
                >
                    <Star className="h-4 w-4" fill={food.favorite ? 'currentColor' : 'none'} />
                </button>
            )}
            {onQuickAdd && (
                <button
                    type="button"
                    onClick={onQuickAdd}
                    disabled={quickState === 'pending' || quickState === 'done'}
                    aria-label={quickState === 'done' ? `${food.name} added` : `Quick add ${round(servings, 2)} × ${food.name}`}
                    className={cn(
                        'mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
                        quickState === 'done' ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent hover:bg-[rgb(45_212_191/0.22)]'
                    )}
                >
                    {quickState === 'done' ? <Check className="h-4 w-4" /> : <Plus className={cn('h-4 w-4', quickState === 'pending' && 'animate-pulse')} />}
                </button>
            )}
        </li>
    );
}
