'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { searchFoodItems, addFoodToMeal, createCustomFoodAndAddToMeal } from '@/actions/food.actions';
import { parseMealDescription, ParsedMeal } from '@/actions/ai.actions';
import { Search, Plus, Sparkles, Loader2 } from 'lucide-react';

type FoodSearchResult = {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
};

export default function LogFoodPage() {
    const router = useRouter();
    // Demo only: this app hardcodes a single seeded user rather than real auth.

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FoodSearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const [selectedMeal, setSelectedMeal] = useState('Breakfast');
    const [selectedServing, setSelectedServing] = useState(1);
    const [addingId, setAddingId] = useState<string | null>(null);

    // --- AI meal logging state ---
    const [aiDescription, setAiDescription] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiResult, setAiResult] = useState<ParsedMeal | null>(null);
    const [aiSaving, setAiSaving] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setSearching(true);

        try {
            const items = await searchFoodItems(query);
            setResults(items);
        } catch (err) {
            console.error(err);
        }
        setSearching(false);
    };

    const handleAdd = async (foodId: string) => {
        setAddingId(foodId);
        try {
            const { getUserProfile } = await import('@/actions/user.actions');
            const user = await getUserProfile('loser@test.com');

            if (user) {
                await addFoodToMeal(user.id, new Date().toISOString(), foodId, selectedMeal, selectedServing);
                router.push('/');
                router.refresh();
            }
        } catch (err) {
            console.error(err);
        }
        setAddingId(null);
    };

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiDescription.trim()) return;

        setAiLoading(true);
        setAiError(null);
        setAiResult(null);

        try {
            const parsed = await parseMealDescription(aiDescription);
            setAiResult(parsed);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Something went wrong analyzing that meal.';
            setAiError(message);
        }
        setAiLoading(false);
    };

    const handleConfirmAiMeal = async () => {
        if (!aiResult) return;
        setAiSaving(true);

        try {
            const { getUserProfile } = await import('@/actions/user.actions');
            const user = await getUserProfile('loser@test.com');

            if (user) {
                await createCustomFoodAndAddToMeal(user.id, new Date().toISOString(), selectedMeal, {
                    name: aiResult.name,
                    calories: aiResult.calories,
                    protein: aiResult.protein,
                    carbs: aiResult.carbs,
                    fat: aiResult.fat,
                    servingSize: aiResult.servingSize,
                });
                router.push('/');
                router.refresh();
            }
        } catch (err) {
            console.error(err);
            setAiError('Could not save this meal. Please try again.');
        }
        setAiSaving(false);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Log Food</h1>
                <p className="text-gray-500">Search the database, or describe your meal and let AI estimate it.</p>
            </header>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
                    <select value={selectedMeal} onChange={e => setSelectedMeal(e.target.value)} className="w-full border border-gray-300 rounded-md p-2">
                        <option value="Breakfast">Breakfast</option>
                        <option value="Lunch">Lunch</option>
                        <option value="Dinner">Dinner</option>
                        <option value="Snack">Snack</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Servings (for database search)</label>
                    <input type="number" step="0.5" min="0.5" value={selectedServing} onChange={e => setSelectedServing(Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-2" />
                </div>
            </div>

            {/* AI Natural Language Meal Logging */}
            <Card className="border-primary/30">
                <CardHeader title="Describe Your Meal (AI-Powered)" />
                <CardContent className="space-y-4">
                    <form onSubmit={handleAnalyze} className="space-y-3">
                        <textarea
                            value={aiDescription}
                            onChange={e => setAiDescription(e.target.value)}
                            placeholder="e.g. Grilled chicken sandwich with fries and a small side salad"
                            rows={3}
                            className="w-full border border-gray-300 rounded-md p-3 focus:ring-primary focus:border-primary resize-none"
                        />
                        <button
                            type="submit"
                            disabled={aiLoading || !aiDescription.trim()}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                        >
                            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {aiLoading ? 'Analyzing...' : 'Analyze with AI'}
                        </button>
                    </form>

                    {aiError && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{aiError}</p>
                    )}

                    {aiResult && (
                        <div className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">{aiResult.name}</h4>
                                <span className="text-xs text-gray-500">{aiResult.servingSize}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                <div>
                                    <p className="font-semibold text-gray-900">{aiResult.calories}</p>
                                    <p className="text-xs text-gray-500">kcal</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{aiResult.protein}g</p>
                                    <p className="text-xs text-gray-500">Protein</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{aiResult.carbs}g</p>
                                    <p className="text-xs text-gray-500">Carbs</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{aiResult.fat}g</p>
                                    <p className="text-xs text-gray-500">Fat</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">AI-estimated, adjust manually later if needed.</p>
                            <button
                                onClick={handleConfirmAiMeal}
                                disabled={aiSaving}
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                                {aiSaving ? 'Adding...' : `Add to ${selectedMeal}`}
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Manual Database Search */}
            <Card>
                <CardHeader title="Or Search the Food Database" />
                <CardContent className="space-y-4">
                    <form onSubmit={handleSearch} className="flex gap-2 relative">
                        <div className="relative w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search for a food (e.g., Apple, Chicken)..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <button type="submit" disabled={searching || !query} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md font-medium transition-colors">
                            {searching ? '...' : 'Search'}
                        </button>
                    </form>
                </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
                <Card>
                    <CardHeader title="Search Results" />
                    <ul className="divide-y divide-gray-100">
                        {results.map(item => (
                            <li key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div>
                                    <h4 className="font-semibold text-gray-900">{item.name}</h4>
                                    <p className="text-sm text-gray-500">
                                        {item.servingSize} • {Math.round(item.calories)} kcal
                                        <span className="text-xs ml-2 text-gray-400 border-l pl-2">
                                            P: {item.protein}g C: {item.carbs}g F: {item.fat}g
                                        </span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleAdd(item.id)}
                                    disabled={addingId === item.id}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors flex gap-1 items-center font-medium text-sm"
                                >
                                    <Plus className="h-5 w-5" />
                                    <span className="hidden sm:inline">{addingId === item.id ? 'Adding...' : 'Add'}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}
