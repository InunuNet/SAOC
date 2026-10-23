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

import { NOS_INTERNAL_PREFIX, nosPath } from '@/lib/nos-paths';
import { SHOW_TITLE } from '@/lib/show-title';
import { nosUrl, saocUrl } from '@/lib/site-hosts';

// nos-site-split F2: a page's canonical lives on the host that serves it. The show tree
// (/national-show/**) is published on the NOS origin under its clean path (the prefix is
// stripped, see lib/nos-paths.ts); the top-level show routes (/tickets/**, /vsp) keep their path
// on the NOS origin; everything else is a SAOC page. lib/site-hosts.ts and lib/nos-paths.ts are
// pure, so this module stays free of app/ imports.
const NOS_TOP_LEVEL_PREFIXES = ['/tickets', '/vsp'];

function isTopLevelShowRoute(path: string): boolean {
  return NOS_TOP_LEVEL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isNosPath(path: string): boolean {
  return path === NOS_ROOT || path.startsWith(`${NOS_ROOT}/`) || isTopLevelShowRoute(path);
}

function canonicalUrlFor(path: string): string {
  if (path === NOS_ROOT || path.startsWith(`${NOS_ROOT}/`)) return nosUrl(nosPath(path));
  return isTopLevelShowRoute(path) ? nosUrl(path) : saocUrl(path);
}

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

// F24 description bounds. A description is kept as written when it is DESCRIPTION_MIN to
// DESCRIPTION_MAX chars; otherwise it is cut back to a whole sentence (the lede is cut at
// LEDE_MAX, a little tighter, so a snippet never sits on the limit).
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;
const LEDE_MAX = 155;

// The National Show layout appends " | The National Orchid Show" to every inner page
// title (layout title template). `openGraph.title` does not receive that template, so
// social cards add the show name back for inner routes.
const NOS_ROOT = NOS_INTERNAL_PREFIX;
const SAOC_SITE_NAME = 'South African Orchid Council';
const NOS_OG_SUFFIX = ` | ${SHOW_TITLE}`;

function normaliseSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The longest prefix of `text` that is at most `max` chars and ends on a sentence boundary
 *  (`.`, `!` or `?` followed by a space or the end). Never cuts mid-word; null when no
 *  boundary fits. */
export function cutAtSentence(text: string, max: number): string | null {
  const flat = normaliseSpace(text);
  for (let i = Math.min(max, flat.length) - 1; i >= 0; i--) {
    const atBoundary = i === flat.length - 1 || flat[i + 1] === ' ';
    if (/[.!?]/.test(flat[i]) && atBoundary) return flat.slice(0, i + 1);
  }
  return null;
}

/**
 * Fits a meta description to the F24 rules: kept as written when it is 70-160 chars; when
 * longer, cut at its own last sentence boundary within 160; when that leaves it under 70
 * (or it was short to begin with) the page `lede` is cut at the last sentence boundary
 * within 155. Never invents copy: every result is the description itself or a prefix of
 * the lede.
 */
export function fitDescription(description: string, lede?: string): string {
  const flat = normaliseSpace(description);
  if (flat.length >= DESCRIPTION_MIN && flat.length <= DESCRIPTION_MAX) return flat;

  const own = flat.length > DESCRIPTION_MAX ? cutAtSentence(flat, DESCRIPTION_MAX) : null;
  if (own && own.length >= DESCRIPTION_MIN) return own;

  const fromLede = lede ? cutAtSentence(lede, LEDE_MAX) : null;
  return fromLede ?? own ?? flat;
}

export interface BuildPageMetadataInput {
  /** Page title. Rendered through the root layout's `%s | South African Orchid Council`
   *  title template, so this should NOT repeat the site name. */
  title: string;
  description: string;
  /** The page's own opening paragraph, verbatim. Used only when `description` is outside
   *  70-160 chars and cannot be cut back to a valid length on its own (`fitDescription`). */
  lede?: string;
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
 * Open Graph is deliberately limited to the properties ogp.me defines (plus `og:site_name`, which a page-level openGraph would otherwise drop) —
 * `og:title`, `og:type`, `og:image`, `og:url` — plus the optional `og:description`.
 * `type` is always the base `'website'` value; ogp.me defines no event type, so this
 * must never be overridden to invent one (B8a / D-M6b).
 */
export function buildPageMetadata({
  title,
  description: rawDescription,
  lede,
  path,
  image,
  noIndex,
}: BuildPageMetadataInput): Metadata {
  const canonical = canonicalUrlFor(path);
  const ogImage = image ?? `/og?title=${encodeURIComponent(title)}`;
  const description = fitDescription(rawDescription, lede);
  const ogTitle = path.startsWith(`${NOS_ROOT}/`) ? `${title}${NOS_OG_SUFFIX}` : title;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      siteName: isNosPath(path) ? SHOW_TITLE : SAOC_SITE_NAME,
      title: ogTitle,
      description,
      type: 'website',
      url: canonical,
      images: [{ url: ogImage, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [ogImage],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
