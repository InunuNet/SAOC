// lib/nos-paths.ts
// Mission nos-site-split F1 — the National Orchid Show site serves clean URLs: the public path P on
// the NOS host is the internal `/national-show` + P (proxy.ts rewrites between them), and `/` is the
// hub. Pure and edge-safe, so proxy.ts, sitemap.ts and link builders share one definition.

export const NOS_INTERNAL_PREFIX = '/national-show';

const SUFFIX_START = /[?#]/;

/**
 * The public NOS path for an internal show href: `/national-show/faq?x=1` becomes `/faq?x=1`, and
 * the hub `/national-show` becomes `/`. Anything outside the prefix is returned unchanged.
 */
export function nosPath(href: string): string {
  const suffixAt = href.search(SUFFIX_START);
  const path = suffixAt === -1 ? href : href.slice(0, suffixAt);
  const suffix = suffixAt === -1 ? '' : href.slice(suffixAt);

  if (path === NOS_INTERNAL_PREFIX) return `/${suffix}`;
  if (path.startsWith(`${NOS_INTERNAL_PREFIX}/`)) return `${path.slice(NOS_INTERNAL_PREFIX.length)}${suffix}`;
  return href;
}

/** The internal route of the show's own contact page; the NOS host serves it at `/contact`. */
export const NOS_CONTACT_PATH = '/national-show/contact';
