import { CellError, isRange, type RangeValue, type Scalar, type Value } from '../values';
import { asRange, bool, fail, int, lookupEquals, num, sameTypeCompare, scalar, show } from './helpers';
import type { FnContext, FnDef } from './types';

/** Lookups return 0 for a blank result cell, like spreadsheets do. */
const result = (v: Scalar): Scalar => (v === null ? 0 : v);

function needle(a: Value[], ctx: FnContext): Scalar {
  const v = scalar(a[0], ctx, 0);
  if (v instanceof CellError) throw v;
  return v;
}

/** Index of the match in a 1-D list of values, or -1. mode: 0 exact, 1 largest ≤, -1 smallest ≥. */
function findIndex(list: Scalar[], target: Scalar, mode: 0 | 1 | -1): number {
  if (mode === 0) return list.findIndex((v) => lookupEquals(v, target));
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    const c = sameTypeCompare(list[i], target);
    if (c === undefined) continue;
    if (c === 0) return i;
    if (mode === 1) {
      if (c < 0) best = i;
      else break; // sorted ascending: past the target
    } else {
      if (c > 0) best = i;
      else break; // sorted descending
    }
  }
  return best;
}

/** Best match for XLOOKUP's "next smaller/larger" modes; does not require sorted data. */
function findNearest(list: Scalar[], target: Scalar, dir: 1 | -1): number {
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    const c = sameTypeCompare(list[i], target);
    if (c === undefined) continue;
    if (c === 0) return i;
    const ok = dir === -1 ? c < 0 : c > 0;
    if (ok && (best < 0 || (dir === -1 ? sameTypeCompare(list[i], list[best])! > 0 : sameTypeCompare(list[i], list[best])! < 0))) {
      best = i;
    }
  }
  return best;
}

function vector(r: RangeValue, ctx: FnContext, i: number): Scalar[] {
  if (r.rows === 1) return r.data[0];
  if (r.cols === 1) return r.data.map((row) => row[0]);
  throw new CellError('#VALUE!', `${ctx.name}: ${r.label} must be a single row or column.`, ctx.argSpan(i));
}

function tableLookup(a: Value[], ctx: FnContext, vertical: boolean): Scalar {
  const target = needle(a, ctx);
  const table = asRange(a[1]);
  const idx = int(a, 2, ctx);
  const span = vertical ? table.cols : table.rows;
  const unit = vertical ? 'column' : 'row';
  if (idx < 1) throw new CellError('#VALUE!', `${ctx.name}: ${unit} index must be at least 1 (got ${idx}).`, ctx.argSpan(2));
  if (idx > span) {
    throw new CellError(
      '#REF!',
      `${ctx.name}: ${unit} index ${idx} is outside ${table.label}, which has only ${span} ${unit}${span === 1 ? '' : 's'}.`,
      ctx.argSpan(2),
    );
  }
  const approximate = bool(a, 3, ctx, true);
  const keys = vertical ? table.data.map((r) => r[0]) : table.data[0];
  const at = findIndex(keys, target, approximate ? 1 : 0);
  if (at < 0) {
    const first = vertical ? 'first column' : 'first row';
    fail(
      '#N/A',
      `${ctx.name} could not find ${show(target)} in the ${first} of ${table.label}.` +
        (approximate
          ? ' Approximate match (the default) expects sorted data; pass FALSE as the last argument for an exact match.'
          : ''),
    );
  }
  return result(vertical ? table.data[at][idx - 1] : table.data[idx - 1][at]);
}

export const lookupFunctions: FnDef[] = [
  {
    name: 'VLOOKUP',
    category: 'Lookup',
    signature: 'VLOOKUP(lookup_value, table, col_index, [approximate])',
    description:
      'Finds lookup_value in the first column of table and returns the value from col_index in the same row. ' +
      'approximate defaults to TRUE (sorted data); use FALSE for an exact match. Text matching is case-insensitive and supports * and ? wildcards.',
    example: '=VLOOKUP("Widget", A2:D20, 4, FALSE)',
    min: 3,
    max: 4,
    ranges: [1],
    call: (a, ctx) => tableLookup(a, ctx, true),
  },
  {
    name: 'HLOOKUP',
    category: 'Lookup',
    signature: 'HLOOKUP(lookup_value, table, row_index, [approximate])',
    description: 'Like VLOOKUP, but searches the first row and returns a value from row_index.',
    example: '=HLOOKUP("Q2", A1:E5, 3, FALSE)',
    min: 3,
    max: 4,
    ranges: [1],
    call: (a, ctx) => tableLookup(a, ctx, false),
  },
  {
    name: 'INDEX',
    category: 'Lookup',
    signature: 'INDEX(range, row, [column])',
    description: 'Value at the given 1-based row and column of a range. For a single row/column, one index is enough.',
    example: '=INDEX(A1:C10, 3, 2)',
    min: 2,
    max: 3,
    ranges: [0],
    call: (a, ctx) => {
      const r = asRange(a[0]);
      let row = int(a, 1, ctx);
      let col = int(a, 2, ctx, 1);
      if (a[2] === undefined && r.rows === 1) [row, col] = [1, row];
      if (row < 1 || col < 1) fail('#VALUE!', 'INDEX: row and column must be at least 1.');
      if (row > r.rows || col > r.cols) {
        fail('#REF!', `INDEX: position (${row}, ${col}) is outside ${r.label} (${r.rows}×${r.cols}).`);
      }
      return result(r.data[row - 1][col - 1]);
    },
  },
  {
    name: 'MATCH',
    category: 'Lookup',
    signature: 'MATCH(lookup_value, range, [match_type])',
    description:
      'Position of lookup_value in a row/column. match_type 1 (default): largest value ≤ lookup in ascending data; 0: exact; -1: smallest value ≥ lookup in descending data.',
    example: '=MATCH("Bob", A1:A10, 0)',
    min: 2,
    max: 3,
    ranges: [1],
    call: (a, ctx) => {
      const target = needle(a, ctx);
      const list = vector(asRange(a[1]), ctx, 1);
      const t = Math.sign(num(a, 2, ctx, 1)) as 0 | 1 | -1;
      const at = findIndex(list, target, t);
      if (at < 0) fail('#N/A', `MATCH could not find ${show(target)} in ${asRange(a[1]).label}.`);
      return at + 1;
    },
  },
  {
    name: 'XLOOKUP',
    category: 'Lookup',
    signature: 'XLOOKUP(lookup_value, lookup_range, return_range, [if_not_found], [match_mode])',
    description:
      'Finds lookup_value in lookup_range and returns the item at the same position in return_range. match_mode 0: exact (default), -1: exact or next smaller, 1: exact or next larger.',
    example: '=XLOOKUP("Bob", A2:A10, C2:C10, "Not found")',
    min: 3,
    max: 5,
    ranges: [1, 2],
    call: (a, ctx) => {
      const target = needle(a, ctx);
      const keys = vector(asRange(a[1]), ctx, 1);
      const values = vector(asRange(a[2]), ctx, 2);
      if (keys.length !== values.length) {
        fail('#VALUE!', `XLOOKUP: lookup_range has ${keys.length} items but return_range has ${values.length}.`);
      }
      const mode = a[4] === undefined ? 0 : int(a, 4, ctx);
      if (mode !== 0 && mode !== 1 && mode !== -1) fail('#VALUE!', 'XLOOKUP: match_mode must be 0, -1 or 1.');
      const at = mode === 0 ? findIndex(keys, target, 0) : findNearest(keys, target, mode as 1 | -1);
      if (at < 0) {
        if (a[3] !== undefined) return scalar(a[3], ctx, 3);
        fail('#N/A', `XLOOKUP could not find ${show(target)} in ${asRange(a[1]).label}.`);
      }
      return result(values[at]);
    },
  },
  {
    name: 'ROWS',
    category: 'Lookup',
    signature: 'ROWS(range)',
    description: 'Number of rows in a range.',
    example: '=ROWS(A1:C10)',
    min: 1,
    max: 1,
    ranges: [0],
    call: (a) => asRange(a[0]).rows,
  },
  {
    name: 'COLUMNS',
    category: 'Lookup',
    signature: 'COLUMNS(range)',
    description: 'Number of columns in a range.',
    example: '=COLUMNS(A1:C10)',
    min: 1,
    max: 1,
    ranges: [0],
    call: (a) => asRange(a[0]).cols,
  },
  {
    name: 'ROW',
    category: 'Lookup',
    signature: 'ROW([reference])',
    description: 'Row number of a reference, or of the current cell.',
    example: '=ROW(B7)',
    min: 0,
    max: 1,
    ranges: [0],
    call: (a, ctx) => {
      if (a[0] === undefined) return ctx.row + 1;
      if (!isRange(a[0])) fail('#VALUE!', 'ROW expects a cell reference.');
      return a[0].row + 1;
    },
  },
  {
    name: 'COLUMN',
    category: 'Lookup',
    signature: 'COLUMN([reference])',
    description: 'Column number of a reference, or of the current cell.',
    example: '=COLUMN(C1)',
    min: 0,
    max: 1,
    ranges: [0],
    call: (a, ctx) => {
      if (a[0] === undefined) return ctx.col + 1;
      if (!isRange(a[0])) fail('#VALUE!', 'COLUMN expects a cell reference.');
      return a[0].col + 1;
    },
  },
];
