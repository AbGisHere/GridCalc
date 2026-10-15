export type ErrorCode =
  | '#DIV/0!'
  | '#VALUE!'
  | '#REF!'
  | '#NAME?'
  | '#N/A'
  | '#NUM!'
  | '#NULL!'
  | '#CIRC!'
  | '#ERROR!';

export const ERROR_CODES: readonly ErrorCode[] = [
  '#DIV/0!',
  '#VALUE!',
  '#REF!',
  '#NAME?',
  '#N/A',
  '#NUM!',
  '#NULL!',
  '#CIRC!',
  '#ERROR!',
];

/** A half-open character range [start, end) into the raw formula text (which includes the leading '='). */
export interface Span {
  start: number;
  end: number;
}

/**
 * A spreadsheet error value. Errors are ordinary values: they flow through formulas
 * and are displayed in cells. `span` points at the part of the formula responsible,
 * `origin` names the cell where the error was first produced when it was propagated
 * through a reference.
 */
export class CellError {
  constructor(
    readonly code: ErrorCode,
    readonly message: string,
    readonly span?: Span,
    readonly origin?: string,
    /** For #CIRC!: the cells of the loop in "depends on" order, ending where it starts (A1, B1, A1). */
    readonly loop?: readonly string[],
  ) {}

  /** Re-tag an error read through a reference so the UI can trace it back to its source. */
  viaReference(address: string, span?: Span): CellError {
    return new CellError(this.code, this.message, span, this.origin ?? address);
  }

  toString(): string {
    return this.code;
  }
}

/** A single cell value. `null` is an empty cell. */
export type Scalar = number | string | boolean | null | CellError;

/** A rectangular block of values produced by a range reference such as A1:C10. */
export interface RangeValue {
  kind: 'range';
  data: Scalar[][];
  rows: number;
  cols: number;
  /** Top-left position, so ROW()/COLUMN() can report where the range lives. */
  row: number;
  col: number;
  /** Human readable label used in error messages, e.g. "A1:C10". */
  label: string;
}

export type Value = Scalar | RangeValue;

export const isError = (v: unknown): v is CellError => v instanceof CellError;

export const isRange = (v: Value | undefined): v is RangeValue =>
  typeof v === 'object' && v !== null && !(v instanceof CellError) && v.kind === 'range';

/** Strict numeric literal: 12, -3.5, .5, 1e6. Rejects hex, "Infinity", whitespace-only, etc. */
export const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Format a number in the spirit of the "General" format: up to ~11 significant digits. */
export function formatNumber(n: number): string {
  if (Object.is(n, -0)) n = 0;
  const r = Number(n.toPrecision(15)); // hides binary noise: 0.1 + 0.2 -> 0.3
  if (Number.isInteger(r) && Math.abs(r) < 1e15) return String(r);
  const abs = Math.abs(r);
  if (abs !== 0 && (abs < 1e-9 || abs >= 1e15)) {
    return r.toExponential(5).replace(/\.?0+e/, 'e');
  }
  return String(Number(r.toPrecision(11)));
}

export function displayValue(v: Scalar): string {
  if (v === null) return '';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof CellError) return v.code;
  return v;
}
