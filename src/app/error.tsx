'use client';

import Link from 'next/link';
import StatusPage from '@/components/StatusPage';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      code="#ERROR!"
      formula={`=APP()\n ^\n${error.digest ? `Error ID: ${error.digest}` : 'Something failed while rendering this page.'}`}
      title="Something went wrong"
      message="GridCalc hit an unexpected error. Your sheet is saved in this browser, so trying again or reloading won't lose it."
    >
      <button className="primary" onClick={reset}>
        Try again
      </button>
      <Link href="/">Back to the sheet</Link>
    </StatusPage>
  );
}
