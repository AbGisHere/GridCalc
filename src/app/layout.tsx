import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE_URL } from './site';

const description = 'A virtualized spreadsheet with a custom formula parser, evaluator and dependency-aware recalculation.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'GridCalc',
  description,
  applicationName: 'GridCalc',
  alternates: { canonical: '/' },
  openGraph: { title: 'GridCalc', description, type: 'website', url: '/' },
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
    // public/theme.js sets data-theme on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/theme.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
