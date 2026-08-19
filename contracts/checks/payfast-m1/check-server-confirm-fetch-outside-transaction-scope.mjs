// A32 — replaces the line-number-only check (first `fetch(PAYFAST_SANDBOX_VALIDATE_URL`
// line < first `db.runTransaction` line), which a decoy fetch() call anywhere earlier in
// the file could satisfy without proving anything about the REAL server-confirm call.
//
// F4 (production-blockers) — restated as a TWO-FILE claim, because F10 moved the atomic
// paid-write transaction out of app/api/tickets/itn/route.ts and into
// markOrderAndPositionPaidByPaymentId (lib/orders.ts). "The server-confirm fetch is
// outside the transaction" is no longer a single-file, single-function claim: it now
// needs BOTH of:
//
//   1. In route.ts: the real server-confirm call occurs BEFORE the
//      markOrderAndPositionPaidByPaymentId(...) call site in source order — i.e. the
//      paid-write is provably gated behind a successful server-confirm.
//
//      REPOINTED BY F2 (payment-provider-seam), 2026-08-19. This claim used to require a
//      literal fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) in the route source, and F2's decisive
//      assertion forbids exactly that: no gateway symbol may survive in either route. One of the
//      two had to move. The claim's INTENT is unchanged and is now expressed against the
//      paymentProvider.confirmNotification(...) call site, which is where the round-trip is
//      issued from post-F2. The defect class is additionally retired rather than relocated:
//      contracts/checks/payment-seam-f2/check-downstream-repoints.sh part 3 asserts the adapter
//      has NO Firestore access at all, so the round-trip now lives in a module that cannot open
//      a transaction around itself whatever anyone later writes there. Claim 2 below is
//      untouched.
//   2. In lib/orders.ts: markOrderAndPositionPaidByPaymentId's own transaction body
//      (scoped via the same findFunctionDeclarationBody + findRunTransactionCallback
//      helper as A30/A31) contains ZERO fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) calls —
//      defending against a future edit that moves the network round-trip inside the
//      Firestore transaction (which would violate the route's own documented constraint
//      that transactions must not wrap external network calls).
//
// Both files are parsed independently — the TypeScript compiler API parses one
// SourceFile at a time, and no cross-file AST linkage is attempted; each file's
// source-order/scope claim stands on its own. See
// contracts/golden/production-blockers-f4-itn-check-repoint/README.md "A32, restated as
// a two-file claim".
//
// Shares the AST helpers with check-paid-write-inside-transaction-scope.mjs
// (_ast-shared.mjs) and follows the same self-test convention.

import { readFileSync } from 'node:fs';

import {
  findFirstCallExpressionByCalleeName,
  findFunctionDeclarationBody,
  findRunTransactionCallback,
  findValidateFetchCalls,
  isDescendantOf,
  parseSource,
} from './_ast-shared.mjs';

const ASSERTION_ID = 'A32';
const TARGET_FUNCTION = 'markOrderAndPositionPaidByPaymentId';
const CALL_SITE_NAME = 'markOrderAndPositionPaidByPaymentId';
const CONFIRM_MEMBER_NAME = 'confirmNotification';

// See _itn-harness.mts's loadItnPost() header comment — these overrides exist only for
// the one-off manual broken/real proof runs, never for normal gate operation.
const ROUTE_PATH =
  process.env.ITN_ROUTE_PATH_OVERRIDE ??
  new URL('../../../app/api/tickets/itn/route.ts', import.meta.url).pathname;
const ORDERS_LIB_PATH =
  process.env.ORDERS_LIB_PATH_OVERRIDE ??
  new URL('../../../lib/orders.ts', import.meta.url).pathname;

/** Claim 1: in route.ts, the server-confirm round-trip is issued before the call site that
 * hands off to the transactional paid-write. */
function judgeRoute(sourceText) {
  const problems = [];
  const sourceFile = parseSource(sourceText, 'route.ts');
  const confirmCall = findFirstCallExpressionByCalleeName(sourceFile, CONFIRM_MEMBER_NAME);

  if (!confirmCall) {
    problems.push(`no ${CONFIRM_MEMBER_NAME}(...) call found in route.ts`);
    return problems;
  }

  const callSite = findFirstCallExpressionByCalleeName(sourceFile, CALL_SITE_NAME);
  if (!callSite) {
    problems.push(`no call site for ${CALL_SITE_NAME}(...) found in route.ts`);
    return problems;
  }

  if (!(confirmCall.getStart() < callSite.getStart())) {
    problems.push(
      `${CONFIRM_MEMBER_NAME}(...) does not occur before the ${CALL_SITE_NAME}(...) call site in source order`
    );
  }

  return problems;
}

/** Claim 2: in lib/orders.ts, markOrderAndPositionPaidByPaymentId's own transaction body
 * contains zero fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) calls. */
function judgeOrdersLib(sourceText) {
  const problems = [];
  const sourceFile = parseSource(sourceText, 'orders.ts');
  const functionBody = findFunctionDeclarationBody(sourceFile, TARGET_FUNCTION);
  if (!functionBody) {
    problems.push(`no function declaration named ${TARGET_FUNCTION} found in lib/orders.ts`);
    return problems;
  }
  const { callbackBody } = findRunTransactionCallback(functionBody);
  if (!callbackBody) {
    problems.push(`no db.runTransaction(...) callback found inside ${TARGET_FUNCTION}`);
    return problems;
  }
  const fetchCallsInFile = findValidateFetchCalls(sourceFile);
  const fetchInsideTransaction = fetchCallsInFile.filter((call) => isDescendantOf(call, callbackBody));
  if (fetchInsideTransaction.length > 0) {
    problems.push(
      `fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) found inside ${TARGET_FUNCTION}'s transaction callback — the network round-trip must not run inside the Firestore transaction`
    );
  }
  return problems;
}

// --- detector self-test: route.ts claim ------------------------------------
const COMPLIANT_ROUTE = `
  export async function POST(request) {
    const confirmation = await paymentProvider.confirmNotification(notification);
    if (!confirmation.confirmed) return acknowledge();
    const outcome = await markOrderAndPositionPaidByPaymentId({ m_payment_id: reference });
    return acknowledge();
  }
`;

const ROUTE_ESCAPES = [
  [
    'call site occurs before the server confirmation in source order',
    `
    export async function POST(request) {
      const outcome = await markOrderAndPositionPaidByPaymentId({ m_payment_id: reference });
      const confirmation = await paymentProvider.confirmNotification(notification);
      return acknowledge();
    }
  `,
  ],
  [
    'decoy provider call elsewhere, no server confirmation at all',
    `
    export async function POST(request) {
      const status = paymentProvider.mapStatus(notification.rawStatus);
      const outcome = await markOrderAndPositionPaidByPaymentId({ m_payment_id: reference });
      return acknowledge();
    }
  `,
  ],
  [
    'no call site to the paid-write function at all',
    `
    export async function POST(request) {
      const confirmation = await paymentProvider.confirmNotification(notification);
      return acknowledge();
    }
  `,
  ],
];

// --- detector self-test: lib/orders.ts claim --------------------------------
const COMPLIANT_ORDERS_LIB = `
  export async function markOrderAndPositionPaidByPaymentId(input) {
    return db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      transaction.update(orderRef, { status: 'paid' });
    });
  }
`;

const ORDERS_LIB_ESCAPES = [
  [
    'confirm fetch moved inside the transaction callback',
    `
    export async function markOrderAndPositionPaidByPaymentId(input) {
      return db.runTransaction(async (transaction) => {
        const confirmResponse = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, { method: 'POST' });
        const orderDoc = await transaction.get(orderRef);
        transaction.update(orderRef, { status: 'paid' });
      });
    }
  `,
  ],
];

const selfTestFailures = [];
if (judgeRoute(COMPLIANT_ROUTE).length !== 0) {
  selfTestFailures.push(`route detector rejects a compliant route: ${judgeRoute(COMPLIANT_ROUTE).join('; ')}`);
}
for (const [name, fixture] of ROUTE_ESCAPES) {
  if (judgeRoute(fixture).length === 0) selfTestFailures.push(`route detector fails to catch: ${name}`);
}
if (judgeOrdersLib(COMPLIANT_ORDERS_LIB).length !== 0) {
  selfTestFailures.push(
    `orders.ts detector rejects a compliant function: ${judgeOrdersLib(COMPLIANT_ORDERS_LIB).join('; ')}`
  );
}
for (const [name, fixture] of ORDERS_LIB_ESCAPES) {
  if (judgeOrdersLib(fixture).length === 0) selfTestFailures.push(`orders.ts detector fails to catch: ${name}`);
}
if (selfTestFailures.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} detector self-test — this check can no longer discriminate`);
  for (const f of selfTestFailures) console.error(`  - ${f}`);
  process.exit(1);
}

// --- the real (or, for a manual proof run, overridden) files ----------------
let routeSource;
let ordersLibSource;
try {
  routeSource = readFileSync(ROUTE_PATH, 'utf8');
} catch (error) {
  console.error(`FAIL: ${ASSERTION_ID} could not read ${ROUTE_PATH}: ${error.message}`);
  process.exit(1);
}
try {
  ordersLibSource = readFileSync(ORDERS_LIB_PATH, 'utf8');
} catch (error) {
  console.error(`FAIL: ${ASSERTION_ID} could not read ${ORDERS_LIB_PATH}: ${error.message}`);
  process.exit(1);
}

const routeProblems = judgeRoute(routeSource);
const ordersLibProblems = judgeOrdersLib(ordersLibSource);
const problems = [...routeProblems, ...ordersLibProblems];

if (problems.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} the server-confirm fetch is not provably outside the transaction`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `PASS: ${ASSERTION_ID} ${CONFIRM_MEMBER_NAME}(...) precedes the ${CALL_SITE_NAME}(...) call site in route.ts, and ${TARGET_FUNCTION}'s transaction body in lib/orders.ts contains no fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) call`
);
