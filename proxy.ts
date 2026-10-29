// proxy.ts (repo root)
// Mission beta-password-wall F1 — Next 16 canonical proxy convention (the file
// every request to this backend runs through before any route handler;
// `middleware.ts` / `export function middleware` is the deprecated pre-16 alias —
// see node_modules/next/dist/server/web/types.d.ts's own `@deprecated` tags on
// NextMiddleware/MiddlewareConfig in favour of NextProxy/ProxyConfig, and
// node_modules/next/dist/server/next-server.js:1193's
// `middlewareModule.proxy || middlewareModule.middleware || middlewareModule`,
// which is why this file exports a function named `proxy`, not `middleware`).
// Runs on every path — no `config.matcher` export, Next's documented default
// behaviour when one is absent is "every request" — covering "every page and
// asset" per Brad's instruction, and HOST-AGNOSTIC: applies identically on
// beta.saoc.co.za, any *.hosted.app preview origin, and the real saoc.co.za
// apex alike. This is deliberate (team-lead override, 2026-10-06): the wall
// stays up on every host until lib/beta-public-launch.ts's SITE_PUBLIC_LAUNCH
// flag is explicitly set, never lifting itself as a side effect of a DNS
// migration — see that file's header comment for the full rationale.
//
// Runs on the Edge runtime (Next's proxy/middleware has no `runtime: 'nodejs'`
// escape hatch — see
// node_modules/next/dist/build/segment-config/middleware/middleware-config.d.ts,
// which exposes only `matcher`/`regions`/`unstable_allowDynamic`), so this file
// uses only Web-standard globals (`crypto.subtle`, `atob`, `TextEncoder`) — never
// `node:crypto`'s `timingSafeEqual` or `Buffer`, neither of which is available here.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isBetaWallConfigured, isPasswordWallOff, isPubliclyLaunched } from '@/lib/beta-public-launch';
import { NOS_INTERNAL_PREFIX, nosPath } from '@/lib/nos-paths';
import { saocUrl, nosUrl, siteForHost, type Site } from '@/lib/site-hosts';

// Exact-match only — never a prefix/startsWith check. A prefix match would also
// exempt /api/tickets/itn-evil or (pre-URL-normalisation) a traversal attempt like
// /api/revalidate/../admin; Set.has() on the runtime-normalised pathname cannot be
// fooled by either shape. These 6 are the only routes that cannot send a Basic
// Auth header (server-to-server webhooks) and already verify their own
// signature/secret independently — see docs/beta-password-wall.md.
const EXEMPT_PATHS = new Set<string>([
  '/api/tickets/itn',
  '/api/tickets/ozow-itn',
  '/api/vendors/stand-payment/payfast-itn',
  '/api/vendors/stand-payment/ozow-itn',
  '/api/revalidate',
  '/api/admin/reconcile-orders',
]);

export function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.has(pathname);
}

// Firebase App Hosting puts Cloud CDN in front of this server, and a CDN hit never
// reaches proxy() at all. So while the wall is up, no response may be storable by
// a shared cache — otherwise one authenticated load of an ISR page (which Next
// emits as `s-maxage=60, stale-while-revalidate=...`) is replayed to anonymous
// visitors from the edge (observed live on beta, 2026-10-06). Two independent
// mechanisms, both from Cloud CDN's documented "never cached" list
// (https://firebase.google.com/docs/app-hosting/optimize-cache):
//   1. Cache-Control private/no-store. Next copies proxy headers onto the response
//      before rendering and only sets its own Cache-Control when none exists
//      (node_modules/next/dist/server/send-payload.js:60,
//      server/lib/router-server.js:394), so this survives on pages, static files
//      and API routes.
//   2. A Set-Cookie marker. Some paths overwrite Cache-Control after proxy runs —
//      the image optimizer always sets `public, max-age=...`
//      (server/image-optimizer.js:1180) and a route handler's own headers win (the
//      ImageResponse at app/og). Cloud CDN never caches a response carrying
//      Set-Cookie, whatever its Cache-Control says. The value carries no data.
// `Vary: Authorization` is deliberately NOT used: Next replaces Vary on every page
// (build/templates/app-page.js:446) and image response, so it would be absent
// exactly where it mattered. Both mechanisms lift with SITE_PUBLIC_LAUNCH, at
// runtime, restoring Next's own caching headers.
export const WALL_CACHE_CONTROL = 'private, no-store, max-age=0';
export const WALL_MARKER_COOKIE = 'saoc_beta_wall=1; Path=/; HttpOnly; Secure; SameSite=Lax';

function applyWallHeaders(response: Response): Response {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', WALL_CACHE_CONTROL);
  response.headers.append('Set-Cookie', WALL_MARKER_COOKIE);
  return response;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

// Constant-time comparison safe for the Edge runtime: both inputs are hashed to a
// fixed 32-byte SHA-256 digest first, so the comparison loop's running time depends
// only on the digest length (always 32), never on the length or content of the real
// secret or of what a caller supplied — no node:crypto.timingSafeEqual available here.
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([sha256(a), sha256(b)]);
  let mismatch = 0;
  for (let i = 0; i < digestA.length; i++) {
    mismatch |= digestA[i] ^ digestB[i];
  }
  return mismatch === 0;
}

export type AuthDecisionInput = {
  pathname: string;
  authorizationHeader: string | null;
  expectedUser: string | undefined;
  expectedPassword: string | undefined;
  isProduction: boolean;
  publiclyLaunched: boolean;
  passwordWallOff?: boolean;
};

// Pure decision function — no NextRequest/NextResponse dependency, so it is
// directly unit-testable (see e2e/beta-password-wall-decision.spec.ts). Order
// matters:
//   1. The 6 exempt webhook paths always pass, in every environment, on every
//      host, launched or not — they already verify their own signature/secret
//      and cannot send a Basic Auth header at all.
//   2. `publiclyLaunched` (lib/beta-public-launch.ts's SITE_PUBLIC_LAUNCH ===
//      'true' exact match) always passes when true — this is the ONE explicit
//      switch that lifts the wall; nothing else (host, environment) does.
//      `passwordWallOff` (BETA_PASSWORD_WALL_OFF === 'true') also passes, but lifts ONLY the
//      prompt: wallUp stays !publiclyLaunched, so noindex, no-store and the wall cookie remain.
//   3. If no credentials are configured (BETA_BASIC_AUTH_USER/PASSWORD unset),
//      FAIL CLOSED in production (no credential could ever be supplied that
//      would satisfy an unconfigured secret, so every request is denied) and
//      bypass in local dev (`pnpm dev`/`pnpm dev:secure`, NODE_ENV !==
//      'production') so it keeps working with zero setup.
//   4. Otherwise, parse the Authorization header as Basic, decode it, and
//      compare both the username and the password with constantTimeEqual —
//      both must match.
export async function decideBasicAuth(input: AuthDecisionInput): Promise<boolean> {
  if (isExemptPath(input.pathname)) return true;
  if (input.publiclyLaunched) return true;
  if (input.passwordWallOff === true) return true;

  const credentialsConfigured = isBetaWallConfigured(input.expectedUser, input.expectedPassword);
  if (!credentialsConfigured) {
    return !input.isProduction;
  }

  const header = input.authorizationHeader;
  if (!header || !header.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice('Basic '.length));
  } catch {
    return false;
  }
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return false;

  const providedUser = decoded.slice(0, separatorIndex);
  const providedPassword = decoded.slice(separatorIndex + 1);

  const [userMatches, passwordMatches] = await Promise.all([
    constantTimeEqual(providedUser, input.expectedUser as string),
    constantTimeEqual(providedPassword, input.expectedPassword as string),
  ]);
  return userMatches && passwordMatches;
}

// ---------------------------------------------------------------------------
// Host routing (mission nos-site-split F1; golden host-routing.golden.md). One app serves two
// sites: the SAOC site (everything not NOS) and the National Orchid Show site (nos.saoc.co.za).
// It runs AFTER the wall decision above, so a 401 is identical on both hosts and no redirect ever
// leaks the existence of a path to an unauthenticated caller.
// ---------------------------------------------------------------------------
const SITE_HEADER = 'x-site';
const PERMANENT_REDIRECT = 308; // 308, not 301: the method and body survive the hop.

// South African exhibitors was merged into Exhibitors and vendors (mission leeann-content-build, F4).
// Both public spellings of the retired page go straight to the merged page on the NOS origin, from
// either host, so no one lands on a 404 and no chain of hops forms.
const RETIRED_EXHIBITORS_ENTRY_PATHS = new Set<string>(['/exhibitors', '/national-show/exhibitors']);
const AWARD_ENTRIES_PATH = '/award-entries';
const RETIRED_SA_EXHIBITORS_PATHS = new Set<string>(['/sa-exhibitors', '/national-show/sa-exhibitors']);
const MERGED_VENDORS_PATH = '/vendors';

// The Constitution page is now the Memorandum of Incorporation (mission saoc-content-standard, F2).
// The old path 308s on both hosts, straight to the SAOC origin's new path in one hop.
const RETIRED_CONSTITUTION_PATH = '/constitution';
const MOI_PATH = '/memorandum-of-incorporation';

// Host-neutral: served identically on every host, never redirected or rewritten. /admin and
// /api/admin share one sign-in; /api carries the payment webhooks; /og and /studio are tooling.
const NEUTRAL_PREFIXES = ['/admin', '/api', '/studio', '/og', '/_next'];
const NEUTRAL_EXACT = new Set<string>([
  '/robots.txt',
  '/sitemap.xml',
  '/events.ics',
  '/favicon.ico',
  '/icon.png',
  '/icon1.png',
  '/apple-icon.png',
]);
// The NOS share card lives at /national-show/og; the bare /og route is SAOC's card, so on the NOS
// host the show card keeps its internal path instead of being prefix-stripped.
const NOS_OG_PATH = `${NOS_INTERNAL_PREFIX}/og`;

// SAOC-hosted trees: asked for on the NOS host they redirect to the SAOC origin.
const SAOC_ONLY_EXACT = new Set<string>(['/members', MOI_PATH, '/judging']);
const SAOC_ONLY_PREFIXES = ['/societies', '/events'];
// Host-neutral content rendered by both sites' chrome (app/(shared)).
const SHARED_EXACT = new Set<string>(['/privacy', '/terms', '/refunds']);
const SHARED_PREFIXES = ['/newsletter'];
// Show routes that exist as short top-level URLs (Ozow caps the cancel URL at 50 characters).
const NOS_TOP_LEVEL_PREFIXES = ['/vsp', '/tickets'];
const NOS_TICKETS_ROOT = '/tickets';
const NOS_TICKETS_BUY_PREFIX = '/tickets/buy';
// What the SAOC host hands to the NOS origin.
const SHOW_PREFIXES = [NOS_INTERNAL_PREFIX, '/tickets', '/vsp'];

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isUnderAny(pathname: string, bases: readonly string[]): boolean {
  return bases.some((base) => isUnder(pathname, base));
}

function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return lastSegment.includes('.');
}

export function isHostNeutralPath(pathname: string): boolean {
  return (
    NEUTRAL_EXACT.has(pathname) ||
    isUnderAny(pathname, NEUTRAL_PREFIXES) ||
    hasFileExtension(pathname)
  );
}

function siteOfRequest(request: NextRequest): Site {
  return siteForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
}

function redirectTo(location: string): Response {
  return new Response(null, { status: PERMANENT_REDIRECT, headers: { Location: location } });
}

// Same-host redirect on the NOS site. Location is built from the configured NOS origin, never from
// the request's Host or X-Forwarded-Host (both client-controlled), so a spoofed host cannot steer it.
// A proxy redirect must be absolute; Next may relativise it when it matches the request.
function redirectWithinNos(request: NextRequest, pathname: string): Response {
  return redirectTo(nosUrl(`${pathname}${request.nextUrl.search}`));
}

function rewriteTo(request: NextRequest, pathname: string): Response {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  return NextResponse.rewrite(target);
}

function routeNosHost(request: NextRequest): Response {
  const { pathname, search } = request.nextUrl;

  if (RETIRED_SA_EXHIBITORS_PATHS.has(pathname)) return redirectTo(nosUrl(MERGED_VENDORS_PATH));
  if (pathname === RETIRED_CONSTITUTION_PATH) return redirectTo(saocUrl(`${MOI_PATH}${search}`));
  if (RETIRED_EXHIBITORS_ENTRY_PATHS.has(pathname)) return redirectTo(nosUrl(`${AWARD_ENTRIES_PATH}${search}`));
  if (SAOC_ONLY_EXACT.has(pathname) || isUnderAny(pathname, SAOC_ONLY_PREFIXES)) {
    return redirectTo(saocUrl(`${pathname}${search}`));
  }
  if (isUnder(pathname, NOS_INTERNAL_PREFIX) && pathname !== NOS_OG_PATH) {
    return redirectWithinNos(request, nosPath(pathname));
  }
  if (pathname === NOS_OG_PATH || SHARED_EXACT.has(pathname) || isUnderAny(pathname, SHARED_PREFIXES)) {
    return NextResponse.next();
  }
  if (pathname === NOS_TICKETS_ROOT || isUnder(pathname, NOS_TICKETS_BUY_PREFIX)) {
    return rewriteTo(request, `${NOS_INTERNAL_PREFIX}${pathname}`);
  }
  if (isUnderAny(pathname, NOS_TOP_LEVEL_PREFIXES)) return NextResponse.next();
  return rewriteTo(request, pathname === '/' ? NOS_INTERNAL_PREFIX : `${NOS_INTERNAL_PREFIX}${pathname}`);
}

function routeSaocHost(request: NextRequest): Response {
  const { pathname, search } = request.nextUrl;
  if (RETIRED_SA_EXHIBITORS_PATHS.has(pathname)) return redirectTo(nosUrl(MERGED_VENDORS_PATH));
  if (pathname === RETIRED_CONSTITUTION_PATH) return redirectTo(saocUrl(`${MOI_PATH}${search}`));
  if (RETIRED_EXHIBITORS_ENTRY_PATHS.has(pathname)) return redirectTo(nosUrl(`${AWARD_ENTRIES_PATH}${search}`));
  if (isUnderAny(pathname, SHOW_PREFIXES)) return redirectTo(nosUrl(`${pathname}${search}`));
  return NextResponse.next();
}

function routeByHost(request: NextRequest, site: Site): Response {
  if (isHostNeutralPath(request.nextUrl.pathname)) return NextResponse.next();
  return site === 'nos' ? routeNosHost(request) : routeSaocHost(request);
}

export async function proxy(request: NextRequest): Promise<Response> {
  const publiclyLaunched = isPubliclyLaunched(process.env.SITE_PUBLIC_LAUNCH);

  const allowed = await decideBasicAuth({
    pathname: request.nextUrl.pathname,
    authorizationHeader: request.headers.get('authorization'),
    expectedUser: process.env.BETA_BASIC_AUTH_USER,
    expectedPassword: process.env.BETA_BASIC_AUTH_PASSWORD,
    isProduction: process.env.NODE_ENV === 'production',
    publiclyLaunched,
    passwordWallOff: isPasswordWallOff(process.env.BETA_PASSWORD_WALL_OFF),
  });

  const wallUp = !publiclyLaunched;

  if (!allowed) {
    const response = new Response('Authentication required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="SAOC Beta", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
    return wallUp ? applyWallHeaders(response) : response;
  }

  const site = siteOfRequest(request);
  const response = routeByHost(request, site);
  response.headers.set(SITE_HEADER, site);
  return wallUp ? applyWallHeaders(response) : response;
}
