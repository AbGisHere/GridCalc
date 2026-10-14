import { CellError, isRange, type Scalar, type Value } from '../values';
import { asRange, criteria, fail, int, num, numbers, sameShape } from './helpers';
import type { FnContext, FnDef } from './types';

/** Round half away from zero, avoiding binary noise (ROUND(1.005, 2) = 1.01). */
function roundTo(x: number, digits: number, mode: 'half' | 'up' | 'down'): number {
  const f = 10 ** digits;
  const scaled = Number((Math.abs(x) * f).toPrecision(15));
  const r = mode === 'half' ? Math.round(scaled) : mode === 'up' ? Math.ceil(scaled) : Math.floor(scaled);
  return (Math.sign(x) * r) / f;
}

function finite(n: number, ctx: FnContext): number {
  if (!Number.isFinite(n)) fail('#NUM!', `${ctx.name}: the result is too large or undefined.`);
  return n;
}

/** Shared engine behind SUMIF(S), COUNTIF(S), AVERAGEIF, MAXIFS and MINIFS. */
function matchingCells(ctx: FnContext, pairs: [Value, Value][], target?: Value): Scalar[] {
  const ranges = pairs.map(([r]) => asRange(r));
  const tests = pairs.map(([, c]) => {
    if (isRange(c)) fail('#VALUE!', `${ctx.name}: a criterion must be a single value, not the range ${c.label}.`);
    return criteria(c);
  });
  const tgt = target === undefined ? ranges[0] : asRange(target);
  sameShape(ctx, [tgt, ...ranges]);
  const out: Scalar[] = [];
  for (let r = 0; r < tgt.rows; r++) {
    for (let c = 0; c < tgt.cols; c++) {
      if (tests.every((t, k) => t(ranges[k].data[r][c]))) out.push(tgt.data[r][c]);
    }
  }
  return out;
}

const numericOnly = (vals: Scalar[]): number[] => {
  const out: number[] = [];
  for (const v of vals) {
    if (v instanceof CellError) throw v;
    if (typeof v === 'number') out.push(v);
  }
  return out;
};

function pairsFrom(args: Value[], startAt: number, ctx: FnContext): [Value, Value][] {
  if ((args.length - startAt) % 2 !== 0) {
    fail('#VALUE!', `${ctx.name}: criteria must come in range/criterion pairs.`);
  }
  const pairs: [Value, Value][] = [];
  for (let i = startAt; i < args.length; i += 2) pairs.push([args[i], args[i + 1]]);
  return pairs;
}

const unary = (
  name: string,
  description: string,
  fn: (x: number, ctx: FnContext) => number,
  example?: string,
): FnDef => ({
  name,
  category: 'Math',
  signature: `${name}(number)`,
  description,
  example,
  min: 1,
  max: 1,
  call: (a, ctx) => finite(fn(num(a, 0, ctx), ctx), ctx),
});

export const mathFunctions: FnDef[] = [
  {
    name: 'SUM',
    category: 'Math',
    signature: 'SUM(number1, [number2], ...)',
    description: 'Adds all numbers. Text and blanks inside ranges are ignored.',
    example: '=SUM(A1:A10, 5)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => numbers(a, ctx).reduce((s, x) => s + x, 0),
  },
  {
    name: 'PRODUCT',
    category: 'Math',
    signature: 'PRODUCT(number1, [number2], ...)',
    description: 'Multiplies all numbers.',
    example: '=PRODUCT(A1:A3)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => {
      const ns = numbers(a, ctx);
      return ns.length ? finite(ns.reduce((p, x) => p * x, 1), ctx) : 0;
    },
  },
  unary('ABS', 'Absolute value of a number.', (x) => Math.abs(x), '=ABS(-4)'),
  {
    name: 'ROUND',
    category: 'Math',
    signature: 'ROUND(number, [digits])',
    description: 'Rounds half away from zero to the given number of digits (negative digits round left of the decimal point).',
    example: '=ROUND(3.14159, 2)',
    min: 1,
    max: 2,
    call: (a, ctx) => roundTo(num(a, 0, ctx), int(a, 1, ctx, 0), 'half'),
  },
  {
    name: 'ROUNDUP',
    category: 'Math',
    signature: 'ROUNDUP(number, [digits])',
    description: 'Rounds away from zero.',
    example: '=ROUNDUP(3.141, 1)',
    min: 1,
    max: 2,
    call: (a, ctx) => roundTo(num(a, 0, ctx), int(a, 1, ctx, 0), 'up'),
  },
  {
    name: 'ROUNDDOWN',
    category: 'Math',
    signature: 'ROUNDDOWN(number, [digits])',
    description: 'Rounds toward zero.',
    example: '=ROUNDDOWN(3.149, 2)',
    min: 1,
    max: 2,
    call: (a, ctx) => roundTo(num(a, 0, ctx), int(a, 1, ctx, 0), 'down'),
  },
  unary('INT', 'Rounds down to the nearest integer.', (x) => Math.floor(x), '=INT(-2.5)'),
  {
    name: 'TRUNC',
    category: 'Math',
    signature: 'TRUNC(number, [digits])',
    description: 'Truncates a number to the given digits by removing the fractional part.',
    example: '=TRUNC(8.97)',
    min: 1,
    max: 2,
    call: (a, ctx) => roundTo(num(a, 0, ctx), int(a, 1, ctx, 0), 'down'),
  },
  {
    name: 'MOD',
    category: 'Math',
    signature: 'MOD(number, divisor)',
    description: 'Remainder after division; the result has the sign of the divisor.',
    example: '=MOD(10, 3)',
    min: 2,
    max: 2,
    call: (a, ctx) => {
      const n = num(a, 0, ctx);
      const d = num(a, 1, ctx);
      if (d === 0) throw new CellError('#DIV/0!', 'MOD: the divisor is 0.', ctx.argSpan(1));
      return n - d * Math.floor(n / d);
    },
  },
  {
    name: 'POWER',
    category: 'Math',
    signature: 'POWER(number, power)',
    description: 'Raises a number to a power (same as ^).',
    example: '=POWER(2, 10)',
    min: 2,
    max: 2,
    call: (a, ctx) => {
      const b = num(a, 0, ctx);
      const e = num(a, 1, ctx);
      if (b === 0 && e < 0) fail('#DIV/0!', 'POWER: 0 cannot be raised to a negative power.');
      const r = b ** e;
      if (Number.isNaN(r)) fail('#NUM!', 'POWER: a negative number cannot be raised to a fractional power.');
      return finite(r, ctx);
    },
  },
  unary(
    'SQRT',
    'Square root.',
    (x, ctx) => {
      if (x < 0) fail('#NUM!', `${ctx.name}: cannot take the square root of a negative number (${x}).`);
      return Math.sqrt(x);
    },
    '=SQRT(16)',
  ),
  unary('EXP', 'e raised to the given power.', (x) => Math.exp(x), '=EXP(1)'),
  unary(
    'LN',
    'Natural logarithm.',
    (x, ctx) => {
      if (x <= 0) fail('#NUM!', `${ctx.name}: the number must be positive (got ${x}).`);
      return Math.log(x);
    },
    '=LN(10)',
  ),
  {
    name: 'LOG',
    category: 'Math',
    signature: 'LOG(number, [base])',
    description: 'Logarithm in the given base (default 10).',
    example: '=LOG(8, 2)',
    min: 1,
    max: 2,
    call: (a, ctx) => {
      const x = num(a, 0, ctx);
      const b = num(a, 1, ctx, 10);
      if (x <= 0 || b <= 0) fail('#NUM!', 'LOG: the number and base must be positive.');
      if (b === 1) fail('#DIV/0!', 'LOG: the base cannot be 1.');
      return Math.log(x) / Math.log(b);
    },
  },
  unary(
    'LOG10',
    'Base-10 logarithm.',
    (x, ctx) => {
      if (x <= 0) fail('#NUM!', `${ctx.name}: the number must be positive (got ${x}).`);
      return Math.log10(x);
    },
    '=LOG10(1000)',
  ),
  {
    name: 'CEILING',
    category: 'Math',
    signature: 'CEILING(number, [significance])',
    description: 'Rounds up to the nearest multiple of significance (default 1).',
    example: '=CEILING(4.3, 0.5)',
    min: 1,
    max: 2,
    call: (a, ctx) => {
      const x = num(a, 0, ctx);
      const s = num(a, 1, ctx, 1);
      if (s === 0) return 0;
      if (x > 0 && s < 0) fail('#NUM!', 'CEILING: a positive number needs a positive significance.');
      return roundTo(Math.ceil(Number((x / s).toPrecision(15))) * s, 10, 'half');
    },
  },
  {
    name: 'FLOOR',
    category: 'Math',
    signature: 'FLOOR(number, [significance])',
    description: 'Rounds down to the nearest multiple of significance (default 1).',
    example: '=FLOOR(4.7, 0.5)',
    min: 1,
    max: 2,
    call: (a, ctx) => {
      const x = num(a, 0, ctx);
      const s = num(a, 1, ctx, 1);
      if (s === 0) fail('#DIV/0!', 'FLOOR: significance cannot be 0.');
      if (x > 0 && s < 0) fail('#NUM!', 'FLOOR: a positive number needs a positive significance.');
      return roundTo(Math.floor(Number((x / s).toPrecision(15))) * s, 10, 'half');
    },
  },
  unary('SIGN', 'Returns 1, 0 or -1 depending on the sign of the number.', (x) => Math.sign(x), '=SIGN(-3)'),
  {
    name: 'PI',
    category: 'Math',
    signature: 'PI()',
    description: 'The constant π.',
    example: '=PI()*2',
    min: 0,
    max: 0,
    call: () => Math.PI,
  },
  {
    name: 'RAND',
    category: 'Math',
    signature: 'RAND()',
    description: 'Random number in [0, 1). Volatile: recalculates on every change (or F9).',
    example: '=RAND()',
    min: 0,
    max: 0,
    volatile: true,
    call: () => Math.random(),
  },
  {
    name: 'RANDBETWEEN',
    category: 'Math',
    signature: 'RANDBETWEEN(bottom, top)',
    description: 'Random integer between bottom and top, inclusive. Volatile.',
    example: '=RANDBETWEEN(1, 6)',
    min: 2,
    max: 2,
    volatile: true,
    call: (a, ctx) => {
      const lo = Math.ceil(num(a, 0, ctx));
      const hi = Math.floor(num(a, 1, ctx));
      if (lo > hi) fail('#NUM!', 'RANDBETWEEN: bottom must not be greater than top.');
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    },
  },
  {
    name: 'SUMPRODUCT',
    category: 'Math',
    signature: 'SUMPRODUCT(array1, [array2], ...)',
    description: 'Multiplies corresponding entries of same-sized ranges and sums the products. Non-numbers count as 0.',
    example: '=SUMPRODUCT(B2:B5, C2:C5)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => {
      const rs = a.map(asRange);
      sameShape(ctx, rs);
      let total = 0;
      for (let r = 0; r < rs[0].rows; r++) {
        for (let c = 0; c < rs[0].cols; c++) {
          let p = 1;
          for (const rg of rs) {
            const v = rg.data[r][c];
            if (v instanceof CellError) throw v;
            p *= typeof v === 'number' ? v : 0;
          }
          total += p;
        }
      }
      return total;
    },
  },
  {
    name: 'SUMIF',
    category: 'Math',
    signature: 'SUMIF(range, criterion, [sum_range])',
    description: 'Sums cells that meet a criterion such as ">10", "apple" or "a*".',
    example: '=SUMIF(B2:B10, "North", C2:C10)',
    min: 2,
    max: 3,
    ranges: [0, 2],
    call: (a, ctx) => numericOnly(matchingCells(ctx, [[a[0], a[1]]], a[2])).reduce((s, x) => s + x, 0),
  },
  {
    name: 'SUMIFS',
    category: 'Math',
    signature: 'SUMIFS(sum_range, criteria_range1, criterion1, ...)',
    description: 'Sums cells that meet every criterion.',
    example: '=SUMIFS(C2:C10, B2:B10, "North", C2:C10, ">100")',
    min: 3,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => numericOnly(matchingCells(ctx, pairsFrom(a, 1, ctx), a[0])).reduce((s, x) => s + x, 0),
  },
  {
    name: 'COUNTIF',
    category: 'Statistical',
    signature: 'COUNTIF(range, criterion)',
    description: 'Counts cells that meet a criterion.',
    example: '=COUNTIF(A1:A10, ">=50")',
    min: 2,
    max: 2,
    ranges: [0],
    call: (a, ctx) => matchingCells(ctx, [[a[0], a[1]]]).length,
  },
  {
    name: 'COUNTIFS',
    category: 'Statistical',
    signature: 'COUNTIFS(criteria_range1, criterion1, ...)',
    description: 'Counts rows that meet every criterion.',
    example: '=COUNTIFS(B2:B10, "North", C2:C10, ">100")',
    min: 2,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => matchingCells(ctx, pairsFrom(a, 0, ctx)).length,
  },
  {
    name: 'AVERAGEIF',
    category: 'Statistical',
    signature: 'AVERAGEIF(range, criterion, [average_range])',
    description: 'Averages cells that meet a criterion.',
    example: '=AVERAGEIF(B2:B10, "North", C2:C10)',
    min: 2,
    max: 3,
    ranges: [0, 2],
    call: (a, ctx) => {
      const ns = numericOnly(matchingCells(ctx, [[a[0], a[1]]], a[2]));
      if (!ns.length) fail('#DIV/0!', 'AVERAGEIF: no cells matched the criterion.');
      return ns.reduce((s, x) => s + x, 0) / ns.length;
    },
  },
  {
    name: 'MAXIFS',
    category: 'Statistical',
    signature: 'MAXIFS(max_range, criteria_range1, criterion1, ...)',
    description: 'Largest value among cells that meet every criterion (0 if none).',
    example: '=MAXIFS(C2:C10, B2:B10, "North")',
    min: 3,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => {
      const ns = numericOnly(matchingCells(ctx, pairsFrom(a, 1, ctx), a[0]));
      return ns.length ? Math.max(...ns) : 0;
    },
  },
  {
    name: 'MINIFS',
    category: 'Statistical',
    signature: 'MINIFS(min_range, criteria_range1, criterion1, ...)',
    description: 'Smallest value among cells that meet every criterion (0 if none).',
    example: '=MINIFS(C2:C10, B2:B10, "North")',
    min: 3,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => {
      const ns = numericOnly(matchingCells(ctx, pairsFrom(a, 1, ctx), a[0]));
      return ns.length ? Math.min(...ns) : 0;
    },
  },
];
