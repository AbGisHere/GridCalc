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
  saveState: 'saving' | 'saved' | 'failed';
  onExport(): void;
  onBackup(): void;
  stats: SelectionStats | null;
  recalc: RecalcStats | null;
  rendered: number;
  totalCells: number;
  usedCells: number;
  /** How many cells hold an error; the button walks through them. */
  errors: number;
  onNextError(): void;
  message?: string;
  /** Shown with the message when the action behind it can be reversed. */
  onUndo?(): void;
  /** True while the pointer or keyboard focus is on the message, so it doesn't vanish mid-read or under the Undo button. */
  onHold(held: boolean): void;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact' });

export function StatusBar({ saveState, onExport, onBackup, stats, recalc, rendered, totalCells, usedCells, errors, onNextError, message, onUndo, onHold }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <p className="sr-only" role="status">
        {message}
      </p>
      <div className={`save-state ${saveState}`}>
        <span role="status">
          {saveState === 'failed' ? 'Not saved' : saveState === 'saving' ? 'Saving…' : 'Saved in this browser'}
          {saveState === 'failed' && <span className="save-detail"> — Browser storage is unavailable or full. Download a backup to keep cell contents and formulas.</span>}
        </span>
        {saveState === 'failed' && (
          <>
            <button className="status-undo" onClick={onBackup}>Download backup</button>
            <button className="status-undo" onClick={onExport}>Export values as CSV</button>
          </>
        )}
      </div>
      {errors > 0 && (
        <button className="err-nav" onClick={onNextError} title="Select the next error cell (F8, or Shift+F8 for the previous one)">
          <b>{fmt(errors)}</b> error{errors === 1 ? '' : 's'}
          <span aria-hidden> · </span>Next<span aria-hidden> ›</span>
        </button>
      )}
      <div
        className="status-left"
        onPointerEnter={() => onHold(true)}
        onPointerLeave={(e) => onHold(e.currentTarget.contains(document.activeElement))}
        onFocus={() => onHold(true)}
        onBlur={(e) => onHold(e.currentTarget.matches(':hover'))}
      >
        {message ? (
          <>
            <span className="status-message" title={message}>
              {message}
            </span>
            {onUndo && (
              <button className="status-undo" onClick={onUndo}>
                Undo
              </button>
            )}
          </>
        ) : stats && stats.numeric > 0 ? (
          <>
            <span>
              Sum <b>{formatNumber(stats.sum)}</b>
            </span>
            <span>
              Average <b>{formatNumber(stats.sum / stats.numeric)}</b>
            </span>
            <span>
              Count <b>{fmt(stats.count)}</b>
            </span>
            <details className="selection-details">
              <summary>More stats</summary>
              <span>Min <b>{formatNumber(stats.min)}</b> · Max <b>{formatNumber(stats.max)}</b></span>
            </details>
          </>
        ) : stats && stats.count > 0 ? (
          <span>
            Count <b>{fmt(stats.count)}</b>
          </span>
        ) : (
          <span>Ready</span>
        )}
      </div>
      <div className="status-right" role="group" aria-label="Engine">
        {recalc && (
          <span className="metric" title="Only cells downstream of an edit are re-evaluated">
            <span className="metric-label">Recalc</span>
            <b>{fmt(recalc.evaluated)}</b>
            <span className="metric-unit"> cell{recalc.evaluated === 1 ? '' : 's'}</span> in <b>{recalc.ms.toFixed(recalc.ms < 10 ? 2 : 0)} ms</b>
            {recalc.cycles > 0 && <span className="warn"> · {recalc.cycles} circular</span>}
          </span>
        )}
        <span className="metric" title="Virtualization: only visible cells exist in the DOM">
          <span className="metric-label">DOM cells</span>
          <b>{fmt(rendered)}</b> of <span className="total-full">{fmt(totalCells)}</span>
          <span className="total-short">{compact.format(totalCells)}</span>
        </span>
        <span className="metric metric-used">
          <span className="metric-label">Used</span>
          <b>{fmt(usedCells)}</b>
        </span>
      </div>
    </footer>
  );
}
