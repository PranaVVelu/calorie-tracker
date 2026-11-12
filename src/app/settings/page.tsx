'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, PencilRuler, Info } from 'lucide-react';
import { useData, useMutation, useQuery } from '@/lib/data/DataProvider';
import { useToast } from '@/components/ui/Toast';
import { Card, CardHeader, cn } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Field } from '@/components/ui/Field';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { MACRO_META } from '@/components/ui/MacroBar';
import { DemoControls } from '@/components/app/AppShell';
import { computeTargets } from '@/lib/targets';
import { macroCalories } from '@/lib/nutrition';
import { parseDecimal } from '@/lib/validation';
import { todayKey } from '@/lib/dates';
import { cmToFeetInches, displayWeight, feetInchesToCm, toKg, useUnitSystem, weightUnit, LB_PER_KG, type UnitSystem } from '@/utils/units';
import type { GoalType, GenderType, Profile, ProfileInput, TargetMode, Targets } from '@/lib/types';

const ACTIVITY = [
    { value: 1.2, label: 'Sedentary', hint: 'Desk job, little exercise' },
    { value: 1.375, label: 'Light', hint: 'Exercise 1–2 days/week' },
    { value: 1.55, label: 'Moderate', hint: 'Exercise 3–5 days/week' },
    { value: 1.725, label: 'Heavy', hint: 'Exercise 6–7 days/week' },
    { value: 1.9, label: 'Athlete', hint: 'Training twice a day' },
];

const DEFAULT_PROFILE: ProfileInput = { name: '', age: 30, gender: 'male', height: 175, weight: 75, activityLevel: 1.375, goalType: 'maintain', goalRate: 0.5, goalWeight: 75 };

export default function GoalsPage() {
    const profile = useQuery('profile', api => api.getProfile());
    const { unitSystem, setUnitSystem } = useUnitSystem();

    return (
        <div className="space-y-5">
            <header>
                <p className="eyebrow">Goals & preferences</p>
                <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">Goals</h1>
            </header>
            {profile.error ? (
                <Card>
                    <ErrorState error={profile.error} onRetry={profile.reload} />
                </Card>
            ) : profile.loading ? (
                <div className="grid gap-5 lg:grid-cols-2">
                    <Skeleton className="h-96 rounded-[1.25rem]" />
                    <Skeleton className="h-96 rounded-[1.25rem]" />
                </div>
            ) : (
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                    <div className="space-y-5">
                        {profile.data && <TargetsCard profile={profile.data} />}
                        <ProfileCard profile={profile.data ?? null} unitSystem={unitSystem} />
                    </div>
                    <div className="space-y-5">
                        <Card>
                            <CardHeader title="Units" subtitle="Applies to weight and height everywhere. Stored data doesn’t change." />
                            <div className="p-5">
                                <Segmented
                                    label="Unit system"
                                    value={unitSystem}
                                    onChange={setUnitSystem}
                                    options={[
                                        { value: 'metric', label: 'Metric (kg, cm)' },
                                        { value: 'imperial', label: 'Imperial (lb, ft/in)' },
                                    ]}
                                />
                            </div>
                        </Card>
                        <Card>
                            <CardHeader title="Demo" subtitle="Explore MacroTrack with sample data. Demo changes never touch your account." />
                            <div className="p-5">
                                <DemoControls />
                            </div>
                        </Card>
                        <HistoryNote />
                    </div>
                </div>
            )}
        </div>
    );
}

function HistoryNote() {
    return (
        <Card className="flex gap-3 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            <p className="text-[13px] text-ink-2">
                Target changes apply from today forward. Earlier days keep the targets that applied at the time, so past progress is judged fairly.
            </p>
        </Card>
    );
}

function TargetsCard({ profile }: { profile: Profile }) {
    const mutate = useMutation();
    const toast = useToast();
    const calc = useMemo(() => computeTargets(profile), [profile]);
    const [mode, setMode] = useState<TargetMode>(profile.targetMode);
    const [draft, setDraft] = useState(() => toDraft(profile.targets));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        setMode(profile.targetMode);
        setDraft(toDraft(profile.targets));
    }, [profile.targetMode, profile.targets]);

    const parsed: Targets | null = (() => {
        const v = { calories: parseDecimal(draft.calories), protein: parseDecimal(draft.protein), carbs: parseDecimal(draft.carbs), fat: parseDecimal(draft.fat) };
        if (Object.values(v).some(x => x == null || x < 0)) return null;
        return { calories: Math.round(v.calories!), protein: Math.round(v.protein!), carbs: Math.round(v.carbs!), fat: Math.round(v.fat!) };
    })();

    // Headline = targets in effect; switching to Calculated previews the recalculated numbers.
    const shown = mode === 'manual' ? parsed ?? profile.targets : profile.targetMode === 'calculated' ? profile.targets : calc.targets;
    const macroKcal = macroCalories(shown);
    const dirty = mode !== profile.targetMode || (mode === 'manual' && parsed != null && JSON.stringify(parsed) !== JSON.stringify(profile.targets)) || (mode === 'calculated' && JSON.stringify(calc.targets) !== JSON.stringify(profile.targets));

    const save = async () => {
        if (mode === 'manual') {
            if (!parsed) return setErr('Enter all four targets as numbers');
            if (parsed.calories < 800 || parsed.calories > 10000) return setErr('Calories should be between 800 and 10,000');
        }
        setErr(null);
        setBusy(true);
        try {
            await mutate(api => api.saveTargets({ mode, targets: mode === 'manual' ? parsed! : undefined, effectiveFrom: todayKey() }));
            toast({ message: 'Targets saved · applied from today' });
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not save');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card aria-labelledby="targets-title">
            <CardHeader
                id="targets-title"
                title="Daily targets"
                subtitle={profile.targetMode === 'manual' ? 'Custom targets you set' : 'Calculated from your profile'}
                action={
                    <Segmented
                        size="sm"
                        label="Target mode"
                        value={mode}
                        onChange={setMode}
                        options={[
                            { value: 'calculated', label: 'Calculated' },
                            { value: 'manual', label: 'Custom' },
                        ]}
                    />
                }
            />
            <div className="space-y-5 p-5">
                {/* Headline targets */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="col-span-2 rounded-2xl bg-surface-2 p-4 sm:col-span-1">
                        <p className="eyebrow">Calories</p>
                        <p className="num mt-1 text-3xl font-semibold text-ink">{shown.calories.toLocaleString()}</p>
                        <p className="text-xs text-ink-3">kcal / day</p>
                    </div>
                    {(['protein', 'carbs', 'fat'] as const).map(m => (
                        <div key={m} className="rounded-2xl bg-surface-2 p-4">
                            <p className="eyebrow flex items-center gap-1.5">
                                <span className={cn('h-2 w-2 rounded-full', MACRO_META[m].bgClass)} aria-hidden />
                                {MACRO_META[m].label}
                            </p>
                            <p className="num mt-1 text-2xl font-semibold text-ink">
                                {shown[m]}
                                <span className="text-sm font-normal text-ink-3"> g</span>
                            </p>
                            <p className="text-xs text-ink-3">{shown.calories ? Math.round(((shown[m] * (m === 'fat' ? 9 : 4)) / shown.calories) * 100) : 0}% of kcal</p>
                        </div>
                    ))}
                </div>

                {mode === 'calculated' ? (
                    <div className="rounded-2xl border border-line p-4">
                        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                            <Calculator className="h-4 w-4 text-accent" aria-hidden /> How this is calculated
                        </p>
                        <ol className="mt-3 space-y-2 text-[13px] text-ink-2">
                            <Step n={1} label="Resting burn (BMR, Mifflin-St Jeor)" value={`${Math.round(calc.bmr).toLocaleString()} kcal`} />
                            <Step n={2} label={`× activity ${profile.activityLevel} → maintenance (TDEE)`} value={`${Math.round(calc.tdee).toLocaleString()} kcal`} />
                            <Step
                                n={3}
                                label={profile.goalType === 'maintain' ? 'Goal: maintain' : `Goal: ${profile.goalType} ${profile.goalRate} kg/week (≈1,100 kcal/day per kg/week)`}
                                value={`${calc.adjustment > 0 ? '+' : ''}${calc.adjustment.toLocaleString()} kcal`}
                            />
                            <Step n={4} label="Protein: 2.0 g/kg (1.8 when maintaining) · Fat: 25% of kcal · Carbs: the rest" value="" />
                        </ol>
                        {calc.floorApplied && (
                            <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-ink-2">
                                Raised to the safety minimum ({profile.gender === 'male' ? '1,500' : '1,200'} kcal) for your profile.
                            </p>
                        )}
                        {JSON.stringify(calc.targets) !== JSON.stringify(profile.targets) && profile.targetMode === 'calculated' && (
                            <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-ink-2">
                                Your profile has changed since these targets were set. Recalculated:{' '}
                                <span className="num font-semibold text-ink">
                                    {calc.targets.calories.toLocaleString()} kcal · P {calc.targets.protein} · C {calc.targets.carbs} · F {calc.targets.fat}
                                </span>
                                . Save to apply from today.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {(['calories', 'protein', 'carbs', 'fat'] as const).map(k => (
                                <Field key={k} label={k === 'calories' ? 'Calories (kcal)' : `${MACRO_META[k].label} (g)`}>
                                    {p => <input {...p} inputMode="decimal" className="input num" value={draft[k]} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} />}
                                </Field>
                            ))}
                        </div>
                        <p className={cn('text-xs', parsed && Math.abs(macroKcal - parsed.calories) > parsed.calories * 0.05 ? 'text-warn' : 'text-ink-3')}>
                            Macros add up to {Math.round(macroKcal).toLocaleString()} kcal (protein & carbs 4 kcal/g, fat 9 kcal/g)
                            {parsed && Math.abs(macroKcal - parsed.calories) > parsed.calories * 0.05 ? ` · ${Math.round(macroKcal - parsed.calories) > 0 ? 'above' : 'below'} your calorie target` : ''}.
                        </p>
                        <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(calc.targets))}>
                            <PencilRuler className="h-3.5 w-3.5" aria-hidden /> Start from calculated values
                        </Button>
                    </div>
                )}

                {err && (
                    <p className="text-xs text-danger" role="alert">
                        {err}
                    </p>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                    <p className="text-xs text-ink-3">Applies from today. Past days keep their targets.</p>
                    <Button variant="primary" onClick={save} loading={busy} disabled={!dirty}>
                        Save targets
                    </Button>
                </div>
            </div>
        </Card>
    );
}

function Step({ n, label, value }: { n: number; label: string; value: string }) {
    return (
        <li className="flex items-baseline gap-3">
            <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-2">{n}</span>
            <span className="flex-1">{label}</span>
            {value && <span className="num font-semibold text-ink">{value}</span>}
        </li>
    );
}

function toDraft(t: Targets) {
    return { calories: String(t.calories), protein: String(t.protein), carbs: String(t.carbs), fat: String(t.fat) };
}

type ProfileDraft = {
    name: string;
    age: string;
    gender: GenderType;
    heightCm: string;
    feet: string;
    inches: string;
    weight: string; // display unit
    goalWeight: string; // display unit
    activityLevel: number;
    goalType: GoalType;
    goalRate: number; // kg/week
};

function draftFrom(p: ProfileInput, u: UnitSystem): ProfileDraft {
    const fi = cmToFeetInches(p.height);
    return {
        name: p.name,
        age: String(p.age),
        gender: p.gender,
        heightCm: String(Math.round(p.height)),
        feet: String(fi.feet),
        inches: String(fi.inches),
        weight: String(displayWeight(p.weight, u)),
        goalWeight: String(displayWeight(p.goalWeight, u)),
        activityLevel: p.activityLevel,
        goalType: p.goalType,
        goalRate: p.goalRate,
    };
}

function ProfileCard({ profile, unitSystem }: { profile: Profile | null; unitSystem: UnitSystem }) {
    const mutate = useMutation();
    const toast = useToast();
    const { mode } = useData();
    const base = profile ?? DEFAULT_PROFILE;
    const [d, setD] = useState<ProfileDraft>(() => draftFrom(base, unitSystem));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const weights = useQuery(profile ? 'weights' : null, api => api.getWeights());
    const latest = weights.data?.length ? weights.data[weights.data.length - 1] : null;

    // Re-express inputs when the unit preference changes (not on first render).
    const prevUnit = useRef(unitSystem);
    useEffect(() => {
        if (prevUnit.current === unitSystem) return;
        const from = prevUnit.current;
        prevUnit.current = unitSystem;
        setD(prev => {
            const parsed = toInput(prev, from, base);
            return parsed ? { ...draftFrom(parsed, unitSystem), name: prev.name } : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unitSystem]);

    const input = toInput(d, unitSystem, base);
    const preview = input ? computeTargets(input) : null;
    const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD(prev => ({ ...prev, [k]: v }));
    const unit = weightUnit(unitSystem);
    const rateDisplay = unitSystem === 'imperial' ? `${Math.round(d.goalRate * LB_PER_KG * 10) / 10} lb` : `${d.goalRate} kg`;

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        const age = Number(d.age);
        if (!(age >= 13 && age <= 120)) errs.age = 'Age 13–120';
        if (!input) errs.form = 'Check height and weights';
        else {
            if (!(input.height > 50 && input.height < 300)) errs.height = 'Check height';
            if (!(input.weight > 20 && input.weight < 500)) errs.weight = 'Check weight';
            if (!(input.goalWeight > 20 && input.goalWeight < 500)) errs.goalWeight = 'Check goal weight';
        }
        setErrors(errs);
        if (Object.keys(errs).length || !input) return;
        setBusy(true);
        try {
            await mutate(api => api.saveProfile(input, todayKey()));
            toast({ message: profile?.targetMode === 'manual' ? 'Profile saved · custom targets kept' : 'Profile saved · targets updated from today' });
        } catch (e2) {
            setErrors({ form: e2 instanceof Error ? e2.message : 'Could not save' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card aria-labelledby="profile-title">
            <CardHeader id="profile-title" title={profile ? 'Profile' : 'Set up your profile'} subtitle="Used to calculate your targets." />
            <form onSubmit={save} className="space-y-4 p-5" noValidate>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Name" className="col-span-2 sm:col-span-1">
                        {p => <input {...p} className="input" value={d.name} onChange={e => set('name', e.target.value)} autoComplete="given-name" />}
                    </Field>
                    <Field label="Age" error={errors.age}>
                        {p => <input {...p} inputMode="numeric" className="input num" value={d.age} onChange={e => set('age', e.target.value)} />}
                    </Field>
                    <div className="col-span-2 sm:col-span-1">
                        <p className="mb-1.5 text-[13px] font-medium text-ink-2">Sex (for BMR)</p>
                        <Segmented
                            label="Sex"
                            value={d.gender}
                            onChange={v => set('gender', v)}
                            options={[
                                { value: 'male', label: 'Male' },
                                { value: 'female', label: 'Female' },
                            ]}
                            className="w-full"
                        />
                    </div>
                    {unitSystem === 'metric' ? (
                        <Field label="Height (cm)" error={errors.height}>
                            {p => <input {...p} inputMode="decimal" className="input num" value={d.heightCm} onChange={e => set('heightCm', e.target.value)} />}
                        </Field>
                    ) : (
                        <fieldset>
                            <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Height</legend>
                            <div className="flex gap-2">
                                <label className="sr-only" htmlFor="ft">Feet</label>
                                <input id="ft" inputMode="numeric" className="input num" value={d.feet} onChange={e => set('feet', e.target.value)} aria-describedby="ft-u" />
                                <span id="ft-u" className="self-center text-xs text-ink-3">ft</span>
                                <label className="sr-only" htmlFor="in">Inches</label>
                                <input id="in" inputMode="numeric" className="input num" value={d.inches} onChange={e => set('inches', e.target.value)} />
                                <span className="self-center text-xs text-ink-3">in</span>
                            </div>
                        </fieldset>
                    )}
                    <Field
                        label={`Current weight (${unit})`}
                        error={errors.weight}
                        hint={
                            latest && Math.abs(latest.weight - (input?.weight ?? 0)) > 0.05 ? (
                                <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => set('weight', String(displayWeight(latest.weight, unitSystem)))}>
                                    Use latest weigh-in ({displayWeight(latest.weight, unitSystem)} {unit})
                                </button>
                            ) : undefined
                        }
                    >
                        {p => <input {...p} inputMode="decimal" className="input num" value={d.weight} onChange={e => set('weight', e.target.value)} />}
                    </Field>
                    <Field label={`Goal weight (${unit})`} error={errors.goalWeight}>
                        {p => <input {...p} inputMode="decimal" className="input num" value={d.goalWeight} onChange={e => set('goalWeight', e.target.value)} />}
                    </Field>
                </div>

                <div>
                    <p className="mb-1.5 text-[13px] font-medium text-ink-2">Activity</p>
                    <div role="radiogroup" aria-label="Activity level" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {ACTIVITY.map(a => (
                            <button
                                key={a.value}
                                type="button"
                                role="radio"
                                aria-checked={d.activityLevel === a.value}
                                onClick={() => set('activityLevel', a.value)}
                                className={cn('rounded-xl border px-3 py-2 text-left', d.activityLevel === a.value ? 'border-accent/50 bg-accent-soft' : 'border-line hover:border-line-strong')}
                            >
                                <span className="block text-[13px] font-medium text-ink">{a.label}</span>
                                <span className="block text-[11px] text-ink-3">{a.hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mb-1.5 text-[13px] font-medium text-ink-2">Goal</p>
                    <Segmented
                        label="Goal"
                        value={d.goalType}
                        onChange={v => set('goalType', v)}
                        options={[
                            { value: 'lose', label: 'Lose' },
                            { value: 'maintain', label: 'Maintain' },
                            { value: 'gain', label: 'Gain' },
                        ]}
                        className="w-full"
                    />
                </div>
                {d.goalType !== 'maintain' && (
                    <div>
                        <label htmlFor="rate" className="mb-1.5 flex justify-between text-[13px] font-medium text-ink-2">
                            <span>Rate per week</span>
                            <span className="num text-ink">{rateDisplay}</span>
                        </label>
                        <input
                            id="rate"
                            type="range"
                            min={d.goalType === 'gain' ? 0.1 : 0.25}
                            max={d.goalType === 'gain' ? 0.5 : 1}
                            step={0.05}
                            value={d.goalRate}
                            onChange={e => set('goalRate', Number(e.target.value))}
                            className="w-full accent-[var(--color-accent)]"
                        />
                        <div className="flex justify-between text-[11px] text-ink-3">
                            <span>Gradual</span>
                            <span>Aggressive</span>
                        </div>
                    </div>
                )}

                {preview && (
                    <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
                        {profile?.targetMode === 'manual' ? (
                            <>Custom targets are on, so saving won’t change them. Calculated would be <span className="num font-semibold text-ink">{preview.targets.calories.toLocaleString()} kcal</span>.</>
                        ) : (
                            <>Calculated target: <span className="num font-semibold text-ink">{preview.targets.calories.toLocaleString()} kcal</span> · P {preview.targets.protein} g · C {preview.targets.carbs} g · F {preview.targets.fat} g</>
                        )}
                    </p>
                )}
                {errors.form && <p className="text-xs text-danger" role="alert">{errors.form}</p>}
                <div className="flex justify-end">
                    <Button type="submit" variant="primary" loading={busy}>
                        {profile ? 'Save profile' : mode === 'demo' ? 'Save' : 'Create profile'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

/**
 * Draft → metric input. Untouched fields keep their exact stored kg/cm so
 * repeated saves in imperial don't drift through rounding.
 */
function toInput(d: ProfileDraft, u: UnitSystem, base?: ProfileInput): ProfileInput | null {
    const w = parseDecimal(d.weight);
    const gw = parseDecimal(d.goalWeight);
    const same = (raw: string, kg: number | undefined) => kg != null && raw === String(displayWeight(kg, u));
    const height = u === 'metric' ? parseDecimal(d.heightCm) : (() => {
        const f = parseDecimal(d.feet);
        const i = parseDecimal(d.inches) ?? 0;
        return f == null ? null : feetInchesToCm(f, i);
    })();
    const age = Number(d.age);
    if (w == null || gw == null || height == null || !Number.isFinite(age)) return null;
    return {
        name: d.name.trim(),
        age,
        gender: d.gender,
        height: base && (u === 'metric' ? d.heightCm === String(Math.round(base.height)) : (() => { const fi = cmToFeetInches(base.height); return d.feet === String(fi.feet) && d.inches === String(fi.inches); })()) ? base.height : Math.round(height * 10) / 10,
        weight: same(d.weight, base?.weight) ? base!.weight : Math.round(toKg(w, u) * 100) / 100,
        goalWeight: same(d.goalWeight, base?.goalWeight) ? base!.goalWeight : Math.round(toKg(gw, u) * 100) / 100,
        activityLevel: d.activityLevel,
        goalType: d.goalType,
        goalRate: d.goalType === 'maintain' ? 0 : d.goalRate,
    };
}
