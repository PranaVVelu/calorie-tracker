import { getUserProfile } from '@/actions/user.actions';
import { getDailyMealEntry } from '@/actions/food.actions';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import Link from 'next/link';

export default async function Dashboard() {
    const email = 'loser@test.com'; // Hardcoded for demo/test purposes
    const user = await getUserProfile(email);

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <h2 className="text-2xl font-bold mb-4">Welcome to MacroTrack</h2>
                <p className="text-gray-400 mb-6">Let's get started by setting up your profile and goals.</p>
                <Link href="/settings" className="bg-primary hover:bg-primary-dark text-black font-semibold glow-primary px-6 py-3 rounded-lg font-medium transition-colors">
                    Set up Profile
                </Link>
            </div>
        );
    }

    // Fetch today's food
    const todayStr = new Date().toISOString();
    const mealEntry = await getDailyMealEntry(user.id, todayStr);

    // Calculate Subtotals
    let totalCals = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    if (mealEntry && mealEntry.mealFoods) {
        mealEntry.mealFoods.forEach((mf: any) => {
            totalCals += mf.foodItem.calories * mf.servings;
            totalProtein += mf.foodItem.protein * mf.servings;
            totalCarbs += mf.foodItem.carbs * mf.servings;
            totalFat += mf.foodItem.fat * mf.servings;
        });
    }

    const remainingCals = Math.max(0, user.calorieTarget - totalCals);

    return (
        <div className="space-y-6">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-white">Today's Overview</h1>
                <p className="text-gray-400">Welcome back, {user.name?.split(' ')[0] || 'User'}</p>
            </header>

            {/* Main Calorie & Macro Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Calories Card */}
                <Card className="lg:col-span-1 border-primary/30 glow-primary bg-gradient-to-b from-primary/10 to-transparent">
                    <CardContent className="flex flex-col items-center justify-center h-full py-8">
                        <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Calories</h3>
                        <ProgressRing
                            value={totalCals}
                            max={user.calorieTarget}
                            label="Eaten"
                            sublabel={`/ ${user.calorieTarget} kcal`}
                            size={160}
                            strokeWidth={12}
                            colorClass="text-primary"
                        />
                        <div className="mt-6 text-center">
                            <span className="text-2xl font-bold text-white">{Math.round(remainingCals)}</span>
                            <span className="text-sm text-gray-400 block">Remaining</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Macros Breakdown */}
                <Card className="lg:col-span-3">
                    <CardHeader title="Macronutrients" subtitle="Your daily tracking targets" />
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-8">
                        <div className="flex flex-col items-center">
                            <ProgressRing
                                value={totalProtein}
                                max={user.proteinTarget}
                                label="Protein"
                                sublabel={`${Math.round(totalProtein)} / ${user.proteinTarget}g`}
                                colorClass="text-secondary"
                            />
                        </div>

                        <div className="flex flex-col items-center">
                            <ProgressRing
                                value={totalCarbs}
                                max={user.carbsTarget}
                                label="Carbs"
                                sublabel={`${Math.round(totalCarbs)} / ${user.carbsTarget}g`}
                                colorClass="text-accent"
                            />
                        </div>

                        <div className="flex flex-col items-center">
                            <ProgressRing
                                value={totalFat}
                                max={user.fatTarget}
                                label="Fat"
                                sublabel={`${Math.round(totalFat)} / ${user.fatTarget}g`}
                                colorClass="text-danger"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions / Recent */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader title="Today's Log" />
                    <CardContent>
                        {mealEntry?.mealFoods?.length ? (
                            <div className="space-y-4">
                                {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(mealType => {
                                    const foods = mealEntry.mealFoods?.filter((f: any) => f.mealType === mealType) || [];
                                    if (foods.length === 0) return null;

                                    return (
                                        <div key={mealType} className="border-b border-white/10 pb-3 last:border-0">
                                            <h4 className="font-medium text-sm text-white mb-2">{mealType}</h4>
                                            <ul className="space-y-2">
                                                {foods.map((mf: any) => (
                                                    <li key={mf.id} className="flex justify-between text-sm">
                                                        <span className="text-gray-400">
                                                            {mf.servings}x {mf.foodItem.name}
                                                        </span>
                                                        <span className="font-medium text-white">
                                                            {Math.round(mf.foodItem.calories * mf.servings)} kcal
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                })}
                                <div className="pt-2">
                                    <Link href="/log" className="text-secondary text-sm font-medium hover:underline">
                                        + Log more food
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-400">
                                <p className="mb-4">No food logged yet today.</p>
                                <Link href="/log" className="inline-block bg-white/5 border border-white/15 text-white shadow-sm px-4 py-2 rounded-md hover:bg-white/10 transition-colors">
                                    Add Entry
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader title="Goal Status" />
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                                <span className="text-gray-400 font-medium">Goal Type</span>
                                <span className="capitalize font-semibold text-white">{user.goalType}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                                <span className="text-gray-400 font-medium">Target Rate</span>
                                <span className="font-semibold text-white">{user.goalRate} kg/week</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                                <span className="text-gray-400 font-medium">Maintenance (TDEE)</span>
                                <span className="font-semibold text-white">{Math.round(user.tdee)} kcal</span>
                            </div>

                            <div className="pt-4">
                                <Link href="/settings" className="w-full block text-center bg-white/5 hover:bg-white/10 transition-colors border border-white/15 py-2 rounded-lg font-medium text-sm text-gray-300">
                                    Edit Profile
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
