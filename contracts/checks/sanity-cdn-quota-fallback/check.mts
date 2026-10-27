// Usage: pnpm exec tsx contracts/checks/sanity-cdn-quota-fallback/check.mts
// The shared Sanity client must retry a CDN fetch once against the API host (useCdn: false) when
// the CDN fails with a quota/rate-limit/5xx error (live incident 2026-10-26: HTTP 402
// plan_limit_reached), must not retry any other error, and must make exactly one call when the
// CDN answers.
import type { SanityClient } from 'next-sanity';

import { withCdnFallback } from '../../../sanity/lib/cdn-fallback.ts';

type Call = { query: string; params: unknown; options: Record<string, unknown> | undefined };

const QUERY = 'count(*[_type=="ticketType"])';
const PARAMS = { slug: 'vip' };
const OPTIONS = { next: { tags: ['sanity'] }, perspective: 'published', useCdn: true };
const API_RESULT = 5;

function fakeClient(cdnOutcome: { reject: { statusCode: number } } | { resolve: unknown }) {
  const calls: Call[] = [];
  const fake = {
    config: () => ({ useCdn: true }),
    fetch: async (query: string, params: unknown, options?: Record<string, unknown>) => {
      calls.push({ query, params, options });
      if (options?.useCdn === false) return API_RESULT;
      if ('reject' in cdnOutcome) throw Object.assign(new Error('cdn'), cdnOutcome.reject);
      return cdnOutcome.resolve;
    },
  };
  // The fake implements only the two members withCdnFallback touches (fetch, config).
  return { client: withCdnFallback(fake as unknown as SanityClient), calls };
}

const fails: string[] = [];
const check = (label: string, ok: boolean) => {
  if (!ok) fails.push(label);
};

{
  const { client, calls } = fakeClient({ reject: { statusCode: 402 } });
  const result = await client.fetch(QUERY, PARAMS, OPTIONS);
  check('402: returns the API-host result', result === API_RESULT);
  check('402: exactly two calls (CDN, then one retry)', calls.length === 2);
  check('402: first call goes to the CDN', calls[0]?.options?.useCdn === true);
  check('402: retry uses useCdn:false', calls[1]?.options?.useCdn === false);
  check('402: retry keeps query and params', calls[1]?.query === QUERY && calls[1]?.params === PARAMS);
  check(
    '402: retry keeps perspective and next tags',
    calls[1]?.options?.perspective === 'published' && calls[1]?.options?.next === OPTIONS.next,
  );
}

for (const statusCode of [429, 500, 503]) {
  const { client, calls } = fakeClient({ reject: { statusCode } });
  const result = await client.fetch(QUERY, PARAMS, OPTIONS);
  check(`${statusCode}: falls back to the API host`, result === API_RESULT && calls.length === 2);
}

{
  const { client, calls } = fakeClient({ reject: { statusCode: 400 } });
  let threw = false;
  try {
    await client.fetch(QUERY, PARAMS, OPTIONS);
  } catch {
    threw = true;
  }
  check('400: error propagates', threw);
  check('400: no retry', calls.length === 1);
}

{
  const { client, calls } = fakeClient({ reject: { statusCode: 402 } });
  let threw = false;
  try {
    await client.fetch(QUERY, PARAMS, { ...OPTIONS, useCdn: false });
  } catch {
    threw = true;
  }
  // useCdn:false resolves in the fake, so this asserts the non-CDN path is a single call.
  check('useCdn:false request: single call, no retry', !threw && calls.length === 1);
}

{
  const { client, calls } = fakeClient({ resolve: 7 });
  const result = await client.fetch(QUERY);
  check('CDN success: returns the CDN result', result === 7);
  check('CDN success: exactly one call', calls.length === 1);
}

if (fails.length > 0) {
  console.error(`FAIL sanity-cdn-quota-fallback:\n  - ${fails.join('\n  - ')}`);
  process.exit(1);
}
console.log('PASS sanity-cdn-quota-fallback');
