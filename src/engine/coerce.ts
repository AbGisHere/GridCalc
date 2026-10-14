import { CellError, NUMBER_RE, formatNumber, type Scalar } from './values';

const PERCENT_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)%$/;

/** Number coercion used by arithmetic. Empty -> 0, TRUE -> 1, numeric text -> number. */
export function toNumber(v: Scalar): number | CellError {
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof CellError) return v;
  const t = v.trim();
  if (NUMBER_RE.test(t)) return Number(t);
  if (PERCENT_RE.test(t)) return Number(t.slice(0, -1)) / 100;
  return new CellError('#VALUE!', `Expected a number but got the text "${v}".`);
}

export function toText(v: Scalar): string | CellError {
  if (v === null) return '';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v;
}

export function toBool(v: Scalar): boolean | CellError {
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v instanceof CellError) return v;
  const u = v.trim().toUpperCase();
  if (u === 'TRUE') return true;
  if (u === 'FALSE') return false;
  return new CellError('#VALUE!', `Expected TRUE/FALSE but got the text "${v}".`);
}

/** Compare numbers at 15 significant digits, like spreadsheets do. */
const norm = (n: number): number => Number(n.toPrecision(15));

const typeRank = (v: Exclude<Scalar, null | CellError>): number =>
  typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;

/**
 * Total ordering used by comparison operators and sorting lookups.
 * Numbers < text < booleans; text is case-insensitive; an empty cell
 * behaves like 0, "" or FALSE depending on what it is compared to.
 */
export function compareScalars(a: Exclude<Scalar, CellError>, b: Exclude<Scalar, CellError>): number {
  const blankLike = (other: Exclude<Scalar, CellError>) =>
    typeof other === 'string' ? '' : typeof other === 'boolean' ? false : 0;
  if (a === null && b === null) return 0;
  const x = a === null ? blankLike(b) : a;
  const y = b === null ? blankLike(a) : b;
  if (x === null || y === null) return 0;
  const rx = typeRank(x);
  const ry = typeRank(y);
  if (rx !== ry) return rx - ry;
  if (typeof x === 'number' && typeof y === 'number') {
    const d = norm(x) - norm(y);
    return d < 0 ? -1 : d > 0 ? 1 : 0;
  }
  if (typeof x === 'string' && typeof y === 'string') {
    const lx = x.toLowerCase();
    const ly = y.toLowerCase();
    return lx < ly ? -1 : lx > ly ? 1 : 0;
  }
  return Number(x) - Number(y);
}

/** Parses what a user typed into a non-formula cell. */
export function parseLiteral(raw: string): Scalar {
  if (raw === '') return null;
  if (raw.startsWith("'")) return raw.slice(1); // leading apostrophe forces text
  const t = raw.trim();
  if (NUMBER_RE.test(t)) return Number(t);
  if (PERCENT_RE.test(t)) return Number(t.slice(0, -1)) / 100;
  const u = t.toUpperCase();
  if (u === 'TRUE') return true;
  if (u === 'FALSE') return false;
  return raw;
}
