'use client';

import { Bar, Cell, ComposedChart, Line, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import type { DayPoint } from '@/lib/analytics';
import { keyToLocalDate } from '@/lib/dates';
import { round } from '@/lib/nutrition';

const AXIS = { fontSize: 11, fill: '#828b99' };
const GRID = 'rgb(255 255 255 / 0.06)';

const dayTick = (k: string) => format(keyToLocalDate(k), 'MMM d');
const compactTick = (v: number) => (Math.abs(v) >= 1000 ? `${round(v / 1000, 1)}k` : String(v));

/** Round tick steps (1/2/2.5/5 × 10^n) giving at most ~5 intervals. */
export function niceTicks(max: number, intervals = 4): number[] {
    if (!(max > 0)) return [0];
    const raw = max / intervals;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => st >= raw)!;
    const top = Math.ceil(max / step) * step;
    const out: number[] = [];
    for (let v = 0; v <= top + 1e-9; v += step) out.push(round(v, 2));
    return out;
}

/** Whether the goal line falls close enough to the data to be drawn without flattening it. */
export function goalInView(values: (number | null)[], goal: number | null): boolean {
    const vals = values.filter((v): v is number => v != null);
    if (goal == null || !vals.length) return false;
    return goal >= Math.min(...vals) - 4 && goal <= Math.max(...vals) + 4;
}

function TooltipCard({ children }: { children: React.ReactNode }) {
    return <div className="min-w-44 rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-xs shadow-xl">{children}</div>;
}

function Row({ swatch, label, value, dashed }: { swatch?: string; label: string; value: React.ReactNode; dashed?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-ink-2">
                {swatch && (dashed ? <span className="w-3 border-t-2 border-dashed" style={{ borderColor: swatch }} /> : <span className="h-2 w-2 rounded-full" style={{ background: swatch }} />)}
                {label}
            </span>
            <span className="num font-semibold text-ink">{value}</span>
        </div>
    );
}

/** Daily bars (missing days have no bar) with the target that applied each day as a dashed step line. */
export function IntakeChart({
    series,
    metric,
    color,
    unit,
    selected,
    onSelect,
    height = 220,
}: {
    series: DayPoint[];
    metric: 'calories' | 'protein';
    color: string;
    unit: string;
    selected: string | null;
    onSelect: (date: string) => void;
    height?: number;
}) {
    const data = series.map(d => ({
        date: d.date,
        value: metric === 'calories' ? d.calories : d.protein,
        target: metric === 'calories' ? d.targets.calories : d.targets.protein,
        isToday: d.isToday,
        entries: d.entryCount,
        unknown: d.proteinUnknownItems,
    }));
    const barSize = series.length > 45 ? 6 : series.length > 14 ? 10 : 22;
    const ticks = niceTicks(Math.max(1, ...data.map(d => Math.max(d.value ?? 0, d.target))));

    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    onClick={s => {
                        if (s && typeof s.activeLabel === 'string') onSelect(s.activeLabel);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="date" tickFormatter={dayTick} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} tickFormatter={compactTick} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} />
                    <Tooltip
                        cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload as (typeof data)[number];
                            return (
                                <TooltipCard>
                                    <p className="mb-1 font-semibold text-ink">
                                        {format(keyToLocalDate(p.date), 'EEE, MMM d')}
                                        {p.isToday && <span className="font-normal text-ink-3"> · in progress</span>}
                                    </p>
                                    {p.value == null ? (
                                        <p className="text-ink-3">Not logged</p>
                                    ) : (
                                        <>
                                            <Row swatch={color} label={metric === 'calories' ? 'Calories' : 'Protein'} value={`${Math.round(p.value).toLocaleString()} ${unit}`} />
                                            <Row swatch="#aab2bf" dashed label="Target" value={`${p.target.toLocaleString()} ${unit}`} />
                                            <Row label="Difference" value={`${p.value - p.target > 0 ? '+' : ''}${Math.round(p.value - p.target).toLocaleString()} ${unit}`} />
                                            {metric === 'protein' && p.unknown > 0 && <p className="mt-1 text-warn">{p.unknown} item(s) with unknown protein</p>}
                                        </>
                                    )}
                                    <p className="mt-1.5 text-[11px] text-ink-3">Click to see entries</p>
                                </TooltipCard>
                            );
                        }}
                    />
                    <Bar dataKey="value" barSize={barSize} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {data.map(d => (
                            <Cell key={d.date} fill={color} fillOpacity={d.isToday ? 0.45 : selected && selected !== d.date ? 0.55 : 1} stroke={selected === d.date ? '#f2f4f7' : 'none'} strokeWidth={selected === d.date ? 1.5 : 0} />
                        ))}
                    </Bar>
                    <Line type="stepAfter" dataKey="target" stroke="#aab2bf" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Weigh-ins as dots plus a trailing 7-day average line. Values already in display units. */
export function WeightChart({
    series,
    unit,
    goal,
    selected,
    onSelect,
    height = 240,
}: {
    series: (DayPoint & { w: number | null; wAvg: number | null })[];
    unit: string;
    goal: number | null;
    selected: string | null;
    onSelect: (date: string) => void;
    height?: number;
}) {
    const vals = series.flatMap(d => [d.w, d.wAvg]).filter((v): v is number => v != null);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const showGoal = goalInView(vals, goal);
    const lo = Math.floor(Math.min(min, showGoal ? goal! : min) - 0.6);
    const hi = Math.ceil(Math.max(max, showGoal ? goal! : max) + 0.6);

    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={series}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    onClick={s => {
                        if (s && typeof s.activeLabel === 'string') onSelect(s.activeLabel);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="date" tickFormatter={dayTick} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} domain={[lo, hi]} allowDecimals={false} />
                    {showGoal && <ReferenceLine y={goal!} stroke="#aab2bf" strokeDasharray="4 4" label={{ value: `Goal ${goal}`, position: 'insideTopRight', fill: '#aab2bf', fontSize: 11 }} />}
                    {selected && <ReferenceLine x={selected} stroke="rgb(255 255 255 / 0.25)" />}
                    <Tooltip
                        cursor={{ stroke: 'rgb(255 255 255 / 0.2)' }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload as (typeof series)[number];
                            return (
                                <TooltipCard>
                                    <p className="mb-1 font-semibold text-ink">{format(keyToLocalDate(p.date), 'EEE, MMM d')}</p>
                                    <Row swatch="#f2f4f7" label="Weigh-in" value={p.w == null ? '—' : `${p.w} ${unit}`} />
                                    <Row swatch="var(--color-accent)" label="7-day avg" value={p.wAvg == null ? '—' : `${round(p.wAvg, 1)} ${unit}`} />
                                    {p.wAvg != null && (
                                        <p className="mt-1 text-[11px] text-ink-3">
                                            Mean of {p.weightAvgCount} weigh-in{p.weightAvgCount === 1 ? '' : 's'} in the 7 days ending here
                                        </p>
                                    )}
                                </TooltipCard>
                            );
                        }}
                    />
                    <Line type="monotone" dataKey="wAvg" stroke="var(--color-accent)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line dataKey="w" stroke="none" isAnimationActive={false} dot={{ r: 3.5, fill: '#f2f4f7', stroke: 'var(--color-surface)', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#f2f4f7' }} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
