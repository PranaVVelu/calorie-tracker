import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Card({ className, children }: { className?: string, children: React.ReactNode }) {
    return (
        <div className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden", className)}>
            {children}
        </div>
    );
}

export function CardHeader({ title, subtitle, className }: { title: string, subtitle?: string, className?: string }) {
    return (
        <div className={cn("px-6 py-4 border-b border-gray-100", className)}>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
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
