import type { Span, Value } from '../values';

export type Category = 'Math' | 'Statistical' | 'Logical' | 'Text' | 'Lookup' | 'Information';

export interface FnContext {
  /** Upper-case function name, for error messages. */
  name: string;
  /** Source span of argument i (falls back to the whole call). */
  argSpan(i: number): Span;
  /** Position of the cell being evaluated (for ROW() / COLUMN()). */
  row: number;
  col: number;
}

/** A deferred argument, used by short-circuiting functions such as IF and IFERROR. */
export type Thunk = () => Value;

export interface FnDef {
  name: string;
  category: Category;
  /** Usage line shown in autocomplete and docs. Optional params are in [brackets]. */
  signature: string;
  description: string;
  example?: string;
  min: number;
  max: number;
  /**
   * Which arguments may receive a range (A1:B5). Other arguments are reduced to a
   * single value before the call; passing a multi-cell range there is a #VALUE! error.
   */
  ranges?: 'all' | number[];
  /** Re-evaluated on every recalculation (RAND, RANDBETWEEN). */
  volatile?: boolean;
  /** Eager implementation: receives evaluated arguments. May throw a CellError. */
  call?: (args: Value[], ctx: FnContext) => Value;
  /** Lazy implementation: receives thunks, evaluates only what it needs. */
  lazy?: (args: Thunk[], ctx: FnContext) => Value;
}
