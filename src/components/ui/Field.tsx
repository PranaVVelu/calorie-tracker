'use client';

import React, { useId } from 'react';
import { cn } from './Card';

/** Label + control + hint/error wiring. Child receives id/aria props via render fn. */
export function Field({
    label,
    hint,
    error,
    children,
    className,
    optional,
}: {
    label: React.ReactNode;
    hint?: React.ReactNode;
    error?: string | null;
    optional?: boolean;
    className?: string;
    children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
}) {
    const id = useId();
    const hintId = `${id}-hint`;
    const errId = `${id}-err`;
    const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
    return (
        <div className={cn('min-w-0', className)}>
            <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
                <span>{label}</span>
                {optional && <span className="text-[11px] font-normal text-ink-3">Optional</span>}
            </label>
            {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
            {error ? (
                <p id={errId} className="mt-1 text-xs text-danger" role="alert">
                    {error}
                </p>
            ) : hint ? (
                <p id={hintId} className="mt-1 text-xs text-ink-3">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
