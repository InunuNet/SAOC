// lib/nav-current.ts
// NAV-1: which nav item is the current page. Pure and edge-safe, shared by both headers and the
// SAOC mobile menu. Matching is on a path-segment boundary (`/events/x` is Events, `/eventsfoo` is
// not), the hub and home match exactly, and both sides go through nosPath() so the public NOS path
// (`/faq`) and the internal one (`/national-show/faq`) agree.

import { nosPath } from '@/lib/nos-paths';

const SUFFIX_START = /[?#]/;
const ABSOLUTE_HREF = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/** Path only (no query or hash), one trailing slash dropped, NOS paths made public. */
function normalisePath(value: string): string {
  const suffixAt = value.search(SUFFIX_START);
  const path = suffixAt === -1 ? value : value.slice(0, suffixAt);
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return nosPath(trimmed);
}

export function isNavCurrent(pathname: string | null | undefined, href: string): boolean {
  if (!pathname || !href || ABSOLUTE_HREF.test(href)) return false;
  const current = normalisePath(pathname);
  const target = normalisePath(href);
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

/**
 * The `aria-current` value for a link to a page, or undefined so the attribute is omitted (it is
 * never rendered as "false"). A `crossSite` item leaves this site and is never current.
 */
export function navAriaCurrent(
  pathname: string | null | undefined,
  href: string,
  options: { crossSite?: boolean } = {},
): 'page' | undefined {
  if (options.crossSite) return undefined;
  return isNavCurrent(pathname, href) ? 'page' : undefined;
}

export function anyNavCurrent(
  pathname: string | null | undefined,
  hrefs: readonly string[],
): boolean {
  return hrefs.some((href) => isNavCurrent(pathname, href));
}
