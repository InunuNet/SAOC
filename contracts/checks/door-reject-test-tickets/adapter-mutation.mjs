// F4 adapter mutation proof: each mutant of the sandbox-mode leaf, the adapters, the stamp, its imports or the
// lib/payments diff must be rejected by adapter-guard.mjs, and the unmutated controls must pass (so a broken
// harness cannot fake a kill).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCheckout, checkClientSafe, checkCoupling, checkDiff } from './adapter-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const files = ['app/api/tickets/checkout/route.ts', 'lib/payments/ozow.ts', 'lib/payments/payfast.ts', 'lib/payments/sandbox-mode.ts', 'lib/ticket-issuance-mode.ts', 'lib/checkout-reservation.ts', 'lib/orders.ts'];
const original = Object.fromEntries(files.map((file) => [file, readFileSync(path.join(root, file), 'utf8')]));
const sub = (file, from, to) => (text) => { const next = text[file].replace(from, to); if (next === text[file]) throw new Error(`pattern not found in ${file}: ${from}`); return { ...text, [file]: next }; };
const chain = (...steps) => (text) => steps.reduce((acc, step) => step(acc), text);
const OZOW_FALSE = sub('lib/payments/sandbox-mode.ts', /OZOW_SANDBOX_MODE = true;/, 'OZOW_SANDBOX_MODE = false;');
const PAYFAST_FALSE = sub('lib/payments/sandbox-mode.ts', /PAYFAST_SANDBOX_MODE = true;/, 'PAYFAST_SANDBOX_MODE = false;');
const DROP_FAIL_CLOSED = sub('lib/payments/payfast.ts', /\n[ \t]*if \(!PAYFAST_SANDBOX_MODE\) return \{ ok: false, reason: 'not-configured' \};/, '');

const couplingMutants = [
  ['control', (t) => t, false],
  ['ozow-flag-false-keeps-sandbox-credentials', OZOW_FALSE, true],
  ['ozow-flag-false-isTest-decoupled', chain(OZOW_FALSE, sub('lib/payments/ozow.ts', /const OZOW_IS_TEST = [^;]+;/, "const OZOW_IS_TEST = 'true';")), true],
  ['ozow-isTest-hardcoded-false-flag-true', sub('lib/payments/ozow.ts', /const OZOW_IS_TEST = [^;]+;/, "const OZOW_IS_TEST = 'false';"), true],
  ['ozow-redefines-flag-locally', sub('lib/payments/ozow.ts', /const OZOW_IS_TEST = [^;]+;/, 'const OZOW_SANDBOX_MODE = true;\nconst OZOW_IS_TEST = String(OZOW_SANDBOX_MODE);'), true],
  ['payfast-flag-false-still-posts-sandbox-form', chain(PAYFAST_FALSE, DROP_FAIL_CLOSED), true],
  ['payfast-fail-closed-inverted', sub('lib/payments/payfast.ts', /if \(!PAYFAST_SANDBOX_MODE\)/, 'if (PAYFAST_SANDBOX_MODE)'), true],
  ['payfast-fail-closed-after-sandbox-form', chain(DROP_FAIL_CLOSED, sub('lib/payments/payfast.ts', /processUrl: PAYFAST_SANDBOX_PROCESS_URL/, "processUrl: PAYFAST_SANDBOX_PROCESS_URL,\n        // if (!PAYFAST_SANDBOX_MODE) return { ok: false, reason: 'not-configured' };\n        _x: 0")), true],
  ['leaf-imports-something', sub('lib/payments/sandbox-mode.ts', /export const OZOW_SANDBOX_MODE/, "import { x } from '@/lib/payments/payfast';\nexport const OZOW_SANDBOX_MODE"), true],
  ['leaf-flag-not-literal', sub('lib/payments/sandbox-mode.ts', /OZOW_SANDBOX_MODE = true;/, "OZOW_SANDBOX_MODE = process.env.X === '1';"), true],
  ['stamp-toggle-term-dropped', sub('lib/ticket-issuance-mode.ts', / \|\| options\.ozowSandboxTestMode !== false/, ''), true],
  ['stamp-toggle-fails-open', sub('lib/ticket-issuance-mode.ts', /options\.ozowSandboxTestMode !== false/, 'options.ozowSandboxTestMode === true'), true],
  ['builders-ignore-toggle', sub('lib/checkout-reservation.ts', /const issuedInTestMode = isIssuanceTestMode\(\{ ozowSandboxTestMode: input\.ozowSandboxTestMode \}\);/, 'const issuedInTestMode = isIssuanceTestMode({ ozowSandboxTestMode: false });'), true],
  ['comp-reads-toggle-from-nowhere', sub('lib/orders.ts', /const issuedInTestMode = isIssuanceTestMode\(\{ ozowSandboxTestMode: false \}\);/, 'const issuedInTestMode = isIssuanceTestMode({ ozowSandboxTestMode: undefined });'), true],
  ['stamp-hand-flag', sub('lib/ticket-issuance-mode.ts', /PAYMENT_GATEWAYS_SANDBOX_ONLY = [^;]+;/, 'PAYMENT_GATEWAYS_SANDBOX_ONLY = false;'), true],
  ['stamp-drops-payfast', sub('lib/ticket-issuance-mode.ts', /OZOW_SANDBOX_MODE \|\| PAYFAST_SANDBOX_MODE;/, 'OZOW_SANDBOX_MODE;'), true],
  ['stamp-drops-ozow', sub('lib/ticket-issuance-mode.ts', /OZOW_SANDBOX_MODE \|\| PAYFAST_SANDBOX_MODE;/, 'PAYFAST_SANDBOX_MODE;'), true],
];

const clientSafeMutants = [
  ['client-control', (t) => t, false],
  ['client-imports-payfast-adapter', sub('lib/ticket-issuance-mode.ts', /import \{ isTicketingTestMode \}/, "import { PAYFAST_ITN_HOSTS } from '@/lib/payments/payfast';\nimport { isTicketingTestMode }"), true],
  ['client-imports-ozow-adapter', sub('lib/ticket-issuance-mode.ts', /import \{ isTicketingTestMode \}/, "import { createOzowProvider } from '@/lib/payments/ozow';\nimport { isTicketingTestMode }"), true],
  ['client-imports-payments-index', sub('lib/ticket-issuance-mode.ts', /import \{ isTicketingTestMode \}/, "import { getProvider } from '@/lib/payments';\nimport { isTicketingTestMode }"), true],
  ['client-imports-node-builtin', sub('lib/ticket-issuance-mode.ts', /import \{ isTicketingTestMode \}/, "import { promises } from 'node:dns';\nimport { isTicketingTestMode }"), true],
  ['client-dynamic-import-adapter', sub('lib/ticket-issuance-mode.ts', /export function/, "const lazy = () => import('@/lib/payments/payfast');\nexport function"), true],
];

const baselineReads = (original['app/api/tickets/checkout/route.ts'].match(/isOzowSandboxTestModeEnabled\(\)/g) ?? []).length;
const checkoutMutants = [
  ['checkout-control', (t) => t, false],
  ['checkout-literal-false', sub('app/api/tickets/checkout/route.ts', /(buildMultiReservationDocs\(\{[\s\S]*?)ozowSandboxTestMode:\s*[\w$.]+/, '$1ozowSandboxTestMode: false'), true],
  ['checkout-literal-true', sub('app/api/tickets/checkout/route.ts', /(buildMultiReservationDocs\(\{[\s\S]*?)ozowSandboxTestMode:\s*[\w$.]+/, '$1ozowSandboxTestMode: true'), true],
  ['checkout-reserve-input-literal-false', sub('app/api/tickets/checkout/route.ts', /(await reserveTicket\(\{[\s\S]*?)ozowSandboxTestMode: [\w$]+,/, '$1ozowSandboxTestMode: false,'), true],
  ['checkout-reserve-input-literal-true', sub('app/api/tickets/checkout/route.ts', /(await reserveTicket\(\{[\s\S]*?)ozowSandboxTestMode: [\w$]+,/, '$1ozowSandboxTestMode: true,'), true],
  ['checkout-reserve-input-field-dropped', sub('app/api/tickets/checkout/route.ts', /(await reserveTicket\(\{[\s\S]*?)\n[ \t]*ozowSandboxTestMode: [\w$]+,/, '$1'), true],
  ['checkout-override-arg-swapped', sub('app/api/tickets/checkout/route.ts', /resolveExpectedGatewayAmount\(providerId, [\w$]+\)/, 'resolveExpectedGatewayAmount(providerId, otherToggle)'), true],
  ['checkout-override-arg-literal', sub('app/api/tickets/checkout/route.ts', /resolveExpectedGatewayAmount\(providerId, [\w$]+\)/, 'resolveExpectedGatewayAmount(providerId, true)'), true],
  ['checkout-read-replaced-by-literal', sub('app/api/tickets/checkout/route.ts', /await isOzowSandboxTestModeEnabled\(\);/, 'false;'), true],
  ['checkout-stamp-uses-other-identifier', sub('app/api/tickets/checkout/route.ts', /(await reserveTicket\(\{[\s\S]*?ozowSandboxTestMode: )[\w$]+,/, '$1providerId,'), true],
  ['checkout-field-dropped', sub('app/api/tickets/checkout/route.ts', /(buildMultiReservationDocs\(\{[\s\S]*?)ozowSandboxTestMode:\s*[\w$.]+,?/, '$1'), true],
  ['checkout-second-firestore-read', sub('app/api/tickets/checkout/route.ts', /buildMultiReservationDocs\(\{/, 'buildMultiReservationDocs({ _read: await isOzowSandboxTestModeEnabled(),'), true],
];

const goodDiff = [
  'diff --git a/lib/payments/ozow.ts b/lib/payments/ozow.ts', '--- a/lib/payments/ozow.ts', '+++ b/lib/payments/ozow.ts', '@@ -7 +7,2 @@',
  "+import { OZOW_SANDBOX_MODE } from '@/lib/payments/sandbox-mode';", "-const OZOW_IS_TEST = 'true';", '+const OZOW_IS_TEST = String(OZOW_SANDBOX_MODE);',
  'diff --git a/lib/payments/payfast.ts b/lib/payments/payfast.ts', '--- a/lib/payments/payfast.ts', '+++ b/lib/payments/payfast.ts', '@@ -9 +9,2 @@',
  "+import { PAYFAST_SANDBOX_MODE } from '@/lib/payments/sandbox-mode';", "+if (!PAYFAST_SANDBOX_MODE) return { ok: false, reason: 'not-configured' };",
  'diff --git a/lib/payments/sandbox-mode.ts b/lib/payments/sandbox-mode.ts', '--- /dev/null', '+++ b/lib/payments/sandbox-mode.ts', '@@ -0,0 +1,3 @@',
  '+// leaf', '+export const OZOW_SANDBOX_MODE = true;', '+export const PAYFAST_SANDBOX_MODE = true;',
];
const swap = (from, to) => goodDiff.map((line) => line.replace(from, to));
const diffMutants = [
  ['diff-control', goodDiff, false],
  ['diff-flag-false', swap('OZOW_SANDBOX_MODE = true', 'OZOW_SANDBOX_MODE = false'), true],
  ['diff-extra-code-line', [...goodDiff, '+const sneaky = 1;'], true],
  ['diff-other-removal', [...goodDiff, "-const OZOW_CURRENCY_CODE = 'ZAR';"], true],
  ['diff-other-file', [...goodDiff, 'diff --git a/lib/payments/active-gateway.ts b/lib/payments/active-gateway.ts', '--- a/lib/payments/active-gateway.ts', '+++ b/lib/payments/active-gateway.ts', '+// x'], true],
  ['diff-isTest-not-reading-flag', swap('String(OZOW_SANDBOX_MODE)', "'true'"), true],
  ['diff-missing-fail-closed', goodDiff.filter((line) => !line.includes('reason:')), true],
  ['diff-fail-closed-wrong-payload', swap("reason: 'not-configured'", "reason: 'ok'"), true],
  ['diff-code-line-in-leaf', [...goodDiff, '+export const EXTRA = 1;'], true],
  ['diff-missing-leaf', goodDiff.slice(0, goodDiff.findIndex((line) => line.endsWith('sandbox-mode.ts') && line.startsWith('diff'))), true],
];

let failed = false;
const report = (name, rejected, want) => { console.log(`${name}: ${rejected ? 'rejected' : 'accepted'} (want ${want ? 'rejected' : 'accepted'})`); if (rejected !== want) failed = true; };
for (const [name, mutate, want] of couplingMutants) { const text = mutate({ ...original }); report(name, checkCoupling((file) => text[file]).length > 0, want); }
for (const [name, mutate, want] of checkoutMutants) { const text = mutate({ ...original }); report(name, checkCheckout((file) => text[file], baselineReads).length > 0, want); }
for (const [name, mutate, want] of clientSafeMutants) { const text = mutate({ ...original }); report(name, checkClientSafe((file) => text[file]).length > 0, want); }
for (const [name, lines, want] of diffMutants) report(name, checkDiff(lines.join('\n')).length > 0, want);
process.exit(failed ? 1 : 0);
