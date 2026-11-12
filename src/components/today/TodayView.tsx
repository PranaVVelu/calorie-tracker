'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Copy, BookmarkPlus, Pencil, Trash2, MoreHorizontal, Sparkles, Target, Utensils } from 'lucide-react';
import { useData, useQuery } from '@/lib/data/DataProvider';
import { useApp, defaultMealType } from '@/components/app/AppContext';
import { Card, cn } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CalorieRing } from '@/components/ui/CalorieRing';
import { MacroBar, MacroChips } from '@/components/ui/MacroBar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { calorieStatus, groupByMeal, sumEntries, addToTotals, emptyTotals, round, type Totals } from '@/lib/nutrition';
import { formatDayLabel, isDateKey, shiftKey, todayKey, keyToLocalDate } from '@/lib/dates';
import { MEAL_TYPES, type DayLog, type LogEntry, type MealType } from '@/lib/types';
import { format } from 'date-fns';
import { CopyMealDialog, EditEntryDialog, SaveMealDialog, useDeleteEntry } from './EntryDialogs';
import { QuickAddPanel } from './QuickAddPanel';

export function TodayView() {
    const params = useSearchParams();
    const router = useRouter();
    const today = todayKey();
    const raw = params.get('date');
    const date = raw && isDateKey(raw) ? raw : today;
    const { setSelectedDate } = useApp();
    const { mode, enterDemo } = useData();

    useEffect(() => setSelectedDate(date), [date, setSelectedDate]);

    const go = (k: string) => router.replace(k === today ? '/' : `/?date=${k}`, { scroll: false });

    const profile = useQuery('profile', api => api.getProfile());
    const day = useQuery(profile.data ? `day:${date}` : null, api => api.getDay(date));

    if (profile.error) {
        return (
            <Card className="mx-auto mt-10 max-w-lg">
                <ErrorState error={profile.error} onRetry={profile.reload} />
                {mode === 'live' && (
                    <div className="-mt-4 flex justify-center pb-8">
                        <Button variant="subtle" onClick={enterDemo}>
                            <Sparkles className="h-4 w-4" aria-hidden /> Explore the demo
                        </Button>
                    </div>
                )}
            </Card>
        );
    }
    if (!profile.loading && profile.data === null) return <Welcome />;

    return (
        <div className="space-y-5">
            <DateHeader date={date} today={today} onChange={go} name={profile.data?.name} />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-5">
                    {day.error ? (
                        <Card>
                            <ErrorState error={day.error} onRetry={day.reload} />
                        </Card>
                    ) : !day.data ? (
                        <SummarySkeleton />
                    ) : (
                        <div className={cn('space-y-5 transition-opacity', (day.refreshing || day.data.date !== date) && 'opacity-60')} aria-busy={day.refreshing}>
                            <Summary day={day.data} />
                            <Meals day={day.data} />
                        </div>
                    )}
                </div>
                <aside className="min-w-0 space-y-5" aria-label="Quick add">
                    <QuickAddPanel date={date} />
                </aside>
            </div>
        </div>
    );
}

function DateHeader({ date, today, onChange, name }: { date: string; today: string; onChange: (k: string) => void; name?: string }) {
    const isToday = date === today;
    return (
        <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <p className="eyebrow">{isToday ? (name ? `Hi, ${name.split(' ')[0]}` : 'Today') : format(keyToLocalDate(date), 'EEEE')}</p>
                <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">{isToday ? 'Today' : formatDayLabel(date, today)}</h1>
            </div>
            <div className="flex items-center gap-1.5">
                <Button size="icon" variant="secondary" onClick={() => onChange(shiftKey(date, -1))} aria-label={`Previous day, ${formatDayLabel(shiftKey(date, -1), today)}`}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <label className="sr-only" htmlFor="day-picker">
                    Choose day
                </label>
                <input
                    id="day-picker"
                    type="date"
                    value={date}
                    max={shiftKey(today, 7)}
                    onChange={e => e.target.value && onChange(e.target.value)}
                    className="input num h-10 min-h-0 w-[9.5rem] py-1.5 text-sm"
                />
                <Button size="icon" variant="secondary" onClick={() => onChange(shiftKey(date, 1))} aria-label={`Next day, ${formatDayLabel(shiftKey(date, 1), today)}`}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                {!isToday && (
                    <Button size="md" variant="subtle" onClick={() => onChange(today)}>
                        Today
                    </Button>
                )}
            </div>
        </header>
    );
}

function Summary({ day }: { day: DayLog }) {
    const totals = useMemo(() => sumEntries(day.entries), [day.entries]);
    const t = day.targets;
    const status = calorieStatus(totals.calories, t.calories);
    const over = status.over > 0;

    return (
        <Card className="overflow-hidden" aria-labelledby="summary-title">
            <h2 id="summary-title" className="sr-only">
                Daily summary
            </h2>
            <div className="grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8 sm:p-6">
                <div className="relative mx-auto grid place-items-center">
                    <CalorieRing consumed={totals.calories} target={t.calories} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="num text-[44px] font-semibold leading-none tracking-tight text-ink">{(over ? status.over : status.remaining).toLocaleString()}</span>
                        <span className="mt-1.5 text-[13px] text-ink-2">{over ? 'kcal over target' : 'kcal left'}</span>
                    </div>
                </div>
                <div className="min-w-0 space-y-5">
                    <dl className="grid grid-cols-3 gap-3">
                        <Stat label="Eaten" value={Math.round(totals.calories)} />
                        <Stat label="Target" value={t.calories} />
                        <Stat label={over ? 'Over' : 'Left'} value={over ? status.over : status.remaining} accent={!over} />
                    </dl>
                    <div className="grid grid-cols-3 gap-3 sm:gap-5">
                        <MacroBar macro="protein" value={totals.protein} target={t.protein} unknown={totals.unknown.protein} />
                        <MacroBar macro="carbs" value={totals.carbs} target={t.carbs} unknown={totals.unknown.carbs} />
                        <MacroBar macro="fat" value={totals.fat} target={t.fat} unknown={totals.unknown.fat} />
                    </div>
                    {over && (
                        <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-[13px] text-ink-2">
                            {status.over.toLocaleString()} kcal above today’s target of {t.calories.toLocaleString()} ({Math.round((totals.calories / t.calories) * 100)}%).
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
            <dt className="eyebrow">{label}</dt>
            <dd className={cn('num mt-1 text-xl font-semibold sm:text-2xl', accent ? 'text-accent' : 'text-ink')}>{value.toLocaleString()}</dd>
        </div>
    );
}

function SummarySkeleton() {
    return (
        <div className="space-y-5" aria-busy="true" aria-label="Loading day">
            <Card className="grid gap-6 p-6 sm:grid-cols-[auto_1fr]">
                <Skeleton className="mx-auto h-52 w-52 rounded-full" />
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                    </div>
                    <Skeleton className="h-10" />
                </div>
            </Card>
            <Skeleton className="h-40 rounded-[1.25rem]" />
        </div>
    );
}

type Dialogs =
    | { kind: 'edit'; entry: LogEntry }
    | { kind: 'copy'; mealType: MealType; entries: LogEntry[] }
    | { kind: 'save'; mealType: MealType; entries: LogEntry[] }
    | null;

function Meals({ day }: { day: DayLog }) {
    const grouped = useMemo(() => groupByMeal(day.entries), [day.entries]);
    const [dialog, setDialog] = useState<Dialogs>(null);
    const empty = day.entries.length === 0;
    const { openLogger } = useApp();

    return (
        <section aria-labelledby="meals-title" className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 id="meals-title" className="text-[15px] font-semibold text-ink">
                    Meals
                </h2>
                <span className="text-[13px] text-ink-3">
                    {day.entries.length} item{day.entries.length === 1 ? '' : 's'}
                </span>
            </div>
            {empty && (
                <Card>
                    <EmptyState
                        icon={<Utensils className="h-5 w-5" />}
                        title={`Nothing logged for ${formatDayLabel(day.date).toLowerCase() === 'today' ? 'today' : formatDayLabel(day.date)} yet`}
                        body="Log your first meal. Recent foods and saved meals make it quick."
                        action={
                            <Button variant="primary" onClick={() => openLogger({ date: day.date, mealType: defaultMealType() })}>
                                <Plus className="h-4 w-4" aria-hidden /> Log food
                            </Button>
                        }
                    />
                </Card>
            )}
            <div className="grid gap-3 md:grid-cols-2">
                {MEAL_TYPES.map(m => (
                    <MealCard
                        key={m}
                        date={day.date}
                        mealType={m}
                        entries={grouped[m]}
                        muted={empty}
                        onEdit={entry => setDialog({ kind: 'edit', entry })}
                        onCopy={() => setDialog({ kind: 'copy', mealType: m, entries: grouped[m] })}
                        onSave={() => setDialog({ kind: 'save', mealType: m, entries: grouped[m] })}
                    />
                ))}
            </div>
            <EditEntryDialog entry={dialog?.kind === 'edit' ? dialog.entry : null} onClose={() => setDialog(null)} />
            <CopyMealDialog source={dialog?.kind === 'copy' ? { date: day.date, mealType: dialog.mealType, entries: dialog.entries } : null} onClose={() => setDialog(null)} />
            <SaveMealDialog source={dialog?.kind === 'save' ? { mealType: dialog.mealType, entries: dialog.entries } : null} onClose={() => setDialog(null)} />
        </section>
    );
}

function MealCard({
    date,
    mealType,
    entries,
    muted,
    onEdit,
    onCopy,
    onSave,
}: {
    date: string;
    mealType: MealType;
    entries: LogEntry[];
    muted?: boolean;
    onEdit: (e: LogEntry) => void;
    onCopy: () => void;
    onSave: () => void;
}) {
    const { openLogger, highlights } = useApp();
    const del = useDeleteEntry();
    const totals: Totals = useMemo(() => entries.reduce((t, e) => addToTotals(t, e, e.servings), emptyTotals()), [entries]);
    const [menu, setMenu] = useState(false);
    const headingId = `meal-${mealType}`;

    return (
        <Card as="article" aria-labelledby={headingId} className={cn('flex flex-col', muted && 'opacity-80')}>
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                <div className="min-w-0 flex-1">
                    <h3 id={headingId} className="text-sm font-semibold text-ink">
                        {mealType}
                    </h3>
                    {entries.length > 0 ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                            <span className="num font-medium text-ink-2">{Math.round(totals.calories)} kcal</span>
                            <MacroChips protein={totals.unknown.protein === totals.count ? null : totals.protein} carbs={totals.unknown.carbs === totals.count ? null : totals.carbs} fat={totals.unknown.fat === totals.count ? null : totals.fat} />
                        </p>
                    ) : (
                        <p className="mt-0.5 text-xs text-ink-3">Not logged</p>
                    )}
                </div>
                {entries.length > 0 && (
                    <div className="relative">
                        <Button size="icon-sm" variant="ghost" aria-label={`${mealType} options`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(v => !v)}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {menu && (
                            <MealMenu
                                onClose={() => setMenu(false)}
                                items={[
                                    { label: 'Copy to another day', icon: Copy, onClick: onCopy },
                                    { label: 'Save as meal', icon: BookmarkPlus, onClick: onSave },
                                ]}
                            />
                        )}
                    </div>
                )}
                <Button size="icon-sm" variant="subtle" aria-label={`Add to ${mealType}`} onClick={() => openLogger({ date, mealType })}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            {entries.length > 0 && (
                <ul className="px-2 pb-2">
                    {entries.map(e => (
                        <li key={e.id} className={cn('group flex items-center gap-1 rounded-xl', highlights.has(e.id) && 'animate-highlight')}>
                            <button type="button" onClick={() => onEdit(e)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.03]" aria-label={`Edit ${e.name}, ${round(e.servings, 2)} servings, ${Math.round(e.calories * e.servings)} kcal`}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-medium text-ink">{e.name}</span>
                                    <span className="block truncate text-xs text-ink-3">
                                        {round(e.servings, 2)} × {e.servingSize}
                                        {(e.protein == null || e.carbs == null || e.fat == null) && <span className="text-warn"> · {e.protein == null && e.carbs == null && e.fat == null ? 'macros unknown' : 'some macros unknown'}</span>}
                                    </span>
                                </span>
                                <span className="num shrink-0 text-[13px] font-semibold text-ink">{Math.round(e.calories * e.servings)}</span>
                            </button>
                            <span className="flex shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${e.name}`} onClick={() => onEdit(e)} className="hidden md:inline-flex">
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${e.name}`} onClick={() => del(e)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

function MealMenu({ items, onClose }: { items: { label: string; icon: typeof Copy; onClick: () => void }[]; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        const onDown = (e: MouseEvent) => !(e.target as HTMLElement).closest('[role="menu"]') && onClose();
        window.addEventListener('keydown', onKey);
        window.addEventListener('mousedown', onDown);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mousedown', onDown);
        };
    }, [onClose]);
    // Roving focus: arrow keys / Home / End move between items.
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const els = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
        const i = els.indexOf(document.activeElement as HTMLButtonElement);
        let n = -1;
        if (e.key === 'ArrowDown') n = (i + 1) % els.length;
        if (e.key === 'ArrowUp') n = (i - 1 + els.length) % els.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = els.length - 1;
        if (e.key === 'Tab') onClose();
        if (n >= 0) {
            e.preventDefault();
            els[n].focus();
        }
    };
    return (
        <div role="menu" onKeyDown={onKeyDown} className="absolute right-0 top-9 z-20 w-52 animate-pop-in rounded-xl border border-line-strong bg-surface-3 p-1 shadow-xl">
            {items.map((it, i) => (
                <button
                    key={it.label}
                    role="menuitem"
                    autoFocus={i === 0}
                    type="button"
                    onClick={() => {
                        onClose();
                        it.onClick();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink hover:bg-white/5 focus:bg-white/5"
                >
                    <it.icon className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                    {it.label}
                </button>
            ))}
        </div>
    );
}

function Welcome() {
    const { enterDemo } = useData();
    return (
        <div className="mx-auto mt-6 max-w-xl space-y-4 text-center sm:mt-16">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Target className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Welcome to MacroTrack</h1>
            <p className="text-ink-2">Set your profile once and get calorie and macro targets you can adjust any time.</p>
            <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
                <Link href="/settings" className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-5 font-semibold text-on-accent">
                    Set up goals
                </Link>
                <Button size="lg" variant="secondary" onClick={enterDemo}>
                    <Sparkles className="h-4 w-4" aria-hidden /> Explore the demo
                </Button>
            </div>
        </div>
    );
}

