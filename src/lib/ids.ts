/** Random id usable as an idempotency key; works without crypto.randomUUID (non-secure origins). */
export function newId(prefix = ''): string {
    const c = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
    if (c?.randomUUID) return prefix + c.randomUUID();
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
