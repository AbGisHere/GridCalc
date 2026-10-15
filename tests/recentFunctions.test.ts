import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRecentFunctions, recordRecentFunction } from '@/state/recentFunctions';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('recent functions', () => {
  it('keeps the newest first, without repeats, up to five', () => {
    for (const name of ['SUM', 'IF', 'ROUND', 'SUM', 'MAX', 'MIN', 'AVERAGE']) recordRecentFunction(name);
    expect(readRecentFunctions()).toEqual(['AVERAGE', 'MIN', 'MAX', 'SUM', 'ROUND']);
  });

  it('drops stored entries that are not known functions', () => {
    store.set('gridcalc:recent-functions:v1', JSON.stringify(['sum', '<img>', 42, 'NOPE', 'vlookup', 'SUM']));
    expect(readRecentFunctions()).toEqual(['SUM', 'VLOOKUP']);
  });

  it('reads malformed or missing storage as empty', () => {
    store.set('gridcalc:recent-functions:v1', '{not json');
    expect(readRecentFunctions()).toEqual([]);
    store.set('gridcalc:recent-functions:v1', '{"a":1}');
    expect(readRecentFunctions()).toEqual([]);
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(readRecentFunctions()).toEqual([]);
    expect(() => recordRecentFunction('SUM')).not.toThrow();
  });
});
