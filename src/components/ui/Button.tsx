import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './Card';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
    primary: 'bg-accent text-on-accent font-semibold hover:bg-[#5eead4] active:bg-accent-strong shadow-[0_6px_20px_-8px_rgb(45_212_191/0.6)]',
    secondary: 'bg-surface-3 text-ink border border-line-strong hover:bg-[#2e343d]',
    subtle: 'bg-accent-soft text-accent hover:bg-[rgb(45_212_191/0.2)]',
    ghost: 'text-ink-2 hover:text-ink hover:bg-white/5',
    danger: 'bg-danger-soft text-danger hover:bg-[rgb(248_113_113/0.2)]',
};

const sizes: Record<Size, string> = {
    sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2',
    lg: 'h-12 px-5 text-[15px] rounded-xl gap-2',
    icon: 'h-10 w-10 rounded-xl',
    'icon-sm': 'h-8 w-8 rounded-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                variants[variant],
                sizes[size],
                className
            )}
            {...rest}
        >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {children}
        </button>
    );
});
