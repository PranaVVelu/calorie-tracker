'use client';

import { UnitSystem } from '@/utils/units';

export function UnitToggle({ value, onChange }: { value: UnitSystem; onChange: (v: UnitSystem) => void }) {
    return (
        <div className="inline-flex bg-white/5 border border-white/15 rounded-full p-1">
            {(['metric', 'imperial'] as UnitSystem[]).map(option => (
                <button
                    key={option}
                    type="button"
                    onClick={() => onChange(option)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        value === option
                            ? 'bg-primary text-black font-semibold'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    {option === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lb/ft)'}
                </button>
            ))}
        </div>
    );
}
