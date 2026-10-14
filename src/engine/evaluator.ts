import { normalizeRange, toA1, rangeToA1, type CellRef } from './address';
import type { Node, NodeOf } from './ast';
import { compareScalars, toNumber, toText } from './coerce';
import { acceptsRange, getFunction, type FnContext, type FnDef } from './functions';
import { CellError, isRange, type RangeValue, type Scalar, type Span, type Value } from './values';

interface EvalContext {
  /** Current computed value of a cell (null when empty). */
  getValue(row: number, col: number): Scalar;
  /** Raw formula text, used to quote sub-expressions in error messages. */
  formula: string;
  /** The cell being evaluated. */
  row: number;
  col: number;
}

const spanOf = (n: Node): Span => ({ start: n.start, end: n.end });

/** Evaluates a parsed formula down to the single value stored in the cell. */
export function evaluateFormula(ast: Node, ctx: EvalContext): Scalar {
  const v = evalNode(ast, ctx);
  if (isRange(v)) {
    if (v.rows === 1 && v.cols === 1) return v.data[0][0] ?? 0;
    return new CellError(
      '#VALUE!',
      `The formula returns the whole range ${v.label}, but a cell holds one value. Wrap it in a function such as SUM(${v.label}).`,
      spanOf(ast),
    );
  }
  return v === null ? 0 : v;
}

function evalNode(node: Node, ctx: EvalContext): Value {
  switch (node.type) {
    case 'number':
    case 'string':
    case 'bool':
      return node.value;
    case 'error':
      return new CellError(node.code, `The formula contains the error value ${node.code}.`, spanOf(node));
    case 'cell': {
      const { row, col } = node.ref;
      const v = ctx.getValue(row, col);
      return v instanceof CellError ? v.viaReference(toA1(row, col), spanOf(node)) : v;
    }
    case 'range':
      return readRange(node.from, node.to, ctx, spanOf(node));
    case 'unary': {
      const v = single(evalNode(node.operand, ctx), node.operand, ctx);
      if (v instanceof CellError) return v;
      const n = number(v, node.operand);
      if (n instanceof CellError) return n;
      return node.op === '-' ? -n : n;
    }
    case 'percent': {
      const v = single(evalNode(node.operand, ctx), node.operand, ctx);
      if (v instanceof CellError) return v;
      const n = number(v, node.operand);
      return n instanceof CellError ? n : n / 100;
    }
    case 'binary':
      return evalBinary(node, ctx);
    case 'call':
      return evalCall(node, ctx);
  }
}

function readRange(from: CellRef, to: CellRef, ctx: EvalContext, span: Span): RangeValue {
  const b = normalizeRange(from, to);
  const data: Scalar[][] = [];
  for (let r = b.r1; r <= b.r2; r++) {
    const row: Scalar[] = [];
    for (let c = b.c1; c <= b.c2; c++) {
      const v = ctx.getValue(r, c);
      row.push(v instanceof CellError ? v.viaReference(toA1(r, c), span) : v);
    }
    data.push(row);
  }
  return { kind: 'range', data, rows: b.r2 - b.r1 + 1, cols: b.c2 - b.c1 + 1, row: b.r1, col: b.c1, label: rangeToA1(b) };
}

/** Reduce to a single value; a multi-cell range in an operator is a #VALUE! error. */
function single(v: Value, node: Node, ctx: EvalContext): Scalar {
  if (!isRange(v)) return v;
  if (v.rows === 1 && v.cols === 1) return v.data[0][0];
  const text = ctx.formula.slice(node.start, node.end);
  return new CellError(
    '#VALUE!',
    `The range ${text} can't be used as a single value here. Use a function like SUM(${text}) or refer to one cell.`,
    spanOf(node),
  );
}

function number(v: Scalar, node: Node): number | CellError {
  const n = toNumber(v);
  if (n instanceof CellError && n !== v) return new CellError(n.code, n.message, spanOf(node));
  return n;
}

function evalBinary(node: NodeOf<'binary'>, ctx: EvalContext): Value {
  const l = single(evalNode(node.left, ctx), node.left, ctx);
  if (l instanceof CellError) return l;
  const r = single(evalNode(node.right, ctx), node.right, ctx);
  if (r instanceof CellError) return r;

  switch (node.op) {
    case '&': {
      return (toText(l) as string) + (toText(r) as string);
    }
    case '=':
    case '<>':
    case '<':
    case '>':
    case '<=':
    case '>=': {
      const c = compareScalars(l, r);
      switch (node.op) {
        case '=':
          return c === 0;
        case '<>':
          return c !== 0;
        case '<':
          return c < 0;
        case '>':
          return c > 0;
        case '<=':
          return c <= 0;
        default:
          return c >= 0;
      }
    }
  }

  const a = number(l, node.left);
  if (a instanceof CellError) return a;
  const b = number(r, node.right);
  if (b instanceof CellError) return b;

  let out: number;
  switch (node.op) {
    case '+':
      out = a + b;
      break;
    case '-':
      out = a - b;
      break;
    case '*':
      out = a * b;
      break;
    case '/':
      if (b === 0) {
        const divisor = ctx.formula.slice(node.right.start, node.right.end);
        return new CellError(
          '#DIV/0!',
          node.right.type === 'number' ? 'Division by zero.' : `Division by zero: the divisor ${divisor} evaluates to 0.`,
          spanOf(node.right),
        );
      }
      out = a / b;
      break;
    case '^':
      if (a === 0 && b < 0) return new CellError('#DIV/0!', '0 cannot be raised to a negative power.', spanOf(node));
      out = a ** b;
      if (Number.isNaN(out)) {
        return new CellError('#NUM!', 'A negative number cannot be raised to a fractional power.', spanOf(node));
      }
      break;
  }
  if (!Number.isFinite(out)) return new CellError('#NUM!', 'The result is too large to represent.', spanOf(node));
  return out;
}

function prepareArg(def: FnDef, i: number, node: Node, ctx: EvalContext): Value {
  if (acceptsRange(def, i)) {
    // A lone cell passed where ranges are allowed behaves like a 1×1 range, so e.g.
    // SUM(A1) ignores text in A1 exactly as SUM(A1:A1) would.
    if (node.type === 'cell') return readRange(node.ref, node.ref, ctx, spanOf(node));
    return evalNode(node, ctx);
  }
  const v = evalNode(node, ctx);
  if (!isRange(v)) return v;
  if (v.rows === 1 && v.cols === 1) return v.data[0][0];
  return new CellError(
    '#VALUE!',
    `${def.name}: argument ${i + 1} expects a single value, but got the range ${v.label}.`,
    spanOf(node),
  );
}

function evalCall(node: NodeOf<'call'>, ctx: EvalContext): Value {
  const def = getFunction(node.name);
  if (!def) return new CellError('#NAME?', `Unknown function '${node.name}'.`, { start: node.start, end: node.nameEnd });

  const fctx: FnContext = {
    name: def.name,
    argSpan: (i) => (node.args[i] ? spanOf(node.args[i]) : spanOf(node)),
    row: ctx.row,
    col: ctx.col,
  };

  let result: Value;
  try {
    if (def.lazy) {
      result = def.lazy(
        node.args.map((a, i) => () => prepareArg(def, i, a, ctx)),
        fctx,
      );
    } else {
      result = def.call!(
        node.args.map((a, i) => prepareArg(def, i, a, ctx)),
        fctx,
      );
    }
  } catch (e) {
    if (e instanceof CellError) result = e;
    else result = new CellError('#VALUE!', `${def.name} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (result instanceof CellError && !result.span && !result.origin) {
    return new CellError(result.code, result.message, spanOf(node));
  }
  return result;
}

/** Finds where in a formula a given cell is referenced (for pointing a caret at a circular reference). */
export function findReferenceSpan(ast: Node, row: number, col: number): Span | undefined {
  let found: Span | undefined;
  const visit = (n: Node) => {
    if (found) return;
    if (n.type === 'cell' && n.ref.row === row && n.ref.col === col) found = spanOf(n);
    else if (n.type === 'range') {
      const b = normalizeRange(n.from, n.to);
      if (row >= b.r1 && row <= b.r2 && col >= b.c1 && col <= b.c2) found = spanOf(n);
    } else if (n.type === 'unary' || n.type === 'percent') visit(n.operand);
    else if (n.type === 'binary') {
      visit(n.left);
      visit(n.right);
    } else if (n.type === 'call') n.args.forEach(visit);
  };
  visit(ast);
  return found;
}
