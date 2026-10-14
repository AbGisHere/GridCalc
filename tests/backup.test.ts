import { describe, expect, it } from 'vitest';
import { SpreadsheetEngine } from '../src/engine/engine';
import { MAX_BACKUP_BYTES, parseBackup, readCells, toBackup } from '../src/state/backup';

describe('GridCalc backups', () => {
  it('round-trips formulas, text and errors, then rebuilds dependencies on restore', () => {
    const cells = { A1: '2', B1: '=A1*3', C1: '=SUMM(A1)', A2: '日本語 مرحبا 🧮', B2: '<script>alert(1)</script>', CV100000: 'last cell' };
    const restored = parseBackup(toBackup(cells));
    expect(restored).toEqual(cells);
    const engine = new SpreadsheetEngine();
    engine.load(restored!);
    expect(engine.getValue(0, 1)).toBe(6);
    engine.setCells([{ row: 0, col: 0, raw: '4' }]);
    expect(engine.getValue(0, 1)).toBe(12);
    expect(engine.getRaw(0, 2)).toBe('=SUMM(A1)');
    expect(engine.getRaw(1, 1)).toBe(cells.B2);
  });

  it('round-trips empty sheets and empty cell text', () => {
    expect(parseBackup(toBackup({}))).toEqual({});
    expect(parseBackup(toBackup({ A1: '' }))).toEqual({ A1: '' });
  });

  it.each([
    null, [], {}, { format: 'other', version: 1, cells: {} },
    { format: 'gridcalc', version: 2, cells: {} },
    { format: 'gridcalc', version: 1, cells: [] },
    { format: 'gridcalc', version: 1, cells: null },
  ])('rejects malformed or unsupported envelopes: %j', (value) => {
    expect(parseBackup(JSON.stringify(value))).toBeNull();
  });

  it.each(['A0', 'A100001', 'CW1', '$A$1', 'a1', 'A01', '__proto__'])('rejects an invalid address without partially restoring: %s', (address) => {
    expect(parseBackup(toBackup({ A1: 'keep me', [address]: 'invalid' }))).toBeNull();
  });

  it.each([1, null, {}, [], true])('rejects non-string cell data: %j', (value) => {
    expect(parseBackup(JSON.stringify({ format: 'gridcalc', version: 1, cells: { A1: 'valid', B1: value } }))).toBeNull();
  });

  it('rejects invalid JSON and files exceeding the byte limit', () => {
    expect(parseBackup('{')).toBeNull();
    expect(parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toBeNull();
  });

  it('skips bad cells from browser storage but rejects them in a backup', () => {
    const stored = { a1: '1', B2: 2, ZZ1: 'outside', 'not a cell': 'x', C3: '=A1' };
    expect(readCells(stored, false)).toEqual({ A1: '1', C3: '=A1' });
    expect(readCells(stored, true)).toBeNull();
    expect(readCells(['A1'], false)).toBeNull();
  });
});
