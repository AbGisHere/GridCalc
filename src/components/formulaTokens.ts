import { inBounds, normalizeRange, parseA1, type RangeBounds } from '@/engine/address';
import { FUNCTIONS, getFunction, type FnDef } from '@/engine/functions';
import { tokenize, type Token } from '@/engine/lexer';

/** Colours shared by the formula bar and the grid so each reference is visibly linked to its cells; `--ref-0`…`--ref-7` are set per theme. */
const REF_COLORS = 8;

export interface RefMark {
  start: number;
  end: number;
  range: RangeBounds;
  color: string;
}

type SegmentKind = 'ref' | 'fn' | 'string' | 'number' | 'bool' | 'error' | 'op' | 'paren' | 'plain';

interface Segment {
  text: string;
  kind: SegmentKind;
  color?: string;
}

/** Every cell/range reference in a (possibly incomplete) formula, coloured by distinct target. */
export function formulaRefs(text: string): RefMark[] {
  if (!text.startsWith('=')) return [];
  const { tokens } = tokenize(text, 1);
  const marks: RefMark[] = [];
  const colorOf = new Map<string, string>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'cell') continue;
    const a = parseA1(t.text);
    if (!a || !inBounds(a.row, a.col)) continue;
    let end = t.end;
    let b = a;
    if (tokens[i + 1]?.kind === 'colon' && tokens[i + 2]?.kind === 'cell') {
      const p = parseA1(tokens[i + 2].text);
      if (p && inBounds(p.row, p.col)) {
        b = p;
        end = tokens[i + 2].end;
        i += 2;
      }
    }
    const range = normalizeRange(a, b);
    const id = `${range.r1},${range.c1},${range.r2},${range.c2}`;
    if (!colorOf.has(id)) colorOf.set(id, `var(--ref-${colorOf.size % REF_COLORS})`);
    marks.push({ start: t.start, end, range, color: colorOf.get(id)! });
  }
  return marks;
}

/** Splits formula text into coloured segments for the formula-bar overlay. */
export function highlightSegments(text: string): Segment[] {
  if (!text.startsWith('=')) return [{ text, kind: 'plain' }];
  const { tokens } = tokenize(text, 1);
  const refs = formulaRefs(text);
  const segs: Segment[] = [{ text: '=', kind: 'op' }];
  let last = 1;
  const kindOf = (t: Token): SegmentKind => {
    switch (t.kind) {
      case 'ident':
        return 'fn';
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'bool':
        return 'bool';
      case 'error':
        return 'error';
      case 'lparen':
      case 'rparen':
        return 'paren';
      case 'op':
      case 'comma':
      case 'colon':
        return 'op';
      default:
        return 'plain';
    }
  };
  const refAt = new Map(refs.map((r) => [r.start, r]));
  for (const t of tokens) {
    if (t.kind === 'eof' || t.start < last) continue;
    if (t.start > last) segs.push({ text: text.slice(last, t.start), kind: 'plain' });
    const ref = refAt.get(t.start);
    if (ref) {
      segs.push({ text: text.slice(ref.start, ref.end), kind: 'ref', color: ref.color });
      last = ref.end;
    } else {
      segs.push({ text: t.text, kind: kindOf(t) });
      last = t.end;
    }
  }
  if (last < text.length) segs.push({ text: text.slice(last), kind: 'plain' });
  return segs;
}

export interface AssistInfo {
  /** Identifier being typed at the caret, for autocomplete. */
  prefix?: { start: number; text: string };
  suggestions: FnDef[];
  /** Innermost function call around the caret, for the signature hint. */
  call?: { def: FnDef; argIndex: number };
}

export function assistAt(text: string, caret: number): AssistInfo {
  if (!text.startsWith('=')) return { suggestions: [] };
  const before = text.slice(0, caret);
  const { tokens } = tokenize(before, 1);
  const real = tokens.filter((t) => t.kind !== 'eof');

  let prefix: AssistInfo['prefix'];
  const last = real[real.length - 1];
  if (last && last.end === caret && (last.kind === 'ident' || last.kind === 'bool' || (last.kind === 'cell' && /^[A-Za-z]+\d*$/.test(last.text)))) {
    prefix = { start: last.start, text: last.text };
  }
  const suggestions = prefix
    ? FUNCTIONS.filter((f) => f.name.startsWith(prefix!.text.toUpperCase()) && f.name !== prefix!.text.toUpperCase()).slice(0, 8)
    : [];

  const stack: { name?: string; arg: number }[] = [];
  for (let i = 0; i < real.length; i++) {
    const t = real[i];
    if (t.kind === 'lparen') {
      const prev = real[i - 1];
      stack.push({ name: prev?.kind === 'ident' ? prev.text.toUpperCase() : undefined, arg: 0 });
    } else if (t.kind === 'rparen') stack.pop();
    else if (t.kind === 'comma' && stack.length) stack[stack.length - 1].arg++;
  }
  let call: AssistInfo['call'];
  for (let i = stack.length - 1; i >= 0; i--) {
    const def = stack[i].name ? getFunction(stack[i].name!) : undefined;
    if (def) {
      call = { def, argIndex: stack[i].arg };
      break;
    }
  }
  return { prefix, suggestions, call };
}

/** Parameter names from a signature such as "VLOOKUP(lookup_value, table, ...)". */
export function signatureParams(signature: string): string[] {
  const inner = signature.slice(signature.indexOf('(') + 1, signature.lastIndexOf(')'));
  return inner ? inner.split(/,\s*/) : [];
}

/** Index of the parameter to highlight, accounting for trailing "..." repetition. */
export function activeParam(params: string[], argIndex: number): number {
  if (argIndex < params.length && params[argIndex] !== '...') return argIndex;
  const dots = params.indexOf('...');
  return dots > 0 ? dots - 1 : params.length - 1;
}

/** True when a click on the grid should insert a reference at the caret (after =, (, , or an operator). */
export function canInsertRef(text: string, caret: number): boolean {
  if (!text.startsWith('=')) return false;
  const before = text.slice(0, caret).trimEnd();
  return /[=(,+\-*/^&<>:]$/.test(before);
}
