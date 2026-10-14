import { parseA1 } from '../src/engine/address';
import { SpreadsheetEngine } from '../src/engine/engine';
import { CellError, type Scalar } from '../src/engine/values';

/** Build an engine from { A1: "1", B1: "=A1*2" } and read values by address. */
export function sheet(cells: Record<string, string | number> = {}) {
  const engine = new SpreadsheetEngine();
  engine.setCells(
    Object.entries(cells).map(([a1, raw]) => {
      const r = parseA1(a1)!;
      return { row: r.row, col: r.col, raw: String(raw) };
    }),
  );
  const pos = (a1: string) => parseA1(a1)!;
  return {
    engine,
    set(a1: string, raw: string | number) {
      const p = pos(a1);
      return engine.setCell(p.row, p.col, String(raw));
    },
    get(a1: string): Scalar {
      const p = pos(a1);
      return engine.getValue(p.row, p.col);
    },
    error(a1: string): CellError | undefined {
      const v = this.get(a1);
      return v instanceof CellError ? v : undefined;
    },
    record(a1: string) {
      const p = pos(a1);
      return engine.getRecord(p.row, p.col);
    },
  };
}

/** Evaluate a single formula in an otherwise-empty sheet (plus optional data). */
export function calc(formula: string, cells: Record<string, string | number> = {}): Scalar {
  const s = sheet({ ...cells, CV1: formula });
  return s.get('CV1');
}

export const code = (v: Scalar) => (v instanceof CellError ? v.code : v);
