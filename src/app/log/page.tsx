'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { searchFoodItems, addFoodToMeal } from '@/actions/food.actions';
import { Search, Plus } from 'lucide-react';

export default function LogFoodPage() {
    const router = useRouter();
    const userId = 'loser@test.com'; // Demo only, linking to our mocked user's email/id
    // Actually, wait, actions take the actual DB userId, not email!

    // Oh, wait, the seed script created user with email 'loser@test.com'.
    // I must pass the user ID, not email. I'll need to fetch the ID first, but for now I'll use a hack or assume we just look it up.
    // Actually, Server Actions are better fitted here, but let's assume we do this:

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const [selectedMeal, setSelectedMeal] = useState('Breakfast');
    const [selectedServing, setSelectedServing] = useState(1);
    const [addingId, setAddingId] = useState<string | null>(null);

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
            // We need the ACTUAL user ID. Let's create a wrapper or just use a small effect 
            // to fetch the user by email first to get ID. Or modify the action.
            // For speed in this demo, I will adjust addFoodToMeal action or call a wrapper.

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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Log Food</h1>
                <p className="text-gray-500">Search the database to add items to your daily log.</p>
            </header>

            <Card>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
                            <input type="number" step="0.5" min="0.5" value={selectedServing} onChange={e => setSelectedServing(Number(e.target.value))} className="w-full border border-gray-300 rounded-md p-2" />
                        </div>
                    </div>

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

            {/* Manual Entry Placeholder */}
            <Card className="border-dashed bg-transparent border-gray-300 shadow-none">
                <CardContent className="text-center py-8">
                    <p className="text-gray-500 mb-2">Can't find what you're looking for?</p>
                    <button className="text-primary font-medium hover:underline">
                        + Add Custom Food Manually
                    </button>
                </CardContent>
            </Card>

        </div>
    );
}
