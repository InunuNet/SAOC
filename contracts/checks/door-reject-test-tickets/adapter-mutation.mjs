// F4 adapter mutation proof: each mutant of the adapter constants, the stamp or the lib/payments diff must be
// rejected by adapter-guard.mjs, and the unmutated control must pass (so a broken harness cannot fake a kill).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCoupling, checkDiff } from './adapter-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const files = ['lib/payments/ozow.ts', 'lib/payments/payfast.ts', 'lib/ticket-issuance-mode.ts'];
const original = Object.fromEntries(files.map((file) => [file, readFileSync(path.join(root, file), 'utf8')]));
const sub = (file, from, to) => (text) => { const next = text[file].replace(from, to); if (next === text[file]) throw new Error(`pattern not found in ${file}: ${from}`); return { ...text, [file]: next }; };

const couplingMutants = [
  ['control', (t) => t, false],
  ['ozow-flag-false-keeps-sandbox-credentials', sub('lib/payments/ozow.ts', /OZOW_SANDBOX_MODE = true;/, 'OZOW_SANDBOX_MODE = false;'), true],
  ['ozow-flag-false-isTest-decoupled', (t) => sub('lib/payments/ozow.ts', /const OZOW_IS_TEST = [^;]+;/, "const OZOW_IS_TEST = 'true';")(sub('lib/payments/ozow.ts', /OZOW_SANDBOX_MODE = true;/, 'OZOW_SANDBOX_MODE = false;')(t)), true],
  ['ozow-isTest-hardcoded-false-flag-true', sub('lib/payments/ozow.ts', /const OZOW_IS_TEST = [^;]+;/, "const OZOW_IS_TEST = 'false';"), true],
  ['payfast-flag-false-keeps-sandbox-url', sub('lib/payments/payfast.ts', /PAYFAST_SANDBOX_MODE = true;/, 'PAYFAST_SANDBOX_MODE = false;'), true],
  ['stamp-hand-flag', sub('lib/ticket-issuance-mode.ts', /PAYMENT_GATEWAYS_SANDBOX_ONLY = [^;]+;/, 'PAYMENT_GATEWAYS_SANDBOX_ONLY = false;'), true],
  ['stamp-drops-payfast', sub('lib/ticket-issuance-mode.ts', /OZOW_SANDBOX_MODE \|\| PAYFAST_SANDBOX_MODE;/, 'OZOW_SANDBOX_MODE;'), true],
  ['stamp-drops-ozow', sub('lib/ticket-issuance-mode.ts', /OZOW_SANDBOX_MODE \|\| PAYFAST_SANDBOX_MODE;/, 'PAYFAST_SANDBOX_MODE;'), true],
];

const goodDiff = [
  'diff --git a/lib/payments/ozow.ts b/lib/payments/ozow.ts', '--- a/lib/payments/ozow.ts', '+++ b/lib/payments/ozow.ts', '@@ -87 +87,2 @@',
  "-const OZOW_IS_TEST = 'true';", '+export const OZOW_SANDBOX_MODE = true;', '+const OZOW_IS_TEST = String(OZOW_SANDBOX_MODE);',
  'diff --git a/lib/payments/payfast.ts b/lib/payments/payfast.ts', '--- a/lib/payments/payfast.ts', '+++ b/lib/payments/payfast.ts', '@@ -20 +20,2 @@', '+export const PAYFAST_SANDBOX_MODE = true;',
];
const diffMutants = [
  ['diff-control', goodDiff, false],
  ['diff-flag-false', goodDiff.map((l) => l.replace('OZOW_SANDBOX_MODE = true', 'OZOW_SANDBOX_MODE = false')), true],
  ['diff-extra-code-line', [...goodDiff, '+const sneaky = 1;'], true],
  ['diff-other-removal', [...goodDiff, '-const OZOW_CURRENCY_CODE = \'ZAR\';'], true],
  ['diff-other-file', [...goodDiff, 'diff --git a/lib/payments/active-gateway.ts b/lib/payments/active-gateway.ts', '--- a/lib/payments/active-gateway.ts', '+++ b/lib/payments/active-gateway.ts', '+// x'], true],
  ['diff-isTest-not-reading-flag', goodDiff.map((l) => l.replace('String(OZOW_SANDBOX_MODE)', "'true'")), true],
  ['diff-missing-payfast-export', goodDiff.slice(0, -1), true],
];

let failed = false;
const report = (name, rejected, want) => { console.log(`${name}: ${rejected ? 'rejected' : 'accepted'} (want ${want ? 'rejected' : 'accepted'})`); if (rejected !== want) failed = true; };
for (const [name, mutate, want] of couplingMutants) {
  const text = mutate({ ...original });
  report(name, checkCoupling((file) => text[file]).length > 0, want);
}
for (const [name, lines, want] of diffMutants) report(name, checkDiff(lines.join('\n')).length > 0, want);
process.exit(failed ? 1 : 0);
