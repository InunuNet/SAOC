// lib/site-hosts.ts
// Mission nos-site-split F1 — the one place that knows which origin is the SAOC site and which is
// the National Orchid Show (NOS) site. The two sites are one Next.js app routed by host (proxy.ts),
// so every absolute URL, canonical, sitemap entry and cross-link is built from here.
//
// Edge-safe and pure: it reads only `process.env`, imports nothing, and is used from proxy.ts
// (Edge runtime), Server Components, route handlers and Node-side URL builders alike.
//
// Origin precedence (golden host-routing.golden.md):
//   SAOC: NEXT_PUBLIC_SAOC_SITE_URL, else SITE_URL, else dev default, else production default.
//   NOS:  NEXT_PUBLIC_NOS_SITE_URL, else dev default, else production default.
// The dev defaults apply only when NODE_ENV !== 'production'.

export type Site = 'saoc' | 'nos';

const SAOC_DEV_ORIGIN = 'http://localhost:3002';
const NOS_DEV_ORIGIN = 'http://nos.localhost:3002';
const SAOC_PRODUCTION_ORIGIN = 'https://saoc.co.za';
const NOS_PRODUCTION_ORIGIN = 'https://nos.saoc.co.za';
const NOS_HOST_PREFIX = 'nos.';

function stripTrailingSlashes(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function configured(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? stripTrailingSlashes(trimmed) : null;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function saocOrigin(): string {
  return (
    configured(process.env.NEXT_PUBLIC_SAOC_SITE_URL) ??
    configured(process.env.SITE_URL) ??
    (isProduction() ? SAOC_PRODUCTION_ORIGIN : SAOC_DEV_ORIGIN)
  );
}

export function nosOrigin(): string {
  return (
    configured(process.env.NEXT_PUBLIC_NOS_SITE_URL) ??
    (isProduction() ? NOS_PRODUCTION_ORIGIN : NOS_DEV_ORIGIN)
  );
}

function hostnameOf(hostHeader: string): string {
  const first = hostHeader.split(',')[0]?.trim().toLowerCase() ?? '';
  // Bracketed IPv6 literals keep their colons; everything else loses the `:port` suffix.
  if (first.startsWith('[')) return first.slice(0, first.indexOf(']') + 1);
  return first.split(':')[0] ?? '';
}

function hostnameOfOrigin(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Which site a request host belongs to. Pass `x-forwarded-host` when present, else `host`.
 * Only the NOS origin's hostname or any `nos.*` host is 'nos'; beta.saoc.co.za, *.hosted.app,
 * localhost and the apex are all 'saoc'.
 */
export function siteForHost(host: string | null): Site {
  if (!host) return 'saoc';
  const hostname = hostnameOf(host);
  if (!hostname) return 'saoc';
  if (hostname === hostnameOfOrigin(nosOrigin())) return 'nos';
  return hostname.startsWith(NOS_HOST_PREFIX) ? 'nos' : 'saoc';
}

export function saocUrl(path: string): string {
  return `${saocOrigin()}${path}`;
}

export function nosUrl(path: string): string {
  return `${nosOrigin()}${path}`;
}
