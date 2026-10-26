import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { SITE_DESCRIPTION } from '@/lib/site-metadata';
import './globals.css';

const crimsonPro = localFont({
  src: [
    { path: './fonts/crimson-pro/CrimsonPro-latin-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-italic.woff2', weight: '300', style: 'italic' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/crimson-pro/CrimsonPro-latin-italic.woff2', weight: '600', style: 'italic' },
  ],
  variable: '--font-serif-loaded',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

const manrope = localFont({
  src: [
    { path: './fonts/manrope/Manrope-latin-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/manrope/Manrope-latin-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/manrope/Manrope-latin-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/manrope/Manrope-latin-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans-loaded',
  display: 'swap',
  adjustFontFallback: 'Arial',
});

const jetBrainsMono = localFont({
  src: [
    { path: './fonts/jetbrains-mono/JetBrainsMono-latin-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/jetbrains-mono/JetBrainsMono-latin-normal.woff2', weight: '500', style: 'normal' },
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
