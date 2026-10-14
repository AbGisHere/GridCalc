'use client';

import type { RecalcStats } from '@/engine/engine';
import { formatNumber } from '@/engine/values';

export interface SelectionStats {
  cells: number;
  count: number;
  numeric: number;
  sum: number;
  min: number;
  max: number;
}

interface StatusBarProps {
  stats: SelectionStats | null;
  recalc: RecalcStats | null;
  rendered: number;
  totalCells: number;
  usedCells: number;
  message?: string;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export function StatusBar({ stats, recalc, rendered, totalCells, usedCells, message }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-left">
        {message ? (
          <span className="status-message">{message}</span>
        ) : stats && stats.numeric > 0 ? (
          <>
            <span>
              Sum <b>{formatNumber(stats.sum)}</b>
            </span>
            <span>
              Average <b>{formatNumber(stats.sum / stats.numeric)}</b>
            </span>
            <span>
              Min <b>{formatNumber(stats.min)}</b>
            </span>
            <span>
              Max <b>{formatNumber(stats.max)}</b>
            </span>
            <span>
              Count <b>{fmt(stats.count)}</b>
            </span>
          </>
        ) : stats && stats.count > 0 ? (
          <span>
            Count <b>{fmt(stats.count)}</b>
          </span>
        ) : (
          <span className="muted">Ready</span>
        )}
      </div>
      <div className="status-right">
        {recalc && (
          <span title="Only cells downstream of an edit are re-evaluated">
            Recalculated <b>{fmt(recalc.evaluated)}</b> cell{recalc.evaluated === 1 ? '' : 's'} in <b>{recalc.ms.toFixed(recalc.ms < 10 ? 2 : 0)} ms</b>
            {recalc.cycles > 0 && <span className="warn"> · {recalc.cycles} circular</span>}
          </span>
        )}
        <span title="Virtualization: only visible cells exist in the DOM">
          DOM cells <b>{fmt(rendered)}</b> / {fmt(totalCells)}
        </span>
        <span>
          Used <b>{fmt(usedCells)}</b>
        </span>
      </div>
    </footer>
  );
}
