import { describe, expect, it } from 'vitest';
import { caretLine, formatDiagnostic } from '../src/engine/diagnostics';
import { parseFormula } from '../src/engine/parser';

const diag = (f: string) => parseFormula(f).diagnostic;

describe('parser: valid formulas', () => {
  it.each([
    '=1+2*3',
    '=-2^2',
    '=(A1+B2)/C3',
    '=SUM(A1:B10, 5, C3)',
    '=IF(AND(A1>0, B1<>"x"), "yes", IF(A1=0, "zero", "no"))',
    '=VLOOKUP("Bob", $A$1:C20, 3, FALSE)',
    '="a" & "b" & 1',
    '=50%',
    '=A1>=B1',
    '=#N/A',
    '=  sum( a1 , b2 )',
    '=LOG10(100)',
    '=PI()',
  ])('parses %s', (f) => {
    expect(diag(f)).toBeUndefined();
  });

  it('respects precedence and associativity', () => {
    const ast = parseFormula('=1+2*3-4').ast!;
    expect(ast.type).toBe('binary');
    if (ast.type === 'binary') {
      expect(ast.op).toBe('-');
      expect(ast.left.type === 'binary' && ast.left.op).toBe('+');
    }
  });
});

describe('parser: diagnostics', () => {
  it('reports the example from the problem statement', () => {
    const d = diag('=SUM(A1, B2')!;
    expect(d.message).toBe('Missing closing parenthesis.');
    expect(d.suggestion).toBe("Add ')' at the end of the formula.");
    expect(d.fix).toBe('=SUM(A1, B2)');
    expect(d.start).toBe('=SUM(A1, B2'.length);
    expect(formatDiagnostic('=SUM(A1, B2', d)).toContain('Error: Missing closing parenthesis.');
  });

  it('counts multiple missing parentheses', () => {
    const d = diag('=ROUND(SUM(A1:A3, 2')!;
    expect(d.message).toBe('Missing 2 closing parentheses.');
    expect(d.fix).toBe('=ROUND(SUM(A1:A3, 2))');
  });

  it('flags unmatched closing parenthesis', () => {
    const d = diag('=SUM(A1))')!;
    expect(d.message).toBe('Unmatched closing parenthesis.');
    expect(d.start).toBe(8);
    expect(d.fix).toBe('=SUM(A1)');
  });

  it('suggests a function name for typos', () => {
    const d = diag('=SUMM(A1:A3)')!;
    expect(d.code).toBe('#NAME?');
    expect(d.suggestion).toBe('Did you mean SUM?');
    expect(d.fix).toBe('=SUM(A1:A3)');
    expect([d.start, d.end]).toEqual([1, 5]);
  });

  it('handles trailing operators, chaining fixes', () => {
    const d = diag('=SUM(A1, B2+')!;
    expect(d.message).toBe("Expected a value after '+'.");
    expect(d.fix).toBe('=SUM(A1, B2)');
  });

  it('explains missing separators between arguments', () => {
    const d = diag('=SUM(A1 B1)')!;
    expect(d.message).toContain("Expected ',' or ')'");
    expect(d.fix).toBe('=SUM(A1, B1)');
  });

  it('detects bad operators', () => {
    expect(diag('=A1==B1')!.fix).toBe('=A1=B1');
    expect(diag('=A1!=B1')!.fix).toBe('=A1<>B1');
    expect(diag('=SUM(A1;A2)')!.fix).toBe('=SUM(A1,A2)');
  });

  it('detects unterminated strings', () => {
    const d = diag('=CONCAT("abc')!;
    expect(d.message).toBe('Unterminated text string.');
    expect(d.fix).toBe('=CONCAT("abc")');
  });

  it('checks argument counts', () => {
    const d = diag('=IF(A1)')!;
    expect(d.message).toBe('IF expects 2 to 3 arguments, but got 1.');
    expect(d.suggestion).toContain('IF(condition');
  });

  it('flags unknown bare names and offers quoting', () => {
    const d = diag('=hello')!;
    expect(d.code).toBe('#NAME?');
    expect(d.fix).toBe('="hello"');
  });

  it('flags out-of-bounds references', () => {
    expect(diag('=ZZZ1')!.code).toBe('#REF!');
  });

  it('flags trailing commas and empty arguments', () => {
    expect(diag('=SUM(A1,)')!.fix).toBe('=SUM(A1)');
    expect(diag('=SUM(,A1)')!.message).toContain('Missing argument 1');
  });

  it('flags incomplete ranges and empty formulas', () => {
    expect(diag('=SUM(A1:)')!.message).toContain("after ':'");
    expect(diag('=')!.message).toBe('The formula is empty.');
  });

  it('renders a caret under the problem', () => {
    expect(caretLine(4, 7)).toBe('    ^~~');
  });
});
