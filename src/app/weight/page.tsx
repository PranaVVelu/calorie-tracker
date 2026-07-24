'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { UnitToggle } from '@/components/ui/UnitToggle';
import { getUserProfile, logWeight } from '@/actions/user.actions';
import { estimateWeeksToGoal } from '@/utils/algorithms';
import { useUnitSystem, kgToLbs, lbsToKg, formatWeight } from '@/utils/units';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

type WeightLog = { id: string; weight: number; date: Date };
type UserProfile = {
    id: string;
    weight: number;
    goalWeight: number;
    calorieTarget: number;
    tdee: number;
    weightEntries?: WeightLog[];
};

export default function WeightPage() {
    const email = 'loser@test.com'; // Demo user
    const { unitSystem, setUnitSystem, loaded: unitLoaded } = useUnitSystem();

    const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
    const [user, setUser] = useState<UserProfile | null>(null);

    // newWeightKg is always the source of truth in kg; the input displays
    // a converted value when in imperial mode.
    const [newWeightKg, setNewWeightKg] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getUserProfile(email).then(u => {
            if (u) {
                setUser(u);
                setWeightLogs(u.weightEntries || []);
                setNewWeightKg(String(u.weight));
            }
        });
    }, []);

    const isImperial = unitSystem === 'imperial';

    const displayedNewWeight = newWeightKg
        ? (isImperial ? Math.round(kgToLbs(Number(newWeightKg)) * 10) / 10 : Number(newWeightKg))
        : '';

    const handleWeightInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '') {
            setNewWeightKg('');
            return;
        }
        const kg = isImperial ? lbsToKg(Number(raw)) : Number(raw);
        setNewWeightKg(String(Math.round(kg * 100) / 100));
    };

    const handleLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newWeightKg) return;
        setSaving(true);

        try {
            await logWeight(user.id, Number(newWeightKg), newDate);
            // Refresh local state to show it instantly
            const updatedUser = await getUserProfile(email);
            setWeightLogs(updatedUser?.weightEntries || []);

            // Clear form
            setNewWeightKg('');
        } catch (err) {
            console.error(err);
        }

        setSaving(false);
    };

    // Calculate Estimations
    let intakeProjectedWeeks = null;

    if (user && user.tdee) {
        // Hardcode average intake to user's target for UI demo purposes
        // Real implementation would calculate average of mealEntries over last 7 days
        const assumedIntake = user.calorieTarget;
        intakeProjectedWeeks = estimateWeeksToGoal(user.weight, user.goalWeight, assumedIntake, user.tdee);
    }

    if (!unitLoaded) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Weight Tracking</h1>
                    <p className="text-gray-400">Log your weight and view your projected progress.</p>
                </div>
                <UnitToggle value={unitSystem} onChange={setUnitSystem} />
            </header>

            {/* Projection Card */}
            {user && (
                <Card className="bg-gradient-to-r from-secondary/10 to-primary/10 border-secondary/30">
                    <CardContent className="py-6">
                        <h3 className="text-lg font-semibold text-white mb-2">Time to Goal Estimate</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-white/5 p-4 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-400 mb-1">Projected by Intake</p>
                                <p className="text-2xl font-bold text-primary">
                                    {intakeProjectedWeeks !== null ? `${Math.round(intakeProjectedWeeks)} weeks` : 'N/A'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 mt-1">
                                    Assuming you eat exactly {Math.round(user.calorieTarget)} kcal daily.
                                </p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-400 mb-1">Projected by Scale Trend</p>
                                {/* A more robust chart or regression formula output goes here */}
                                <p className="text-2xl font-bold text-secondary">
                                    {weightLogs.length > 5 ? `~${Math.round(intakeProjectedWeeks ? intakeProjectedWeeks * 1.1 : 0)} weeks` : 'Need more data'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 mt-1">
                                    Based on your last {weightLogs.length} weigh-ins.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Logging Form */}
            <Card>
                <CardHeader title="Log Weight" />
                <CardContent>
                    <form onSubmit={handleLog} className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="w-full sm:w-1/3">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                        </div>

                        <div className="w-full sm:w-1/3">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Weight ({isImperial ? 'lb' : 'kg'})</label>
                            <input type="number" step="0.1" value={displayedNewWeight} onChange={handleWeightInputChange} required className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                        </div>

                        <button type="submit" disabled={saving || !newWeightKg} className="w-full sm:w-1/3 bg-primary hover:bg-primary-dark text-black font-semibold glow-primary px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>{saving ? 'Saving...' : 'Add Log'}</span>
                        </button>
                    </form>
                </CardContent>
            </Card>

            {/* Log History */}
            <Card>
                <CardHeader title="Recent Logs" />
                <ul className="divide-y divide-white/10">
                    {weightLogs.map(log => (
                        <li key={log.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <span className="font-medium text-white">{format(new Date(log.date), 'MMM d, yyyy')}</span>
                            <span className="text-gray-400 font-semibold">{formatWeight(log.weight, unitSystem)}</span>
                        </li>
                    ))}
                    {weightLogs.length === 0 && <li className="p-4 text-gray-400 text-center">No weight logs recorded yet.</li>}
                </ul>
            </Card>
        </div>
    );
}
