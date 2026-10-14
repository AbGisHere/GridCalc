import { cellKey, colToLetters, inBounds, normalizeRange, parseA1, type RangeBounds } from './address';
import { walk, type Node } from './ast';
import { getFunction } from './functions';
import { tokenize } from './lexer';

interface References {
  /** Keys of individually referenced cells. */
  cells: number[];
  /** Multi-cell ranges, kept as rectangles so A1:A100000 costs one entry, not 100,000. */
  ranges: RangeBounds[];
  /** Contains RAND()/RANDBETWEEN(). */
  volatile: boolean;
}

/** Static analysis of a formula: which cells it reads. */
export function collectReferences(ast: Node): References {
  const cells = new Set<number>();
  const ranges = new Map<string, RangeBounds>();
  let volatile = false;
  walk(ast, (n) => {
    if (n.type === 'cell') cells.add(cellKey(n.ref.row, n.ref.col));
    else if (n.type === 'range') {
      const b = normalizeRange(n.from, n.to);
      if (b.r1 === b.r2 && b.c1 === b.c2) cells.add(cellKey(b.r1, b.c1));
      else ranges.set(`${b.r1},${b.c1},${b.r2},${b.c2}`, b);
    } else if (n.type === 'call' && getFunction(n.name)?.volatile) volatile = true;
  });
  return { cells: [...cells], ranges: [...ranges.values()], volatile };
}

/**
 * Rewrites relative references in a formula as if it were moved by (dRow, dCol), for
 * drag-to-fill and paste. `$`-anchored parts stay fixed; references pushed off the sheet
 * become #REF!. Works on tokens, so spacing and casing of the rest of the formula survive.
 */
export function shiftFormula(raw: string, dRow: number, dCol: number): string {
  if (!raw.startsWith('=') || (dRow === 0 && dCol === 0)) return raw;
  const { tokens } = tokenize(raw, 1);

  const shift = (text: string): string | null => {
    const ref = parseA1(text);
    if (!ref) return null;
    const row = ref.absRow ? ref.row : ref.row + dRow;
    const col = ref.absCol ? ref.col : ref.col + dCol;
    if (!inBounds(row, col)) return null;
    return (ref.absCol ? '$' : '') + colToLetters(col) + (ref.absRow ? '$' : '') + (row + 1);
  };

  let out = '';
  let last = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'cell') continue;
    if (tokens[i + 1]?.kind === 'colon' && tokens[i + 2]?.kind === 'cell') {
      const end = tokens[i + 2];
      const a = shift(t.text);
      const b = shift(end.text);
      out += raw.slice(last, t.start) + (a && b ? `${a}:${b}` : '#REF!');
      last = end.end;
      i += 2;
      continue;
    }
    out += raw.slice(last, t.start) + (shift(t.text) ?? '#REF!');
    last = t.end;
  }
  return out + raw.slice(last);
}

/**
 * Canonical spelling for a committed formula: function names, references and
 * TRUE/FALSE upper-cased, everything else (strings, spacing) left alone.
 */
export function normalizeFormula(raw: string): string {
  if (!raw.startsWith('=')) return raw;
  const { tokens, diagnostic } = tokenize(raw, 1);
  if (diagnostic) return raw;
  let out = '';
  let last = 0;
  for (const t of tokens) {
    if (t.kind === 'cell' || t.kind === 'ident' || t.kind === 'bool' || t.kind === 'error') {
      out += raw.slice(last, t.start) + t.text.toUpperCase();
      last = t.end;
    }
  }
  return out + raw.slice(last);
}
