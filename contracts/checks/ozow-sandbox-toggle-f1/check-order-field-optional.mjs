// ozow-sandbox-toggle F1 — proves types/index.ts declares Order.expectedGatewayAmount as
// OPTIONAL (`expectedGatewayAmount?:`), not required, following the same precedent already set
// for `buyerUid?:` on the same type (ticketing-f5-buyers F5). A required field on `Order` breaks
// every pre-existing typed `Order` literal elsewhere in the codebase that predates this feature
// and legitimately omits it — e.g. contracts/checks/ticketing-f5-buyers/fixtures/buyers-typecheck.ts's
// `legacyOrder` literal, which exists specifically to prove old order shapes still compile.
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §3e for the full decision record — this
// is the fix for Codex GPT-5.5's fourth cross-model review finding
// (types/index.ts:227 making expectedGatewayAmount required broke that pre-existing fixture with
// TS2741).
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-order-field-optional.mjs

import { readFileSync, existsSync } from 'node:fs';

const FILE = 'types/index.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

if (!existsSync(FILE)) {
  fail(`${FILE} does not exist`);
  process.exit(1);
}

const src = readFileSync(FILE, 'utf8');

// Required form (`expectedGatewayAmount: number | null;`, no `?`) must NOT appear.
const REQUIRED_FORM = /\bexpectedGatewayAmount\s*:\s*number \| null;/;
// Optional form (`expectedGatewayAmount?: number | null;`) must appear exactly once.
const OPTIONAL_FORM = /\bexpectedGatewayAmount\?\s*:\s*number \| null;/;

if (!OPTIONAL_FORM.test(src)) {
  fail(`${FILE} does not declare 'expectedGatewayAmount?: number | null;' — field must be optional.`);
} else if (REQUIRED_FORM.test(src)) {
  fail(`${FILE} declares 'expectedGatewayAmount' in its required (non-'?') form somewhere in the file.`);
}

if (FAIL) {
  console.error(
    `FAIL: Order.expectedGatewayAmount must stay optional (matching the 'buyerUid?:' precedent), or ` +
    `pre-existing Order-literal fixtures (e.g. ticketing-f5-buyers/fixtures/buyers-typecheck.ts) stop compiling.`
  );
  process.exit(1);
}
console.log(`PASS: ${FILE} declares Order.expectedGatewayAmount as optional.`);
