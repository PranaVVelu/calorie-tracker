'use client';

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PortionEditor } from '@/components/logging/PortionEditor';
import { useMutation } from '@/lib/data/DataProvider';
import { useToast } from '@/components/ui/Toast';
import { useApp } from '@/components/app/AppContext';
import { formatDayLabel, shiftKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { sumEntries } from '@/lib/nutrition';
import { MEAL_TYPES, type DateKey, type Food, type LogEntry, type MealType } from '@/lib/types';

/** Deletes an entry and offers Undo (restores from its snapshot). */
export function useDeleteEntry() {
    const mutate = useMutation();
    const toast = useToast();
    const { flash } = useApp();
    return async (entry: LogEntry) => {
        try {
            const removed = await mutate(api => api.deleteEntry(entry.id));
            toast({
                message: `Removed ${removed.name}`,
                action: {
                    label: 'Undo',
                    onClick: async () => {
                        const restored = await mutate(api => api.restoreEntry(removed));
                        flash([restored.id]);
                    },
                },
            });
        } catch (e) {
            toast({ message: e instanceof Error ? e.message : 'Could not delete', tone: 'error' });
        }
    };
}

export function EditEntryDialog({ entry, onClose }: { entry: LogEntry | null; onClose: () => void }) {
    return (
        <Dialog open={!!entry} onClose={onClose} title="Edit entry" description={entry ? `${formatDayLabel(entry.date)} · logged item` : undefined}>
            {entry && <EditEntryBody entry={entry} onClose={onClose} />}
        </Dialog>
    );
}

function EditEntryBody({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
    const mutate = useMutation();
    const toast = useToast();
    const { flash } = useApp();
    const del = useDeleteEntry();
    const [mealType, setMealType] = useState<MealType>(entry.mealType);
    // The entry's own snapshot is the "food" here, so editing never depends on the current food record.
    const food: Food = { id: entry.foodId, name: entry.name, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, servingSize: entry.servingSize, source: 'snapshot', mine: false };

    return (
        <div className="space-y-4">
            <Segmented label="Meal" value={mealType} onChange={setMealType} options={MEAL_TYPES.map(m => ({ value: m, label: m }))} className="w-full" />
            <PortionEditor
                food={food}
                initialServings={entry.servings}
                submitLabel={kcal => `Save · ${kcal} kcal`}
                onSubmit={async servings => {
                    try {
                        const updated = await mutate(api => api.updateEntry(entry.id, { servings, mealType }));
                        flash([updated.id]);
                        toast({ message: 'Entry updated' });
                        onClose();
                    } catch (e) {
                        toast({ message: e instanceof Error ? e.message : 'Could not save', tone: 'error' });
                    }
                }}
            />
            <div className="border-t border-line pt-3">
                <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                        onClose();
                        await del(entry);
                    }}
                >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete entry
                </Button>
            </div>
        </div>
    );
}

export function CopyMealDialog({ source, onClose }: { source: { date: DateKey; mealType: MealType; entries: LogEntry[] } | null; onClose: () => void }) {
    return (
        <Dialog open={!!source} onClose={onClose} title={source ? `Copy ${source.mealType.toLowerCase()}` : 'Copy meal'} description={source ? `From ${formatDayLabel(source.date)} · ${source.entries.length} items` : undefined} size="sm">
            {source && <CopyBody source={source} onClose={onClose} />}
        </Dialog>
    );
}

function CopyBody({ source, onClose }: { source: { date: DateKey; mealType: MealType; entries: LogEntry[] }; onClose: () => void }) {
    const mutate = useMutation();
    const toast = useToast();
    const { flash } = useApp();
    const [toDate, setToDate] = useState(shiftKey(source.date, 1));
    const [toMeal, setToMeal] = useState<MealType>(source.mealType);
    const [busy, setBusy] = useState(false);
    const requestId = useRef(newId('c_'));
    const kcal = Math.round(sumEntries(source.entries).calories);

    return (
        <form
            className="space-y-4"
            onSubmit={async e => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                try {
                    const created = await mutate(api => api.copyMeal({ fromDate: source.date, fromMealType: source.mealType, toDate, toMealType: toMeal, requestId: requestId.current }));
                    flash(created.map(c => c.id));
                    toast({ message: `Copied ${created.length} items to ${formatDayLabel(toDate)} ${toMeal.toLowerCase()}` });
                    onClose();
                } catch (err) {
                    toast({ message: err instanceof Error ? err.message : 'Could not copy', tone: 'error' });
                    setBusy(false);
                }
            }}
        >
            <Field label="To day" hint={formatDayLabel(toDate)}>
                {p => (
                    <input
                        {...p}
                        type="date"
                        value={toDate}
                        onChange={e => {
                            if (e.target.value) {
                                setToDate(e.target.value);
                                requestId.current = newId('c_');
                            }
                        }}
                        className="input num"
                    />
                )}
            </Field>
            <div className="flex flex-wrap gap-1.5">
                {[-1, 0, 1].map(d => {
                    const k = shiftKey(source.date, d);
                    return (
                        <Button key={d} size="sm" variant={k === toDate ? 'subtle' : 'ghost'} onClick={() => setToDate(k)}>
                            {formatDayLabel(k)}
                        </Button>
                    );
                })}
            </div>
            <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-2">To meal</p>
                <Segmented label="To meal" value={toMeal} onChange={setToMeal} options={MEAL_TYPES.map(m => ({ value: m, label: m }))} className="w-full" />
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                Copy {source.entries.length} items · {kcal} kcal
            </Button>
        </form>
    );
}

export function SaveMealDialog({ source, onClose }: { source: { mealType: MealType; entries: LogEntry[] } | null; onClose: () => void }) {
    return (
        <Dialog open={!!source} onClose={onClose} title="Save as meal" description="Reuse this combination in one tap." size="sm">
            {source && <SaveMealBody source={source} onClose={onClose} />}
        </Dialog>
    );
}

function SaveMealBody({ source, onClose }: { source: { mealType: MealType; entries: LogEntry[] }; onClose: () => void }) {
    const mutate = useMutation();
    const toast = useToast();
    const [name, setName] = useState(`My ${source.mealType.toLowerCase()}`);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    return (
        <form
            className="space-y-4"
            onSubmit={async e => {
                e.preventDefault();
                if (busy) return;
                if (!name.trim()) return setErr('Give it a name');
                setBusy(true);
                try {
                    await mutate(api => api.saveSavedMeal({ name, items: source.entries.map(x => ({ foodId: x.foodId, servings: x.servings })) }));
                    toast({ message: `Saved “${name.trim()}”` });
                    onClose();
                } catch (e2) {
                    setErr(e2 instanceof Error ? e2.message : 'Could not save');
                    setBusy(false);
                }
            }}
        >
            <Field label="Name" error={err}>
                {p => <input {...p} autoFocus data-autofocus onFocus={e => e.currentTarget.select()} className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} />}
            </Field>
            <ul className="space-y-1 rounded-2xl border border-line p-3 text-[13px] text-ink-2">
                {source.entries.map(e => (
                    <li key={e.id} className="flex justify-between gap-2">
                        <span className="truncate">
                            {e.servings}× {e.name}
                        </span>
                        <span className="num text-ink-3">{Math.round(e.calories * e.servings)}</span>
                    </li>
                ))}
            </ul>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                Save meal
            </Button>
        </form>
    );
}
