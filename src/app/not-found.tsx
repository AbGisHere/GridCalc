import type { Metadata } from 'next';
import Link from 'next/link';
import StatusPage from '@/components/StatusPage';

export const metadata: Metadata = { title: 'Page not found · GridCalc' };

export default function NotFound() {
  return (
    <StatusPage
      code="#REF!"
      formula={'=PAGE("this one")\n ^\nThe reference points to a page that does not exist.'}
      title="Page not found"
      message="This page was moved, deleted or never existed. Your sheet is safe; it's saved in this browser."
    >
      <Link className="primary" href="/">
        Back to the sheet
      </Link>
    </StatusPage>
  );
}
