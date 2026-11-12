'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from './Card';

/**
 * Accessible modal built on native <dialog>: focus is trapped, Esc closes,
 * focus returns to the trigger. Renders as a bottom sheet on small screens.
 */
export function Dialog({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    className,
}: {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const descId = useId();
    const returnFocus = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            returnFocus.current = document.activeElement as HTMLElement | null;
            d.showModal();
            document.body.style.overflow = 'hidden';
            // showModal() moves focus to the first focusable element; honour an explicit target.
            requestAnimationFrame(() => d.querySelector<HTMLElement>('[data-autofocus]')?.focus());
        } else if (!open && d.open) {
            d.close();
        }
    }, [open]);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        const handleClose = () => {
            document.body.style.overflow = '';
            returnFocus.current?.focus?.();
            onClose();
        };
        const handleCancel = (e: Event) => {
            e.preventDefault();
            onClose();
        };
        d.addEventListener('close', handleClose);
        d.addEventListener('cancel', handleCancel);
        return () => {
            d.removeEventListener('close', handleClose);
            d.removeEventListener('cancel', handleCancel);
        };
    }, [onClose]);

    useEffect(() => () => void (document.body.style.overflow = ''), []);

    const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

    return (
        <dialog
            ref={ref}
            className="mt-dialog sm:m-auto sm:w-[calc(100vw-2rem)]"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            onClick={e => {
                if (e.target === ref.current) onClose();
            }}
        >
            {open && (
                <div
                    className={cn(
                        'mt-dialog-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-line-strong bg-surface shadow-2xl sm:mx-auto sm:max-h-[86dvh] sm:rounded-[1.5rem]',
                        widths[size],
                        className
                    )}
                >
                    <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
                    <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:pt-5">
                        <div className="min-w-0">
                            <h2 id={titleId} className="text-lg font-semibold text-ink">
                                {title}
                            </h2>
                            {description && (
                                <div id={descId} className="mt-0.5 text-[13px] text-ink-3">
                                    {description}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/5 hover:text-ink"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
                    {footer && <footer className="border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
                </div>
            )}
        </dialog>
    );
}
