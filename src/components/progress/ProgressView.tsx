'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRight, Pencil, Scale, Table2, Trash2, X, LineChart as LineIcon } from 'lucide-react';
import { useMutation, useQuery } from '@/lib/data/DataProvider';
import { useToast } from '@/components/ui/Toast';
import { Card, CardHeader, cn } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Field } from '@/components/ui/Field';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { MacroChips } from '@/components/ui/MacroBar';
import { buildDaySeries, summarize, ROLLING_WINDOW_DAYS, NEAR_TARGET_TOLERANCE, type DayPoint } from '@/lib/analytics';
import { formatDayLabel, keyToLocalDate, shiftKey, todayKey } from '@/lib/dates';
import { groupByMeal, round, sumEntries } from '@/lib/nutrition';
import { parseDecimal } from '@/lib/validation';
import { displayWeight, toKg, useUnitSystem, weightUnit } from '@/utils/units';
import { MEAL_TYPES, type WeightEntry } from '@/lib/types';
import { IntakeChart, WeightChart, goalInView } from './Charts';

type Range = '7' | '30' | '90';

export function ProgressView() {
    const [range, setRange] = useState<Range>('30');
    const [selected, setSelected] = useState<string | null>(null);
    const [table, setTable] = useState(false);
    const today = todayKey();
    const from = shiftKey(today, -(Number(range) - 1));
    const { unitSystem } = useUnitSystem();
    const unit = weightUnit(unitSystem);

    const profile = useQuery('profile', api => api.getProfile());
    const q = useQuery(profile.data ? `range:${from}:${today}` : null, api => api.getRange(from, today));
    const series = useMemo(() => (q.data ? buildDaySeries(q.data, today) : []), [q.data, today]);
    const summary = useMemo(() => summarize(series), [series]);
    const wSeries = useMemo(
        () =>
            series.map(d => ({
                ...d,
                w: d.weight == null ? null : displayWeight(d.weight, unitSystem),
                wAvg: d.weightAvg == null ? null : unitSystem === 'imperial' ? round(displayWeight(d.weightAvg, unitSystem), 2) : round(d.weightAvg, 2),
            })),
        [series, unitSystem]
    );

    if (profile.error || q.error) return <Card><ErrorState error={(profile.error ?? q.error)!} onRetry={q.reload} /></Card>;
    if (profile.data === null) return <Card><EmptyState icon={<LineIcon className="h-5 w-5" />} title="Set up your profile first" body="Progress appears once you have goals and some logs." action={<Link className="text-accent" href="/settings">Go to Goals</Link>} /></Card>;

    const loading = !q.data;
    const fmtW = (kg: number | null) => (kg == null ? '—' : `${displayWeight(kg, unitSystem)}`);
    const goalDisplay = profile.data ? displayWeight(profile.data.goalWeight, unitSystem) : null;

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="eyebrow">Last {range} days</p>
                    <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">Progress</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Segmented
                        label="Date range"
                        value={range}
                        onChange={v => {
                            setRange(v);
                            setSelected(null);
                        }}
                        options={[
                            { value: '7', label: '7D' },
                            { value: '30', label: '30D' },
                            { value: '90', label: '90D' },
                        ]}
                    />
                    <Button size="icon" variant={table ? 'subtle' : 'secondary'} aria-pressed={table} aria-label="Show data as table" onClick={() => setTable(t => !t)}>
                        <Table2 className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            {/* Summary tiles */}
            <section aria-label="Summary" className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', q.refreshing && 'opacity-60')}>
                {loading ? (
                    [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-[1.25rem]" />)
                ) : (
                    <>
                        <Tile
                            label="Avg calories"
                            value={summary.avgCalories == null ? '—' : Math.round(summary.avgCalories).toLocaleString()}
                            unit="kcal/day"
                            note={summary.avgCalorieTarget != null ? `Target avg ${Math.round(summary.avgCalorieTarget).toLocaleString()}` : 'No complete logged days'}
                            basis={`${summary.loggedDays} of ${summary.totalDays - (summary.includesToday ? 1 : 0)} days logged`}
                        />
                        <Tile
                            label="Avg protein"
                            value={summary.avgProtein == null ? '—' : Math.round(summary.avgProtein).toString()}
                            unit="g/day"
                            note={summary.avgProteinTarget != null ? `Target avg ${Math.round(summary.avgProteinTarget)} g` : '—'}
                            basis={`${summary.loggedDays} logged days`}
                        />
                        <Tile
                            label="Near target"
                            value={summary.loggedDays ? `${summary.nearTargetDays}` : '—'}
                            unit={summary.loggedDays ? `of ${summary.loggedDays} days` : ''}
                            note={`Within ±${NEAR_TARGET_TOLERANCE * 100}% of calorie target`}
                            basis="Logged days only"
                        />
                        <Tile
                            label="Weight change"
                            value={summary.weightChange == null ? '—' : `${summary.weightChange > 0 ? '+' : ''}${round(displayWeight(summary.weightChange, unitSystem), 1)}`}
                            unit={summary.weightChange == null ? '' : unit}
                            note={summary.weightStart != null && summary.weightEnd != null && summary.weightChange != null ? `${fmtW(summary.weightStart)} → ${fmtW(summary.weightEnd)} ${unit}` : 'Need 2+ weigh-ins'}
                            basis={`7-day avg · ${summary.weighIns} weigh-ins`}
                        />
                    </>
                )}
            </section>
            <p className="-mt-2 text-xs text-ink-3">Averages use completed, logged days only. Unlogged days count as missing, not zero, and today is excluded while in progress.</p>

            {table && !loading ? (
                <DataTable series={series} unitSystem={unitSystem} onSelect={setSelected} />
            ) : (
                <div className="grid gap-5 xl:grid-cols-2">
                    <Card className="xl:col-span-2">
                        <CardHeader
                            title="Weight"
                            subtitle={
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <Legend swatch="dot" label="Weigh-in" />
                                    <Legend swatch="line" label={`${ROLLING_WINDOW_DAYS}-day average (trailing mean of weigh-ins)`} />
                                    {goalDisplay != null && (goalInView(wSeries.flatMap(d => [d.w, d.wAvg]), goalDisplay) ? <Legend swatch="dash" label={`Goal ${goalDisplay} ${unit}`} /> : <span className="text-xs text-ink-3">Goal {goalDisplay} {unit} (outside chart range)</span>)}
                                </span>
                            }
                        />
                        <div className="px-2 pb-4 pt-2 sm:px-4">
                            {loading ? <Skeleton className="h-60" /> : summary.weighIns === 0 && !series.some(d => d.weightAvg != null) ? <EmptyState icon={<Scale className="h-5 w-5" />} title="No weigh-ins in this range" body="Log your weight below to see the trend." /> : <WeightChart series={wSeries} unit={unit} goal={goalDisplay} selected={selected} onSelect={setSelected} />}
                        </div>
                    </Card>
                    <Card>
                        <CardHeader title="Calories" subtitle={<span className="flex flex-wrap gap-x-3"><Legend swatch="bar" color="var(--color-cal)" label="Eaten" /><Legend swatch="dash" label="Target that day" /></span>} />
                        <div className="px-2 pb-4 pt-2 sm:px-4">{loading ? <Skeleton className="h-56" /> : <IntakeChart series={series} metric="calories" color="var(--color-cal)" unit="kcal" selected={selected} onSelect={setSelected} />}</div>
                    </Card>
                    <Card>
                        <CardHeader title="Protein" subtitle={<span className="flex flex-wrap gap-x-3"><Legend swatch="bar" color="var(--color-protein)" label="Eaten" /><Legend swatch="dash" label="Target that day" /></span>} />
                        <div className="px-2 pb-4 pt-2 sm:px-4">{loading ? <Skeleton className="h-56" /> : <IntakeChart series={series} metric="protein" color="var(--color-protein)" unit="g" selected={selected} onSelect={setSelected} />}</div>
                    </Card>
                </div>
            )}

            {selected && <DayDetail date={selected} point={series.find(d => d.date === selected) ?? null} onClose={() => setSelected(null)} unitSystem={unitSystem} />}

            <WeightLog />
        </div>
    );
}

function Legend({ swatch, label, color }: { swatch: 'dot' | 'line' | 'dash' | 'bar'; label: string; color?: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
            {swatch === 'dot' && <span className="h-2 w-2 rounded-full bg-ink" />}
            {swatch === 'line' && <span className="h-0.5 w-4 rounded bg-accent" />}
            {swatch === 'dash' && <span className="w-4 border-t-2 border-dashed border-ink-2" />}
            {swatch === 'bar' && <span className="h-2.5 w-2 rounded-sm" style={{ background: color }} />}
            {label}
        </span>
    );
}

function Tile({ label, value, unit, note, basis }: { label: string; value: string; unit: string; note: string; basis: string }) {
    return (
        <Card className="p-4">
            <p className="eyebrow">{label}</p>
            <p className="mt-2 flex items-baseline gap-1">
                <span className="num text-[28px] font-semibold leading-none text-ink">{value}</span>
                <span className="text-xs text-ink-3">{unit}</span>
            </p>
            <p className="mt-2 truncate text-xs text-ink-2">{note}</p>
            <p className="mt-0.5 truncate text-[11px] text-ink-3">{basis}</p>
        </Card>
    );
}

function DayDetail({ date, point, onClose, unitSystem }: { date: string; point: DayPoint | null; onClose: () => void; unitSystem: 'metric' | 'imperial' }) {
    const q = useQuery(`day:${date}`, api => api.getDay(date));
    const totals = q.data ? sumEntries(q.data.entries) : null;
    const grouped = q.data ? groupByMeal(q.data.entries) : null;
    return (
        <Card aria-labelledby="day-detail-title" className="animate-fade-up">
            <CardHeader
                id="day-detail-title"
                title={format(keyToLocalDate(date), 'EEEE, MMM d')}
                subtitle={
                    totals
                        ? `${Math.round(totals.calories).toLocaleString()} of ${q.data!.targets.calories.toLocaleString()} kcal · ${Math.round(totals.protein)} g protein${point?.weight != null ? ` · weighed ${displayWeight(point.weight, unitSystem)} ${weightUnit(unitSystem)}` : ''}`
                        : 'Loading…'
                }
                action={
                    <div className="flex gap-1">
                        <Link href={`/?date=${date}`} className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent-soft px-3 text-[13px] font-medium text-accent">
                            Open day <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close day details">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                }
            />
            <div className="p-5 pt-3">
                {!q.data ? (
                    <Skeleton className="h-24" />
                ) : q.data.entries.length === 0 ? (
                    <p className="text-[13px] text-ink-3">Nothing logged this day. It’s treated as missing data in averages.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {MEAL_TYPES.filter(m => grouped![m].length).map(m => (
                            <div key={m}>
                                <p className="eyebrow">{m}</p>
                                <ul className="mt-1.5 space-y-1">
                                    {grouped![m].map(e => (
                                        <li key={e.id} className="flex justify-between gap-2 text-[13px]">
                                            <span className="truncate text-ink-2">
                                                {round(e.servings, 2)}× {e.name}
                                            </span>
                                            <span className="num shrink-0 text-ink">{Math.round(e.calories * e.servings)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
                {totals && totals.count > 0 && <MacroChips className="mt-4" protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />}
            </div>
        </Card>
    );
}

function DataTable({ series, unitSystem, onSelect }: { series: DayPoint[]; unitSystem: 'metric' | 'imperial'; onSelect: (d: string) => void }) {
    const rows = [...series].reverse();
    return (
        <Card className="overflow-hidden">
            <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-[13px]">
                    <caption className="sr-only">Daily calories, protein and weight</caption>
                    <thead className="sticky top-0 bg-surface-2 text-left text-xs text-ink-3">
                        <tr>
                            <th scope="col" className="px-4 py-2.5 font-medium">Day</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-medium">Calories</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-medium">Target</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-medium">Protein</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-medium">Weight</th>
                            <th scope="col" className="px-3 py-2.5 text-right font-medium">7d avg</th>
                            <th scope="col" className="px-3 py-2.5"><span className="sr-only">Details</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map(d => (
                            <tr key={d.date} className={cn(!d.logged && 'text-ink-3')}>
                                <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-medium text-ink-2">
                                    {format(keyToLocalDate(d.date), 'EEE MMM d')}
                                    {d.isToday && <span className="text-ink-3"> · today</span>}
                                </th>
                                <td className="num px-3 py-2 text-right text-ink">{d.calories == null ? <span className="text-ink-3">not logged</span> : d.calories.toLocaleString()}</td>
                                <td className="num px-3 py-2 text-right">{d.targets.calories.toLocaleString()}</td>
                                <td className="num px-3 py-2 text-right">{d.protein == null ? '—' : Math.round(d.protein)}</td>
                                <td className="num px-3 py-2 text-right">{d.weight == null ? '—' : displayWeight(d.weight, unitSystem)}</td>
                                <td className="num px-3 py-2 text-right">{d.weightAvg == null ? '—' : displayWeight(d.weightAvg, unitSystem)}</td>
                                <td className="px-3 py-1.5 text-right">
                                    <Button size="sm" variant="ghost" onClick={() => onSelect(d.date)} aria-label={`Show entries for ${formatDayLabel(d.date)}`}>
                                        View
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function WeightLog() {
    const { unitSystem } = useUnitSystem();
    const unit = weightUnit(unitSystem);
    const q = useQuery('weights', api => api.getWeights());
    const mutate = useMutation();
    const toast = useToast();
    const [date, setDate] = useState(todayKey());
    const [raw, setRaw] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [showAll, setShowAll] = useState(false);

    const recent = q.data ? [...q.data].reverse() : [];
    const existing = q.data?.find(w => w.date === date);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        const v = parseDecimal(raw);
        if (v == null || v <= 0) return setErr(`Enter your weight in ${unit}`);
        const kg = toKg(v, unitSystem);
        if (kg < 20 || kg > 500) return setErr('That doesn’t look right');
        setErr(null);
        setBusy(true);
        try {
            await mutate(api => api.logWeight(date, kg));
            toast({ message: existing ? `Updated ${formatDayLabel(date)} to ${v} ${unit}` : `Logged ${v} ${unit}` });
            setRaw('');
        } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : 'Could not save');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (w: WeightEntry) => {
        try {
            await mutate(api => api.deleteWeight(w.date));
            toast({ message: `Removed weigh-in for ${formatDayLabel(w.date)}`, action: { label: 'Undo', onClick: () => void mutate(api => api.logWeight(w.date, w.weight)) } });
        } catch {
            toast({ message: 'Could not remove', tone: 'error' });
        }
    };

    return (
        <Card aria-labelledby="weight-log-title">
            <CardHeader id="weight-log-title" title="Log weight" subtitle={`One weigh-in per day. Saving a day that already has one replaces it. Shown in ${unit}; change units in Goals.`} />
            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <form onSubmit={save} className="grid grid-cols-2 items-start gap-3" noValidate>
                    <Field label="Day">{p => <input {...p} type="date" max={todayKey()} value={date} onChange={e => e.target.value && setDate(e.target.value)} className="input num" />}</Field>
                    <Field label={`Weight (${unit})`} error={err} hint={existing ? `Currently ${displayWeight(existing.weight, unitSystem)} ${unit}` : undefined}>
                        {p => <input {...p} inputMode="decimal" value={raw} onChange={e => setRaw(e.target.value)} placeholder={existing ? String(displayWeight(existing.weight, unitSystem)) : unit} className="input num" />}
                    </Field>
                    <Button type="submit" variant="primary" loading={busy} className="col-span-2">
                        {existing ? 'Update weigh-in' : 'Save weigh-in'}
                    </Button>
                </form>
                <div>
                    <p className="eyebrow mb-2">Recent weigh-ins</p>
                    {q.loading ? (
                        <Skeleton className="h-32" />
                    ) : !recent.length ? (
                        <p className="text-[13px] text-ink-3">No weigh-ins yet.</p>
                    ) : (
                        <>
                            <ul className="divide-y divide-line">
                                {recent.slice(0, showAll ? 60 : 6).map(w => (
                                    <li key={w.date} className="flex items-center gap-2 py-1.5">
                                        <span className="flex-1 text-[13px] text-ink-2">{format(keyToLocalDate(w.date), 'EEE, MMM d')}</span>
                                        <span className="num text-sm font-semibold text-ink">
                                            {displayWeight(w.weight, unitSystem)} <span className="text-xs font-normal text-ink-3">{unit}</span>
                                        </span>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Correct weigh-in for ${formatDayLabel(w.date)}`}
                                            onClick={() => {
                                                setDate(w.date);
                                                setRaw(String(displayWeight(w.weight, unitSystem)));
                                                document.getElementById('weight-log-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="icon-sm" variant="ghost" aria-label={`Delete weigh-in for ${formatDayLabel(w.date)}`} onClick={() => remove(w)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                            {recent.length > 6 && (
                                <Button size="sm" variant="ghost" className="mt-1" onClick={() => setShowAll(s => !s)}>
                                    {showAll ? 'Show fewer' : `Show all ${recent.length}`}
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}
