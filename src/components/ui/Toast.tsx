'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from './Card';

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info'; action?: { label: string; onClick: () => void } };
type ToastInput = Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] };

const Ctx = createContext<(t: ToastInput) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const seq = useRef(0);

    const dismiss = useCallback((id: number) => setToasts(ts => ts.filter(t => t.id !== id)), []);
    const push = useCallback(
        (t: ToastInput) => {
            const id = ++seq.current;
            setToasts(ts => [...ts.slice(-2), { tone: 'success', ...t, id }]);
            setTimeout(() => dismiss(id), t.action ? 8000 : 3200);
        },
        [dismiss]
    );

    return (
        <Ctx.Provider value={push}>
            {children}
            <div
                aria-live="polite"
                className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:right-6 md:items-end"
            >
                {toasts.map(t => (
                    <div
                        key={t.id}
                        role={t.tone === 'error' ? 'alert' : 'status'}
                        className={cn(
                            'pointer-events-auto flex w-full max-w-sm animate-fade-up items-center gap-3 rounded-2xl border border-line-strong bg-surface-3 py-2.5 pl-3.5 pr-2 text-sm shadow-xl'
                        )}
                    >
                        {t.tone === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
                        <span className="min-w-0 flex-1 text-ink">{t.message}</span>
                        {t.action && (
                            <button
                                type="button"
                                onClick={() => {
                                    t.action!.onClick();
                                    dismiss(t.id);
                                }}
                                className="rounded-lg px-2.5 py-1 text-[13px] font-semibold text-accent hover:bg-accent-soft"
                            >
                                {t.action.label}
                            </button>
                        )}
                        <button type="button" onClick={() => dismiss(t.id)} className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:text-ink" aria-label="Dismiss">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}

export const useToast = () => useContext(Ctx);
