// Small things kept in this browser's localStorage (the look, the last app, backup and sync bookkeeping...). Storage can be
// blocked or full (private mode): reads then give null and writes are skipped, so callers fall back to their defaults.
export const getLocal = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
// null removes the key. Resolves to false when it could not be stored.
export const setLocal = (k: string, v: string | null): boolean => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch { return false; }
};
export const readJson = <T = unknown>(k: string): T | null => { try { return JSON.parse(getLocal(k) ?? 'null') as T | null; } catch { return null; } };
export const writeJson = (k: string, v: unknown): boolean => setLocal(k, JSON.stringify(v));
