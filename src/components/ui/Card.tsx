import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Card({ className, children }: { className?: string, children: React.ReactNode }) {
    return (
        <div className={cn("glass-card rounded-2xl shadow-xl shadow-black/20 overflow-hidden", className)}>
            {children}
        </div>
    );
}

export function CardHeader({ title, subtitle, className }: { title: string, subtitle?: string, className?: string }) {
    return (
        <div className={cn("px-6 py-4 border-b border-white/10", className)}>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
    );
}

export function CardContent({ className, children }: { className?: string, children: React.ReactNode }) {
    return (
        <div className={cn("p-6", className)}>
            {children}
        </div>
    );
}
