'use client';

import type { RecalcStats } from '@/engine/engine';
import { formatNumber } from '@/engine/values';
import { ToolMenu } from './ToolMenu';

export interface SelectionStats {
  cells: number;
  count: number;
  numeric: number;
  sum: number;
  min: number;
  max: number;
}

/** Status-bar message, with an optional follow-up such as undoing a sheet replacement or showing a new error. */
export interface StatusMessage {
  text: string;
  action?: { label: string; run(): void };
  tone?: 'error';
  /** Read by screen readers only, when the same words are already on screen elsewhere. */
  quiet?: boolean;
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
  /** Cells in a reference loop anywhere on the sheet. */
  circular: number;
  onNextError(): void;
  message?: StatusMessage;
  /** True while the pointer or keyboard focus is on the message, so it doesn't vanish mid-read or under the Undo button. */
  onHold(held: boolean): void;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact' });

/** One format for every recalculation time, so the status message and the Recalc metric always agree. */
export const formatMs = (ms: number) => `${ms.toFixed(ms < 10 ? 2 : 0)} ms`;

const METRICS: [string, string][] = [
  ['Recalc', 'How many formulas the last change re-evaluated, and how long that took. Only cells downstream of an edit are recalculated.'],
  ['Circular', 'Cells in a reference loop anywhere on the sheet. They show #CIRC!, and their explanation links each cell in the loop.'],
  ['DOM cells', 'Cells that exist in the page right now, out of 10,000,000 addressable ones. The grid only renders what is on screen.'],
  ['Used', 'Cells with contents.'],
];

export function StatusBar({ saveState, onExport, onBackup, stats, recalc, rendered, totalCells, usedCells, errors, circular, onNextError, message, onHold }: StatusBarProps) {
  const shown = message?.quiet ? undefined : message;
  return (
    <footer className="status-bar">
      <p className="sr-only" role="status">
        {message?.text}
      </p>
      {/* Only a failed save is announced; saving after every edit would be noise. */}
      <p className="sr-only" role="alert">
        {saveState === 'failed' && 'Not saved. Browser storage is unavailable or full.'}
      </p>
      <div className={`save-state ${saveState}`}>
        {saveState === 'failed' ? (
          <span>
            Not saved
            <span className="save-detail"> — Browser storage is unavailable or full. Download a backup to keep cell contents and formulas.</span>
          </span>
        ) : (
          // Both labels share one grid cell, so swapping them after every edit never shifts the footer.
          <span className="save-swap" data-state={saveState}>
            <span>Saving…</span>
            <span>
              Saved<span className="save-where"> in this browser</span>
            </span>
          </span>
        )}
        {saveState === 'failed' && (
          <>
            <button className="status-undo" onClick={onBackup}>Download backup</button>
            <button className="status-undo" onClick={onExport}>Export values as CSV</button>
          </>
        )}
      </div>
      {errors > 0 && (
        <button className="err-nav" onClick={onNextError} title="Select the next error cell (Shift+F8 for the previous one)" aria-keyshortcuts="F8">
          <b>{fmt(errors)}</b> error{errors === 1 ? '' : 's'}
          <span aria-hidden> · </span>Next<span aria-hidden> ›</span>
          <kbd>F8</kbd>
        </button>
      )}
      <div
        className="status-left"
        onPointerEnter={() => onHold(true)}
        onPointerLeave={(e) => onHold(e.currentTarget.contains(document.activeElement))}
        onFocus={() => onHold(true)}
        onBlur={(e) => onHold(e.currentTarget.matches(':hover'))}
      >
        {/* A message sits beside the selection stats rather than replacing them. */}
        {shown && (
          <>
            <span className={'status-message' + (shown.tone ? ` ${shown.tone}` : '')} title={shown.text}>
              {shown.text}
            </span>
            {shown.action && (
              <button className="status-undo" onClick={shown.action.run}>
                {shown.action.label}
              </button>
            )}
          </>
        )}
        {stats && stats.numeric > 0 ? (
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
          !shown && <span>Ready</span>
        )}
      </div>
      <div className="status-right" role="group" aria-label="Engine">
        {/* Keyed by the recalculation, so each new one replays the pulse alongside the wave on the grid. */}
        <span className="metric metric-recalc" key={recalc ? `${recalc.evaluated}:${recalc.ms}` : ''}>
          <span className="metric-label">Recalc</span>
          {recalc && (recalc.evaluated > 0 || usedCells > 0) ? (
            <>
              <b>{fmt(recalc.evaluated)}</b>
              <span className="metric-unit"> cell{recalc.evaluated === 1 ? '' : 's'}</span> in <b>{formatMs(recalc.ms)}</b>
            </>
          ) : (
            <span>none yet</span>
          )}
        </span>
        {circular > 0 && (
          <span className="metric metric-circ">
            <span className="metric-label">Circular</span>
            <b>{fmt(circular)}</b>
          </span>
        )}
        <span className="metric">
          <span className="metric-label">DOM<span className="metric-unit"> cells</span></span>
          <b>{fmt(rendered)}</b> of <span className="total-full">{fmt(totalCells)}</span>
          <span className="total-short">{compact.format(totalCells)}</span>
        </span>
        <span className="metric metric-used">
          <span className="metric-label">Used</span>
          <b>{fmt(usedCells)}</b>
        </span>
        <ToolMenu
          className="end metrics-help"
          title="What the engine metrics mean"
          label={
            <>
              ?<span className="sr-only"> What the engine metrics mean</span>
            </>
          }
        >
          {() => (
            <dl className="metrics-list">
              {METRICS.map(([term, meaning]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
          )}
        </ToolMenu>
      </div>
    </footer>
  );
}
