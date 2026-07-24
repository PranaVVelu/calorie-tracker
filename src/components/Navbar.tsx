import Link from 'next/link';
import { Zap, Apple, Settings, LineChart, Scale } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white">
                            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/15 border border-primary/30">
                                <Zap className="h-4 w-4 text-primary" fill="currentColor" />
                            </span>
                            <span>MacroTrack</span>
                        </Link>
                    </div>

                    <div className="flex items-center space-x-1">
                        <Link href="/" className="text-gray-400 hover:text-primary hover:bg-white/5 p-2 rounded-md flex items-center gap-1 transition-colors">
                            <LineChart className="h-5 w-5" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                        <Link href="/log" className="text-gray-400 hover:text-primary hover:bg-white/5 p-2 rounded-md flex items-center gap-1 transition-colors">
                            <Apple className="h-5 w-5" />
                            <span className="hidden sm:inline">Log Food</span>
                        </Link>
                        <Link href="/weight" className="text-gray-400 hover:text-primary hover:bg-white/5 p-2 rounded-md flex items-center gap-1 transition-colors">
                            <Scale className="h-5 w-5" />
                            <span className="hidden sm:inline">Weight</span>
                        </Link>
                        <Link href="/settings" className="text-gray-400 hover:text-primary hover:bg-white/5 p-2 rounded-md flex items-center gap-1 transition-colors">
                            <Settings className="h-5 w-5" />
                            <span className="hidden sm:inline">Settings</span>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
