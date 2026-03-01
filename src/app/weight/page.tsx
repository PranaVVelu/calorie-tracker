'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { getUserProfile, logWeight } from '@/actions/user.actions';
import { estimateWeeksToGoal } from '@/utils/algorithms';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

export default function WeightPage() {
    const router = useRouter();
    const email = 'loser@test.com'; // Demo user

    const [weightLogs, setWeightLogs] = useState<{ id: string, weight: number, date: Date }[]>([]);
    const [user, setUser] = useState<any>(null);

    const [newWeight, setNewWeight] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getUserProfile(email).then(u => {
            if (u) {
                setUser(u);
                setWeightLogs(u.weightEntries || []);
                setNewWeight(String(u.weight));
            }
        });
    }, []);

    const handleLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newWeight) return;
        setSaving(true);

        try {
            await logWeight(user.id, Number(newWeight), newDate);
            // Refresh local state to show it instantly
            const updatedUser = await getUserProfile(email);
            setWeightLogs(updatedUser?.weightEntries || []);

            // Clear form
            setNewWeight('');
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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Weight Tracking</h1>
                <p className="text-gray-500">Log your weight and view your projected progress.</p>
            </header>

            {/* Projection Card */}
            {user && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                    <CardContent className="py-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Time to Goal Estimate</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-500 mb-1">Projected by Intake</p>
                                <p className="text-2xl font-bold text-primary">
                                    {intakeProjectedWeeks !== null ? `${Math.round(intakeProjectedWeeks)} weeks` : 'N/A'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 mt-1">
                                    Assuming you eat exactly {Math.round(user.calorieTarget)} kcal daily.
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-500 mb-1">Projected by Scale Trend</p>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className="w-full border border-gray-300 rounded-md p-2" />
                        </div>

                        <div className="w-full sm:w-1/3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                            <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} required className="w-full border border-gray-300 rounded-md p-2" />
                        </div>

                        <button type="submit" disabled={saving || !newWeight} className="w-full sm:w-1/3 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>{saving ? 'Saving...' : 'Add Log'}</span>
                        </button>
                    </form>
                </CardContent>
            </Card>

            {/* Log History */}
            <Card>
                <CardHeader title="Recent Logs" />
                <ul className="divide-y divide-gray-100">
                    {weightLogs.map(log => (
                        <li key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <span className="font-medium text-gray-900">{format(new Date(log.date), 'MMM d, yyyy')}</span>
                            <span className="text-gray-600 font-semibold">{log.weight} kg</span>
                        </li>
                    ))}
                    {weightLogs.length === 0 && <li className="p-4 text-gray-500 text-center">No weight logs recorded yet.</li>}
                </ul>
            </Card>
        </div>
    );
}
