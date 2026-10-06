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

import { isPubliclyLaunched } from '@/lib/beta-public-launch';

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

  const credentialsConfigured = Boolean(input.expectedUser) && Boolean(input.expectedPassword);
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

export async function proxy(request: NextRequest): Promise<Response> {
  const publiclyLaunched = isPubliclyLaunched(process.env.SITE_PUBLIC_LAUNCH);

  const allowed = await decideBasicAuth({
    pathname: request.nextUrl.pathname,
    authorizationHeader: request.headers.get('authorization'),
    expectedUser: process.env.BETA_BASIC_AUTH_USER,
    expectedPassword: process.env.BETA_BASIC_AUTH_PASSWORD,
    isProduction: process.env.NODE_ENV === 'production',
    publiclyLaunched,
  });

  const applyNoindex = !publiclyLaunched;

  if (!allowed) {
    const response = new Response('Authentication required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="SAOC Beta", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
    if (applyNoindex) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  const response = NextResponse.next();
  if (applyNoindex) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
