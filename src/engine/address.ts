/** Sheet dimensions. 100,000 rows × 100 columns = 10 million addressable cells. */
export const SHEET_ROWS = 100_000;
export const SHEET_COLS = 100;

/** Keys pack (row, col) into one number so maps/sets stay cheap. Stride is Excel's column limit. */
const KEY_STRIDE = 16_384;

export interface CellPos {
  row: number;
  col: number;
}

/** Inclusive, normalized rectangle (r1 <= r2, c1 <= c2). */
export interface RangeBounds {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

/** A parsed A1-style reference, including `$` absolute markers. */
export interface CellRef extends CellPos {
  absRow: boolean;
  absCol: boolean;
}

export const cellKey = (row: number, col: number): number => row * KEY_STRIDE + col;
export const keyRow = (key: number): number => Math.floor(key / KEY_STRIDE);
export const keyCol = (key: number): number => key % KEY_STRIDE;

export function colToLetters(col: number): string {
  let s = '';
  let n = col + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export const toA1 = (row: number, col: number): string => colToLetters(col) + (row + 1);
export const keyToA1 = (key: number): string => toA1(keyRow(key), keyCol(key));

export function rangeToA1(r: RangeBounds): string {
  const a = toA1(r.r1, r.c1);
  return r.r1 === r.r2 && r.c1 === r.c2 ? a : `${a}:${toA1(r.r2, r.c2)}`;
}

const A1_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;

/** Parses "A1", "$B$2", "c$10". Does not check sheet bounds (see `inBounds`). */
export function parseA1(text: string): CellRef | null {
  const m = A1_RE.exec(text);
  if (!m) return null;
  const row = parseInt(m[4], 10) - 1;
  if (row < 0) return null;
  return { row, col: lettersToCol(m[2]), absCol: m[1] === '$', absRow: m[3] === '$' };
}

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < SHEET_ROWS && col >= 0 && col < SHEET_COLS;

export function normalizeRange(a: CellPos, b: CellPos): RangeBounds {
  return {
    r1: Math.min(a.row, b.row),
    c1: Math.min(a.col, b.col),
    r2: Math.max(a.row, b.row),
    c2: Math.max(a.col, b.col),
  };
}

/** Parses "B5" or "A1:C3" (used by the name box). Returns null when invalid or out of bounds. */
export function parseRangeA1(text: string): RangeBounds | null {
  const parts = text.trim().split(':');
  if (parts.length > 2) return null;
  const a = parseA1(parts[0]);
  const b = parts.length === 2 ? parseA1(parts[1]) : a;
  if (!a || !b || !inBounds(a.row, a.col) || !inBounds(b.row, b.col)) return null;
  return normalizeRange(a, b);
}

export const LAST_CELL_A1 = toA1(SHEET_ROWS - 1, SHEET_COLS - 1);
