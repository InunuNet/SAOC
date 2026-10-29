import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { SITE_DESCRIPTION } from '@/lib/site-metadata';
import './globals.css';

// One declaration per file, with the weight range the variable file covers (F1e): a per-weight
// list makes next/font emit one @font-face per entry and the browser then requests the same file
// once per matching rule. No face uses next/font's own preload: Next delivers that as an HTTP Link
// header (never in the HTML head) and would also preload the italic. The one preload, Crimson Pro
// normal (the h1/hero face), is the <link> SaocFontPreload renders into the SAOC head.
const crimsonPro = localFont({
  src: [
    { path: './fonts/crimson-pro/CrimsonPro-latin-normal.woff2', weight: '300 600', style: 'normal' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-italic.woff2', weight: '300 600', style: 'italic' },
  ],
  variable: '--font-serif-loaded',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

const manrope = localFont({
  src: [{ path: './fonts/manrope/Manrope-latin-normal.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-sans-loaded',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Arial',
});

const jetBrainsMono = localFont({
  src: [
    { path: './fonts/jetbrains-mono/JetBrainsMono-latin-normal.woff2', weight: '400 500', style: 'normal' },
  ],
  variable: '--font-mono-loaded',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Arial',
});

// nos-site-split F1: only host-neutral metadata lives here. metadataBase, canonical, openGraph and
// the Organization JSON-LD are owned by the route-group layouts (lib/site-metadata.ts), because the
// SAOC and NOS sites share this root and a hard-coded origin here would be wrong for one of them.
export const metadata: Metadata = {
  title: {
    template: '%s | South African Orchid Council',
    default: 'South African Orchid Council',
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
