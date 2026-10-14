import { compareScalars, toBool } from '../coerce';
import { CellError, isError, isRange, type Value } from '../values';
import { fail } from './helpers';
import type { FnContext, FnDef, Thunk } from './types';

/** Evaluate a thunk as a condition; errors propagate. */
function condition(t: Thunk, ctx: FnContext, i: number): boolean {
  const v = t();
  if (isRange(v)) fail('#VALUE!', `${ctx.name}: argument ${i + 1} must be a single TRUE/FALSE value, not the range ${v.label}.`);
  if (v instanceof CellError) throw v;
  const b = toBool(v);
  if (b instanceof CellError) throw new CellError(b.code, `${ctx.name}: ${b.message}`, ctx.argSpan(i));
  return b;
}

/** Logical values from arguments: in ranges only booleans/numbers count; text and blanks are skipped. */
function logicals(args: Value[], ctx: FnContext): boolean[] {
  const out: boolean[] = [];
  args.forEach((a, i) => {
    if (isRange(a)) {
      for (const row of a.data) {
        for (const v of row) {
          if (v instanceof CellError) throw v;
          if (typeof v === 'boolean') out.push(v);
          else if (typeof v === 'number') out.push(v !== 0);
        }
      }
    } else if (a !== null) {
      if (a instanceof CellError) throw a;
      const b = toBool(a);
      if (b instanceof CellError) throw new CellError(b.code, `${ctx.name}: ${b.message}`, ctx.argSpan(i));
      out.push(b);
    }
  });
  if (!out.length) fail('#VALUE!', `${ctx.name}: no TRUE/FALSE values were found in the arguments.`);
  return out;
}

const sameValue = (a: Value, b: Value): boolean => {
  if (isRange(a) || isRange(b) || isError(a) || isError(b)) return false;
  if (a === null || b === null) return a === b;
  return typeof a === typeof b && compareScalars(a, b) === 0;
};

export const logicalFunctions: FnDef[] = [
  {
    name: 'IF',
    category: 'Logical',
    signature: 'IF(condition, value_if_true, [value_if_false])',
    description: 'Returns one value if the condition is TRUE and another if it is FALSE. Only the chosen branch is evaluated.',
    example: '=IF(A1>=50, "Pass", "Fail")',
    min: 2,
    max: 3,
    lazy: (a, ctx) => (condition(a[0], ctx, 0) ? a[1]() : a[2] ? a[2]() : false),
  },
  {
    name: 'IFS',
    category: 'Logical',
    signature: 'IFS(condition1, value1, [condition2, value2], ...)',
    description: 'Returns the value for the first TRUE condition; #N/A if none is TRUE.',
    example: '=IFS(A1>=90, "A", A1>=80, "B", TRUE, "C")',
    min: 2,
    max: Infinity,
    lazy: (a, ctx) => {
      if (a.length % 2) fail('#VALUE!', 'IFS: arguments must come in condition/value pairs.');
      for (let i = 0; i < a.length; i += 2) if (condition(a[i], ctx, i)) return a[i + 1]();
      fail('#N/A', 'IFS: none of the conditions is TRUE. Add TRUE as the last condition to provide a default.');
    },
  },
  {
    name: 'AND',
    category: 'Logical',
    signature: 'AND(logical1, [logical2], ...)',
    description: 'TRUE if every argument is TRUE.',
    example: '=AND(A1>0, B1>0)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => logicals(a, ctx).every(Boolean),
  },
  {
    name: 'OR',
    category: 'Logical',
    signature: 'OR(logical1, [logical2], ...)',
    description: 'TRUE if any argument is TRUE.',
    example: '=OR(A1="yes", B1="yes")',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => logicals(a, ctx).some(Boolean),
  },
  {
    name: 'XOR',
    category: 'Logical',
    signature: 'XOR(logical1, [logical2], ...)',
    description: 'TRUE if an odd number of arguments are TRUE.',
    example: '=XOR(A1, B1)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => logicals(a, ctx).filter(Boolean).length % 2 === 1,
  },
  {
    name: 'NOT',
    category: 'Logical',
    signature: 'NOT(logical)',
    description: 'Reverses a TRUE/FALSE value.',
    example: '=NOT(A1>5)',
    min: 1,
    max: 1,
    lazy: (a, ctx) => !condition(a[0], ctx, 0),
  },
  {
    name: 'IFERROR',
    category: 'Logical',
    signature: 'IFERROR(value, value_if_error)',
    description: 'Returns value, or value_if_error if value is any error.',
    example: '=IFERROR(A1/B1, 0)',
    min: 2,
    max: 2,
    lazy: (a) => {
      const v = a[0]();
      return isError(v) ? a[1]() : v;
    },
  },
  {
    name: 'IFNA',
    category: 'Logical',
    signature: 'IFNA(value, value_if_na)',
    description: 'Returns value, or value_if_na if value is #N/A.',
    example: '=IFNA(VLOOKUP("x", A1:B9, 2, FALSE), "missing")',
    min: 2,
    max: 2,
    lazy: (a) => {
      const v = a[0]();
      return isError(v) && v.code === '#N/A' ? a[1]() : v;
    },
  },
  {
    name: 'SWITCH',
    category: 'Logical',
    signature: 'SWITCH(expression, value1, result1, [value2, result2], ..., [default])',
    description: 'Compares an expression against a list of values and returns the matching result.',
    example: '=SWITCH(A1, 1, "One", 2, "Two", "Other")',
    min: 3,
    max: Infinity,
    lazy: (a) => {
      const e = a[0]();
      if (isError(e)) return e;
      let i = 1;
      for (; i + 1 < a.length; i += 2) if (sameValue(e, a[i]())) return a[i + 1]();
      if (i < a.length) return a[i]();
      fail('#N/A', 'SWITCH: no value matched and no default was given.');
    },
  },
  {
    name: 'CHOOSE',
    category: 'Logical',
    signature: 'CHOOSE(index, value1, [value2], ...)',
    description: 'Returns the value at the given 1-based index.',
    example: '=CHOOSE(2, "red", "green", "blue")',
    min: 2,
    max: Infinity,
    lazy: (a, ctx) => {
      const v = a[0]();
      if (isRange(v) || isError(v)) return isError(v) ? v : fail('#VALUE!', 'CHOOSE: index must be a single number.');
      const n = Math.trunc(Number(v));
      if (!(n >= 1 && n < a.length)) {
        throw new CellError('#VALUE!', `CHOOSE: index must be between 1 and ${a.length - 1} (got ${String(v)}).`, ctx.argSpan(0));
      }
      return a[n]();
    },
  },
  {
    name: 'TRUE',
    category: 'Logical',
    signature: 'TRUE()',
    description: 'The logical value TRUE.',
    min: 0,
    max: 0,
    call: () => true,
  },
  {
    name: 'FALSE',
    category: 'Logical',
    signature: 'FALSE()',
    description: 'The logical value FALSE.',
    min: 0,
    max: 0,
    call: () => false,
  },
];
