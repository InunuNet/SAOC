// A32 — replaces the line-number-only check (first `fetch(PAYFAST_SANDBOX_VALIDATE_URL`
// line < first `db.runTransaction` line), which a decoy fetch() call anywhere earlier in
// the file could satisfy without proving anything about the REAL server-confirm call.
//
// This check parses the route with the TypeScript compiler API and proves the specific
// `fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...)` CallExpression is (a) NOT a lexical
// descendant of the callback passed to `db.runTransaction(`, and (b) positioned before
// that callback in source order — i.e. the real network round-trip that must not run
// inside a Firestore transaction (see route.ts's own comment on why: transactions must
// not wrap external network calls) genuinely does not.
//
// Shares the AST helpers with check-paid-write-inside-transaction-scope.mjs
// (_ast-shared.mjs) and follows the same self-test convention.

import { readFileSync } from 'node:fs';

import {
  findRunTransactionCallback,
  findValidateFetchCalls,
  isDescendantOf,
  parseSource,
} from './_ast-shared.mjs';

const ASSERTION_ID = 'A32';

// See _itn-harness.mts's loadItnPost() header comment — this override exists only for
// the one-off manual broken/real proof runs, never for normal gate operation.
const ROUTE_PATH =
  process.env.ITN_ROUTE_PATH_OVERRIDE ??
  new URL('../../../app/api/tickets/itn/route.ts', import.meta.url).pathname;

function judge(sourceText) {
  const problems = [];
  const sourceFile = parseSource(sourceText);
  const fetchCalls = findValidateFetchCalls(sourceFile);
  const { callExprNode: transactionCall, callbackBody } = findRunTransactionCallback(sourceFile);

  if (fetchCalls.length === 0) {
    problems.push('no fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) call found');
    return problems;
  }
  if (!transactionCall) {
    problems.push('no db.runTransaction(async (transaction) => { ... }) callback found');
    return problems;
  }

  const realFetch = fetchCalls[0];
  if (isDescendantOf(realFetch, callbackBody)) {
    problems.push('fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) is inside the runTransaction callback scope');
  }
  if (!(realFetch.getStart() < transactionCall.getStart())) {
    problems.push('fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) does not occur before db.runTransaction(...) in source order');
  }

  return problems;
}

// --- detector self-test -----------------------------------------------------
const COMPLIANT = `
  export async function POST(request) {
    const confirmResponse = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, { method: 'POST' });
    const confirmText = (await confirmResponse.text()).trim();
    if (confirmText !== 'VALID') return acknowledge();
    await db.runTransaction(async (transaction) => {
      const s = await transaction.get(docRef);
      transaction.update(docRef, { status: 'paid' });
    });
    return acknowledge();
  }
`;

const ESCAPES = [
  [
    'real confirm fetch moved inside the transaction callback',
    `
    export async function POST(request) {
      await db.runTransaction(async (transaction) => {
        const confirmResponse = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, { method: 'POST' });
        const s = await transaction.get(docRef);
        transaction.update(docRef, { status: 'paid' });
      });
      return acknowledge();
    }
  `,
  ],
  [
    'confirm fetch occurs after the transaction in source order',
    `
    export async function POST(request) {
      await db.runTransaction(async (transaction) => {
        const s = await transaction.get(docRef);
        transaction.update(docRef, { status: 'paid' });
      });
      const confirmResponse = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, { method: 'POST' });
      return acknowledge();
    }
  `,
  ],
  [
    'decoy fetch elsewhere, no real validate call at all',
    `
    export async function POST(request) {
      await fetch('https://example.com/telemetry');
      await db.runTransaction(async (transaction) => {
        const s = await transaction.get(docRef);
        transaction.update(docRef, { status: 'paid' });
      });
      return acknowledge();
    }
  `,
  ],
  [
    'no runTransaction at all (write bypasses transaction entirely)',
    `
    export async function POST(request) {
      const confirmResponse = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, { method: 'POST' });
      await docRef.update({ status: 'paid' });
      return acknowledge();
    }
  `,
  ],
];

const selfTestFailures = [];
if (judge(COMPLIANT).length !== 0) {
  selfTestFailures.push(`detector rejects a compliant route: ${judge(COMPLIANT).join('; ')}`);
}
for (const [name, fixture] of ESCAPES) {
  if (judge(fixture).length === 0) selfTestFailures.push(`detector fails to catch: ${name}`);
}
if (selfTestFailures.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} detector self-test — this check can no longer discriminate`);
  for (const f of selfTestFailures) console.error(`  - ${f}`);
  process.exit(1);
}

// --- the real (or, for a manual proof run, overridden) file -----------------
let source;
try {
  source = readFileSync(ROUTE_PATH, 'utf8');
} catch (error) {
  console.error(`FAIL: ${ASSERTION_ID} could not read ${ROUTE_PATH}: ${error.message}`);
  process.exit(1);
}

const problems = judge(source);
if (problems.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} the server-confirm fetch is not provably outside the transaction`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `PASS: ${ASSERTION_ID} fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) is outside and before the db.runTransaction callback scope`
);
