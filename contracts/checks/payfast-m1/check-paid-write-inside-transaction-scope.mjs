// A30/A31 — structural companion to the behavioural check
// check-itn-atomic-idempotent-write.mts.
//
// WHAT THIS PROVES THAT THE BEHAVIOURAL CHECK CANNOT
// The behavioural check proves the OBSERVABLE outcome (replay doesn't double-write,
// checked-in tickets don't resurrect). It cannot, by itself, rule out a route that
// happens to produce the right outcome today via some other mechanism (e.g. an
// application-level mutex, or luck under a single-process test) while still containing a
// decoy `db.runTransaction(...)` elsewhere that the write does not actually go through.
// This check parses the route with the TypeScript compiler API and proves the specific
// structural property the audit asked for: the real `transaction.update(docRef, ...)`
// call is a lexical descendant of the callback passed to `db.runTransaction(`, and
// `transaction.get(docRef)` occurs earlier in that same callback body. A grep for
// `db.runTransaction` and `transaction.update(docRef` (the old A30/A31) is satisfied by
// an unrelated no-op transaction sitting next to a plain, unguarded `docRef.update()` —
// this check is not.
//
// Self-tests against a compliant and several non-compliant fixtures before judging the
// real file, so a detector that stops discriminating fails loudly instead of silently
// passing everything (same convention as
// contracts/checks/ticketing-hardening/check-checkin-route-delegates.mjs).

import { readFileSync } from 'node:fs';

import {
  findRunTransactionCallback,
  findTransactionGetDocRef,
  findTransactionUpdateDocRef,
  parseSource,
} from './_ast-shared.mjs';

const ASSERTION_ID = 'A30/A31';

// ITN_ROUTE_PATH_OVERRIDE is NOT part of normal operation — see the header comment on
// contracts/checks/payfast-m1/_itn-harness.mts's loadItnPost() for why an override hook
// exists at all. Every committed run of this check leaves it unset and reads the real,
// pinned route.
const ROUTE_PATH =
  process.env.ITN_ROUTE_PATH_OVERRIDE ??
  new URL('../../../app/api/tickets/itn/route.ts', import.meta.url).pathname;

function judge(sourceText) {
  const problems = [];
  const sourceFile = parseSource(sourceText);
  const { callbackBody } = findRunTransactionCallback(sourceFile);
  if (!callbackBody) {
    problems.push('no db.runTransaction(async (transaction) => { ... }) callback found');
    return problems;
  }

  const getCalls = findTransactionGetDocRef(callbackBody);
  const updateCalls = findTransactionUpdateDocRef(callbackBody);

  if (getCalls.length === 0) {
    problems.push('transaction.get(docRef) not found inside the runTransaction callback');
  }
  if (updateCalls.length === 0) {
    problems.push('transaction.update(docRef, ...) not found inside the runTransaction callback');
  }
  if (getCalls.length > 0 && updateCalls.length > 0) {
    const getPos = getCalls[0].getStart();
    const updatePos = updateCalls[0].getStart();
    if (!(getPos < updatePos)) {
      problems.push(
        'transaction.get(docRef) does not occur before transaction.update(docRef, ...) in the callback'
      );
    }
  }

  // A write that bypasses the transaction entirely (e.g. a bare docRef.update alongside
  // a decoy runTransaction) must also be caught even though findTransactionUpdateDocRef
  // already requires the update to go through `transaction.update`, not `docRef.update`.
  if (/\bdocRef\.update\(/.test(sourceText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))) {
    problems.push('a plain docRef.update(...) call exists outside the transaction — bypasses atomicity');
  }

  return problems;
}

// --- detector self-test -----------------------------------------------------
const COMPLIANT = `
  export async function POST(request) {
    try {
      await db.runTransaction(async (transaction) => {
        const freshSnapshot = await transaction.get(docRef);
        if (!freshSnapshot.exists) return;
        if (freshSnapshot.data()?.['status'] !== RESERVED_STATUS) return;
        transaction.update(docRef, { status: PAID_STATUS, pf_payment_id: fields['pf_payment_id'] ?? null, purchasedAt: Timestamp.now() });
      });
    } catch (error) {}
    return acknowledge();
  }
`;

const ESCAPES = [
  ['bare docRef.update, no transaction at all', `await docRef.update({ status: 'paid' }); return acknowledge();`],
  [
    'decoy no-op transaction beside a plain write',
    `await db.runTransaction(async (t) => { await t.get(otherRef); }); await docRef.update({ status: 'paid' }); return acknowledge();`,
  ],
  [
    'update without a preceding get in the same callback',
    `await db.runTransaction(async (transaction) => { transaction.update(docRef, { status: 'paid' }); });`,
  ],
  [
    'update occurs before get in source order',
    `await db.runTransaction(async (transaction) => { transaction.update(docRef, { status: 'paid' }); const s = await transaction.get(docRef); });`,
  ],
  [
    'get and update target different refs than docRef',
    `await db.runTransaction(async (transaction) => { const s = await transaction.get(otherRef); transaction.update(otherRef, { status: 'paid' }); });`,
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
  console.error(`FAIL: ${ASSERTION_ID} the paid write is not provably atomic/idempotent`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `PASS: ${ASSERTION_ID} transaction.update(docRef, ...) is a lexical descendant of the db.runTransaction callback, preceded by transaction.get(docRef)`
);
