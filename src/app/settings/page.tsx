'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { UnitToggle } from '@/components/ui/UnitToggle';
import { getUserProfile, upsertUserProfile } from '@/actions/user.actions';
import { GenderType, GoalType } from '@/utils/algorithms';
import { useUnitSystem, kgToLbs, lbsToKg, cmToFeetInches, feetInchesToCm } from '@/utils/units';

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const email = 'loser@test.com'; // Demo user
    const { unitSystem, setUnitSystem, loaded: unitLoaded } = useUnitSystem();

    // Height, when in imperial mode, is edited as separate feet/inches fields.
    const [heightFeet, setHeightFeet] = useState(5);
    const [heightInches, setHeightInches] = useState(9);

    const [formData, setFormData] = useState({
        name: '',
        age: 30,
        gender: 'male' as GenderType,
        height: 175, // always stored in cm
        weight: 75,  // always stored in kg
        activityLevel: 1.2,
        goalType: 'lose' as GoalType,
        goalRate: 0.5, // always stored in kg/week
        goalWeight: 70 // always stored in kg
    });

    useEffect(() => {
        getUserProfile(email).then(user => {
            if (user) {
                setFormData({
                    name: user.name || '',
                    age: user.age,
                    gender: user.gender as GenderType,
                    height: user.height,
                    weight: user.weight,
                    activityLevel: user.activityLevel,
                    goalType: user.goalType as GoalType,
                    goalRate: user.goalRate,
                    goalWeight: user.goalWeight
                });
                const { feet, inches } = cmToFeetInches(user.height);
                setHeightFeet(feet);
                setHeightInches(inches);
            }
            setLoading(false);
        });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    // --- Imperial-aware handlers: convert on the way in, store metric ---
    const handleWeightLbsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const lbs = Number(e.target.value);
        setFormData(prev => ({ ...prev, weight: Math.round(lbsToKg(lbs) * 10) / 10 }));
    };

    const handleGoalWeightLbsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const lbs = Number(e.target.value);
        setFormData(prev => ({ ...prev, goalWeight: Math.round(lbsToKg(lbs) * 10) / 10 }));
    };

    const handleHeightFeetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const feet = Number(e.target.value);
        setHeightFeet(feet);
        setFormData(prev => ({ ...prev, height: Math.round(feetInchesToCm(feet, heightInches) * 10) / 10 }));
    };

    const handleHeightInchesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const inches = Number(e.target.value);
        setHeightInches(inches);
        setFormData(prev => ({ ...prev, height: Math.round(feetInchesToCm(heightFeet, inches) * 10) / 10 }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await upsertUserProfile({ ...formData, email });
        setSaving(false);
        router.push('/');
        router.refresh();
    };

    if (loading || !unitLoaded) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading profile...</div>;

    const isImperial = unitSystem === 'imperial';
    // Display-only rate: internal storage always stays kg/week regardless of unit system.
    const displayedRate = isImperial ? Math.round(kgToLbs(formData.goalRate) * 100) / 100 : formData.goalRate;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Profile & Goals</h1>
                    <p className="text-gray-400">Update your metrics to recalculate your targets.</p>
                </div>
                <UnitToggle value={unitSystem} onChange={setUnitSystem} />
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <CardHeader title="Personal Information" />
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Age</label>
                                <input required type="number" name="age" value={formData.age} onChange={handleChange} min="15" max="120" className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Gender (Biological)</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} style={{ colorScheme: 'dark' }} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2">
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="male">Male</option>
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="female">Female</option>
                                </select>
                            </div>

                            {isImperial ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Height (ft/in)</label>
                                    <div className="flex gap-2">
                                        <select value={heightFeet} onChange={handleHeightFeetChange} style={{ colorScheme: 'dark' }} className="w-full border border-white/15 bg-white/5 text-white rounded-md p-2">
                                            {Array.from({ length: 6 }, (_, i) => i + 3).map(ft => (
                                                <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} key={ft} value={ft}>{ft} ft</option>
                                            ))}
                                        </select>
                                        <select value={heightInches} onChange={handleHeightInchesChange} style={{ colorScheme: 'dark' }} className="w-full border border-white/15 bg-white/5 text-white rounded-md p-2">
                                            {Array.from({ length: 12 }, (_, i) => i).map(inch => (
                                                <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} key={inch} value={inch}>{inch} in</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Height (cm)</label>
                                    <input required type="number" name="height" value={formData.height} onChange={handleChange} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                                </div>
                            )}

                            {isImperial ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Current Weight (lb)</label>
                                    <input required type="number" step="0.1" value={Math.round(kgToLbs(formData.weight) * 10) / 10} onChange={handleWeightLbsChange} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Current Weight (kg)</label>
                                    <input required type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Activity Level</label>
                                <select name="activityLevel" value={String(formData.activityLevel)} onChange={handleChange} style={{ colorScheme: 'dark' }} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2">
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="1.2">Sedentary (Office job)</option>
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="1.375">Light Exercise (1-2 days/week)</option>
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="1.55">Moderate Exercise (3-5 days/week)</option>
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="1.725">Heavy Exercise (6-7 days/week)</option>
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="1.9">Athlete (2x per day)</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader title="Goals" subtitle="How you want your targets calculated." />
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Goal Type</label>
                                <select name="goalType" value={formData.goalType} onChange={handleChange} style={{ colorScheme: 'dark' }} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2">
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="lose">Lose Weight</option>
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="maintain">Maintain Weight</option>
                                    <option style={{ backgroundColor: '#0d0f12', color: '#ffffff' }} value="gain">Gain Weight</option>
                                </select>
                            </div>

                            {isImperial ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Goal Weight (lb)</label>
                                    <input required type="number" step="0.1" value={Math.round(kgToLbs(formData.goalWeight) * 10) / 10} onChange={handleGoalWeightLbsChange} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Goal Weight (kg)</label>
                                    <input required type="number" step="0.1" name="goalWeight" value={formData.goalWeight} onChange={handleChange} className="w-full border border-white/15 bg-white/5 text-white placeholder-gray-500 rounded-md p-2" />
                                </div>
                            )}
                        </div>

                        {formData.goalType !== 'maintain' && (
                            <div>
                                <label className="flex justify-between items-center text-sm font-medium text-gray-300 mb-1">
                                    <span>Target Rate ({isImperial ? 'lb' : 'kg'}/week)</span>
                                    <span className="text-secondary">{displayedRate} {isImperial ? 'lb' : 'kg'}</span>
                                </label>
                                <input
                                    type="range"
                                    name="goalRate"
                                    min={formData.goalType === 'gain' ? "0.1" : "0.25"}
                                    max={formData.goalType === 'gain' ? "0.5" : "1.0"}
                                    step="0.05"
                                    value={formData.goalRate}
                                    onChange={handleChange}
                                    className="w-full accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>Slow & Steady</span>
                                    <span>Aggressive</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => router.back()} className="px-4 py-2 text-gray-400 hover:text-white border border-white/15 bg-white/5 rounded-md hover:bg-white/10 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-6 py-2 bg-primary hover:bg-primary-dark text-black font-semibold glow-primary rounded-md font-medium transition-colors">
                        {saving ? 'Saving...' : 'Save & Recalculate'}
                    </button>
                </div>
            </form>
        </div>
    );
}
