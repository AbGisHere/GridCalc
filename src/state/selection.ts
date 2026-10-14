import { normalizeRange, SHEET_COLS, SHEET_ROWS, type CellPos, type RangeBounds } from '@/engine/address';

/** The active cell is `anchor`; the selected rectangle spans anchor..head. */
export interface Selection {
  anchor: CellPos;
  head: CellPos;
}

export const single = (row: number, col: number): Selection => ({ anchor: { row, col }, head: { row, col } });

export const selectionRange = (s: Selection): RangeBounds => normalizeRange(s.anchor, s.head);

export const clampPos = (p: CellPos): CellPos => ({
  row: Math.min(SHEET_ROWS - 1, Math.max(0, p.row)),
  col: Math.min(SHEET_COLS - 1, Math.max(0, p.col)),
});

/**
 * Ctrl+Arrow: jump to the edge of the current data block, or to the next
 * non-empty cell, or to the sheet edge — the familiar spreadsheet behaviour.
 */
export function jump(from: CellPos, dRow: number, dCol: number, hasValue: (r: number, c: number) => boolean): CellPos {
  const inside = (p: CellPos) => p.row >= 0 && p.row < SHEET_ROWS && p.col >= 0 && p.col < SHEET_COLS;
  const step = (p: CellPos): CellPos => ({ row: p.row + dRow, col: p.col + dCol });
  let cur = from;
  let next = step(cur);
  if (!inside(next)) return cur;
  if (hasValue(cur.row, cur.col) && hasValue(next.row, next.col)) {
    while (inside(next) && hasValue(next.row, next.col)) {
      cur = next;
      next = step(cur);
    }
    return cur;
  }
  cur = next;
  while (inside(step(cur)) && !hasValue(cur.row, cur.col)) cur = step(cur);
  return cur;
}
