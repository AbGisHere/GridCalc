import { compareScalars } from '../coerce';
import { CellError, isRange, type Value } from '../values';
import { fail, int, num, numbers } from './helpers';
import type { FnContext, FnDef } from './types';

const sum = (ns: number[]) => ns.reduce((s, x) => s + x, 0);

function variance(ns: number[], sample: boolean, ctx: FnContext): number {
  const n = ns.length;
  if (n < (sample ? 2 : 1)) {
    fail('#DIV/0!', `${ctx.name} needs at least ${sample ? 2 : 1} numeric value${sample ? 's' : ''}.`);
  }
  const mean = sum(ns) / n;
  return ns.reduce((s, x) => s + (x - mean) ** 2, 0) / (sample ? n - 1 : n);
}

const aggregate = (
  name: string,
  description: string,
  fn: (ns: number[], ctx: FnContext) => number,
  example: string,
): FnDef => ({
  name,
  category: 'Statistical',
  signature: `${name}(number1, [number2], ...)`,
  description,
  example,
  min: 1,
  max: Infinity,
  ranges: 'all',
  call: (a, ctx) => fn(numbers(a, ctx), ctx),
});

function kth(a: Value[], ctx: FnContext, largest: boolean): number {
  const ns = numbers([a[0]], ctx).sort((x, y) => (largest ? y - x : x - y));
  const k = int(a, 1, ctx);
  if (k < 1 || k > ns.length) fail('#NUM!', `${ctx.name}: k must be between 1 and ${ns.length} (got ${k}).`);
  return ns[k - 1];
}

export const statisticalFunctions: FnDef[] = [
  aggregate(
    'AVERAGE',
    'Arithmetic mean of the numbers.',
    (ns, ctx) => {
      if (!ns.length) fail('#DIV/0!', `${ctx.name}: there are no numbers to average.`);
      return sum(ns) / ns.length;
    },
    '=AVERAGE(B2:B20)',
  ),
  aggregate(
    'MEDIAN',
    'Middle value of the numbers.',
    (ns, ctx) => {
      if (!ns.length) fail('#NUM!', `${ctx.name}: there are no numbers.`);
      const s = [...ns].sort((x, y) => x - y);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    },
    '=MEDIAN(A1:A9)',
  ),
  aggregate('MIN', 'Smallest number (0 if there are none).', (ns) => (ns.length ? Math.min(...ns) : 0), '=MIN(A1:A100)'),
  aggregate('MAX', 'Largest number (0 if there are none).', (ns) => (ns.length ? Math.max(...ns) : 0), '=MAX(A1:A100)'),
  aggregate('STDEV', 'Sample standard deviation.', (ns, ctx) => Math.sqrt(variance(ns, true, ctx)), '=STDEV(A1:A10)'),
  aggregate('STDEVP', 'Population standard deviation.', (ns, ctx) => Math.sqrt(variance(ns, false, ctx)), '=STDEVP(A1:A10)'),
  aggregate('VAR', 'Sample variance.', (ns, ctx) => variance(ns, true, ctx), '=VAR(A1:A10)'),
  aggregate('VARP', 'Population variance.', (ns, ctx) => variance(ns, false, ctx), '=VARP(A1:A10)'),
  {
    name: 'COUNT',
    category: 'Statistical',
    signature: 'COUNT(value1, [value2], ...)',
    description: 'Counts how many values are numbers.',
    example: '=COUNT(A1:A10)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a) => {
      let n = 0;
      for (const v of a) {
        if (isRange(v)) {
          for (const row of v.data) for (const x of row) if (typeof x === 'number') n++;
        } else if (typeof v === 'number' || typeof v === 'boolean') n++;
        else if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) n++;
      }
      return n;
    },
  },
  {
    name: 'COUNTA',
    category: 'Statistical',
    signature: 'COUNTA(value1, [value2], ...)',
    description: 'Counts non-empty values (including text and errors).',
    example: '=COUNTA(A1:A10)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a) => {
      let n = 0;
      for (const v of a) {
        if (isRange(v)) {
          for (const row of v.data) for (const x of row) if (x !== null) n++;
        } else if (v !== null) n++;
      }
      return n;
    },
  },
  {
    name: 'COUNTBLANK',
    category: 'Statistical',
    signature: 'COUNTBLANK(range)',
    description: 'Counts empty cells (and cells containing empty text).',
    example: '=COUNTBLANK(A1:A10)',
    min: 1,
    max: 1,
    ranges: [0],
    call: (a) => {
      let n = 0;
      const v = a[0];
      if (isRange(v)) {
        for (const row of v.data) for (const x of row) if (x === null || x === '') n++;
      } else if (v === null || v === '') n++;
      return n;
    },
  },
  {
    name: 'LARGE',
    category: 'Statistical',
    signature: 'LARGE(range, k)',
    description: 'The k-th largest number.',
    example: '=LARGE(A1:A10, 2)',
    min: 2,
    max: 2,
    ranges: [0],
    call: (a, ctx) => kth(a, ctx, true),
  },
  {
    name: 'SMALL',
    category: 'Statistical',
    signature: 'SMALL(range, k)',
    description: 'The k-th smallest number.',
    example: '=SMALL(A1:A10, 1)',
    min: 2,
    max: 2,
    ranges: [0],
    call: (a, ctx) => kth(a, ctx, false),
  },
  {
    name: 'RANK',
    category: 'Statistical',
    signature: 'RANK(number, range, [ascending])',
    description: 'Rank of a number within a range (descending by default; pass 1 for ascending).',
    example: '=RANK(B2, B$2:B$10)',
    min: 2,
    max: 3,
    ranges: [1],
    call: (a, ctx) => {
      const x = num(a, 0, ctx);
      const ns = numbers([a[1]], ctx);
      const asc = num(a, 2, ctx, 0) !== 0;
      if (!ns.some((v) => compareScalars(v, x) === 0)) {
        throw new CellError('#N/A', `RANK: ${x} does not appear in the range.`, ctx.argSpan(1));
      }
      return 1 + ns.filter((v) => (asc ? v < x : v > x)).length;
    },
  },
];
