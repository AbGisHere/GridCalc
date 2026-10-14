import type { CellPos, RangeBounds } from '@/engine/address';
import type { CellEdit } from '@/engine/engine';
import { shiftFormula } from '@/engine/references';
import { formatNumber, NUMBER_RE } from '@/engine/values';

/**
 * Where a fill drag ends up: the source range extended along whichever axis the
 * pointer moved furthest from it. Returns null while the pointer is still inside.
 */
export function fillTarget(source: RangeBounds, pointer: CellPos): RangeBounds | null {
  const down = pointer.row - source.r2;
  const up = source.r1 - pointer.row;
  const right = pointer.col - source.c2;
  const left = source.c1 - pointer.col;
  const vertical = Math.max(down, up);
  const horizontal = Math.max(right, left);
  if (vertical <= 0 && horizontal <= 0) return null;
  if (vertical >= horizontal) {
    return down > 0 ? { ...source, r2: pointer.row } : { ...source, r1: pointer.row };
  }
  return right > 0 ? { ...source, c2: pointer.col } : { ...source, c1: pointer.col };
}

/**
 * Drag-to-fill: repeats the source cells across the target.
 *  - formulas are copied with relative references shifted ($-anchored parts stay)
 *  - two or more numbers continue as a linear series (1, 2 → 3, 4, 5 …)
 *  - text ending in a number counts up ("Item 1" → "Item 2")
 *  - anything else is copied
 */
export function buildFill(source: RangeBounds, target: RangeBounds, getRaw: (row: number, col: number) => string): CellEdit[] {
  const edits: CellEdit[] = [];
  const vertical = target.r1 !== source.r1 || target.r2 !== source.r2;

  // Each "lane" is one column (vertical fill) or one row (horizontal fill) of the source.
  const lanes = vertical ? [source.c1, source.c2] : [source.r1, source.r2];
  const along = vertical ? [source.r1, source.r2] : [source.c1, source.c2];
  const span = vertical ? [target.r1, target.r2] : [target.c1, target.c2];
  const len = along[1] - along[0] + 1;

  for (let lane = lanes[0]; lane <= lanes[1]; lane++) {
    const at = (i: number) => (vertical ? { row: i, col: lane } : { row: lane, col: i });
    const raws: string[] = [];
    for (let i = along[0]; i <= along[1]; i++) {
      const p = at(i);
      raws.push(getRaw(p.row, p.col));
    }

    const nums = raws.map((r) => (NUMBER_RE.test(r.trim()) ? Number(r) : NaN));
    const isSeries = len >= 2 && nums.every((n) => !Number.isNaN(n));
    const step = isSeries ? (nums[len - 1] - nums[0]) / (len - 1) : 0;

    for (let i = span[0]; i <= span[1]; i++) {
      if (i >= along[0] && i <= along[1]) continue;
      const offset = i - along[0];
      const idx = ((offset % len) + len) % len;
      const srcRaw = raws[idx];
      const delta = i - (along[0] + idx);
      const dest = at(i);
      let raw: string;
      if (srcRaw.startsWith('=')) {
        raw = vertical ? shiftFormula(srcRaw, delta, 0) : shiftFormula(srcRaw, 0, delta);
      } else if (isSeries) {
        raw = formatNumber(nums[0] + step * offset);
      } else if (len === 1 && /^(.*\D)(\d+)$/.test(srcRaw)) {
        const [, prefix, digits] = /^(.*\D)(\d+)$/.exec(srcRaw)!;
        const n = Number(digits) + delta;
        raw = n >= 0 ? prefix + String(n).padStart(digits.length, '0') : srcRaw;
      } else {
        raw = srcRaw;
      }
      edits.push({ ...dest, raw });
    }
  }
  return edits;
}
