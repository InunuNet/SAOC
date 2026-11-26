// lib/link-target.ts
// One rule for "does this link leave the site the visitor is on?". The SAOC site and the National
// Orchid Show (NOS) site are one app routed by host (proxy.ts), and Brad's standing instruction is
// that a link to the other site, or to any external origin, opens in a new tab. Every anchor goes
// through here (components/ui/SiteLink.tsx and the portable-text link mark), so the decision is
// made once, from the resolved href and the site the page is rendered for.
//
// Pure and edge-safe. Imports are relative with the .ts extension so a node check can load it.
import { SAOC_ONLY_EXACT, SAOC_ONLY_PREFIXES, SHOW_PREFIXES, isUnderAny } from './site-routes.ts';
import { nosOrigin, saocOrigin, type Site } from './site-hosts.ts';

export const NEW_TAB_CUE = '(opens in a new tab)';
export const NEW_TAB_REL = 'noopener noreferrer';

export interface SiteOrigins {
  saoc: string;
  nos: string;
}

export type HrefOwner = Site | 'external' | null;

// A href that never leaves the document: same-page anchors and non-web schemes (mail, phone).
const NON_NAVIGATION = /^(#|mailto:|tel:|sms:)/i;
const ABSOLUTE_WEB = /^(https?:)?\/\//i;

function pathOf(href: string): string {
  const end = href.search(/[?#]/);
  return end === -1 ? href : href.slice(0, end);
}

function ownerOfPath(path: string): Site | null {
  if (isUnderAny(path, SHOW_PREFIXES)) return 'nos';
  if (SAOC_ONLY_EXACT.has(path) || isUnderAny(path, SAOC_ONLY_PREFIXES)) return 'saoc';
  return null;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function parseWebUrl(value: string): URL | null {
  try {
    return new URL(value.startsWith('//') ? `https:${value}` : value);
  } catch {
    return null;
  }
}

/**
 * Which site serves `href`: 'saoc', 'nos', 'external' (any other origin), or null when the href
 * stays wherever it is rendered (a plain relative path, an anchor, mailto:, tel:).
 * When both origins are the same (one-origin local preview) an absolute href is judged by its path.
 */
export function ownerOfHref(href: string, origins: SiteOrigins): HrefOwner {
  const value = href.trim();
  if (value === '' || NON_NAVIGATION.test(value)) return null;
  if (!ABSOLUTE_WEB.test(value)) return value.startsWith('/') ? ownerOfPath(pathOf(value)) : null;

  const url = parseWebUrl(value);
  if (url === null) return 'external'; // unparseable but absolute: open it away from the site
  const saocSite = originOf(origins.saoc);
  const nosSite = originOf(origins.nos);
  if (url.origin === saocSite && url.origin === nosSite) return ownerOfPath(url.pathname) ?? 'saoc';
  if (url.origin === nosSite) return 'nos';
  if (url.origin === saocSite) return 'saoc';
  return 'external';
}

export function opensInNewTabFor(href: string, own: Site, origins: SiteOrigins): boolean {
  const owner = ownerOfHref(href, origins);
  return owner === 'external' || (owner !== null && owner !== own);
}

/** True when `href`, rendered on the `own` site, goes to the other site or to an external origin. */
export function opensInNewTab(href: string, own: Site): boolean {
  return opensInNewTabFor(href, own, { saoc: saocOrigin(), nos: nosOrigin() });
}

export interface NewTabAttrs {
  target?: '_blank';
  rel?: typeof NEW_TAB_REL;
}

/** The anchor attributes for `href` on the `own` site: target and rel for a new tab, else none. */
export function newTabAttrs(href: string, own: Site): NewTabAttrs {
  return opensInNewTab(href, own) ? { target: '_blank', rel: NEW_TAB_REL } : {};
}
