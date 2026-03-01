'use client';

import React, { useEffect, useState } from 'react';
import { cn } from './Card';

interface ProgressRingProps {
    value: number;
    max: number;
    label: string;
    sublabel?: string;
    colorClass?: string;
    size?: number;
    strokeWidth?: number;
}

export function ProgressRing({
    value,
    max,
    label,
    sublabel,
    colorClass = "text-primary",
    size = 120,
    strokeWidth = 8
}: ProgressRingProps) {
    const [offset, setOffset] = useState(0);

    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

    useEffect(() => {
        const progressOffset = circumference - (percent / 100) * circumference;
        setOffset(progressOffset);
    }, [setOffset, circumference, percent, value]);

    return (
        <div className="flex flex-col items-center justify-center">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background Ring */}
                <svg className="transform -rotate-90 w-full h-full">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        className="text-gray-100"
                    />
                    {/* Progress Ring */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className={cn("progress-ring", colorClass)}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Inner Text content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                    <span className="text-xl font-bold leading-none">{Math.round(value)}</span>
                    <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{label}</span>
                    {sublabel && <span className="text-[10px] text-gray-400 mt-0.5">{sublabel}</span>}
                </div>
            </div>
        </div>
    );
}
