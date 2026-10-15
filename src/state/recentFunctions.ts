import { getFunction } from '@/engine/functions';

const RECENT_KEY = 'gridcalc:recent-functions:v1';
const MAX_RECENT = 5;

/** Functions inserted most recently, newest first. Stored data is untrusted: anything that isn't a known function is dropped. */
export function readRecentFunctions(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const names = raw.flatMap((n) => (typeof n === 'string' && getFunction(n) ? [getFunction(n)!.name] : []));
    return [...new Set(names)].slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordRecentFunction(name: string) {
  const next = [name, ...readRecentFunctions().filter((n) => n !== name)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Blocked storage: the list simply isn't remembered.
  }
}
