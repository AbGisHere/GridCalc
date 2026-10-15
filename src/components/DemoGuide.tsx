'use client';

import { Icon } from './Icon';

interface DemoGuideProps {
  kind: 'sample' | 'stress';
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
            The red cells are intentional errors: <span className="keys-only">press F8</span>
            <span className="touch-only">tap one</span> or Try a fix to see one explained. The other two replace the sample;
            Sheet › Previous sheet brings it back.
          </p>
        ) : (
          <p>Compare recalculation: edit B2 to update the long dependency chain, then B10001 to update only its end. Watch Recalc below.</p>
        )}
        <div className="guide-actions">
          {kind === 'sample' ? (
            <>
              <button className="guide-action primary" onClick={onTryFix}>Try a fix</button>
              <button className="guide-action" onClick={onLoadStress}>Load 10k rows</button>
              <button className="guide-action" onClick={onStartBlank}>Start blank</button>
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
