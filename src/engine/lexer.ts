import type { Diagnostic } from './diagnostics';
import { ERROR_CODES } from './values';

type TokenKind =
  | 'number'
  | 'string'
  | 'bool'
  | 'cell'
  | 'ident'
  | 'error'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'colon'
  | 'eof';

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
}

interface LexResult {
  /** Always ends with an 'eof' token. On error, contains the tokens read before the problem. */
  tokens: Token[];
  diagnostic?: Diagnostic;
}

const NUM_RE = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const WORD_RE = /[A-Za-z0-9_.$]+/y;
const CELL_RE = /^\$?[A-Za-z]{1,3}\$?\d+$/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const SINGLE_OPS = '+-*/^&%=<>';
const DOUBLE_OPS = new Set(['<=', '>=', '<>']);

/** Operator typos we recognise, with the operator the user almost certainly meant. */
const OPERATOR_TYPOS: Record<string, { use: string; why: string }> = {
  '==': { use: '=', why: "Use a single '=' to compare two values." },
  '!=': { use: '<>', why: "Use '<>' for 'not equal to'." },
  '=>': { use: '>=', why: "Use '>=' for 'greater than or equal to'." },
  '=<': { use: '<=', why: "Use '<=' for 'less than or equal to'." },
  '**': { use: '^', why: "Use '^' for exponentiation." },
  '&&': { use: '', why: 'Use the AND(a, b) function to combine conditions.' },
  '||': { use: '', why: 'Use the OR(a, b) function to combine conditions.' },
};

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';

/**
 * Splits formula text into tokens. `start` is where to begin (1 skips the leading '=').
 * Every token keeps its exact source position so errors can point at it and so
 * reference-shifting can rewrite a formula without disturbing its formatting.
 */
export function tokenize(src: string, start = 0): LexResult {
  const tokens: Token[] = [];
  const n = src.length;
  let i = start;

  const push = (kind: TokenKind, s: number, e: number) => {
    tokens.push({ kind, text: src.slice(s, e), start: s, end: e });
  };
  const fail = (d: Omit<Diagnostic, 'code'> & { code?: Diagnostic['code'] }): LexResult => {
    tokens.push({ kind: 'eof', text: '', start: n, end: n });
    return { tokens, diagnostic: { code: '#ERROR!', ...d } };
  };
  const without = (s: number, e: number, insert = '') => src.slice(0, s) + insert + src.slice(e);

  while (i < n) {
    const ch = src[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Numbers: 12, 3.5, .5, 1e-3
    if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1]))) {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(src)!;
      const e = i + m[0].length;
      if (src[e] === '.') {
        let j = e;
        while (j < n && (isDigit(src[j]) || src[j] === '.')) j++;
        return fail({
          message: `'${src.slice(i, j)}' is not a valid number.`,
          start: i,
          end: j,
          suggestion: 'A number can contain at most one decimal point.',
        });
      }
      push('number', i, e);
      i = e;
      continue;
    }

    // Strings: "text" with "" as an escaped quote
    if (ch === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= n) {
          return fail({
            message: 'Unterminated text string.',
            start: i,
            end: n,
            suggestion: 'Add a closing " to end the text.',
            fix: src + '"',
          });
        }
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      push('string', i, j);
      i = j;
      continue;
    }

    if (ch === '“' || ch === '”') {
      return fail({
        message: 'Curly quotes are not valid in formulas.',
        start: i,
        end: i + 1,
        suggestion: 'Use straight double quotes (") around text.',
        fix: src.replace(/[“”]/g, '"'),
      });
    }

    // Error literals: #N/A, #DIV/0!, ...
    if (ch === '#') {
      const lit = ERROR_CODES.find((c) => src.substr(i, c.length).toUpperCase() === c);
      if (lit) {
        push('error', i, i + lit.length);
        i += lit.length;
        continue;
      }
      return fail({
        message: "Unknown error value after '#'.",
        start: i,
        end: i + 1,
        suggestion: `Valid error values are ${ERROR_CODES.join(', ')}.`,
      });
    }

    // Words: cell references, TRUE/FALSE, function names
    if (/[A-Za-z_$]/.test(ch)) {
      WORD_RE.lastIndex = i;
      const word = WORD_RE.exec(src)![0];
      const e = i + word.length;
      let k = e;
      while (src[k] === ' ') k++;
      const isCall = src[k] === '(';
      if (src[e] === '!' && src[e + 1] !== '=') {
        return fail({
          code: '#REF!',
          message: `Cross-sheet references like '${word}!…' are not supported.`,
          start: i,
          end: e + 1,
          suggestion: 'This workbook has a single sheet; refer to cells directly, e.g. A1.',
        });
      }
      if (!isCall && CELL_RE.test(word)) push('cell', i, e);
      else if (!isCall && /^(TRUE|FALSE)$/i.test(word)) push('bool', i, e);
      else if (IDENT_RE.test(word)) push('ident', i, e);
      else {
        return fail({
          code: '#REF!',
          message: `'${word}' is not a valid cell reference.`,
          start: i,
          end: e,
          suggestion: 'References look like A1, $A$1, A$1 or $A1.',
        });
      }
      i = e;
      continue;
    }

    const two = src.substr(i, 2);
    if (DOUBLE_OPS.has(two)) {
      push('op', i, i + 2);
      i += 2;
      continue;
    }
    const typo = OPERATOR_TYPOS[two];
    if (typo) {
      return fail({
        message: `'${two}' is not a valid operator.`,
        start: i,
        end: i + 2,
        suggestion: typo.why,
        fix: typo.use ? without(i, i + 2, typo.use) : undefined,
      });
    }

    if (SINGLE_OPS.includes(ch)) push('op', i, i + 1);
    else if (ch === '(') push('lparen', i, i + 1);
    else if (ch === ')') push('rparen', i, i + 1);
    else if (ch === ',') push('comma', i, i + 1);
    else if (ch === ':') push('colon', i, i + 1);
    else if (ch === ';') {
      return fail({
        message: "Unexpected ';'.",
        start: i,
        end: i + 1,
        suggestion: "Use ',' to separate function arguments.",
        fix: without(i, i + 1, ','),
      });
    } else if (ch === '{' || ch === '}') {
      return fail({
        message: 'Array constants ({…}) are not supported.',
        start: i,
        end: i + 1,
        suggestion: 'Put the values in cells and refer to them with a range such as A1:A5.',
      });
    } else if (ch === "'") {
      return fail({
        message: "Single quotes can't be used for text in formulas.",
        start: i,
        end: i + 1,
        suggestion: 'Wrap text in double quotes, e.g. "hello".',
      });
    } else {
      return fail({
        message: `Unexpected character '${ch}'.`,
        start: i,
        end: i + 1,
        suggestion: `Remove '${ch}'.`,
        fix: without(i, i + 1),
      });
    }
    i++;
  }

  tokens.push({ kind: 'eof', text: '', start: n, end: n });
  return { tokens };
}
