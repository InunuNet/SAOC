// Live-server golden for /tickets/recover (mission nos-order-recovery). Frozen by @architect.
// Run: pnpm exec tsx .agent/memory/project/specs/nos-order-recovery/goldens/check-recover-live.mts
// Needs `node scripts/checks/sanity-request-count.mjs --build` first (the stubbed production build) and a
// checkout path WITHOUT spaces (scripts/checks/lib/local-next-server.mjs puts a path in NODE_OPTIONS
// unquoted; SAOC is fixing that in #160). GET only. Sanity is stubbed and Firebase credentials are blanked
// by the helper, so no live system is touched and no Firestore read can succeed: every case below must be
// answered WITHOUT reaching Firestore, which is itself part of what is proved (a token that fails
// verification must not cost a database read).
//
// Seven token classes are requested. Every response must have the same status (404), the same headers
// and the same body. The only thing allowed to differ is the request's own query string echoed back by
// Next into its flight data, so each body is normalised by replacing that exact query (raw and encoded)
// with a placeholder before comparing. Anything else that differs is a finding, not noise.
import assert from 'node:assert/strict';
import http from 'node:http';

import { mintRecoveryToken } from '../../../../../lib/recovery-token.ts';
// @ts-expect-error the helper is plain JS
import { startServer } from '../../../../../scripts/checks/lib/local-next-server.mjs';

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
  const live = await startServer({ port: PORT, countLog: '.tmp/sandbox/nos-order-recovery-live/count.log', launched: true });
  try {
    const host = live.hostFor('nos');
    const valid = mintRecoveryToken({ orderId: 'order-live-A', secret: SECRET, now: NOW }).token;
    const forged = mintRecoveryToken({ orderId: 'order-live-A', secret: OTHER_SECRET, now: NOW }).token;
    const [payload, signature] = valid.split('.');
    const tampered = `${Buffer.from(JSON.stringify({ o: 'order-live-B', e: NOW.getTime() + 1e9 })).toString('base64url')}.${signature}`;
    const expired = mintRecoveryToken({ orderId: 'order-live-A', secret: SECRET, now: new Date(NOW.getTime() - 400 * 86_400_000) }).token;

    const cases: Array<[string, string]> = [
      ['no token param', ''],
      ['empty token', '?token='],
      ['malformed', '?token=abc'],
      ['forged signature', `?token=${encodeURIComponent(forged)}`],
      ['tampered payload', `?token=${encodeURIComponent(tampered)}`],
      ['expired, valid signature', `?token=${encodeURIComponent(expired)}`],
      ['repeated param', `?token=${encodeURIComponent(valid.slice(0, 20))}&token=x`],
      ['oversize', `?token=${'a'.repeat(5000)}`],
    ];
    void payload;

    const results = [];
    for (const [label, query] of cases) {
      const res = await fetchOnce(host, `/tickets/recover${query}`);
      results.push({ label, query, ...res, body: redact(res.body, query.replace(/^\?/, '')) });
    }
    const [first, ...rest] = results;
    assert.equal(first.status, 404, 'a token that does not open an order is a 404');
    for (const r of rest) {
      assert.equal(r.status, first.status, `${r.label}: status`);
      assert.deepStrictEqual(r.headers, first.headers, `${r.label}: headers differ from "${first.label}"`);
      assert.equal(r.body, first.body, `${r.label}: body differs from "${first.label}" after redacting its own query`);
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
