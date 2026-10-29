// Behavioural golden for the five shared-lane routes that moved from the per-instance limiter to
// the durable one (SEC-15): contact, newsletter subscribe and unsubscribe, ticket status, ticket pdf.
// Drives each REAL route handler against the in-memory Firestore fake. For every route: the Nth
// request is let through and the N+1th is refused with Retry-After, a forged leading
// X-Forwarded-For hop buys nothing, another client is untouched, a store failure refuses the request
// (fail closed), and the stored limiter document holds no raw address.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/routes-limited.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';
import { FakeFirestore, installMocks, type SanityFixture } from './fakes';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'mockproj';
process.env.RECOVERY_TOKEN_SECRET = 'golden-recovery-secret';

const db = new FakeFirestore();
const sanity: SanityFixture = { salesOpen: true, shows: [], types: {}, queries: [] };
installMocks(db, sanity);
const outbound: string[] = [];
globalThis.fetch = (async (input: unknown) => { outbound.push(String(input)); throw new Error('no network in this golden'); }) as typeof fetch;

const lb = '35.191.0.1';

interface RouteCase {
  name: string;
  file: string;
  method: 'GET' | 'POST';
  url: string;
  max: number; // existing per-window limit, unchanged by F3
  scope: string;
  refusalStatus: number;
  failStatus: number;
}

const ROUTES: RouteCase[] = [
  { name: 'contact', file: 'app/api/contact/route.ts', method: 'POST', url: 'http://localhost/api/contact', max: 5, scope: 'contact', refusalStatus: 429, failStatus: 500 },
  { name: 'newsletter subscribe', file: 'app/api/newsletter/subscribe/route.ts', method: 'POST', url: 'http://localhost/api/newsletter/subscribe', max: 5, scope: 'newsletter-subscribe', refusalStatus: 429, failStatus: 500 },
  { name: 'newsletter unsubscribe', file: 'app/api/newsletter/unsubscribe/route.ts', method: 'POST', url: 'http://localhost/api/newsletter/unsubscribe', max: 10, scope: 'newsletter-unsubscribe', refusalStatus: 429, failStatus: 500 },
  { name: 'ticket status', file: 'app/api/tickets/status/route.ts', method: 'GET', url: 'http://localhost/api/tickets/status', max: 120, scope: 'ticket-status', refusalStatus: 429, failStatus: 500 },
  { name: 'ticket pdf', file: 'app/api/tickets/pdf/route.ts', method: 'GET', url: 'http://localhost/api/tickets/pdf', max: 60, scope: 'ticket-pdf', refusalStatus: 429, failStatus: 500 },
];

async function main() {
  const { NextRequest } = await import('next/server');

  for (const route of ROUTES) {
    const handler = (await import(path.join(ROOT, route.file)))[route.method] as (request: InstanceType<typeof NextRequest>) => Promise<Response>;
    assert.equal(typeof handler, 'function', `${route.name}: exports ${route.method}`);
    const call = (xff: string | null) => {
      const headers: Record<string, string> = {};
      if (xff !== null) headers['x-forwarded-for'] = xff;
      let body: string | undefined;
      if (route.method === 'POST') {
        body = '{}';
        headers['content-type'] = 'application/json';
        headers['content-length'] = String(body.length);
      }
      return handler(new NextRequest(route.url, { method: route.method, headers, body }));
    };
    const label = (text: string) => `${route.name}: ${text}`;

    db.clear();
    sanity.queries.length = 0;
    process.env.RECOVERY_TOKEN_SECRET = 'golden-recovery-secret';

    // N requests pass the limiter (they are then rejected for their empty input, or answered), the
    // N+1th is refused. A rotating forged leading hop must not buy a fresh budget.
    for (let i = 0; i < route.max; i++) {
      const response = await call(`10.0.${Math.floor(i / 200)}.${i % 200}, 203.0.113.9, ${lb}`);
      assert.notEqual(response.status, route.refusalStatus, label(`request ${i + 1} of ${route.max} is let through`));
      assert.ok(response.status < 500, label(`request ${i + 1} is not a server error (got ${response.status})`));
    }
    const denied = await call(`10.9.9.9, 203.0.113.9, ${lb}`);
    assert.equal(denied.status, route.refusalStatus, label(`request ${route.max + 1} is refused`));
    assert.match(denied.headers.get('retry-after') ?? '', /^[1-9]\d*$/, label('refusal carries Retry-After seconds'));

    // Another client has its own budget.
    const other = await call(`10.0.0.1, 203.0.113.77, ${lb}`);
    assert.notEqual(other.status, route.refusalStatus, label('another client is untouched'));

    // A lone forwarded entry is untrusted: it lands in the shared strict bucket, not in a bucket it chose.
    const stored = db.all('abuseLimits');
    assert.ok(stored.every((doc) => doc.id.startsWith(`${route.scope}:`)), label(`limiter documents are scoped "${route.scope}"`));
    assert.equal(stored.length, 2, label('one document per distinct trusted client'));
    const raw = JSON.stringify(stored);
    for (const fragment of ['203.0.113', '10.0.0', '10.9.9']) assert.ok(!raw.includes(fragment), label(`no raw address ${fragment} stored`));

    // Fail closed: with the store down the request is refused, never waved through.
    db.failing = true;
    const failed = await call(`10.0.0.1, 203.0.113.200, ${lb}`);
    assert.equal(failed.status, route.failStatus, label('a store failure refuses the request'));
    db.failing = false;

    // A missing limiter secret is the same fail-closed refusal.
    delete process.env.RECOVERY_TOKEN_SECRET;
    const noSecret = await call(`10.0.0.1, 203.0.113.201, ${lb}`);
    assert.equal(noSecret.status, route.failStatus, label('a missing limiter secret refuses the request'));
    process.env.RECOVERY_TOKEN_SECRET = 'golden-recovery-secret';
    assert.equal(outbound.length, 0, label('no network use'));
  }

  console.log('routes-limited golden: PASS');
}

main().catch((error) => {
  console.error('routes-limited golden: FAIL');
  console.error(error);
  process.exit(1);
});
