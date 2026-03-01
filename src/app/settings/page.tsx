'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { getUserProfile, upsertUserProfile } from '@/actions/user.actions';
import { GenderType, GoalType } from '@/utils/algorithms';

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const email = 'loser@test.com'; // Demo user

    const [formData, setFormData] = useState({
        name: '',
        age: 30,
        gender: 'male' as GenderType,
        height: 175,
        weight: 75,
        activityLevel: 1.2,
        goalType: 'lose' as GoalType,
        goalRate: 0.5,
        goalWeight: 70
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await upsertUserProfile({ ...formData, email });
        setSaving(false);
        router.push('/');
        router.refresh();
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading profile...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Profile & Goals</h1>
                <p className="text-gray-500">Update your metrics to recalculate your targets.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <CardHeader title="Personal Information" />
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                                <input required type="number" name="age" value={formData.age} onChange={handleChange} min="15" max="120" className="w-full border border-gray-300 rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender (Biological)</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2">
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                                <input required type="number" name="height" value={formData.height} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Weight (kg)</label>
                                <input required type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Activity Level</label>
                                <select name="activityLevel" value={String(formData.activityLevel)} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2">
                                    <option value="1.2">Sedentary (Office job)</option>
                                    <option value="1.375">Light Exercise (1-2 days/week)</option>
                                    <option value="1.55">Moderate Exercise (3-5 days/week)</option>
                                    <option value="1.725">Heavy Exercise (6-7 days/week)</option>
                                    <option value="1.9">Athlete (2x per day)</option>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type</label>
                                <select name="goalType" value={formData.goalType} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2">
                                    <option value="lose">Lose Weight</option>
                                    <option value="maintain">Maintain Weight</option>
                                    <option value="gain">Gain Weight</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Weight (kg)</label>
                                <input required type="number" step="0.1" name="goalWeight" value={formData.goalWeight} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2" />
                            </div>
                        </div>

                        {formData.goalType !== 'maintain' && (
                            <div>
                                <label className="flex justify-between items-center text-sm font-medium text-gray-700 mb-1">
                                    <span>Target Rate (kg/week)</span>
                                    <span className="text-secondary">{formData.goalRate} kg</span>
                                </label>
                                <input
                                    type="range"
                                    name="goalRate"
                                    min={formData.goalType === 'gain' ? "0.1" : "0.25"}
                                    max={formData.goalType === 'gain' ? "0.5" : "1.0"}
                                    step="0.05"
                                    value={formData.goalRate}
                                    onChange={handleChange}
                                    className="w-full accent-primary h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Slow & Steady</span>
                                    <span>Aggressive</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => router.back()} className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-md font-medium transition-colors">
                        {saving ? 'Saving...' : 'Save & Recalculate'}
                    </button>
                </div>
            </form>
        </div>
    );
}
