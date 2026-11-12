'use client';

/**
 * Calorie meter. Fills teal up to the target; any overage is drawn as a
 * neutral second lap so "over" reads as information, not an alarm.
 */
export function CalorieRing({ consumed, target, size = 208, stroke = 16 }: { consumed: number; target: number; size?: number; stroke?: number }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = target > 0 ? consumed / target : 0;
    const main = Math.min(1, Math.max(0, pct));
    const over = Math.min(1, Math.max(0, pct - 1));

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - main)}
                className="ring-track"
            />
            {over > 0 && (
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="rgb(242 244 247 / 0.75)"
                    strokeWidth={stroke - 6}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - over)}
                    className="ring-track"
                />
            )}
        </svg>
    );
}
