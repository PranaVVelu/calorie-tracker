'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CalendarDays, LineChart, Plus, Bookmark, Target, FlaskConical, RotateCcw, LogOut, Sparkles } from 'lucide-react';
import { DataProvider, useData } from '@/lib/data/DataProvider';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { AppProvider, useApp } from './AppContext';
import { LoggerSheet } from '@/components/logging/LoggerSheet';
import { cn } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const NAV = [
    { href: '/', label: 'Today', icon: CalendarDays },
    { href: '/progress', label: 'Progress', icon: LineChart },
    { href: '/foods', label: 'Foods', icon: Bookmark },
    { href: '/settings', label: 'Goals', icon: Target },
];

function isActive(pathname: string, href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function Logo() {
    return (
        <Link href="/" className="flex items-center gap-2.5 rounded-lg px-1 font-semibold tracking-tight text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-on-accent">
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
                    <path d="M4 18V9l4 6 4-9 4 9 4-6v9" />
                </svg>
            </span>
            <span className="text-[17px]">MacroTrack</span>
        </Link>
    );
}

function DemoControls({ compact }: { compact?: boolean }) {
    const { mode, enterDemo, exitDemo, resetDemoData, canExitDemo } = useData();
    const toast = useToast();
    if (mode === 'demo') {
        return (
            <div className={cn('rounded-2xl border border-accent/25 bg-accent-soft p-3', compact && 'p-2.5')}>
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Demo mode
                </p>
                <p className="mt-1 text-xs text-ink-2">Sample data, stored only in this browser.</p>
                <div className="mt-2.5 flex gap-1.5">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                            resetDemoData();
                            toast({ message: 'Demo data reset' });
                        }}
                    >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
                    </Button>
                    {canExitDemo && (
                        <Button size="sm" variant="ghost" onClick={exitDemo}>
                            <LogOut className="h-3.5 w-3.5" aria-hidden /> Exit
                        </Button>
                    )}
                </div>
            </div>
        );
    }
    return (
        <button
            type="button"
            onClick={enterDemo}
            className="group flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface-2 p-3 text-left hover:border-accent/30"
        >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent">
                <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">Try the demo</span>
                <span className="block text-xs text-ink-3">6 weeks of sample data</span>
            </span>
        </button>
    );
}

function DemoBanner() {
    const { mode, exitDemo, resetDemoData, canExitDemo } = useData();
    const toast = useToast();
    if (mode !== 'demo') return null;
    return (
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-accent/20 bg-[#0f1f1d]/95 px-4 py-2 text-[13px] backdrop-blur md:hidden">
            <FlaskConical className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-2">
                <span className="font-semibold text-accent">Demo</span> · sample data, this browser only
            </span>
            <button
                type="button"
                className="rounded-lg px-2 py-1 font-medium text-ink-2 hover:text-ink"
                onClick={() => {
                    resetDemoData();
                    toast({ message: 'Demo data reset' });
                }}
            >
                Reset
            </button>
            {canExitDemo && (
                <button type="button" className="rounded-lg px-2 py-1 font-medium text-accent" onClick={exitDemo}>
                    Exit
                </button>
            )}
        </div>
    );
}

function Sidebar() {
    const pathname = usePathname();
    const { openLogger } = useApp();
    return (
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-[#121418] px-3 py-5 md:flex">
            <div className="px-2">
                <Logo />
            </div>
            <Button variant="primary" size="lg" className="mx-1 mt-6" onClick={() => openLogger()} aria-keyshortcuts="n">
                <Plus className="h-5 w-5" aria-hidden /> Log food
                <kbd className="ml-auto rounded-md bg-black/15 px-1.5 text-[11px] font-semibold">N</kbd>
            </Button>
            <nav aria-label="Main" className="mt-6 flex flex-col gap-0.5">
                {NAV.map(item => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                active ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:bg-white/[0.04] hover:text-ink'
                            )}
                        >
                            <Icon className={cn('h-[18px] w-[18px]', active && 'text-accent')} aria-hidden />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="mt-auto px-1">
                <DemoControls />
            </div>
        </aside>
    );
}

function BottomNav() {
    const pathname = usePathname();
    const { openLogger } = useApp();
    const items = [NAV[0], NAV[1], null, NAV[2], NAV[3]];
    return (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#121418]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
            <ul className="mx-auto grid max-w-md grid-cols-5 items-center">
                {items.map((item, i) =>
                    item ? (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                                className={cn(
                                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                                    isActive(pathname, item.href) ? 'text-accent' : 'text-ink-3'
                                )}
                            >
                                <item.icon className="h-[22px] w-[22px]" aria-hidden />
                                {item.label}
                            </Link>
                        </li>
                    ) : (
                        <li key={`add-${i}`} className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => openLogger()}
                                className="-mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-on-accent shadow-[0_10px_30px_-8px_rgb(45_212_191/0.7)] active:scale-95"
                                aria-label="Log food"
                            >
                                <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
                            </button>
                        </li>
                    )
                )}
            </ul>
        </nav>
    );
}

function KeyboardShortcuts() {
    const { openLogger, logger } = useApp();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            if (logger || e.metaKey || e.ctrlKey || e.altKey) return;
            if (t.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                openLogger();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openLogger, logger]);
    return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <DataProvider>
            <ToastProvider>
                <AppProvider>
                    <a href="#main" className="sr-only z-[70] rounded-lg bg-accent px-3 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
                        Skip to content
                    </a>
                    <div className="flex min-h-dvh">
                        <Sidebar />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <DemoBanner />
                            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-5 sm:px-6 md:pb-12 md:pt-8 lg:px-10">
                                {children}
                            </main>
                        </div>
                    </div>
                    <BottomNav />
                    <LoggerSheet />
                    <KeyboardShortcuts />
                </AppProvider>
            </ToastProvider>
        </DataProvider>
    );
}

export { DemoControls };
