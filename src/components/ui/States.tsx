import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from './Card';

export function EmptyState({ icon, title, body, action, className }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center px-4 py-8 text-center', className)}>
            {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-ink-3">{icon}</div>}
            <p className="text-sm font-medium text-ink">{title}</p>
            {body && <p className="mt-1 max-w-xs text-[13px] text-ink-3">{body}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export function ErrorState({ error, onRetry, className }: { error: Error | string; onRetry?: () => void; className?: string }) {
    const msg = typeof error === 'string' ? error : error.message;
    const dbDown = /DATABASE_URL|connect|ECONNREFUSED|Can't reach database/i.test(msg);
    return (
        <div role="alert" className={cn('flex flex-col items-center px-4 py-8 text-center', className)}>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-danger-soft text-danger">
                <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-medium text-ink">{dbDown ? 'Can’t reach the database' : 'Something went wrong'}</p>
            <p className="mt-1 max-w-sm text-[13px] text-ink-3">{dbDown ? 'Check DATABASE_URL, or explore the demo instead.' : msg}</p>
            {onRetry && (
                <Button className="mt-4" size="sm" onClick={onRetry}>
                    Try again
                </Button>
            )}
        </div>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('skeleton', className)} aria-hidden />;
}
