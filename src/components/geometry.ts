import { SHEET_COLS } from '@/engine/address';

export const ROW_HEIGHT = 26;
export const HEADER_HEIGHT = 26;
export const ROW_HEADER_WIDTH = 60;
const DEFAULT_COL_WIDTH = 104;
export const MIN_COL_WIDTH = 36;

export const defaultColumnWidths = (): number[] => Array.from({ length: SHEET_COLS }, () => DEFAULT_COL_WIDTH);

const MAX_FIT_WIDTH = 480;
let measureCtx: CanvasRenderingContext2D | null = null;

/** Default widths, with each column widened as a whole (never one cell) so its longest value shows in full. */
export function fittedColumnWidths(cells: Iterable<{ col: number; text: string }>): number[] {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')!;
    measureCtx.font = `13px ${getComputedStyle(document.body).fontFamily}`;
  }
  const widths = defaultColumnWidths();
  for (const { col, text } of cells) {
    // 12px of cell padding plus the 1px column line.
    const need = Math.min(MAX_FIT_WIDTH, Math.ceil(measureCtx.measureText(text).width) + 13);
    if (need > widths[col]) widths[col] = need;
  }
  return widths;
}

/** Prefix sums over column widths: O(1) x-position lookup, O(log n) column-at-x lookup. */
export class ColumnLayout {
  private readonly offsets: Float64Array;

  constructor(readonly widths: readonly number[]) {
    this.offsets = new Float64Array(widths.length + 1);
    for (let i = 0; i < widths.length; i++) this.offsets[i + 1] = this.offsets[i] + widths[i];
  }

  get count(): number {
    return this.widths.length;
  }

  get total(): number {
    return this.offsets[this.widths.length];
  }

  x(col: number): number {
    return this.offsets[Math.max(0, Math.min(col, this.widths.length))];
  }

  width(col: number): number {
    return this.widths[col];
  }

  /** Column containing pixel x (clamped to the sheet). */
  indexAt(x: number): number {
    let lo = 0;
    let hi = this.widths.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.offsets[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}
