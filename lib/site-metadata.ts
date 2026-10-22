// lib/site-metadata.ts
// Mission nos-site-split F1 — the site-wide metadata that used to be hard-coded in app/layout.tsx
// against https://saoc.co.za. Each route group's layout calls this with its own origin, so
// metadataBase, canonical and openGraph.url follow the host the group serves. The root layout keeps
// only the host-neutral title template and description.
import type { Metadata } from 'next';

export const SITE_DESCRIPTION =
  'The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.';

export function buildSiteMetadata(origin: string): Metadata {
  return {
    metadataBase: new URL(origin),
    alternates: { canonical: './' },
    openGraph: {
      siteName: 'South African Orchid Council',
      locale: 'en_ZA',
      type: 'website',
      url: origin,
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
}

export function buildOrganizationJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: 'South African Orchid Council',
    alternateName: 'SAOC',
    url: origin,
    foundingDate: '1968',
    description: SITE_DESCRIPTION,
    email: 'secretary@saoc.co.za',
  };
}
