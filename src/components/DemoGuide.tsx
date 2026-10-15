'use client';

import { Icon } from './Icon';

/** The sample's guide has two steps: fix an error, then change a value and watch the recalculation. */
export type GuideKind = 'sample' | 'recalc' | 'stress';

interface DemoGuideProps {
  kind: GuideKind;
  onTryFix(): void;
  onLoadStress(): void;
  onStartBlank(): void;
  onGoTo(address: string): void;
  onDismiss(): void;
}

export function DemoGuide({ kind, onTryFix, onLoadStress, onStartBlank, onGoTo, onDismiss }: DemoGuideProps) {
  return (
    <section className="demo-guide" aria-label="Demo guide">
      <div className="guide-content">
        {kind === 'sample' ? (
          <p>
            Nine cells in column H are deliberate errors. Try a fix to see one explained and repaired
            <span className="keys-only">, or press F8 to step through them</span>.
          </p>
        ) : kind === 'recalc' ? (
          <p>Next, change C2 from 120 to 150. Only the formulas that read it recalculate, in order, and the division by zero in H4 and H10 clears.</p>
        ) : (
          <p>Compare recalculation: edit B2 to update the long dependency chain, then B10001 to update only its end. Watch Recalc below.</p>
        )}
        <div className="guide-actions">
          {kind === 'stress' ? (
            <>
              <button className="guide-action" onClick={() => onGoTo('B2')}>Jump to B2</button>
              <button className="guide-action" onClick={() => onGoTo('B10001')}>Jump to B10001</button>
            </>
          ) : (
            <>
              {kind === 'sample' ? (
                <button className="guide-action primary" onClick={onTryFix}>Try a fix</button>
              ) : (
                <button className="guide-action primary" onClick={() => onGoTo('C2')}>Go to C2</button>
              )}
              <button className="guide-action" onClick={onLoadStress}>Load 10k rows</button>
              <button className="guide-action" onClick={onStartBlank}>Start blank</button>
            </>
          )}
        </div>
      </div>
      <button className="icon-btn" onClick={onDismiss} aria-label="Dismiss demo guide"><Icon name="close" /></button>
    </section>
  );
}
