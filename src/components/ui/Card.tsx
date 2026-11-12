import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Card({ className, children, as: As = 'section', ...rest }: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }) {
    return (
        <As className={cn('card', className)} {...rest}>
            {children}
        </As>
    );
}

export function CardHeader({
    title,
    subtitle,
    action,
    className,
    id,
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
    id?: string;
}) {
    return (
        <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
            <div className="min-w-0">
                <h2 id={id} className="text-[15px] font-semibold text-ink">
                    {title}
                </h2>
                {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('p-5', className)}>{children}</div>;
}
