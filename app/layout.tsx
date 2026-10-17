import type { Metadata } from 'next';
import './globals.css';

const BASE_URL = 'https://saoc.co.za';
const DEFAULT_DESCRIPTION =
  'The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.';

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'NGO',
  name: 'South African Orchid Council',
  alternateName: 'SAOC',
  url: BASE_URL,
  foundingDate: '1968',
  description: DEFAULT_DESCRIPTION,
  email: 'secretary@saoc.co.za',
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: '%s | South African Orchid Council',
    default: 'South African Orchid Council',
  },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: './' },
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
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // Developer-controlled static JSON (no user input) — safe to inline.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
