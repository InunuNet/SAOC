// e2e/beta-password-wall-decision.spec.ts
// Mission beta-password-wall F1 — GOLDEN FILE, authored by @architect. Pure
// unit-style tests of proxy.ts's exported decision functions and
// lib/beta-public-launch.ts's isPubliclyLaunched — no browser, no running
// server, the same convention as every plain-Node `test()` block elsewhere in
// this repo's e2e/ directory. @dev implements proxy.ts, lib/beta-public-launch.ts
// and the app/robots.ts change against this spec, not against prose; if an
// assertion here seems wrong, escalate to @architect rather than loosening it.
//
// HOST-AGNOSTIC BY DESIGN (team-lead override, 2026-10-06): there is no
// host-based bypass anywhere in this suite — the wall, the noindex header, and
// robots.ts's disallow-all all apply on every host until SITE_PUBLIC_LAUNCH is
// exactly 'true'. See lib/beta-public-launch.ts's header comment for why.
import { expect, test } from '@playwright/test';
import { NextRequest } from 'next/server';

import { isPubliclyLaunched } from '../lib/beta-public-launch';
import { constantTimeEqual, decideBasicAuth, isExemptPath, proxy } from '../proxy';

const EXEMPT_PATHS = [
  '/api/tickets/itn',
  '/api/tickets/ozow-itn',
  '/api/vendors/stand-payment/payfast-itn',
  '/api/vendors/stand-payment/ozow-itn',
  '/api/revalidate',
  '/api/admin/reconcile-orders',
];

function basicAuthHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

test.describe('lib/beta-public-launch.ts isPubliclyLaunched — exact match, fail closed', () => {
  test('exactly "true" is the only value that launches', () => {
    expect(isPubliclyLaunched('true')).toBe(true);
  });

  test('unset, near-miss, and non-exact values all stay walled', () => {
    expect(isPubliclyLaunched(undefined)).toBe(false);
    expect(isPubliclyLaunched('')).toBe(false);
    expect(isPubliclyLaunched('TRUE')).toBe(false);
    expect(isPubliclyLaunched('True')).toBe(false);
    expect(isPubliclyLaunched('1')).toBe(false);
    expect(isPubliclyLaunched('yes')).toBe(false);
    expect(isPubliclyLaunched(' true')).toBe(false);
    expect(isPubliclyLaunched('true ')).toBe(false);
  });
});

test.describe('proxy.ts isExemptPath — exact match only', () => {
  for (const path of EXEMPT_PATHS) {
    test(`${path} is exempt`, () => {
      expect(isExemptPath(path)).toBe(true);
    });
  }

  test('near-miss paths are NOT exempt (no prefix matching)', () => {
    expect(isExemptPath('/api/tickets/itn-evil')).toBe(false);
    expect(isExemptPath('/api/tickets/itn/')).toBe(false);
    expect(isExemptPath('/api/revalidate/../admin')).toBe(false);
    // what /api/revalidate/../admin actually resolves to once a real URL parses
    // and normalises it — also must not be exempt.
    expect(isExemptPath(new URL('https://x/api/revalidate/../admin').pathname)).toBe(false);
    expect(isExemptPath('/api/admin')).toBe(false);
    expect(isExemptPath('/api/admin/reconcile-orders/')).toBe(false);
    expect(isExemptPath('/')).toBe(false);
  });
});

test.describe('proxy.ts constantTimeEqual', () => {
  test('equal strings match', async () => {
    expect(await constantTimeEqual('correct-password', 'correct-password')).toBe(true);
  });

  test('different strings, including different lengths, do not match', async () => {
    expect(await constantTimeEqual('correct-password', 'wrong-password')).toBe(false);
    expect(await constantTimeEqual('short', 'a-much-longer-value')).toBe(false);
    expect(await constantTimeEqual('', 'nonempty')).toBe(false);
    expect(await constantTimeEqual('', '')).toBe(true);
  });
});

test.describe('proxy.ts decideBasicAuth', () => {
  const baseInput = {
    pathname: '/',
    authorizationHeader: null as string | null,
    expectedUser: 'councilbeta',
    expectedPassword: 's3cr3t-value',
    isProduction: true,
    publiclyLaunched: false,
  };

  for (const path of EXEMPT_PATHS) {
    test(`exempt path ${path} always allowed, no credentials, not launched`, async () => {
      const allowed = await decideBasicAuth({
        ...baseInput,
        pathname: path,
        authorizationHeader: null,
      });
      expect(allowed).toBe(true);
    });
  }

  test('publiclyLaunched=true always allows, even with no credentials configured', async () => {
    const allowed = await decideBasicAuth({
      ...baseInput,
      publiclyLaunched: true,
      expectedUser: undefined,
      expectedPassword: undefined,
      authorizationHeader: null,
    });
    expect(allowed).toBe(true);
  });

  test('FAIL CLOSED: unconfigured credentials in production, not launched, denies every non-exempt request', async () => {
    const allowed = await decideBasicAuth({
      ...baseInput,
      expectedUser: undefined,
      expectedPassword: undefined,
      authorizationHeader: null,
    });
    expect(allowed).toBe(false);
  });

  test('BYPASS: unconfigured credentials outside production (local dev) allow the request', async () => {
    const allowed = await decideBasicAuth({
      ...baseInput,
      expectedUser: undefined,
      expectedPassword: undefined,
      authorizationHeader: null,
      isProduction: false,
    });
    expect(allowed).toBe(true);
  });

  test('no Authorization header, credentials configured -> denied (401)', async () => {
    const allowed = await decideBasicAuth({ ...baseInput, authorizationHeader: null });
    expect(allowed).toBe(false);
  });

  test('wrong password, correctly Basic-encoded -> denied (401)', async () => {
    const allowed = await decideBasicAuth({
      ...baseInput,
      authorizationHeader: basicAuthHeader('councilbeta', 'the-wrong-password'),
    });
    expect(allowed).toBe(false);
  });

  test('wrong username, correct password -> denied (401)', async () => {
    const allowed = await decideBasicAuth({
      ...baseInput,
      authorizationHeader: basicAuthHeader('someone-else', 's3cr3t-value'),
    });
    expect(allowed).toBe(false);
  });

  test('malformed Authorization header (not Basic, no colon, or invalid base64) -> denied', async () => {
    expect(await decideBasicAuth({ ...baseInput, authorizationHeader: 'Bearer abc123' })).toBe(
      false,
    );
    expect(
      await decideBasicAuth({
        ...baseInput,
        authorizationHeader: `Basic ${Buffer.from('no-colon-here').toString('base64')}`,
      }),
    ).toBe(false);
    expect(
      await decideBasicAuth({ ...baseInput, authorizationHeader: 'Basic not-valid-base64!!!' }),
    ).toBe(false);
  });

  test('correct credentials, correctly Basic-encoded -> allowed (200)', async () => {
    const allowed = await decideBasicAuth({
      ...baseInput,
      authorizationHeader: basicAuthHeader('councilbeta', 's3cr3t-value'),
    });
    expect(allowed).toBe(true);
  });

  test('exempt path wins even with a garbage Authorization header', async () => {
    const allowed = await decideBasicAuth({
      ...baseInput,
      pathname: '/api/revalidate',
      authorizationHeader: 'not even close to Basic auth',
    });
    expect(allowed).toBe(true);
  });
});

test.describe('proxy() end-to-end response shape', () => {
  const ORIGINAL_ENV = { ...process.env };

  test.afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function requestFor(url: string, authorization?: string): NextRequest {
    const requestHeaders = new Headers();
    if (authorization) requestHeaders.set('authorization', authorization);
    return new NextRequest(url, { headers: requestHeaders });
  }

  // next's global.d.ts augments ProcessEnv.NODE_ENV as readonly, so a direct
  // `process.env.NODE_ENV = ...` fails tsc (TS2540) even though the runtime
  // property is a perfectly ordinary mutable string. Object.defineProperty
  // reassigns the same property through a route the type checker doesn't
  // special-case, with identical runtime behaviour. Safe to redefine per-test:
  // the afterEach above replaces `process.env` wholesale with a fresh
  // `{ ...ORIGINAL_ENV }` object, which carries no descriptor from this call,
  // so nothing here leaks between tests.
  function setNodeEnv(value: 'production' | 'development' | 'test'): void {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }

  test('denied request: 401, WWW-Authenticate, and noindex', async () => {
    delete process.env.SITE_PUBLIC_LAUNCH;
    setNodeEnv('production');
    process.env.BETA_BASIC_AUTH_USER = 'councilbeta';
    process.env.BETA_BASIC_AUTH_PASSWORD = 's3cr3t-value';

    const response = await proxy(requestFor('https://beta.saoc.co.za/'));

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  test('allowed request (correct credentials): 200 and still noindex (not launched)', async () => {
    delete process.env.SITE_PUBLIC_LAUNCH;
    setNodeEnv('production');
    process.env.BETA_BASIC_AUTH_USER = 'councilbeta';
    process.env.BETA_BASIC_AUTH_PASSWORD = 's3cr3t-value';

    const response = await proxy(
      requestFor('https://beta.saoc.co.za/', basicAuthHeader('councilbeta', 's3cr3t-value')),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  test('SITE_PUBLIC_LAUNCH="true": never noindexed and never challenged, even on the real production host, even with no Authorization header', async () => {
    process.env.SITE_PUBLIC_LAUNCH = 'true';
    setNodeEnv('production');
    process.env.BETA_BASIC_AUTH_USER = 'councilbeta';
    process.env.BETA_BASIC_AUTH_PASSWORD = 's3cr3t-value';

    const response = await proxy(requestFor('https://saoc.co.za/'));

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
    expect(response.headers.get('WWW-Authenticate')).toBeNull();
  });

  test('SITE_PUBLIC_LAUNCH="TRUE" (wrong case) still walls the site', async () => {
    process.env.SITE_PUBLIC_LAUNCH = 'TRUE';
    setNodeEnv('production');
    process.env.BETA_BASIC_AUTH_USER = 'councilbeta';
    process.env.BETA_BASIC_AUTH_PASSWORD = 's3cr3t-value';

    const response = await proxy(requestFor('https://saoc.co.za/'));

    expect(response.status).toBe(401);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
});
