// Golden for the response headers of /tickets/recover (mission nos-order-recovery). Frozen by @architect.
// Run: pnpm exec tsx .agent/memory/project/specs/nos-order-recovery/goldens/recover-headers.golden.ts
// The token in the URL is a bearer secret, so this route must never be cacheable, indexable or leak
// the URL in a Referer. next.config.ts headers() is evaluated and each rule's `source` is matched with
// Next's own matcher (next/dist/shared/lib/router/utils/path-match), so a rule that looks right but
// does not match, or two rules that both match and fight over Referrer-Policy, fail here.
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

async function main() {
  const config = (await import(path.join(ROOT, 'next.config.ts'))).default;
  const { getPathMatch } = await import('next/dist/shared/lib/router/utils/path-match');
  const rules: Rule[] = await config.headers();

  function effective(pathname: string): Map<string, string[]> {
    const merged = new Map<string, string[]>();
    for (const rule of rules) {
      if (!getPathMatch(rule.source)(pathname)) continue;
      for (const { key, value } of rule.headers) merged.set(key, [...(merged.get(key) ?? []), value]);
    }
    return merged;
  }
  const one = (pathname: string, key: string): string | null => {
    const values = effective(pathname).get(key) ?? [];
    assert.ok(values.length <= 1, `${pathname}: ${key} is set by ${values.length} rules (${values.join(' | ')}), it must be exactly one`);
    return values[0] ?? null;
  };

  // 1. The recover route: no Referer, never stored, never indexed.
  const RECOVER = '/tickets/recover';
  assert.equal(one(RECOVER, 'Referrer-Policy'), 'no-referrer');
  assert.equal(one(RECOVER, 'Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(one(RECOVER, 'X-Robots-Tag'), 'noindex, nofollow');

  // 2. The rest of the security headers still apply to it (this route is not exempted from them).
  for (const key of ['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Permissions-Policy', 'Content-Security-Policy-Report-Only']) {
    assert.ok(one(RECOVER, key), `${RECOVER} keeps ${key}`);
  }

  // 3. Nothing else changed: every other path keeps the global Referrer-Policy and gains no
  //    Cache-Control or X-Robots-Tag from next.config (their caching is Next's and the wall's).
  const OTHERS = [
    '/', '/about', '/tickets', '/tickets/buy/day-visitor', '/tickets/confirmation', '/tickets/recover/extra',
    '/tickets/recoverx', '/tickets/recover-me', '/tickets/some-slug', '/api/tickets/checkout', '/admin',
    '/vendors', '/_next/static/chunks/a.js', '/national-show/tickets',
  ];
  for (const other of OTHERS) {
    assert.equal(one(other, 'Referrer-Policy'), 'strict-origin-when-cross-origin', `${other} keeps the global Referrer-Policy`);
    assert.equal(one(other, 'Cache-Control'), null, `${other} gets no Cache-Control from next.config`);
    assert.equal(one(other, 'X-Robots-Tag'), null, `${other} gets no X-Robots-Tag from next.config`);
    for (const key of ['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Permissions-Policy', 'Content-Security-Policy-Report-Only']) {
      assert.ok(one(other, key), `${other} keeps ${key}`);
    }
  }

  // 4. A trailing slash is redirected to the clean path by Next, so the clean path is what matters,
  //    but the slashed form must not slip out with the leaky global policy either.
  assert.equal(one('/tickets/recover/', 'Referrer-Policy'), 'no-referrer');

  process.stdout.write('recover-headers.golden: PASS\n');
}

main().catch((error) => {
  process.stderr.write(`recover-headers.golden: FAIL ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
