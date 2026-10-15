'use client';

import { Fragment } from 'react';
import { caretLine } from '@/engine/diagnostics';
import type { ErrorCode } from '@/engine/values';
import { Icon } from './Icon';
import { KEYS } from './keys';

export interface DiagnosticView {
  /** 'syntax' = formula can't be parsed; 'runtime' = it evaluated to an error; 'live' = while typing. */
  kind: 'syntax' | 'runtime' | 'live';
  address: string;
  formula: string;
  code: ErrorCode;
  message: string;
  start?: number;
  end?: number;
  suggestion?: string;
  fix?: string;
  origin?: string;
  loop?: readonly string[];
  related?: { start: number; end: number; label: string };
}

interface DiagnosticsPanelProps {
  view: DiagnosticView;
  onApplyFix(fix: string): void;
  onGoTo(address: string): void;
  onDismiss(): void;
}

const TITLES: Record<DiagnosticView['kind'], string> = {
  syntax: 'Formula error',
  runtime: 'Calculation error',
  live: 'Problem in formula',
};

/** Explains a formula error: message, the formula with a caret under the culprit, and a suggested fix. */
export function DiagnosticsPanel({ view, onApplyFix, onGoTo, onDismiss }: DiagnosticsPanelProps) {
  const hasSpan = view.start !== undefined && view.end !== undefined;
  const start = view.start ?? 0;
  const end = view.end ?? 0;
  const f = view.formula;

  return (
    <aside className={`diag diag-${view.kind}`} aria-label="Diagnostics">
      <div className="diag-gutter">
        <span className="diag-code">{view.code}</span>
        <span className="diag-title">
          {TITLES[view.kind]} in <b>{view.address}</b>
        </span>
      </div>

      <div className="diag-body">
        <p className="diag-message">
          {view.origin ? `${view.code} starts in ${view.origin} and reaches ${view.address} through a reference.` : view.message}
        </p>

        {hasSpan && (
          <pre className="diag-code-block" aria-label="Formula with error position">
            {f.slice(0, start)}
            <mark>{f.slice(start, Math.max(end, start)) || ' '}</mark>
            {f.slice(Math.max(end, start))}
            {'\n'}
            <span className="diag-caret">{caretLine(start, end)}</span>
            {view.related && (
              <>
                {'\n'}
                <span className="diag-related">
                  {' '.repeat(view.related.start)}
                  {'↑ '}
                  {view.related.label}
                </span>
              </>
            )}
          </pre>
        )}

        {view.origin && (
          <p className="diag-origin">
            <span className="diag-label">In {view.origin}</span> {view.message}{' '}
            <button className="diag-goto" onClick={() => onGoTo(view.origin!)}>
              Go to {view.origin}
            </button>
          </p>
        )}

        {view.loop && (
          <p className="diag-origin diag-loop">
            <span className="diag-label">Loop</span>{' '}
            {view.loop.map((a1, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden> → </span>}
                <button onClick={() => onGoTo(a1)}>{a1}</button>
              </Fragment>
            ))}
          </p>
        )}

        {view.suggestion && (
          <p className="diag-suggestion">
            <span className="diag-label">Suggestion</span> {view.suggestion}
          </p>
        )}

        {view.fix && (
          <div className="diag-fix">
            <span className="diag-label">Fixed formula</span>
            <code>{view.fix}</code>
            <button onClick={() => onApplyFix(view.fix!)} aria-keyshortcuts={KEYS.fix.aria}>
              Apply fix <kbd>{KEYS.fix.label}</kbd>
            </button>
          </div>
        )}
      </div>

      <button className="diag-close" onClick={onDismiss} aria-label="Hide diagnostics">
        <Icon name="close" />
      </button>
    </aside>
  );
}
