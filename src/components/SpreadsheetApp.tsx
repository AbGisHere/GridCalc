'use client';

import dynamic from 'next/dynamic';

/**
 * The spreadsheet is entirely client-side (viewport measurement, keyboard, clipboard,
 * localStorage), so it is rendered only in the browser to avoid hydration mismatches.
 */
const Spreadsheet = dynamic(() => import('./Spreadsheet'), {
  ssr: false,
  loading: () => <div className="boot">Loading GridCalc…</div>,
});

export default function SpreadsheetApp() {
  return <Spreadsheet />;
}
