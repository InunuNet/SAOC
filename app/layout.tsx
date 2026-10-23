import type { Metadata } from 'next';
import { Crimson_Pro, Manrope, JetBrains_Mono } from 'next/font/google';

import { SITE_DESCRIPTION } from '@/lib/site-metadata';
import './globals.css';

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-loaded',
  display: 'swap',
  weight: ['400', '500'],
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
