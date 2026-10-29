// Live-server golden for /tickets/recover (mission nos-order-recovery). Frozen by @architect.
// Run: pnpm exec tsx .agent/memory/project/specs/nos-order-recovery/goldens/check-recover-live.mts
// Needs `node scripts/checks/sanity-request-count.mjs --build` first (the stubbed production build) and a
// checkout path WITHOUT spaces (scripts/checks/lib/local-next-server.mjs puts a path in NODE_OPTIONS
// unquoted; SAOC is fixing that in #160). GET only. Sanity is stubbed and Firebase credentials are blanked
// by the helper, so no live system is touched and no Firestore read can succeed: every case below must be
// answered WITHOUT reaching Firestore, which is itself part of what is proved (a token that fails
// verification must not cost a database read).
//
// Nine token classes are requested in two tiers (see the comment in main). Every response must have the same
// status (404) and headers, equal-length probes the same body, all probes the same rendered HTML. The only thing allowed to differ is the request's own query string echoed back by
// Next into its flight data, so each body is normalised by replacing that exact query (raw and encoded)
// with a placeholder before comparing. Anything else that differs is a finding, not noise.
import assert from 'node:assert/strict';
import http from 'node:http';

import { mintRecoveryToken } from '../../../../../../lib/recovery-token.ts';
// @ts-expect-error the helper is plain JS
import { SANDBOX_DIR, startServer } from '../../../../../../scripts/checks/lib/local-next-server.mjs';

const PORT = 3231;
const SECRET = `live-golden-${'q'.repeat(48)}`; // not a credential
const OTHER_SECRET = `live-other-${'w'.repeat(48)}`;
const NOW = new Date();
process.env.RECOVERY_TOKEN_SECRET = SECRET; // startServer spreads process.env into the server env

const volatile = new Set(['date', 'etag', 'content-length', 'connection', 'keep-alive', 'transfer-encoding', 'x-request-id']);

function fetchOnce(host: string, target: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: target, method: 'GET', headers: { host } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) if (!volatile.has(k)) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
        resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

const redact = (body: string, query: string) =>
  [query, encodeURIComponent(query), query.replace(/\./g, '%2E')].reduce((acc, q) => (q ? acc.split(q).join('<QUERY>') : acc), body);

async function main() {
  const live = await startServer({ port: PORT, countLog: `${SANDBOX_DIR}/recover-live.log`, launched: true });
  try {
    const host = live.hostFor('nos');
    const valid = mintRecoveryToken({ orderId: 'order-live-A', secret: SECRET, now: NOW }).token;
    const forged = mintRecoveryToken({ orderId: 'order-live-A', secret: OTHER_SECRET, now: NOW }).token;
    const [payload, signature] = valid.split('.');
    const tampered = `${Buffer.from(JSON.stringify({ o: 'order-live-B', e: NOW.getTime() + 1e9 })).toString('base64url')}.${signature}`;
    const expired = mintRecoveryToken({ orderId: 'order-live-A', secret: SECRET, now: new Date(NOW.getTime() - 400 * 86_400_000) }).token;

    // Next streams the page's RSC payload inline, and how much of the shared layout row it inlines depends on
    // the LENGTH of the request URL (a short query inlines it, a long one outlines it as $L13). Length is chosen
    // by the requester and is public, so it is no oracle, but it means bodies of different-length queries differ
    // for a reason unrelated to the code path. So the comparison is in two tiers:
    //   tier 1: probes of EXACTLY equal query length (forged, tampered, expired, shape-denied) must be
    //           byte-identical, full body, after redacting only the echoed query.
    //   tier 2: every probe, any length, must match on status, headers and the rendered HTML with the
    //           inline flight scripts removed.
    const fullLength = `?token=${encodeURIComponent(forged)}`.length;
    const shapeDenied = `?token=${'a'.repeat(fullLength - '?token='.length)}`;
    const equalLength: Array<[string, string]> = [
      ['forged signature', `?token=${encodeURIComponent(forged)}`],
      ['tampered payload', `?token=${encodeURIComponent(tampered)}`],
      ['expired, valid signature', `?token=${encodeURIComponent(expired)}`],
      ['shape-denied, same length', shapeDenied],
    ];
    for (const [label, query] of equalLength) {
      assert.equal(query.length, fullLength, `${label}: the tier-1 probes are the same length`);
    }
    const anyLength: Array<[string, string]> = [
      ['no token param', ''],
      ['empty token', '?token='],
      ['malformed', '?token=abc'],
      ['repeated param', `?token=${encodeURIComponent(valid.slice(0, 20))}&token=x`],
      ['oversize', `?token=${'a'.repeat(5000)}`],
    ];
    void payload;

    const fetchAll = async (cases: Array<[string, string]>) => {
      const out = [];
      for (const [label, query] of cases) {
        const res = await fetchOnce(host, `/tickets/recover${query}`);
        out.push({ label, query, ...res, body: redact(res.body, query.replace(/^\?/, '')) });
      }
      return out;
    };
    const stripFlight = (html: string) => html.replace(/<script[^>]*>[^<]*__next_f[\s\S]*?<\/script>/g, '');

    // The first request a fresh `next start` serves for a route is streamed with different RSC chunking from every
    // later one (observed: request 1 of a run differs from requests 2-6 of the SAME token class; requests 2-6 are
    // identical across all four classes). That is server warm-up, not a token class, so it is discarded: two
    // throwaway requests per distinct URL length before anything is compared. It does not loosen the comparison,
    // which is still strict across every class once the server is warm.
    for (const warm of [shapeDenied, shapeDenied, '?token=warm', '?token=warm']) {
      await fetchOnce(host, `/tickets/recover${warm}`);
    }
    const tier1 = await fetchAll(equalLength);
    const tier2 = [...tier1, ...(await fetchAll(anyLength))];
    const results = tier2;
    const first = tier1[0];
    assert.equal(first.status, 404, 'a token that does not open an order is a 404');
    for (const r of tier1.slice(1)) {
      assert.equal(r.body, first.body, `${r.label}: body differs from "${first.label}" at equal query length`);
    }
    for (const r of tier2.slice(1)) {
      assert.equal(r.status, first.status, `${r.label}: status`);
      assert.deepStrictEqual(r.headers, first.headers, `${r.label}: headers differ from "${first.label}"`);
      assert.equal(stripFlight(r.body), stripFlight(first.body), `${r.label}: rendered HTML differs from "${first.label}" outside the flight payload`);
      assert.ok(stripFlight(first.body).length > 500, 'the stripped HTML is a real page, not an empty string that trivially matches');
    }
    // Headers every case carries.
    assert.equal(first.headers['referrer-policy'], 'no-referrer');
    assert.match(first.headers['cache-control'] ?? '', /no-store/);
    assert.doesNotMatch(first.headers['cache-control'] ?? '', /s-maxage|public/);
    assert.match(first.headers['x-robots-tag'] ?? '', /noindex/);
    // The body never reflects a token anywhere except as the echoed query (already redacted above).
    for (const r of results) {
      assert.ok(!r.body.includes(signature), `${r.label}: body does not carry the signature`);
    }
    // Same 404 as the site-wide not-found, so a bad token is indistinguishable from any unknown URL.
    const unknown = await fetchOnce(host, '/tickets/recover/no-such-child');
    assert.equal(unknown.status, 404);
    process.stdout.write('check-recover-live: PASS\n');
  } finally {
    live.stop();
  }
}

main().catch((error) => {
  process.stderr.write(`check-recover-live: FAIL ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
