import type { Metadata, Viewport } from 'next';
import './globals.css';

const description = 'A virtualized spreadsheet with a custom formula parser, evaluator and dependency-aware recalculation.';

export const metadata: Metadata = {
  title: 'GridCalc',
  description,
  applicationName: 'GridCalc',
  openGraph: { title: 'GridCalc', description, type: 'website' },
  twitter: { card: 'summary', title: 'GridCalc', description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#161716' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
