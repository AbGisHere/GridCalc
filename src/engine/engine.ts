import { cellKey, inBounds, keyCol, keyRow, keyToA1, parseA1, SHEET_COLS, SHEET_ROWS, type RangeBounds } from './address';
import type { Node } from './ast';
import { parseLiteral } from './coerce';
import type { Diagnostic } from './diagnostics';
import { evaluateFormula, findReferenceSpan } from './evaluator';
import { RangeIndex, stronglyConnectedComponents, type RangeEntry } from './graph';
import { parseFormula } from './parser';
import { collectReferences } from './references';
import { CellError, type Scalar } from './values';

export interface CellEdit {
  row: number;
  col: number;
  raw: string;
}

interface CellRecord {
  /** Exactly what the user typed. */
  raw: string;
  /** Current value (formula result, literal, or error). */
  value: Scalar;
  /** Parsed formula, if the cell holds a valid one. */
  ast?: Node;
  /** Why the formula couldn't be parsed, if it couldn't. */
  diagnostic?: Diagnostic;
}

export interface RecalcStats {
  /** Cells whose input actually changed. */
  edited: number;
  /** Formula cells re-evaluated (only the changed cells' transitive dependents). */
  evaluated: number;
  ms: number;
}

/**
 * The calculation engine: cell storage, a dependency graph, and incremental recalculation.
 *
 * The graph is kept in the "dependents" direction (cell -> formulas that read it):
 *  - single-cell references live in `dependents`
 *  - range references live in a spatial `RangeIndex`, so a formula reading A1:A100000
 *    is one entry rather than 100,000 edges.
 *
 * On every edit, only the transitive dependents of the edited cells are re-evaluated,
 * in topological order computed with Tarjan's SCC algorithm; any SCC with a cycle is
 * marked #CIRC! with an explanation instead of looping.
 */
export class SpreadsheetEngine {
  readonly rows = SHEET_ROWS;
  readonly cols = SHEET_COLS;

  private cells = new Map<number, CellRecord>();
  private dependents = new Map<number, Set<number>>();
  private precedentCells = new Map<number, number[]>();
  private precedentRanges = new Map<number, RangeEntry[]>();
  private rangeIndex = new RangeIndex();
  private volatileCells = new Set<number>();
  private listeners = new Set<() => void>();

  /** Bumped on every change; handy as a React external-store snapshot. */
  version = 0;
  lastStats: RecalcStats | null = null;
  /**
   * The cells the last edit recalculated downstream of it, each with its depth in the dependency chain
   * (1 = reads an edited cell directly). The grid plays it back as a wave; loads and F9 leave it empty.
   */
  lastWave: ReadonlyMap<number, number> = new Map();

  // ---------------------------------------------------------------- reading

  getRecord(row: number, col: number): CellRecord | undefined {
    return this.cells.get(cellKey(row, col));
  }

  getRaw(row: number, col: number): string {
    return this.cells.get(cellKey(row, col))?.raw ?? '';
  }

  getValue(row: number, col: number): Scalar {
    return this.cells.get(cellKey(row, col))?.value ?? null;
  }

  get cellCount(): number {
    return this.cells.size;
  }

  get formulaCount(): number {
    let n = 0;
    for (const r of this.cells.values()) if (r.raw.startsWith('=')) n++;
    return n;
  }

  /** Visit non-empty cells inside a range without scanning empty space. */
  forEachInRange(b: RangeBounds, fn: (row: number, col: number, rec: CellRecord) => void): void {
    const area = (b.r2 - b.r1 + 1) * (b.c2 - b.c1 + 1);
    if (area > this.cells.size) {
      for (const [k, rec] of this.cells) {
        const r = keyRow(k);
        const c = keyCol(k);
        if (r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2) fn(r, c, rec);
      }
      return;
    }
    for (let r = b.r1; r <= b.r2; r++) {
      for (let c = b.c1; c <= b.c2; c++) {
        const rec = this.cells.get(cellKey(r, c));
        if (rec) fn(r, c, rec);
      }
    }
  }

  /** Bounding box of all non-empty cells, or null if the sheet is empty. */
  usedBounds(): RangeBounds | null {
    if (!this.cells.size) return null;
    let r2 = 0;
    let c2 = 0;
    for (const k of this.cells.keys()) {
      r2 = Math.max(r2, keyRow(k));
      c2 = Math.max(c2, keyCol(k));
    }
    return { r1: 0, c1: 0, r2, c2 };
  }

  /** Formula cells that directly read this cell (via a reference or a range). */
  directDependents(row: number, col: number): number[] {
    const out = new Set<number>();
    this.forEachDependent(cellKey(row, col), (d) => out.add(d));
    return [...out];
  }

  // ---------------------------------------------------------------- writing

  setCell(row: number, col: number, raw: string): RecalcStats {
    return this.setCells([{ row, col, raw }]);
  }

  /** Applies a batch of edits, then recalculates everything they affect exactly once. */
  setCells(edits: readonly CellEdit[]): RecalcStats {
    const t0 = now();
    const changed: number[] = [];
    for (const e of edits) {
      if (!inBounds(e.row, e.col)) continue;
      const key = cellKey(e.row, e.col);
      if ((this.cells.get(key)?.raw ?? '') === e.raw) continue;
      this.write(key, e.raw);
      changed.push(key);
    }
    const { evaluated, wave } = this.recalculate(changed);
    const stats: RecalcStats = { edited: changed.length, evaluated, ms: now() - t0 };
    this.lastWave = wave;
    this.lastStats = stats;
    this.version++;
    this.listeners.forEach((l) => l());
    return stats;
  }

  /** Re-evaluates every formula (F9). Used for volatile functions and as a safety net. */
  recalculateAll(): RecalcStats {
    const t0 = now();
    const { evaluated } = this.recalculate([...this.cells.keys()]);
    const stats: RecalcStats = { edited: 0, evaluated, ms: now() - t0 };
    this.lastWave = new Map();
    this.lastStats = stats;
    this.version++;
    this.listeners.forEach((l) => l());
    return stats;
  }

  clear(): void {
    this.setCells([...this.cells.keys()].map((k) => ({ row: keyRow(k), col: keyCol(k), raw: '' })));
  }

  /** { "A1": "=SUM(B1:B3)", ... } — the raw inputs, which is all that needs saving. */
  toJSON(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, rec] of this.cells) out[keyToA1(k)] = rec.raw;
    return out;
  }

  load(data: Record<string, string>): RecalcStats {
    const edits: CellEdit[] = [...this.cells.keys()].map((k) => ({ row: keyRow(k), col: keyCol(k), raw: '' }));
    for (const [a1, raw] of Object.entries(data)) {
      const ref = parseA1(a1);
      if (ref && typeof raw === 'string') edits.push({ row: ref.row, col: ref.col, raw });
    }
    const stats = this.setCells(edits);
    this.lastWave = new Map();
    return stats;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // ---------------------------------------------------------------- internals

  private write(key: number, raw: string): void {
    this.unlink(key);
    if (raw === '') {
      this.cells.delete(key);
      return;
    }
    if (!raw.startsWith('=')) {
      this.cells.set(key, { raw, value: parseLiteral(raw) });
      return;
    }
    const parsed = parseFormula(raw);
    if (parsed.diagnostic) {
      const d = parsed.diagnostic;
      this.cells.set(key, {
        raw,
        diagnostic: d,
        value: new CellError(d.code, d.message, { start: d.start, end: d.end }),
      });
      return;
    }
    this.cells.set(key, { raw, ast: parsed.ast, value: null });
    this.link(key, parsed.ast!);
  }

  private link(key: number, ast: Node): void {
    const refs = collectReferences(ast);
    for (const p of refs.cells) {
      let set = this.dependents.get(p);
      if (!set) this.dependents.set(p, (set = new Set()));
      set.add(key);
    }
    if (refs.cells.length) this.precedentCells.set(key, refs.cells);
    if (refs.ranges.length) {
      const entries = refs.ranges.map((r) => ({ ...r, owner: key }));
      entries.forEach((e) => this.rangeIndex.add(e));
      this.precedentRanges.set(key, entries);
    }
    if (refs.volatile) this.volatileCells.add(key);
  }

  private unlink(key: number): void {
    for (const p of this.precedentCells.get(key) ?? []) {
      const set = this.dependents.get(p);
      set?.delete(key);
      if (set && set.size === 0) this.dependents.delete(p);
    }
    for (const e of this.precedentRanges.get(key) ?? []) this.rangeIndex.remove(e);
    this.precedentCells.delete(key);
    this.precedentRanges.delete(key);
    this.volatileCells.delete(key);
  }

  private forEachDependent(key: number, fn: (dependent: number) => void): void {
    this.dependents.get(key)?.forEach(fn);
    this.rangeIndex.forEachOwnerContaining(keyRow(key), keyCol(key), fn);
  }

  private recalculate(changed: readonly number[]): { evaluated: number; wave: Map<number, number> } {
    // 1. Collect the affected subgraph: changed cells, volatile cells, and everything downstream.
    const affected = new Set<number>(changed);
    for (const v of this.volatileCells) affected.add(v);
    const successors = new Map<number, number[]>();
    const queue = [...affected];
    while (queue.length) {
      const k = queue.pop()!;
      const out = new Set<number>();
      this.forEachDependent(k, (d) => {
        out.add(d);
        if (!affected.has(d)) {
          affected.add(d);
          queue.push(d);
        }
      });
      successors.set(k, [...out]);
    }

    // 2. Order it. Tarjan yields SCCs dependents-first, so walk the list backwards.
    const succ = (k: number) => successors.get(k) ?? [];
    const components = stronglyConnectedComponents(affected, succ);
    // Depth is propagated in the same order, so every cell's depth is final before its dependents read it.
    const edited = new Set(changed);
    const depth = new Map<number, number>();
    const wave = new Map<number, number>();
    let evaluated = 0;
    for (let i = components.length - 1; i >= 0; i--) {
      const comp = components[i];
      if (comp.length > 1 || succ(comp[0]).includes(comp[0])) {
        this.markCircular(comp, succ);
        evaluated += comp.length;
      } else if (this.evaluate(comp[0])) {
        evaluated++;
      }
      const members = comp.length > 1 ? new Set(comp) : null;
      for (const k of comp) {
        const d = depth.get(k) ?? 0;
        if (!edited.has(k)) wave.set(k, Math.max(d, 1));
        for (const s of succ(k)) {
          if (s !== k && !members?.has(s)) depth.set(s, Math.max(depth.get(s) ?? 0, d + 1));
        }
      }
    }
    return { evaluated, wave };
  }

  private evaluate(key: number): boolean {
    const rec = this.cells.get(key);
    if (!rec?.ast) return false;
    rec.value = evaluateFormula(rec.ast, {
      getValue: (r, c) => this.cells.get(cellKey(r, c))?.value ?? null,
      formula: rec.raw,
      row: keyRow(key),
      col: keyCol(key),
    });
    return true;
  }

  /** Every cell in a cycle gets #CIRC! with the chain spelled out and a caret on the offending reference. */
  private markCircular(comp: number[], succ: (k: number) => readonly number[]): void {
    const members = new Set(comp);
    const describe = comp.length <= 64;
    for (const key of comp) {
      const rec = this.cells.get(key);
      if (!rec) continue;
      const path = describe ? cyclePath(key, members, succ) : undefined;
      let message: string;
      let span;
      if (path && path.length === 2) {
        message = `Circular reference: ${keyToA1(key)} refers to itself.`;
      } else if (path) {
        const shown = path.length > 9 ? [...path.slice(0, 4), '…', ...path.slice(-3)] : path;
        message = `Circular reference: ${shown.join(' → ')}. Each cell depends on the next, so none can be calculated.`;
      } else {
        message = `Circular reference involving ${comp.length} cells.`;
      }
      if (path && rec.ast) {
        const next = parseA1(path[1]);
        if (next) span = findReferenceSpan(rec.ast, next.row, next.col);
      }
      rec.value = new CellError('#CIRC!', message, span, undefined, path);
    }
  }
}

/** Shortest cycle through `start` inside its SCC, written in "depends on" order: A1 → B1 → A1. */
function cyclePath(start: number, members: Set<number>, succ: (k: number) => readonly number[]): string[] | undefined {
  const parent = new Map<number, number>();
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    for (const d of succ(k)) {
      if (!members.has(d)) continue;
      if (d === start) {
        // Walk back: start -> ... -> k -> start along "is read by" edges, then reverse it.
        const chain = [start];
        for (let x = k; x !== start; x = parent.get(x)!) chain.push(x);
        chain.push(start);
        return chain.map(keyToA1);
      }
      if (!parent.has(d)) {
        parent.set(d, k);
        queue.push(d);
      }
    }
  }
  return undefined;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
