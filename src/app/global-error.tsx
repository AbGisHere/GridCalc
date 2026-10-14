'use client';

import './globals.css';
import StatusPage from '@/components/StatusPage';

/** Replaces the root layout when the layout itself fails, so it must render <html> and <body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Error · GridCalc</title>
        <StatusPage
          code="#ERROR!"
          formula={`=APP()\n ^\n${error.digest ? `Error ID: ${error.digest}` : 'GridCalc failed to start.'}`}
          title="GridCalc couldn't load"
          message="Try again, or reload to restore the last successful autosave. Recent edits may not have been saved, and recovery requires browser storage to be available."
        >
          <button className="primary" onClick={reset}>
            Try again
          </button>
        </StatusPage>
      </body>
    </html>
  );
}
