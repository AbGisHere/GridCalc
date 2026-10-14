import type { RangeBounds } from './address';

/** Row-bucket size for the range index. */
const BUCKET_SHIFT = 6;

export interface RangeEntry extends RangeBounds {
  /** Key of the formula cell that reads this range. */
  owner: number;
}

/**
 * Spatial index answering "which formulas read a range that contains cell (r, c)?".
 * Ranges are filed under every 64-row bucket they overlap, so a lookup only checks
 * ranges near the changed row instead of every range in the sheet.
 */
export class RangeIndex {
  private buckets = new Map<number, Set<RangeEntry>>();

  add(e: RangeEntry): void {
    for (let b = e.r1 >> BUCKET_SHIFT; b <= e.r2 >> BUCKET_SHIFT; b++) {
      let set = this.buckets.get(b);
      if (!set) this.buckets.set(b, (set = new Set()));
      set.add(e);
    }
  }

  remove(e: RangeEntry): void {
    for (let b = e.r1 >> BUCKET_SHIFT; b <= e.r2 >> BUCKET_SHIFT; b++) {
      const set = this.buckets.get(b);
      if (!set) continue;
      set.delete(e);
      if (set.size === 0) this.buckets.delete(b);
    }
  }

  forEachOwnerContaining(row: number, col: number, fn: (owner: number) => void): void {
    const set = this.buckets.get(row >> BUCKET_SHIFT);
    if (!set) return;
    for (const e of set) {
      if (row >= e.r1 && row <= e.r2 && col >= e.c1 && col <= e.c2) fn(e.owner);
    }
  }
}

/**
 * Tarjan's strongly-connected-components algorithm, iterative so a 100,000-long
 * dependency chain cannot overflow the call stack.
 *
 * Edges point from a cell to the cells that depend on it. Components are returned
 * in reverse topological order (dependents before their inputs), so callers iterate
 * the result backwards to evaluate inputs first. Any component with more than one
 * node, or a node with an edge to itself, is a circular reference.
 */
export function stronglyConnectedComponents(nodes: Iterable<number>, successors: (n: number) => readonly number[]): number[][] {
  const index = new Map<number, number>();
  const low = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const out: number[][] = [];
  let counter = 0;

  for (const root of nodes) {
    if (index.has(root)) continue;
    const work: { node: number; edge: number }[] = [{ node: root, edge: 0 }];
    index.set(root, counter);
    low.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);

    while (work.length) {
      const frame = work[work.length - 1];
      const succ = successors(frame.node);
      if (frame.edge < succ.length) {
        const next = succ[frame.edge++];
        if (!index.has(next)) {
          index.set(next, counter);
          low.set(next, counter);
          counter++;
          stack.push(next);
          onStack.add(next);
          work.push({ node: next, edge: 0 });
        } else if (onStack.has(next)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(next)!));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1].node;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.node)!));
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        const comp: number[] = [];
        let w: number;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          comp.push(w);
        } while (w !== frame.node);
        out.push(comp);
      }
    }
  }
  return out;
}
