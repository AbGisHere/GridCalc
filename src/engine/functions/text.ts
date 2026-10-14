import { toNumber, toText } from '../coerce';
import { CellError, isRange, type Value } from '../values';
import { fail, int, num, str, wildcardRegex } from './helpers';
import type { FnContext, FnDef } from './types';

/** Concatenate every value, flattening ranges. */
function joinAll(args: Value[], sep: string, skipEmpty: boolean): string {
  const parts: string[] = [];
  const add = (v: Value) => {
    if (v instanceof CellError) throw v;
    const t = toText(v as never) as string;
    if (!(skipEmpty && t === '')) parts.push(t);
  };
  for (const a of args) {
    if (isRange(a)) for (const row of a.data) for (const v of row) add(v);
    else add(a);
  }
  return parts.join(sep);
}

const textFn = (name: string, description: string, fn: (s: string) => string | number, example: string): FnDef => ({
  name,
  category: 'Text',
  signature: `${name}(text)`,
  description,
  example,
  min: 1,
  max: 1,
  call: (a, ctx) => fn(str(a, 0, ctx)),
});

function nonNegative(n: number, ctx: FnContext, what: string): number {
  if (n < 0) fail('#VALUE!', `${ctx.name}: ${what} cannot be negative (got ${n}).`);
  return n;
}

/** Minimal TEXT() formatter: 0, 0.00, #,##0.00, 0%, with literal prefix/suffix such as "$". */
function formatText(value: number, format: string): string | undefined {
  const m = /^([^0#.,%]*)([0#,]*)(?:\.([0#]+))?(%?)([^0#.,%]*)$/.exec(format);
  if (!m || (!m[2] && !m[3])) return undefined;
  const [, prefix, intPart, decPart = '', pct, suffix] = m;
  const decimals = decPart.length;
  const n = pct ? value * 100 : value;
  let s = Math.abs(n).toFixed(decimals);
  if (intPart.includes(',')) {
    const [i, d] = s.split('.');
    s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
  }
  const minInt = (intPart.match(/0/g) ?? []).length;
  if (minInt === 0 && s.startsWith('0.')) s = s.slice(1);
  return (n < 0 ? '-' : '') + prefix + s + pct + suffix;
}

export const textFunctions: FnDef[] = [
  {
    name: 'CONCAT',
    category: 'Text',
    signature: 'CONCAT(text1, [text2], ...)',
    description: 'Joins text from values and ranges.',
    example: '=CONCAT(A1, " ", B1)',
    min: 1,
    max: Infinity,
    ranges: 'all',
    call: (a) => joinAll(a, '', false),
  },
  {
    name: 'CONCATENATE',
    category: 'Text',
    signature: 'CONCATENATE(text1, [text2], ...)',
    description: 'Joins single values together (same as the & operator).',
    example: '=CONCATENATE("Q", 3)',
    min: 1,
    max: Infinity,
    call: (a, ctx) => a.map((_, i) => str(a, i, ctx)).join(''),
  },
  {
    name: 'TEXTJOIN',
    category: 'Text',
    signature: 'TEXTJOIN(delimiter, ignore_empty, text1, [text2], ...)',
    description: 'Joins values and ranges with a delimiter, optionally skipping empty values.',
    example: '=TEXTJOIN(", ", TRUE, A1:A5)',
    min: 3,
    max: Infinity,
    ranges: 'all',
    call: (a, ctx) => {
      const sep = str(a, 0, ctx);
      const skip = num(a, 1, ctx) !== 0;
      return joinAll(a.slice(2), sep, skip);
    },
  },
  textFn('LEN', 'Number of characters in the text.', (s) => s.length, '=LEN("hello")'),
  textFn('UPPER', 'Converts text to upper case.', (s) => s.toUpperCase(), '=UPPER("abc")'),
  textFn('LOWER', 'Converts text to lower case.', (s) => s.toLowerCase(), '=LOWER("ABC")'),
  textFn(
    'PROPER',
    'Capitalises the first letter of every word.',
    (s) => s.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()),
    '=PROPER("grace hopper")',
  ),
  textFn('TRIM', 'Removes leading/trailing spaces and collapses internal runs of spaces.', (s) => s.trim().replace(/ {2,}/g, ' '), '=TRIM("  a   b ")'),
  {
    name: 'LEFT',
    category: 'Text',
    signature: 'LEFT(text, [num_chars])',
    description: 'First characters of the text (default 1).',
    example: '=LEFT("Spreadsheet", 6)',
    min: 1,
    max: 2,
    call: (a, ctx) => str(a, 0, ctx).slice(0, nonNegative(int(a, 1, ctx, 1), ctx, 'num_chars')),
  },
  {
    name: 'RIGHT',
    category: 'Text',
    signature: 'RIGHT(text, [num_chars])',
    description: 'Last characters of the text (default 1).',
    example: '=RIGHT("Spreadsheet", 5)',
    min: 1,
    max: 2,
    call: (a, ctx) => {
      const s = str(a, 0, ctx);
      const n = nonNegative(int(a, 1, ctx, 1), ctx, 'num_chars');
      return n === 0 ? '' : s.slice(-n);
    },
  },
  {
    name: 'MID',
    category: 'Text',
    signature: 'MID(text, start, num_chars)',
    description: 'Characters from the middle of the text, starting at a 1-based position.',
    example: '=MID("Spreadsheet", 7, 5)',
    min: 3,
    max: 3,
    call: (a, ctx) => {
      const s = str(a, 0, ctx);
      const start = int(a, 1, ctx);
      if (start < 1) throw new CellError('#VALUE!', `MID: start must be at least 1 (got ${start}).`, ctx.argSpan(1));
      return s.substr(start - 1, nonNegative(int(a, 2, ctx), ctx, 'num_chars'));
    },
  },
  {
    name: 'FIND',
    category: 'Text',
    signature: 'FIND(find_text, within_text, [start])',
    description: '1-based position of find_text in within_text (case-sensitive).',
    example: '=FIND("a", "banana")',
    min: 2,
    max: 3,
    call: (a, ctx) => {
      const needle = str(a, 0, ctx);
      const hay = str(a, 1, ctx);
      const start = int(a, 2, ctx, 1);
      if (start < 1 || start > hay.length + 1) fail('#VALUE!', `FIND: start must be between 1 and ${hay.length + 1}.`);
      const i = hay.indexOf(needle, start - 1);
      if (i < 0) fail('#VALUE!', `FIND: "${needle}" was not found in "${hay}".`);
      return i + 1;
    },
  },
  {
    name: 'SEARCH',
    category: 'Text',
    signature: 'SEARCH(find_text, within_text, [start])',
    description: 'Like FIND, but case-insensitive and supports * and ? wildcards.',
    example: '=SEARCH("n?n", "Banana")',
    min: 2,
    max: 3,
    call: (a, ctx) => {
      const needle = str(a, 0, ctx);
      const hay = str(a, 1, ctx);
      const start = int(a, 2, ctx, 1);
      if (start < 1 || start > hay.length + 1) fail('#VALUE!', `SEARCH: start must be between 1 and ${hay.length + 1}.`);
      const re = new RegExp(wildcardRegex(needle).source.slice(1, -1), 'is');
      const m = re.exec(hay.slice(start - 1));
      if (!m) fail('#VALUE!', `SEARCH: "${needle}" was not found in "${hay}".`);
      return m.index + start;
    },
  },
  {
    name: 'SUBSTITUTE',
    category: 'Text',
    signature: 'SUBSTITUTE(text, old_text, new_text, [instance])',
    description: 'Replaces occurrences of old_text (all, or only the n-th instance).',
    example: '=SUBSTITUTE("a-b-c", "-", "+")',
    min: 3,
    max: 4,
    call: (a, ctx) => {
      const s = str(a, 0, ctx);
      const from = str(a, 1, ctx);
      const to = str(a, 2, ctx);
      if (from === '') return s;
      if (a[3] === undefined) return s.split(from).join(to);
      const nth = int(a, 3, ctx);
      if (nth < 1) fail('#VALUE!', 'SUBSTITUTE: instance must be at least 1.');
      let idx = -1;
      for (let k = 0; k < nth; k++) {
        idx = s.indexOf(from, idx + 1);
        if (idx < 0) return s;
      }
      return s.slice(0, idx) + to + s.slice(idx + from.length);
    },
  },
  {
    name: 'REPLACE',
    category: 'Text',
    signature: 'REPLACE(old_text, start, num_chars, new_text)',
    description: 'Replaces num_chars characters starting at a 1-based position.',
    example: '=REPLACE("2024-01", 1, 4, "2025")',
    min: 4,
    max: 4,
    call: (a, ctx) => {
      const s = str(a, 0, ctx);
      const start = int(a, 1, ctx);
      if (start < 1) fail('#VALUE!', 'REPLACE: start must be at least 1.');
      const n = nonNegative(int(a, 2, ctx), ctx, 'num_chars');
      return s.slice(0, start - 1) + str(a, 3, ctx) + s.slice(start - 1 + n);
    },
  },
  {
    name: 'REPT',
    category: 'Text',
    signature: 'REPT(text, times)',
    description: 'Repeats text a number of times.',
    example: '=REPT("★", 3)',
    min: 2,
    max: 2,
    call: (a, ctx) => {
      const n = nonNegative(int(a, 1, ctx), ctx, 'times');
      const s = str(a, 0, ctx);
      if (s.length * n > 32767) fail('#VALUE!', 'REPT: the result would be longer than 32,767 characters.');
      return s.repeat(n);
    },
  },
  {
    name: 'VALUE',
    category: 'Text',
    signature: 'VALUE(text)',
    description: 'Converts text that looks like a number into a number.',
    example: '=VALUE("42.5")',
    min: 1,
    max: 1,
    call: (a, ctx) => {
      const s = str(a, 0, ctx);
      const n = toNumber(s);
      if (n instanceof CellError) fail('#VALUE!', `VALUE: "${s}" is not a number.`);
      return n;
    },
  },
  {
    name: 'TEXT',
    category: 'Text',
    signature: 'TEXT(value, format)',
    description: 'Formats a number as text. Supports 0, 0.00, #,##0, 0% and literal prefixes/suffixes like "$".',
    example: '=TEXT(1234.5, "$#,##0.00")',
    min: 2,
    max: 2,
    call: (a, ctx) => {
      const fmt = str(a, 1, ctx);
      const n = num(a, 0, ctx);
      return formatText(n, fmt) ?? str(a, 0, ctx);
    },
  },
  {
    name: 'EXACT',
    category: 'Text',
    signature: 'EXACT(text1, text2)',
    description: 'TRUE if two texts are identical (case-sensitive).',
    example: '=EXACT("abc", "ABC")',
    min: 2,
    max: 2,
    call: (a, ctx) => str(a, 0, ctx) === str(a, 1, ctx),
  },
  {
    name: 'CHAR',
    category: 'Text',
    signature: 'CHAR(number)',
    description: 'Character for a character code (1–65535).',
    example: '=CHAR(65)',
    min: 1,
    max: 1,
    call: (a, ctx) => {
      const n = int(a, 0, ctx);
      if (n < 1 || n > 65535) fail('#VALUE!', `CHAR: code must be between 1 and 65535 (got ${n}).`);
      return String.fromCharCode(n);
    },
  },
  {
    name: 'CODE',
    category: 'Text',
    signature: 'CODE(text)',
    description: 'Character code of the first character.',
    example: '=CODE("A")',
    min: 1,
    max: 1,
    call: (a, ctx) => {
      const s = str(a, 0, ctx);
      if (!s) fail('#VALUE!', 'CODE: the text is empty.');
      return s.charCodeAt(0);
    },
  },
];
