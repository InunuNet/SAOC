// A30/A31 — structural companion to the behavioural check
// check-itn-atomic-idempotent-write.mts.
//
// F4 (production-blockers) — repointed at lib/orders.ts post-F10. F10 moved the atomic
// paid-write transaction OUT of app/api/tickets/itn/route.ts and into
// markOrderAndPositionPaidByPaymentId (lib/orders.ts:264-323); this check now parses
// lib/orders.ts, scoped to that named function's body (via findFunctionDeclarationBody),
// not the route. lib/orders.ts has a SECOND, unrelated db.runTransaction call
// (createOrderWithPosition's, F8's comp-ticket write) — scoping by name, not "first in
// the file", is what makes this check validate the correct transaction. See
// contracts/golden/production-blockers-f4-itn-check-repoint/README.md "The AST-scoping
// bug this design catches".
//
// WHAT THIS PROVES THAT THE BEHAVIOURAL CHECK CANNOT
// The behavioural check proves the OBSERVABLE outcome (replay doesn't double-write,
// checked-in tickets don't resurrect). It cannot, by itself, rule out a route that
// happens to produce the right outcome today via some other mechanism (e.g. an
// application-level mutex, or luck under a single-process test) while still containing a
// decoy `db.runTransaction(...)` elsewhere that the write does not actually go through.
// This check parses lib/orders.ts with the TypeScript compiler API and proves the
// specific structural property the audit asked for: the real
// `transaction.update(<ref>, ...)` calls are lexical descendants of the callback passed
// to `db.runTransaction(` inside markOrderAndPositionPaidByPaymentId, and
// `transaction.get(<ref>)` occurs earlier in that same callback body FOR THE SAME REF —
// checked per-identifier (orderRef, positionRef), not against one hardcoded 'docRef'
// name, since this function updates two distinct refs in the same transaction.
//
// Self-tests against a compliant and several non-compliant fixtures before judging the
// real file, so a detector that stops discriminating fails loudly instead of silently
// passing everything (same convention as
// contracts/checks/ticketing-hardening/check-checkin-route-delegates.mjs).

import { readFileSync } from 'node:fs';

import {
  findFunctionDeclarationBody,
  findRunTransactionCallback,
  findTransactionGetRefs,
  findTransactionUpdateRefs,
  parseSource,
} from './_ast-shared.mjs';

const ASSERTION_ID = 'A30/A31';
const TARGET_FUNCTION = 'markOrderAndPositionPaidByPaymentId';

// ORDERS_LIB_PATH_OVERRIDE is NOT part of normal operation — see the header comment on
// contracts/checks/payfast-m1/_itn-harness.mts's loadItnPost() for why an override hook
// exists at all. Every committed run of this check leaves it unset and reads the real,
// pinned (A12) lib/orders.ts.
const ORDERS_LIB_PATH =
  process.env.ORDERS_LIB_PATH_OVERRIDE ??
  new URL('../../../lib/orders.ts', import.meta.url).pathname;

function judge(sourceText) {
  const problems = [];
  const sourceFile = parseSource(sourceText, 'orders.ts');

  const functionBody = findFunctionDeclarationBody(sourceFile, TARGET_FUNCTION);
  if (!functionBody) {
    problems.push(`no function declaration named ${TARGET_FUNCTION} found`);
    return problems;
  }

  const { callbackBody } = findRunTransactionCallback(functionBody);
  if (!callbackBody) {
    problems.push(
      `no db.runTransaction(async (transaction) => { ... }) callback found inside ${TARGET_FUNCTION}`
    );
    return problems;
  }

  const getCalls = findTransactionGetRefs(callbackBody);
  const updateCalls = findTransactionUpdateRefs(callbackBody);

  if (getCalls.length === 0) {
    problems.push('no transaction.get(<ref>) call found inside the runTransaction callback');
  }
  if (updateCalls.length === 0) {
    problems.push('no transaction.update(<ref>, ...) call found inside the runTransaction callback');
  }

  // Per-identifier: every ref updated must have been get'd earlier IN THE SAME
  // CALLBACK, by the same name — lib/orders.ts updates orderRef AND positionRef, so a
  // single hardcoded name cannot prove both are guarded.
  for (const update of updateCalls) {
    const matchingGet = getCalls.find(
      (get) => get.refName === update.refName && get.node.getStart() < update.node.getStart()
    );
    if (!matchingGet) {
      problems.push(
        `transaction.update(${update.refName}, ...) has no preceding transaction.get(${update.refName}) in the same callback`
      );
    }
  }

  // A write that bypasses the transaction entirely (e.g. a bare `orderRef.update(...)`
  // alongside a decoy runTransaction) must also be caught even though
  // findTransactionUpdateRefs already requires the update to go through
  // `transaction.update`, not `<ref>.update`. Generalised from a single hardcoded
  // `docRef.update(` to any `\w+Ref.update(` escape hatch, following lib/orders.ts's own
  // <name>Ref naming convention — this does not false-positive on the compliant shape,
  // since `transaction.update(orderRef, ...)` matches on `transaction.`, not `orderRef.`.
  const stripped = sourceText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/\b\w+Ref\.update\(/.test(stripped)) {
    problems.push('a plain <ref>.update(...) call exists outside the transaction — bypasses atomicity');
  }

  return problems;
}

// --- detector self-test -----------------------------------------------------
const COMPLIANT = `
  export async function createOrderWithPosition(input) {
    await db.runTransaction(async (transaction) => {
      transaction.set(orderRef, order);
      transaction.set(positionRef, position);
    });
  }

  export async function markOrderAndPositionPaidByPaymentId(input) {
    return db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      const positionDoc = await transaction.get(positionRef);
      transaction.update(orderRef, { status: 'paid' });
      transaction.update(positionRef, { status: 'paid' });
      return { committed: true };
    });
  }
`;

const ESCAPES = [
  [
    'bare <ref>.update, no transaction at all',
    `
    export async function markOrderAndPositionPaidByPaymentId(input) {
      await orderRef.update({ status: 'paid' });
      await positionRef.update({ status: 'paid' });
    }
  `,
  ],
  [
    'decoy no-op transaction beside a plain write',
    `
    export async function markOrderAndPositionPaidByPaymentId(input) {
      await db.runTransaction(async (t) => { await t.get(otherRef); });
      await orderRef.update({ status: 'paid' });
      await positionRef.update({ status: 'paid' });
    }
  `,
  ],
  [
    'positionRef updated without a preceding get',
    `
    export async function markOrderAndPositionPaidByPaymentId(input) {
      await db.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        transaction.update(orderRef, { status: 'paid' });
        transaction.update(positionRef, { status: 'paid' });
      });
    }
  `,
  ],
  [
    'update occurs before get in source order for the same ref',
    `
    export async function markOrderAndPositionPaidByPaymentId(input) {
      await db.runTransaction(async (transaction) => {
        transaction.update(orderRef, { status: 'paid' });
        const orderDoc = await transaction.get(orderRef);
      });
    }
  `,
  ],
  [
    'get and update target different refs entirely',
    `
    export async function markOrderAndPositionPaidByPaymentId(input) {
      await db.runTransaction(async (transaction) => {
        const s = await transaction.get(otherRef);
        transaction.update(orderRef, { status: 'paid' });
      });
    }
  `,
  ],
  [
    'a sibling function looks compliant, but the TARGET function bypasses its transaction — proves scoping is by name, not "first runTransaction in the file"',
    `
    export async function createOrderWithPosition(input) {
      await db.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        transaction.update(orderRef, { status: 'paid' });
      });
    }

    export async function markOrderAndPositionPaidByPaymentId(input) {
      await orderRef.update({ status: 'paid' });
      await positionRef.update({ status: 'paid' });
    }
  `,
  ],
];

const selfTestFailures = [];
if (judge(COMPLIANT).length !== 0) {
  selfTestFailures.push(`detector rejects a compliant orders.ts: ${judge(COMPLIANT).join('; ')}`);
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
  source = readFileSync(ORDERS_LIB_PATH, 'utf8');
} catch (error) {
  console.error(`FAIL: ${ASSERTION_ID} could not read ${ORDERS_LIB_PATH}: ${error.message}`);
  process.exit(1);
}

const problems = judge(source);
if (problems.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} the paid write is not provably atomic/idempotent`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `PASS: ${ASSERTION_ID} ${TARGET_FUNCTION}'s transaction.update(orderRef|positionRef, ...) calls are lexical descendants of its own db.runTransaction callback, each preceded by a transaction.get(<same ref>)`
);
