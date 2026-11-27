// =============================================================
// SAOC — e2e/utils/site-urls.ts
// Mission nos-site-split F3 — the two sites in one dev server. The SAOC site is the Playwright
// `baseURL` (http://localhost:<port>); the National Orchid Show is the same server reached through
// the NOS host (http://nos.localhost:<port>), which Chromium and Node resolve to loopback and the
// proxy serves as the NOS site, at clean paths (`/faq`, not `/national-show/faq`).
// =============================================================
import { nosPath } from '@/lib/nos-paths';

/** The NOS origin for a SAOC `baseURL` on the same dev server. */
export function nosBase(baseURL: string): string {
  const { port } = new URL(baseURL);
  return `http://nos.localhost:${port}`;
}

/** The URL to open for a show-internal href (`/national-show/faq`, `/tickets/x`) on the NOS host. */
export function nosHref(baseURL: string, href: string): string {
  return `${nosBase(baseURL)}${nosPath(href)}`;
}

/**
 * The accessible name of a link that opens in a new tab: its label plus the hidden
 * "(opens in a new tab)" cue (lib/link-target.ts). Anchored at both ends, so a longer name that
 * merely starts with the label (e.g. "National Orchid Show - Western Cape 2027") does not match.
 */
export function newTabName(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?:\\s*\\(opens in a new tab\\))?$`);
}

/** True for an absolute URL, i.e. a link that leaves the current site. */
export function isAbsolute(href: string): boolean {
  return /^https?:\/\//.test(href);
}
