import { describe, expect, it } from 'vitest';
import { parseCSV, toCSV } from '../src/state/csv';

describe('CSV', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [['a,b', 'say "hi"', 'line\nbreak']];
    expect(parseCSV(toCSV(rows))).toEqual(rows);
  });

  it('neutralizes text that spreadsheet apps would run as a formula', () => {
    expect(toCSV([['=HYPERLINK("http://x")', '+cmd', '@SUM(A1)', '-x']])).toBe(
      `"'=HYPERLINK(""http://x"")",'+cmd,'@SUM(A1),'-x`,
    );
  });

  it('leaves numbers alone', () => {
    expect(toCSV([['-5', '+3.2', '42']])).toBe('-5,+3.2,42');
  });
});
