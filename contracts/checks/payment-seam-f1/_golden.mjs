// Shared golden loader for the payment-seam-f1 checks. Every vector in payfast-wire.golden.json
// was produced by EXECUTING the real pre-move code (lib/payfast.ts + the two routes) on
// 2026-08-19, not transcribed by hand — see that file's _meta block.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const golden = JSON.parse(
  readFileSync(resolve(here, '../../golden/payment-seam-f1/payfast-wire.golden.json'), 'utf8')
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
