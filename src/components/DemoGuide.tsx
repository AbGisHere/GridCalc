'use client';

import { Icon } from './Icon';

interface DemoGuideProps {
  kind: 'sample' | 'stress';
  onTryFix(): void;
  onLoadStress(): void;
  onGoTo(address: string): void;
  onDismiss(): void;
}

export function DemoGuide({ kind, onTryFix, onLoadStress, onGoTo, onDismiss }: DemoGuideProps) {
  return (
    <section className="demo-guide" aria-label="Demo guide">
      <div className="guide-content">
        <p>
          {kind === 'sample'
            ? 'The sample errors are intentional. Try a fix, or load 10k rows (replaces this sheet; Undo restores it).'
            : 'Compare recalculation: edit B2 to update the long dependency chain, then B10001 to update only its end. Watch Recalc below.'}
        </p>
        <div className="guide-actions">
          {kind === 'sample' ? (
            <>
              <button className="guide-action" onClick={onTryFix}>Try a formula fix</button>
              <button className="guide-action" onClick={onLoadStress}>Load 10k rows</button>
            </>
          ) : (
            <>
              <button className="guide-action" onClick={() => onGoTo('B2')}>Jump to B2</button>
              <button className="guide-action" onClick={() => onGoTo('B10001')}>Jump to B10001</button>
            </>
          )}
        </div>
      </div>
      <button className="icon-btn" onClick={onDismiss} aria-label="Dismiss demo guide"><Icon name="close" /></button>
    </section>
  );
}
