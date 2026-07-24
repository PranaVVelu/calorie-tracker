'use client';

import { useEffect, useState } from 'react';

export type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'macrotrack-unit-system';

/**
 * Persists the user's preferred display unit system (metric/imperial) in
 * localStorage so it's remembered across visits. The database always stores
 * height in cm and weight in kg regardless of this preference; conversion
 * happens only at the UI boundary.
 */
export function useUnitSystem() {
    const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'metric' || stored === 'imperial') {
            setUnitSystemState(stored);
        }
        setLoaded(true);
    }, []);

    const setUnitSystem = (value: UnitSystem) => {
        setUnitSystemState(value);
        window.localStorage.setItem(STORAGE_KEY, value);
    };

    return { unitSystem, setUnitSystem, loaded };
}

// --- Weight ---
export function kgToLbs(kg: number): number {
    return kg * 2.20462262;
}

export function lbsToKg(lbs: number): number {
    return lbs / 2.20462262;
}

// --- Height ---
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - feet * 12);
    // Handle rounding carry (e.g. 11.6 -> 12 inches should become +1 foot)
    if (inches === 12) {
        return { feet: feet + 1, inches: 0 };
    }
    return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
    const totalInches = feet * 12 + inches;
    return totalInches * 2.54;
}

// --- Display formatting ---
export function formatWeight(kg: number, unitSystem: UnitSystem): string {
    if (unitSystem === 'imperial') {
        return `${Math.round(kgToLbs(kg) * 10) / 10} lb`;
    }
    return `${Math.round(kg * 10) / 10} kg`;
}

export function formatHeight(cm: number, unitSystem: UnitSystem): string {
    if (unitSystem === 'imperial') {
        const { feet, inches } = cmToFeetInches(cm);
        return `${feet}'${inches}"`;
    }
    return `${Math.round(cm)} cm`;
}
