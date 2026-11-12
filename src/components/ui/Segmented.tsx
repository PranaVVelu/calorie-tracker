'use client';

import React, { useRef } from 'react';
import { cn } from './Card';

/** Radio-group style segmented control with arrow-key navigation. */
export function Segmented<T extends string>({
    value,
    onChange,
    options,
    label,
    size = 'md',
    className,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: React.ReactNode }[];
    label: string;
    size?: 'sm' | 'md';
    className?: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const idx = options.findIndex(o => o.value === value);

    const onKey = (e: React.KeyboardEvent) => {
        let next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = options.length - 1;
        if (next >= 0) {
            e.preventDefault();
            onChange(options[next].value);
            refs.current[next]?.focus();
        }
    };

    return (
        <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={cn('inline-flex rounded-xl bg-surface-2 p-1 border border-line', className)}>
            {options.map((o, i) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        ref={el => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active || (idx === -1 && i === 0) ? 0 : -1}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'flex-1 whitespace-nowrap rounded-lg font-medium transition-colors',
                            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
                            active ? 'bg-surface-3 text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
