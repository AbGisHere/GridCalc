'use client';

import { caretLine } from '@/engine/diagnostics';
import type { ErrorCode } from '@/engine/values';

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
    <aside className={`diag diag-${view.kind}`} role="status" aria-live="polite" aria-label="Diagnostics">
      <div className="diag-gutter">
        <span className="diag-code">{view.code}</span>
        <span className="diag-title">
          {TITLES[view.kind]} in <b>{view.address}</b>
        </span>
      </div>

      <div className="diag-body">
        <p className="diag-message">{view.message}</p>

        {hasSpan && (
          <pre className="diag-code-block" aria-label="Formula with error position">
            <span className="diag-formula">
              {f.slice(0, start)}
              <mark>{f.slice(start, Math.max(end, start)) || ' '}</mark>
              {f.slice(Math.max(end, start))}
            </span>
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
            This error comes from <button onClick={() => onGoTo(view.origin!)}>{view.origin}</button> and flows into this
            cell through a reference.
          </p>
        )}

        {view.suggestion && (
          <p className="diag-suggestion">
            <span className="diag-label">Suggestion</span> {view.suggestion}
          </p>
        )}

        {view.fix && (
          <div className="diag-fix">
            <code>{view.fix}</code>
            <button onClick={() => onApplyFix(view.fix!)}>Apply fix</button>
          </div>
        )}
      </div>

      <button className="diag-close" onClick={onDismiss} aria-label="Hide diagnostics">
        ×
      </button>
    </aside>
  );
}
