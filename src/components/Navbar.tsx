import Link from 'next/link';
import { Activity, Apple, Settings, LineChart } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="bg-white shadow-sm border-b">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
                            <Activity className="h-6 w-6 text-primary" />
                            <span>MacroTrack</span>
                        </Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Link href="/" className="text-gray-600 hover:text-primary p-2 rounded-md flex items-center gap-1 transition-colors">
                            <LineChart className="h-5 w-5" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                        <Link href="/log" className="text-gray-600 hover:text-primary p-2 rounded-md flex items-center gap-1 transition-colors">
                            <Apple className="h-5 w-5" />
                            <span className="hidden sm:inline">Log Food</span>
                        </Link>
                        <Link href="/settings" className="text-gray-600 hover:text-primary p-2 rounded-md flex items-center gap-1 transition-colors">
                            <Settings className="h-5 w-5" />
                            <span className="hidden sm:inline">Settings</span>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
