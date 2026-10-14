import { inBounds, LAST_CELL_A1, parseA1, type CellRef } from './address';
import type { BinaryOp, Node } from './ast';
import { walk } from './ast';
import { closestName, type Diagnostic } from './diagnostics';
import { describeArity, FUNCTION_NAMES, getFunction } from './functions';
import { tokenize, type Token } from './lexer';
import type { ErrorCode } from './values';

interface ParseResult {
  ast?: Node;
  diagnostic?: Diagnostic;
  tokens: Token[];
}

/**
 * Binding powers for the Pratt parser, lowest to highest:
 * comparison < & (concat) < + - < * / < ^ < unary - < postfix %.
 * Unary minus binds tighter than ^ so that -2^2 = 4, matching spreadsheet convention.
 */
const INFIX: Record<string, [number, number]> = {
  '=': [1, 2],
  '<>': [1, 2],
  '<': [1, 2],
  '>': [1, 2],
  '<=': [1, 2],
  '>=': [1, 2],
  '&': [3, 4],
  '+': [5, 6],
  '-': [5, 6],
  '*': [7, 8],
  '/': [7, 8],
  '^': [9, 10],
};
const PREFIX_BP = 11;
const POSTFIX_BP = 13;

const VALUE_START = new Set(['number', 'string', 'bool', 'cell', 'ident', 'error', 'lparen']);

class ParseFailure {
  constructor(readonly diagnostic: Diagnostic) {}
}

type DiagInput = Omit<Diagnostic, 'code'> & { code?: Diagnostic['code'] };

class Parser {
  private pos = 0;
  /** Stack of currently open '(' tokens, used to explain missing ')'. */
  private open: Token[] = [];

  constructor(
    private readonly raw: string,
    private readonly tokens: Token[],
  ) {}

  peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private prevToken(): Token | undefined {
    return this.tokens[this.pos - 1];
  }

  private fail(d: DiagInput): never {
    throw new ParseFailure({ code: '#ERROR!', ...d });
  }

  /** Formula with [s, e) replaced by `insert`. */
  private edit(s: number, e: number, insert = ''): string {
    return this.raw.slice(0, s) + insert + this.raw.slice(e);
  }

  parseExpr(minBp: number): Node {
    let left = this.parsePrefix();
    for (;;) {
      const t = this.peek();
      if (t.kind !== 'op') break;
      if (t.text === '%') {
        if (POSTFIX_BP < minBp) break;
        this.next();
        left = { type: 'percent', operand: left, start: left.start, end: t.end };
        continue;
      }
      const bp = INFIX[t.text];
      if (!bp || bp[0] < minBp) break;
      this.next();
      const right = this.parseOperandAfter(t, bp[1]);
      left = { type: 'binary', op: t.text as BinaryOp, left, right, start: left.start, end: right.end };
    }
    return left;
  }

  /** Parses the right-hand side of an operator, with targeted errors when it's missing. */
  private parseOperandAfter(op: Token, bp: number): Node {
    const t = this.peek();
    if (t.kind === 'eof') {
      this.fail({
        message: `Expected a value after '${op.text}'.`,
        start: t.start,
        end: t.end,
        suggestion: `Add a value after '${op.text}', or remove the trailing operator.`,
        fix: this.edit(op.start, op.end).trimEnd(),
      });
    }
    if (t.kind === 'rparen' || t.kind === 'comma') {
      this.fail({
        message: `Expected a value after '${op.text}' but found '${t.text}'.`,
        start: op.start,
        end: t.end,
        suggestion: `Add a value after '${op.text}', or remove the operator.`,
        fix: this.edit(op.start, op.end),
      });
    }
    return this.parseExpr(bp);
  }

  private parsePrefix(): Node {
    const t = this.next();
    switch (t.kind) {
      case 'number':
        return { type: 'number', value: Number(t.text), start: t.start, end: t.end };
      case 'string':
        return { type: 'string', value: t.text.slice(1, -1).replace(/""/g, '"'), start: t.start, end: t.end };
      case 'bool':
        return { type: 'bool', value: t.text.toUpperCase() === 'TRUE', start: t.start, end: t.end };
      case 'error':
        return { type: 'error', code: t.text.toUpperCase() as never, start: t.start, end: t.end };
      case 'cell':
        return this.parseReference(t);
      case 'ident':
        return this.parseIdentifier(t);
      case 'lparen':
        return this.parseGroup(t);
      case 'op':
        if (t.text === '-' || t.text === '+') {
          const operand = this.parseOperandAfter(t, PREFIX_BP);
          return { type: 'unary', op: t.text, operand, start: t.start, end: operand.end };
        }
        return this.fail({
          message: `Unexpected operator '${t.text}': expected a value.`,
          start: t.start,
          end: t.end,
          suggestion: `Put a value before '${t.text}', or remove it.`,
          fix: this.edit(t.start, t.end),
        });
      case 'rparen': {
        const prev = this.prevToken();
        if (prev?.kind === 'lparen') {
          return this.fail({
            message: 'Empty parentheses.',
            start: prev.start,
            end: t.end,
            suggestion: 'Put an expression inside the parentheses, or remove them.',
          });
        }
        return this.fail({
          message: "Unexpected ')': expected a value.",
          start: t.start,
          end: t.end,
          suggestion: "Remove the ')' or add a value before it.",
        });
      }
      case 'comma':
        return this.fail({
          message: "Unexpected ',': expected a value.",
          start: t.start,
          end: t.end,
          suggestion: 'Commas separate function arguments, e.g. =SUM(A1, B1).',
        });
      case 'colon':
        return this.fail({
          message: "Unexpected ':'.",
          start: t.start,
          end: t.end,
          suggestion: 'Ranges are written as two cell references joined by a colon, e.g. A1:B5.',
        });
      case 'eof':
        return this.fail({
          message: 'Unexpected end of formula: expected a value.',
          start: t.start,
          end: t.end,
          suggestion: 'Complete the expression.',
        });
    }
  }

  private cellRef(t: Token): CellRef {
    const ref = parseA1(t.text);
    if (!ref || !inBounds(ref.row, ref.col)) {
      this.fail({
        code: '#REF!',
        message: `Reference ${t.text.toUpperCase()} is outside the sheet (A1:${LAST_CELL_A1}).`,
        start: t.start,
        end: t.end,
        suggestion: `Use a reference between A1 and ${LAST_CELL_A1}.`,
      });
    }
    return ref;
  }

  private parseReference(t: Token): Node {
    const from = this.cellRef(t);
    if (this.peek().kind !== 'colon') return { type: 'cell', ref: from, start: t.start, end: t.end };
    const colon = this.next();
    const t2 = this.peek();
    if (t2.kind !== 'cell') {
      this.fail({
        message: "Expected a cell reference after ':' to complete the range.",
        start: colon.start,
        end: t2.kind === 'eof' ? colon.end : t2.end,
        suggestion: `Complete the range, e.g. ${t.text.toUpperCase()}:${t.text.replace(/\d+$/, (d) => String(+d + 9)).toUpperCase()}.`,
      });
    }
    this.next();
    const to = this.cellRef(t2);
    return { type: 'range', from, to, start: t.start, end: t2.end };
  }

  private parseIdentifier(t: Token): Node {
    const name = t.text.toUpperCase();
    if (this.peek().kind === 'lparen') return this.parseCall(t);
    if (getFunction(name)) {
      this.fail({
        code: '#NAME?',
        message: `Function ${name} must be followed by parentheses.`,
        start: t.start,
        end: t.end,
        suggestion: `Call it as ${name}(…).`,
        fix: this.edit(t.end, t.end, '()'),
      });
    }
    const near = closestName(name, FUNCTION_NAMES);
    this.fail({
      code: '#NAME?',
      message: `Unknown name '${t.text}'.`,
      start: t.start,
      end: t.end,
      suggestion: near
        ? `Did you mean the function ${near}(…)? If you meant text, wrap it in double quotes: "${t.text}".`
        : `If you meant text, wrap it in double quotes: "${t.text}".`,
      fix: this.edit(t.start, t.end, `"${t.text}"`),
    });
  }

  private missingCloseParen(): never {
    const opener = this.open[this.open.length - 1];
    const count = this.open.length;
    const closers = ')'.repeat(count);
    const end = this.raw.length;
    this.fail({
      message: count > 1 ? `Missing ${count} closing parentheses.` : 'Missing closing parenthesis.',
      start: end,
      end,
      suggestion: `Add '${closers}' at the end of the formula.`,
      fix: this.raw.trimEnd() + closers,
      related: opener ? { start: opener.start, end: opener.end, label: 'opened here' } : undefined,
    });
  }

  private parseGroup(open: Token): Node {
    this.open.push(open);
    const inner = this.parseExpr(0);
    const t = this.peek();
    if (t.kind === 'eof') this.missingCloseParen();
    if (t.kind !== 'rparen') {
      this.fail({
        message: `Expected ')' but found '${t.text}'.`,
        start: t.start,
        end: t.end,
        suggestion:
          t.kind === 'comma'
            ? 'Commas are only allowed between function arguments.'
            : VALUE_START.has(t.kind)
              ? 'Did you forget an operator such as + or * between two values?'
              : "Close the parenthesis with ')'.",
      });
    }
    this.next();
    this.open.pop();
    return inner;
  }

  private parseCall(nameTok: Token): Node {
    const name = nameTok.text.toUpperCase();
    const open = this.next();
    this.open.push(open);
    const args: Node[] = [];
    let lastComma: Token | undefined;

    if (this.peek().kind === 'rparen') {
      const close = this.next();
      this.open.pop();
      return { type: 'call', name, args, start: nameTok.start, end: close.end, nameEnd: nameTok.end };
    }

    for (;;) {
      const t = this.peek();
      if (t.kind === 'comma') {
        this.fail({
          message: `Missing argument ${args.length + 1} of ${name}.`,
          start: t.start,
          end: t.end,
          suggestion: 'Add a value before the comma, or remove the extra comma.',
          fix: this.edit(t.start, t.end),
        });
      }
      if (lastComma && t.kind === 'rparen') {
        this.fail({
          message: `Trailing ',' in ${name}(…): expected another argument.`,
          start: lastComma.start,
          end: lastComma.end,
          suggestion: 'Remove the trailing comma, or add another argument after it.',
          fix: this.edit(lastComma.start, lastComma.end),
        });
      }
      if (lastComma && t.kind === 'eof') {
        this.fail({
          message: "Unexpected end of formula: expected an argument after ','.",
          start: t.start,
          end: t.end,
          suggestion: "Add another argument, or remove the trailing ',' and close the call with ')'.",
          fix: this.edit(lastComma.start, lastComma.end).trimEnd(),
          related: { start: open.start, end: open.end, label: 'call opened here' },
        });
      }

      args.push(this.parseExpr(0));

      const sep = this.peek();
      if (sep.kind === 'comma') {
        lastComma = this.next();
        continue;
      }
      if (sep.kind === 'rparen') {
        this.next();
        this.open.pop();
        return { type: 'call', name, args, start: nameTok.start, end: sep.end, nameEnd: nameTok.end };
      }
      if (sep.kind === 'eof') this.missingCloseParen();
      const prevEnd = this.prevToken()?.end ?? sep.start;
      const looksLikeValue = VALUE_START.has(sep.kind);
      this.fail({
        message: `Expected ',' or ')' after argument ${args.length} of ${name}, but found '${sep.text}'.`,
        start: sep.start,
        end: sep.end,
        suggestion: looksLikeValue ? "Separate function arguments with ','." : `Check the arguments of ${name}.`,
        fix: looksLikeValue ? this.edit(prevEnd, sep.start, ', ') : undefined,
      });
    }
  }

  /** Called when tokens remain after a complete expression. */
  trailing(t: Token): never {
    if (t.kind === 'rparen') {
      this.fail({
        message: 'Unmatched closing parenthesis.',
        start: t.start,
        end: t.end,
        suggestion: "Remove the extra ')' or add a matching '('.",
        fix: this.edit(t.start, t.end),
      });
    }
    if (t.kind === 'comma') {
      this.fail({
        message: "Unexpected ',' outside of a function call.",
        start: t.start,
        end: t.end,
        suggestion: 'Commas separate function arguments, e.g. =SUM(A1, B1).',
      });
    }
    const prev = this.prevToken();
    const prevText = prev ? this.raw.slice(prev.start, prev.end) : '';
    this.fail({
      message: `Unexpected '${t.text}' after a complete expression.`,
      start: t.start,
      end: t.end,
      suggestion: VALUE_START.has(t.kind)
        ? `Did you forget an operator between '${prevText}' and '${t.text}'? For example ${prevText}+${t.text}.`
        : `Remove '${t.text}'.`,
      fix: VALUE_START.has(t.kind) && prev ? this.edit(prev.end, t.start, '+') : undefined,
    });
  }
}

/** Semantic checks after a successful parse: known functions and argument counts. */
function validate(ast: Node, raw: string): Diagnostic | undefined {
  let found: Diagnostic | undefined;
  walk(ast, (n) => {
    if (found || n.type !== 'call') return;
    const def = getFunction(n.name);
    if (!def) {
      const near = closestName(n.name, FUNCTION_NAMES);
      found = {
        code: '#NAME?',
        message: `Unknown function '${n.name}'.`,
        start: n.start,
        end: n.nameEnd,
        suggestion: near ? `Did you mean ${near}?` : 'Open the function list (ƒ) to see supported functions.',
        fix: near ? raw.slice(0, n.start) + near + raw.slice(n.nameEnd) : undefined,
      };
      return;
    }
    if (n.args.length < def.min || n.args.length > def.max) {
      found = {
        code: '#ERROR!',
        message: `${def.name} expects ${describeArity(def)}, but got ${n.args.length}.`,
        start: n.start,
        end: n.end,
        suggestion: `Usage: ${def.signature}`,
      };
    }
  });
  return found;
}

function parseOnce(raw: string): ParseResult {
  const lex = tokenize(raw, 1);
  if (lex.diagnostic) return { tokens: lex.tokens, diagnostic: lex.diagnostic };
  const { tokens } = lex;
  if (tokens[0].kind === 'eof') {
    return {
      tokens,
      diagnostic: {
        code: '#ERROR!',
        message: 'The formula is empty.',
        start: raw.length,
        end: raw.length,
        suggestion: 'Type an expression after "=", for example =SUM(A1:A10).',
      },
    };
  }
  const parser = new Parser(raw, tokens);
  try {
    const ast = parser.parseExpr(0);
    const t = parser.peek();
    if (t.kind !== 'eof') parser.trailing(t);
    const diagnostic = validate(ast, raw);
    return diagnostic ? { tokens, diagnostic } : { tokens, ast };
  } catch (e) {
    if (e instanceof ParseFailure) return { tokens, diagnostic: e.diagnostic };
    throw e;
  }
}

/**
 * Parses a formula (text starting with '=') into an AST, or returns a diagnostic.
 * Suggested fixes are verified: a fix is only offered if the corrected formula parses,
 * possibly after chaining a few fixes (e.g. remove a trailing '+', then add a ')').
 */
export function parseFormula(raw: string): ParseResult {
  const result = parseOnce(raw);
  const d = result.diagnostic;
  if (!d?.fix) return result;
  let fix: string | undefined = d.fix;
  for (let i = 0; i < 4 && fix !== undefined; i++) {
    const next = parseOnce(fix);
    if (!next.diagnostic) return { ...result, diagnostic: { ...d, fix } };
    fix = next.diagnostic.fix;
  }
  return { ...result, diagnostic: { ...d, fix: undefined } };
}

const RUNTIME_ADVICE: Partial<Record<ErrorCode, { suggestion: string; fallback?: string }>> = {
  '#DIV/0!': {
    suggestion: 'The highlighted divisor is 0 or an empty cell. Change it, or wrap the formula in IFERROR to show 0 instead.',
    fallback: '0',
  },
  '#N/A': {
    suggestion: 'The lookup value is not in the first column of the range. Check its spelling, or wrap the formula in IFERROR to show a message instead.',
    fallback: '"Not found"',
  },
  '#VALUE!': { suggestion: 'The highlighted part needs a number but got text. Point it at a number, or convert the text with VALUE().' },
  '#NUM!': { suggestion: 'The inputs to the highlighted part give a result that is not a valid number. Check them.' },
  '#CIRC!': { suggestion: 'Change one cell in the loop so it no longer refers back, for example by typing a value instead of the reference.' },
};

/**
 * Advice for a formula that parsed but evaluated to an error. Where the usual remedy is a fallback value,
 * the fix wraps the formula in IFERROR, and like every fix it is only offered if it parses.
 */
export function explainRuntimeError(code: ErrorCode, formula: string): Pick<Diagnostic, 'suggestion' | 'fix'> {
  const advice = RUNTIME_ADVICE[code];
  if (!advice) return {};
  const body = formula.slice(1).trim();
  const fix = advice.fallback && !/^IFERROR\(/i.test(body) ? `=IFERROR(${body}, ${advice.fallback})` : undefined;
  return { suggestion: advice.suggestion, fix: fix && !parseOnce(fix).diagnostic ? fix : undefined };
}
