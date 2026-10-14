import { describe, expect, it } from 'vitest';
import { FUNCTIONS } from '../src/engine/functions';
import { CellError } from '../src/engine/values';
import { calc, code, sheet } from './helpers';

describe('arithmetic and operators', () => {
  it.each([
    ['=1+2*3', 7],
    ['=(1+2)*3', 9],
    ['=2^3^2', 64],
    ['=-2^2', 4],
    ['=10/4', 2.5],
    ['=50%*200', 100],
    ['=0.1+0.2=0.3', true],
    ['="a"&1&TRUE', 'a1TRUE'],
    ['=1<2', true],
    ['="B">"a"', true],
    ['=1<"a"', true],
    ['=TRUE+1', 2],
    ['="3"*2', 6],
  ])('%s = %s', (f, expected) => {
    expect(calc(f)).toBe(expected);
  });

  it('produces errors with spans', () => {
    const v = calc('=1/(2-2)') as CellError;
    expect(v.code).toBe('#DIV/0!');
    expect(v.message).toContain('2-2');
    expect(v.span).toEqual({ start: 4, end: 7 });
    expect(code(calc('="abc"+1'))).toBe('#VALUE!');
    expect(code(calc('=(-8)^0.5'))).toBe('#NUM!');
  });

  it('treats empty cells as 0 / ""', () => {
    expect(calc('=A1+1')).toBe(1);
    expect(calc('=A1&"x"')).toBe('x');
    expect(calc('=A1')).toBe(0);
  });

  it('rejects multi-cell ranges in scalar context', () => {
    expect(code(calc('=A1:A3+1'))).toBe('#VALUE!');
    expect(code(calc('=A1:B2'))).toBe('#VALUE!');
  });
});

describe('functions', () => {
  const data = {
    A1: 'Name', B1: 'Region', C1: 'Units',
    A2: 'Widget', B2: 'North', C2: 10,
    A3: 'Gadget', B3: 'South', C3: 25,
    A4: 'Gizmo', B4: 'North', C4: 5,
    A5: 'Doohickey', B5: 'East', C5: 40,
  };

  it('registers at least 30 functions', () => {
    expect(FUNCTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it.each([
    ['=SUM(C2:C5)', 80],
    ['=SUM(C2:C5, 20)', 100],
    ['=SUM(A1:C1)', 0],
    ['=AVERAGE(C2:C5)', 20],
    ['=MIN(C2:C5)', 5],
    ['=MAX(C2:C5)', 40],
    ['=COUNT(A1:C5)', 4],
    ['=COUNTA(A1:C5)', 15],
    ['=COUNTBLANK(D1:D3)', 3],
    ['=PRODUCT(2,3,4)', 24],
    ['=ROUND(2.345, 2)', 2.35],
    ['=ROUND(-2.5, 0)', -3],
    ['=ROUND(1234, -2)', 1200],
    ['=ROUNDUP(1.21, 1)', 1.3],
    ['=ROUNDDOWN(1.29, 1)', 1.2],
    ['=INT(-2.5)', -3],
    ['=MOD(-3, 2)', 1],
    ['=ABS(-4)', 4],
    ['=SQRT(16)', 4],
    ['=POWER(2,10)', 1024],
    ['=CEILING(4.1, 0.5)', 4.5],
    ['=FLOOR(4.9, 0.5)', 4.5],
    ['=MEDIAN(1, 3, 2, 4)', 2.5],
    ['=LARGE(C2:C5, 2)', 25],
    ['=SMALL(C2:C5, 1)', 5],
    ['=RANK(25, C2:C5)', 2],
    ['=SUMIF(B2:B5, "North", C2:C5)', 15],
    ['=SUMIF(C2:C5, ">10")', 65],
    ['=SUMIFS(C2:C5, B2:B5, "North", C2:C5, ">5")', 10],
    ['=COUNTIF(A2:A5, "G*")', 2],
    ['=COUNTIFS(B2:B5, "North", C2:C5, "<10")', 1],
    ['=AVERAGEIF(B2:B5, "North", C2:C5)', 7.5],
    ['=SUMPRODUCT(C2:C3, C4:C5)', 1050],
    ['=IF(C2>5, "big", "small")', 'big'],
    ['=IF(FALSE, 1)', false],
    ['=IFS(C2>50, "a", C2>5, "b")', 'b'],
    ['=AND(TRUE, 1, C2>5)', true],
    ['=OR(FALSE, 0)', false],
    ['=XOR(TRUE, TRUE)', false],
    ['=NOT(FALSE)', true],
    ['=IFERROR(1/0, "oops")', 'oops'],
    ['=IFNA(MATCH("zzz", A2:A5, 0), "none")', 'none'],
    ['=SWITCH(2, 1, "one", 2, "two", "other")', 'two'],
    ['=CHOOSE(3, "a", "b", "c")', 'c'],
    ['=VLOOKUP("gadget", A2:C5, 3, FALSE)', 25],
    ['=VLOOKUP("Giz*", A2:C5, 2, FALSE)', 'North'],
    ['=HLOOKUP("Units", A1:C5, 3, FALSE)', 25],
    ['=INDEX(A2:C5, 4, 1)', 'Doohickey'],
    ['=MATCH("Gizmo", A2:A5, 0)', 3],
    ['=XLOOKUP("Gizmo", A2:A5, C2:C5)', 5],
    ['=XLOOKUP("nope", A2:A5, C2:C5, "missing")', 'missing'],
    ['=ROWS(A1:C5)', 5],
    ['=COLUMNS(A1:C5)', 3],
    ['=ROW(B7)', 7],
    ['=CONCAT(A2, "-", B2)', 'Widget-North'],
    ['=TEXTJOIN(", ", TRUE, A2:A3, D1)', 'Widget, Gadget'],
    ['=LEN("hello")', 5],
    ['=UPPER("abc")', 'ABC'],
    ['=PROPER("grace hopper")', 'Grace Hopper'],
    ['=TRIM("  a   b ")', 'a b'],
    ['=LEFT("Spreadsheet", 6)', 'Spread'],
    ['=RIGHT("Spreadsheet", 5)', 'sheet'],
    ['=MID("Spreadsheet", 7, 5)', 'sheet'],
    ['=FIND("a", "banana")', 2],
    ['=SEARCH("N?N", "banana")', 3],
    ['=SUBSTITUTE("a-b-c", "-", "+")', 'a+b+c'],
    ['=SUBSTITUTE("a-b-c", "-", "+", 2)', 'a-b+c'],
    ['=REPLACE("2024-01", 1, 4, "2025")', '2025-01'],
    ['=REPT("ab", 3)', 'ababab'],
    ['=VALUE("42.5")', 42.5],
    ['=TEXT(1234.5, "$#,##0.00")', '$1,234.50'],
    ['=TEXT(0.256, "0.0%")', '25.6%'],
    ['=EXACT("a", "A")', false],
    ['=ISBLANK(Z9)', true],
    ['=ISNUMBER(C2)', true],
    ['=ISTEXT(A2)', true],
    ['=ISERROR(1/0)', true],
    ['=ISEVEN(4)', true],
  ])('%s', (f, expected) => {
    expect(calc(f, data)).toBe(expected);
  });

  it('VLOOKUP explains a miss', () => {
    const e = calc('=VLOOKUP("Nope", A2:C5, 2, FALSE)', data) as CellError;
    expect(e.code).toBe('#N/A');
    expect(e.message).toContain('could not find "Nope" in the first column of A2:C5');
    expect(code(calc('=VLOOKUP("Widget", A2:C5, 9, FALSE)', data))).toBe('#REF!');
  });

  it('VLOOKUP approximate match on sorted data', () => {
    const grades = { A1: 0, B1: 'F', A2: 60, B2: 'D', A3: 70, B3: 'C', A4: 80, B4: 'B', A5: 90, B5: 'A' };
    expect(calc('=VLOOKUP(85, A1:B5, 2)', grades)).toBe('B');
    expect(calc('=VLOOKUP(90, A1:B5, 2, TRUE)', grades)).toBe('A');
    expect(code(calc('=VLOOKUP(-1, A1:B5, 2)', grades))).toBe('#N/A');
  });

  it('IF only evaluates the chosen branch', () => {
    expect(calc('=IF(TRUE, 1, 1/0)')).toBe(1);
    expect(calc('=IFERROR(SQRT(-1), -1)')).toBe(-1);
  });

  it('supports deeply nested calls', () => {
    expect(calc('=ROUND(AVERAGE(SUM(1,2), MAX(3, ABS(-9)), IF(LEN("ab")=2, 3, 0)), 1)')).toBe(5);
  });

  it('propagates errors and records where they came from', () => {
    const s = sheet({ A1: '=1/0', B1: '=A1+1', C1: '=SUM(A1:B1)' });
    const b = s.error('B1')!;
    expect(b.code).toBe('#DIV/0!');
    expect(b.origin).toBe('A1');
    expect(s.error('C1')!.origin).toBe('A1');
  });
});
