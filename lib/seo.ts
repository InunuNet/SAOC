// F18 (nos-design-system, M6) — the one shared metadata helper for /national-show/**
// (and any route that wants it). Before this, every /national-show/* route shipped a
// bare `metadata = { title }` and only four files in the whole repo touched `openGraph`
// at all. See .agent/memory/project/specs/nos-design-system/goldens/
// m6-conversion-seo-social.golden.md Part B and platform-README.md D-M6b.
//
// This file is deliberately pure — no Sanity or firebase-admin imports. It turns
// already-resolved strings into a Next `Metadata` object; the calling route resolves
// its own title/description/image from Sanity (or a static fallback) before calling it.

import type { Metadata } from 'next';

// Matches app/layout.tsx's own BASE_URL constant. Kept as a separate literal (not an
// import) because layout.tsx's copy is intentionally load-bearing on its own file and
// this module must stay free of app/ imports to avoid a circular dependency between
// the root layout and every page that calls buildPageMetadata().
const BASE_URL = 'https://saoc.co.za';

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

export interface BuildPageMetadataInput {
  /** Page title. Rendered through the root layout's `%s | South African Orchid Council`
   *  title template, so this should NOT repeat the site name. */
  title: string;
  description: string;
  /** Site-relative path starting with `/`, e.g. `/national-show/tickets`. Used to build
   *  the absolute, self-referential canonical and Open Graph URLs. */
  path: string;
  /** Absolute or site-relative image URL. Defaults to the existing dynamic `/og`
   *  endpoint (app/og/route.tsx) rendering `title`. */
  image?: string;
  /** True for a route that must not be indexed — a token-gated page (the vendor
   *  register/payment flow) or a tooling route (the F19 social-kit export target).
   *  Neither is public content and neither has anything to rank for. */
  noIndex?: boolean;
}

/**
 * Single shared metadata helper. Fills title, description, `alternates.canonical`,
 * `openGraph` and `twitter` consistently — a route hand-rolling its own `openGraph`
 * block after this helper exists is a defect (golden Part B.2).
 *
 * Open Graph is deliberately limited to the four properties ogp.me actually defines —
 * `og:title`, `og:type`, `og:image`, `og:url` — plus the optional `og:description`.
 * `type` is always the base `'website'` value; ogp.me defines no event type, so this
 * must never be overridden to invent one (B8a / D-M6b).
 */
export function buildPageMetadata({
  title,
  description,
  path,
  image,
  noIndex,
}: BuildPageMetadataInput): Metadata {
  const canonical = `${BASE_URL}${path}`;
  const ogImage = image ?? `/og?title=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      images: [{ url: ogImage, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
