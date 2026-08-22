// Shared golden loader for the ozow-m1-f1 checks. Every hash in ozow-wire.golden.json was
// computed by SELF-CONSISTENTLY EXECUTING the documented Ozow algorithm (plain SHA512: ordered
// concat + private key appended + lowercase + sha512) against fabricated test credentials, not
// transcribed from a live captured transaction — see that file's _meta block and
// contracts/golden/ozow-m1-f1/README.md for why (Ozow's pay.ozow.com response layer does not
// distinguish signature correctness over raw HTTP without a real browser session).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const golden = JSON.parse(
  readFileSync(resolve(here, '../../golden/ozow-m1-f1/ozow-wire.golden.json'), 'utf8')
);

export function makeReporter(label) {
  const failures = [];
  return {
    eq(caseName, actual, expected) {
      const a = typeof actual === 'string' ? actual : JSON.stringify(actual);
      const e = typeof expected === 'string' ? expected : JSON.stringify(expected);
      if (a !== e) failures.push(`${caseName}\n    expected: ${e}\n    actual:   ${a}`);
    },
    ok(caseName, condition, detail = '') {
      if (!condition) failures.push(`${caseName}${detail ? `\n    ${detail}` : ''}`);
    },
    done() {
      if (failures.length) {
        console.error(`FAIL ${label} — ${failures.length} case(s):`);
        for (const f of failures) console.error(`  - ${f}`);
        process.exit(1);
      }
      console.log(`PASS ${label}`);
    },
  };
}

/** Build a NotificationRequestLike-shaped fake request from a fields object (must include the
 *  posted 'Hash' field). Mirrors how a real Ozow notify POST body is form-urlencoded. */
export function fakeNotifyRequest(fieldsWithHash) {
  const pairs = Object.entries(fieldsWithHash).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  const rawBody = pairs.join('&');
  return {
    rawBody,
    headers: { get: () => null },
  };
}
