import { describe, expect, it } from 'vitest';
import { keyToA1 } from '../src/engine/address';
import { normalizeFormula, shiftFormula } from '../src/engine/references';
import { sheet } from './helpers';

describe('dependency tracking', () => {
  it('recalculates dependents when an input changes', () => {
    const s = sheet({ A1: 1, A2: 2, A3: '=A1+A2', A4: '=A3*10' });
    expect(s.get('A4')).toBe(30);
    s.set('A1', 5);
    expect(s.get('A3')).toBe(7);
    expect(s.get('A4')).toBe(70);
  });

  it('re-evaluates only affected cells', () => {
    const s = sheet({ A1: 1, B1: 2, A2: '=A1*2', B2: '=B1*2', C1: '=A2+1' });
    const stats = s.set('A1', 10);
    expect(stats.evaluated).toBe(2); // A2 and C1 — not B2
    expect(s.get('C1')).toBe(21);
  });

  it('tracks range references, including cells filled in later', () => {
    const s = sheet({ A1: 1, B1: '=SUM(A1:A1000)' });
    expect(s.get('B1')).toBe(1);
    s.set('A500', 41);
    expect(s.get('B1')).toBe(42);
    expect(s.set('C1', 5).evaluated).toBe(0); // outside the range
  });

  it('evaluates each cell once in topological order (diamond)', () => {
    const s = sheet({ A1: 1, B1: '=A1+1', C1: '=A1*2', D1: '=B1+C1' });
    const stats = s.set('A1', 3);
    expect(stats.evaluated).toBe(3);
    expect(s.get('D1')).toBe(10);
  });

  it('records how deep in the chain each recalculated cell sits, for the recalculation wave', () => {
    const s = sheet({ A1: 1, B1: '=A1+1', C1: '=A1*2', D1: '=B1+C1', E1: '=A1+D1' });
    s.set('A1', 3);
    const depths = Object.fromEntries([...s.engine.lastWave].map(([k, d]) => [keyToA1(k), d]));
    expect(depths).toEqual({ B1: 1, C1: 1, D1: 2, E1: 3 });
    s.engine.recalculateAll();
    expect(s.engine.lastWave.size).toBe(0);
  });

  it('drops old dependencies when a formula changes', () => {
    const s = sheet({ A1: 1, B1: 2, C1: '=A1' });
    s.set('C1', '=B1');
    expect(s.set('A1', 100).evaluated).toBe(0);
    expect(s.set('B1', 7).evaluated).toBe(1);
    expect(s.get('C1')).toBe(7);
  });

  it('handles a 20,000-cell dependency chain without recursion limits', () => {
    const cells: Record<string, string> = { A1: '1' };
    for (let r = 2; r <= 20_000; r++) cells[`A${r}`] = `=A${r - 1}+1`;
    const s = sheet(cells);
    expect(s.get('A20000')).toBe(20_000);
    s.set('A1', 101);
    expect(s.get('A20000')).toBe(20_100);
  });
});

describe('circular references', () => {
  it('detects self references', () => {
    const s = sheet({ A1: '=A1+1' });
    const e = s.error('A1')!;
    expect(e.code).toBe('#CIRC!');
    expect(e.message).toContain('A1 refers to itself');
    expect(e.span).toEqual({ start: 1, end: 3 });
  });

  it('detects indirect cycles and explains the chain', () => {
    const s = sheet({ A1: '=B1+1', B1: '=C1+1', C1: '=A1+1' });
    const e = s.error('A1')!;
    expect(e.code).toBe('#CIRC!');
    expect(e.message).toContain('A1 → B1 → C1 → A1');
    expect(s.error('B1')!.code).toBe('#CIRC!');
    expect(s.error('C1')!.code).toBe('#CIRC!');
  });

  it('detects cycles through ranges', () => {
    const s = sheet({ A1: 1, A2: 2, A3: '=SUM(A1:A3)' });
    expect(s.error('A3')!.code).toBe('#CIRC!');
  });

  it('marks downstream cells and recovers when the cycle is broken', () => {
    const s = sheet({ A1: '=B1', B1: '=A1', C1: '=A1*2' });
    expect(s.error('C1')!.code).toBe('#CIRC!');
    s.set('B1', 21);
    expect(s.get('A1')).toBe(21);
    expect(s.get('C1')).toBe(42);
  });
});

describe('formula rewriting', () => {
  it('shifts relative references and keeps absolute ones', () => {
    expect(shiftFormula('=A1+$B$1+C$1+$D1', 1, 1)).toBe('=B2+$B$1+D$1+$D2');
    expect(shiftFormula('=SUM(A1:A3)', 2, 0)).toBe('=SUM(A3:A5)');
    expect(shiftFormula('=A1', -1, 0)).toBe('=#REF!');
    expect(shiftFormula('="A1"&A1', 1, 0)).toBe('="A1"&A2');
  });

  it('normalizes casing outside strings', () => {
    expect(normalizeFormula('=sum(a1:b2, "abc")')).toBe('=SUM(A1:B2, "abc")');
  });
});

describe('persistence', () => {
  it('round-trips through JSON', () => {
    const s = sheet({ A1: 2, B1: '=A1^2' });
    const copy = sheet();
    copy.engine.load(s.engine.toJSON());
    expect(copy.get('B1')).toBe(4);
  });
});
