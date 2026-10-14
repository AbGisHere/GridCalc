import { describe, expect, it } from 'vitest';
import { clampColumnWidth, ColumnLayout, defaultColumnWidths, MAX_COL_WIDTH, MIN_COL_WIDTH } from '../src/components/geometry';

describe('column width bounds', () => {
  it('keeps restored extreme widths inside usable, finite sheet geometry', () => {
    const widths = [1e308, -1, 0, Infinity, NaN, 240].map(clampColumnWidth);
    const fallback = defaultColumnWidths()[0];
    expect(widths).toEqual([MAX_COL_WIDTH, MIN_COL_WIDTH, MIN_COL_WIDTH, fallback, fallback, 240]);
    const layout = new ColumnLayout(widths);
    expect(Number.isFinite(layout.total)).toBe(true);
    expect(layout.indexAt(layout.x(5))).toBe(5);
  });
});
