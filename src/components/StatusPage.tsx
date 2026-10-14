import type { ReactNode } from 'react';

interface Props {
  /** Shown as a spreadsheet error value, e.g. #REF! or #ERROR!. */
  code: string;
  /** A formula-style diagnostic shown above the title, in the same style as the in-app error panel. */
  formula: string;
  title: string;
  message: string;
  children: ReactNode;
}

/** Shared layout for the 404 and error pages. Renders the page's only <h1>. */
export default function StatusPage({ code, formula, title, message, children }: Props) {
  return (
    <main className="status-page">
      <p className="status-code">{code}</p>
      <pre className="status-formula">{formula}</pre>
      <h1>{title}</h1>
      <p>{message}</p>
      <div className="status-actions">{children}</div>
    </main>
  );
}
