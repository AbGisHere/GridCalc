import { describe, expect, it } from 'vitest';
import { History } from '../src/state/history';
import { buildFill, fillTarget } from '../src/state/fill';
import { single } from '../src/state/selection';

const grid = (cells: Record<string, string>) => (r: number, c: number) => cells[`${r},${c}`] ?? '';

describe('drag-to-fill', () => {
  it('picks the dominant drag direction', () => {
    const src = { r1: 0, c1: 0, r2: 0, c2: 0 };
    expect(fillTarget(src, { row: 5, col: 1 })).toEqual({ r1: 0, c1: 0, r2: 5, c2: 0 });
    expect(fillTarget(src, { row: 1, col: 4 })).toEqual({ r1: 0, c1: 0, r2: 0, c2: 4 });
    expect(fillTarget(src, { row: 0, col: 0 })).toBeNull();
  });

  it('shifts formulas down', () => {
    const edits = buildFill({ r1: 0, c1: 1, r2: 0, c2: 1 }, { r1: 0, c1: 1, r2: 2, c2: 1 }, grid({ '0,1': '=A1*$C$1' }));
    expect(edits.map((e) => e.raw)).toEqual(['=A2*$C$1', '=A3*$C$1']);
  });

  it('continues numeric series and increments numbered text', () => {
    const series = buildFill({ r1: 0, c1: 0, r2: 1, c2: 0 }, { r1: 0, c1: 0, r2: 4, c2: 0 }, grid({ '0,0': '2', '1,0': '4' }));
    expect(series.map((e) => e.raw)).toEqual(['6', '8', '10']);
    const items = buildFill({ r1: 0, c1: 0, r2: 0, c2: 0 }, { r1: 0, c1: 0, r2: 0, c2: 2 }, grid({ '0,0': 'Item 9' }));
    expect(items.map((e) => e.raw)).toEqual(['Item 10', 'Item 11']);
  });

  it('fills upward with negative offsets', () => {
    const edits = buildFill({ r1: 3, c1: 0, r2: 3, c2: 0 }, { r1: 1, c1: 0, r2: 3, c2: 0 }, grid({ '3,0': '=B4' }));
    expect(edits).toEqual([
      { row: 1, col: 0, raw: '=B2' },
      { row: 2, col: 0, raw: '=B3' },
    ]);
  });
});

describe('history', () => {
  it('undoes and redoes batches', () => {
    const h = new History();
    h.push({ label: 'Edit', selection: single(0, 0), edits: [{ row: 0, col: 0, raw: 'new', before: 'old' }] });
    expect(h.undo()!.edits).toEqual([{ row: 0, col: 0, raw: 'old' }]);
    expect(h.canUndo).toBe(false);
    expect(h.redo()!.edits).toEqual([{ row: 0, col: 0, raw: 'new' }]);
  });
});
