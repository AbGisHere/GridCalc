import { compareScalars, toBool, toNumber, toText } from '../coerce';
import { CellError, NUMBER_RE, isRange, type ErrorCode, type RangeValue, type Scalar, type Value } from '../values';
import type { FnContext } from './types';

/** Abort the current function with an error value. */
export function fail(code: ErrorCode, message: string): never {
  throw new CellError(code, message);
}

/** Reduce a value to a single scalar (a 1×1 range becomes its cell). */
export function scalar(v: Value, ctx: FnContext, i: number): Scalar {
  if (!isRange(v)) return v;
  if (v.rows === 1 && v.cols === 1) return v.data[0][0];
  throw new CellError(
    '#VALUE!',
    `${ctx.name}: argument ${i + 1} expects a single value, but got the range ${v.label}.`,
    ctx.argSpan(i),
  );
}

function coerced<T>(r: T | CellError, original: Scalar, ctx: FnContext, i: number): T {
  if (r instanceof CellError) {
    if (r === original) throw r; // propagated error: keep its origin
    throw new CellError(r.code, `${ctx.name}: argument ${i + 1} — ${r.message}`, ctx.argSpan(i));
  }
  return r;
}

export function num(args: Value[], i: number, ctx: FnContext, fallback?: number): number {
  if (args[i] === undefined) {
    if (fallback === undefined) fail('#VALUE!', `${ctx.name}: argument ${i + 1} is required.`);
    return fallback;
  }
  const s = scalar(args[i], ctx, i);
  return coerced(toNumber(s), s, ctx, i);
}

export function int(args: Value[], i: number, ctx: FnContext, fallback?: number): number {
  return Math.trunc(num(args, i, ctx, fallback));
}

export function str(args: Value[], i: number, ctx: FnContext, fallback?: string): string {
  if (args[i] === undefined) {
    if (fallback === undefined) fail('#VALUE!', `${ctx.name}: argument ${i + 1} is required.`);
    return fallback;
  }
  const s = scalar(args[i], ctx, i);
  return coerced(toText(s), s, ctx, i);
}

export function bool(args: Value[], i: number, ctx: FnContext, fallback?: boolean): boolean {
  if (args[i] === undefined) {
    if (fallback === undefined) fail('#VALUE!', `${ctx.name}: argument ${i + 1} is required.`);
    return fallback;
  }
  const s = scalar(args[i], ctx, i);
  return coerced(toBool(s), s, ctx, i);
}

/** Treat any value as a range (a lone scalar becomes a 1×1 block). */
export function asRange(v: Value): RangeValue {
  if (isRange(v)) return v;
  return { kind: 'range', data: [[v]], rows: 1, cols: 1, row: 0, col: 0, label: show(v) };
}

/**
 * Collect numbers with spreadsheet aggregation semantics:
 * inside ranges only real numbers count (text/booleans/blanks are skipped),
 * while values typed directly as arguments are coerced. Errors always propagate.
 */
export function numbers(args: Value[], ctx: FnContext): number[] {
  const out: number[] = [];
  args.forEach((a, i) => {
    if (isRange(a)) {
      for (const row of a.data) {
        for (const v of row) {
          if (typeof v === 'number') out.push(v);
          else if (v instanceof CellError) throw v;
        }
      }
    } else if (a !== null) {
      out.push(coerced(toNumber(a), a, ctx, i));
    }
  });
  return out;
}

/** Format a value for use inside an error message. */
export function show(v: Scalar): string {
  if (typeof v === 'string') return `"${v}"`;
  if (v === null) return '(blank)';
  if (v instanceof CellError) return v.code;
  return String(toText(v));
}

export function wildcardRegex(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~' && (pattern[i + 1] === '*' || pattern[i + 1] === '?' || pattern[i + 1] === '~')) {
      re += '\\' + pattern[++i];
    } else if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'is');
}

const hasWildcard = (s: string) => /[*?]/.test(s);

/** Exact-match comparison used by lookups: case-insensitive, wildcards for text. */
export function lookupEquals(candidate: Scalar, needle: Scalar): boolean {
  if (candidate instanceof CellError || needle instanceof CellError) return false;
  if (typeof needle === 'string' && typeof candidate === 'string') {
    return hasWildcard(needle) ? wildcardRegex(needle).test(candidate) : candidate.toLowerCase() === needle.toLowerCase();
  }
  if (candidate === null || needle === null) return candidate === needle;
  if (typeof candidate !== typeof needle) return false;
  return compareScalars(candidate, needle) === 0;
}

/** Ordering for approximate lookups; values of a different type never match. */
export function sameTypeCompare(candidate: Scalar, needle: Scalar): number | undefined {
  if (candidate === null || candidate instanceof CellError || needle instanceof CellError || needle === null) return undefined;
  if (typeof candidate !== typeof needle) return undefined;
  return compareScalars(candidate, needle);
}

/** Builds a predicate from a SUMIF/COUNTIF-style criterion such as ">5", "<>x", "app*", 10. */
export function criteria(c: Scalar): (v: Scalar) => boolean {
  if (c instanceof CellError) return (v) => v instanceof CellError && v.code === c.code;
  if (typeof c === 'number') return (v) => typeof v === 'number' && compareScalars(v, c) === 0;
  if (typeof c === 'boolean') return (v) => v === c;
  if (c === null) return (v) => v === null || v === '';

  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(c)!;
  const op = m[1] ?? '=';
  const operand = m[2];

  if (operand === '') {
    if (op === '=') return (v) => v === null || v === '';
    if (op === '<>') return (v) => v !== null && v !== '';
  }

  const asNumber = NUMBER_RE.test(operand.trim()) ? Number(operand) : undefined;
  const test = (d: number): boolean => {
    switch (op) {
      case '=':
        return d === 0;
      case '<>':
        return d !== 0;
      case '<':
        return d < 0;
      case '>':
        return d > 0;
      case '<=':
        return d <= 0;
      default:
        return d >= 0;
    }
  };

  if (asNumber !== undefined) {
    return (v) => {
      if (typeof v === 'number') return test(compareScalars(v, asNumber));
      return op === '<>';
    };
  }

  const upper = operand.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') {
    const b = upper === 'TRUE';
    return (v) => (typeof v === 'boolean' ? test(compareScalars(v, b)) : op === '<>');
  }

  if (op === '=' || op === '<>') {
    const re = wildcardRegex(operand);
    return (v) => {
      const matches = typeof v === 'string' && re.test(v);
      return op === '=' ? matches : !matches;
    };
  }
  return (v) => typeof v === 'string' && test(compareScalars(v, operand));
}

/** Throws #VALUE! unless every range has the same shape as the first. */
export function sameShape(ctx: FnContext, ranges: RangeValue[]): void {
  const [first, ...rest] = ranges;
  for (const r of rest) {
    if (r.rows !== first.rows || r.cols !== first.cols) {
      fail(
        '#VALUE!',
        `${ctx.name}: all ranges must be the same size, but ${first.label} is ${first.rows}×${first.cols} and ${r.label} is ${r.rows}×${r.cols}.`,
      );
    }
  }
}
