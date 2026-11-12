'use client';

import { useSyncExternalStore } from 'react';

export type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'macrotrack-unit-system';
const listeners = new Set<() => void>();

function read(): UnitSystem {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric';
    } catch {
        return 'metric';
    }
}

/**
 * The user's preferred display unit system, shared across the app and
 * remembered in localStorage. The database always stores kg/cm; conversion
 * happens only at the UI boundary.
 */
export function useUnitSystem() {
    const unitSystem = useSyncExternalStore(
        l => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        read,
        () => 'metric' as UnitSystem
    );
    const setUnitSystem = (value: UnitSystem) => {
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch {
            /* ignore */
        }
        listeners.forEach(l => l());
    };
    return { unitSystem, setUnitSystem, loaded: true };
}

// --- Weight ---
export const LB_PER_KG = 2.20462262;

export function kgToLbs(kg: number): number {
    return kg * LB_PER_KG;
}

export function lbsToKg(lbs: number): number {
    return lbs / LB_PER_KG;
}

/** kg → number in the display unit, rounded to 1 decimal. */
export function displayWeight(kg: number, unitSystem: UnitSystem): number {
    const v = unitSystem === 'imperial' ? kgToLbs(kg) : kg;
    return Math.round(v * 10) / 10;
}

/** Display-unit number → kg (full precision, stored as-is). */
export function toKg(value: number, unitSystem: UnitSystem): number {
    return unitSystem === 'imperial' ? lbsToKg(value) : value;
}

export function weightUnit(unitSystem: UnitSystem): 'kg' | 'lb' {
    return unitSystem === 'imperial' ? 'lb' : 'kg';
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
    return `${displayWeight(kg, unitSystem)} ${weightUnit(unitSystem)}`;
}

export function formatHeight(cm: number, unitSystem: UnitSystem): string {
    if (unitSystem === 'imperial') {
        const { feet, inches } = cmToFeetInches(cm);
        return `${feet}'${inches}"`;
    }
    return `${Math.round(cm)} cm`;
}
