import type { CellRef } from './address';
import type { ErrorCode } from './values';

export type BinaryOp = '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '>' | '<=' | '>=';

interface Base {
  /** Source span [start, end) in the raw formula, used for caret diagnostics. */
  start: number;
  end: number;
}

export type Node =
  | (Base & { type: 'number'; value: number })
  | (Base & { type: 'string'; value: string })
  | (Base & { type: 'bool'; value: boolean })
  | (Base & { type: 'error'; code: ErrorCode })
  | (Base & { type: 'cell'; ref: CellRef })
  | (Base & { type: 'range'; from: CellRef; to: CellRef })
  | (Base & { type: 'unary'; op: '+' | '-'; operand: Node })
  | (Base & { type: 'percent'; operand: Node })
  | (Base & { type: 'binary'; op: BinaryOp; left: Node; right: Node })
  | (Base & { type: 'call'; name: string; args: Node[]; nameEnd: number });

export type NodeOf<T extends Node['type']> = Extract<Node, { type: T }>;

/** Depth-first walk over every node. */
export function walk(node: Node, visit: (n: Node) => void): void {
  visit(node);
  switch (node.type) {
    case 'unary':
    case 'percent':
      walk(node.operand, visit);
      break;
    case 'binary':
      walk(node.left, visit);
      walk(node.right, visit);
      break;
    case 'call':
      for (const a of node.args) walk(a, visit);
      break;
  }
}
