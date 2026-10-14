import { CellError, isRange, type Scalar, type Value } from '../values';
import { fail, num } from './helpers';
import type { FnDef } from './types';

/** IS* functions see the raw value, including errors, without throwing. */
const test = (name: string, description: string, fn: (v: Scalar) => boolean, example: string): FnDef => ({
  name,
  category: 'Information',
  signature: `${name}(value)`,
  description,
  example,
  min: 1,
  max: 1,
  call: (a: Value[]) => {
    const v = a[0];
    if (isRange(v)) return false;
    return fn(v);
  },
});

export const infoFunctions: FnDef[] = [
  test('ISBLANK', 'TRUE if the value is an empty cell.', (v) => v === null, '=ISBLANK(A1)'),
  test('ISNUMBER', 'TRUE if the value is a number.', (v) => typeof v === 'number', '=ISNUMBER(A1)'),
  test('ISTEXT', 'TRUE if the value is text.', (v) => typeof v === 'string', '=ISTEXT(A1)'),
  test('ISLOGICAL', 'TRUE if the value is TRUE or FALSE.', (v) => typeof v === 'boolean', '=ISLOGICAL(A1)'),
  test('ISERROR', 'TRUE if the value is any error.', (v) => v instanceof CellError, '=ISERROR(A1/B1)'),
  test('ISERR', 'TRUE if the value is any error except #N/A.', (v) => v instanceof CellError && v.code !== '#N/A', '=ISERR(A1)'),
  test('ISNA', 'TRUE if the value is #N/A.', (v) => v instanceof CellError && v.code === '#N/A', '=ISNA(MATCH(5, A1:A9, 0))'),
  {
    name: 'ISEVEN',
    category: 'Information',
    signature: 'ISEVEN(number)',
    description: 'TRUE if the integer part of the number is even.',
    example: '=ISEVEN(4)',
    min: 1,
    max: 1,
    call: (a, ctx) => Math.trunc(num(a, 0, ctx)) % 2 === 0,
  },
  {
    name: 'ISODD',
    category: 'Information',
    signature: 'ISODD(number)',
    description: 'TRUE if the integer part of the number is odd.',
    example: '=ISODD(3)',
    min: 1,
    max: 1,
    call: (a, ctx) => Math.abs(Math.trunc(num(a, 0, ctx)) % 2) === 1,
  },
  {
    name: 'NA',
    category: 'Information',
    signature: 'NA()',
    description: 'Returns the #N/A error (useful as a "not available" marker).',
    example: '=IF(A1="", NA(), A1)',
    min: 0,
    max: 0,
    call: () => fail('#N/A', 'NA(): value not available.'),
  },
  {
    name: 'TYPE',
    category: 'Information',
    signature: 'TYPE(value)',
    description: 'Type code: 1 number (or blank), 2 text, 4 logical, 16 error, 64 range.',
    example: '=TYPE("hi")',
    min: 1,
    max: 1,
    ranges: [0],
    call: (a) => {
      const v = a[0];
      if (isRange(v)) return v.rows === 1 && v.cols === 1 ? typeCode(v.data[0][0]) : 64;
      return typeCode(v);
    },
  },
];

function typeCode(v: Scalar): number {
  if (v instanceof CellError) return 16;
  if (typeof v === 'string') return 2;
  if (typeof v === 'boolean') return 4;
  return 1;
}
