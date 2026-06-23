import type { Metadata } from 'next';
import { Crimson_Pro, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { UtilityBar, Header, Footer } from '@/components/chrome';

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

const BASE_URL = 'https://saoc.co.za';
const DEFAULT_DESCRIPTION =
  'The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: '%s | South African Orchid Council',
    default: 'South African Orchid Council',
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    siteName: 'South African Orchid Council',
    locale: 'en_ZA',
    type: 'website',
    url: BASE_URL,
    images: [
      {
        url: '/og?title=South+African+Orchid+Council',
        width: 1200,
        height: 630,
        alt: 'South African Orchid Council',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>
      <body>
        <UtilityBar />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
