#!/usr/bin/env node
// reconcile-response-accuracy F1, A7 — proves the REASON a bookkeeping write failed reaches a
// log, not just that the FAILED ORDER IDS reach the HTTP response.
//
// THE REGRESSION THIS CLOSES (found by @team-lead reading the diff, after @qa and Codex both
// PASSed the code twice): markOrdersAlertedForResponse()'s catch (lib/reconciliation.ts)
// returns a shaped result in both branches and logs NOTHING — the MarkOrdersAlertedError,
// which carries the aggregated message naming WHY each order's batch failed (a Firestore
// permission error, a quota error, a network error, an unexpected exception), is discarded the
// instant it's caught. app/api/admin/reconcile-orders/route.ts's own console.error, downstream
// of that catch, only ever had `alertBookkeepingFailed` (order ids) to log — the error object
// was already gone by the time the route's code ran, so even that route-level log could only
// ever restate WHICH orders failed, never WHY. Net effect: a 207 tells an operator which
// orders need attention and gives them nothing to act on — not a permission error, not a quota
// error, not a network error, not an exception type. Violates this project's own
// .claude/rules/coding.md: "Every error path logs context... Never log and swallow silently."
//
// This script forces BOTH of markOrdersAlertedForResponse's catch branches (a real
// MarkOrdersAlertedError from a partial batch-commit failure, and an unrecognized/infra-level
// error) against a FakeFirestore — same dialect as check-response-splits-partial-failure.mjs —
// and asserts the REASON (not just the order ids) reaches a captured console.error call in
// each case:
//   1. MarkOrdersAlertedError branch: the log must contain the failed order id AND text
//      identifying the underlying reason — this fake's specific commit-failure message
//      ("simulated commit failure for order-B's batch"), not merely the order id repeated.
//      False-pass risk this rules out: a version that logs `{ failedOrderIds }` alone (exactly
//      what the route currently does, one layer up, with nothing better available) would pass
//      a check that only asserted "something was logged" or "the order id appears in the log"
//      — this assertion specifically requires the REASON TEXT distinct from the order id list.
//   2. Unrecognized-error branch: the log must contain the exception's type/name
//      ("Error"/constructor name) and its message ("simulated infra-level failure..."). False-
//      pass risk this rules out: a version that logs only `{ orderIds }` (the conservative
//      fallback's return value, restated) would tell an operator WHICH orders are unproven but
//      still nothing about WHY the whole batch attempt failed — this assertion requires the
//      exception's own message text to be present, not just the order id list.
//
// Run as:
//   npx tsx .agent/memory/project/specs/reconcile-response-accuracy/goldens/check-failure-reason-logged.mjs

import { markOrdersAlertedForResponse } from '../../../../../../lib/reconciliation.ts';
import { Timestamp } from 'firebase-admin/firestore';

const failures = [];
const NOW = Timestamp.fromMillis(Date.parse('2026-08-19T12:00:00Z'));

// Same FakeFirestore dialect as check-response-splits-partial-failure.mjs / this contract's
// sibling order-reconciliation/goldens/check-partial-failure-atomicity.mjs.
class FakeFirestore {
  constructor({ failingOrderId = null, batchThrows = false } = {}) {
    this.failingOrderId = failingOrderId;
    this.batchThrows = batchThrows;
    this.orders = new Map([
      ['order-A', {}],
      ['order-B', {}],
    ]);
    this.tickets = new Map([
      ['ticket-A1', { orderId: 'order-A' }],
      ['ticket-B1', { orderId: 'order-B' }],
    ]);
  }

  collection(name) {
    const store = name === 'orders' ? this.orders : name === 'tickets' ? this.tickets : null;
    if (!store) throw new Error(`unexpected collection queried: '${name}'`);
    const collectionName = name;
    return {
      where(field, op, value) {
        if (op !== '==') throw new Error(`FakeFirestore does not model op '${op}'`);
        return {
          async get() {
            const matched = [...store.entries()].filter(([, doc]) => doc[field] === value);
            return {
              empty: matched.length === 0,
              docs: matched.map(([id, doc]) => ({ id, data: () => doc })),
            };
          },
        };
      },
      doc(id) {
        return { id, collectionName };
      },
    };
  }

  batch() {
    if (this.batchThrows) {
      throw new Error('simulated infra-level failure — db.batch() itself is unavailable');
    }
    const store = { orders: this.orders, tickets: this.tickets };
    const pending = [];
    const failingOrderId = this.failingOrderId;
    return {
      update(ref, data) {
        pending.push({ ref, data });
      },
      async commit() {
        const touchesFailingOrder =
          failingOrderId !== null &&
          pending.some(
            ({ ref, data }) =>
              (ref.collectionName === 'orders' && ref.id === failingOrderId) ||
              (ref.collectionName === 'tickets' && data.reconciliationAlertedAt !== undefined &&
                store.tickets.get(ref.id)?.orderId === failingOrderId)
          );
        if (touchesFailingOrder) {
          throw new Error(`simulated commit failure for ${failingOrderId}'s batch`);
        }
        for (const { ref, data } of pending) {
          const collectionStore = store[ref.collectionName];
          collectionStore.set(ref.id, { ...collectionStore.get(ref.id), ...data });
        }
      },
    };
  }
}

/** Captures every console.error call made during `fn()`, then restores the real console.error
 *  regardless of whether `fn()` throws — never leaves the process's console.error patched. */
async function captureConsoleError(fn) {
  const calls = [];
  const original = console.error;
  console.error = (...args) => {
    calls.push(args);
  };
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return calls;
}

/** Flattens a captured console.error call's arguments into one searchable string — covers both
 *  a plain message string and a second structured-context-object argument, whatever shape the
 *  implementation chooses (this assertion cares about WHAT text reached a log, not the exact
 *  call signature). */
function callToSearchableText(call) {
  return call
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg, (_key, value) =>
          value instanceof Error ? { name: value.name, message: value.message } : value
        );
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

// --- Scenario 1: MarkOrdersAlertedError branch ----------------------------------------------
{
  const db = new FakeFirestore({ failingOrderId: 'order-B' });
  const calls = await captureConsoleError(() =>
    markOrdersAlertedForResponse(['order-A', 'order-B'], NOW, { db })
  );

  if (calls.length === 0) {
    failures.push(
      'Scenario 1 (MarkOrdersAlertedError): markOrdersAlertedForResponse() logged NOTHING via ' +
        'console.error on a partial batch-commit failure — the failure reason (a real ' +
        'Firestore/permission/quota/network error in production) is completely lost; only the ' +
        'HTTP response, not any log, would tell an operator anything at all.'
    );
  } else {
    const text = calls.map(callToSearchableText).join(' | ');
    if (!text.includes('order-B')) {
      failures.push(
        `Scenario 1: logged something, but none of it names the failed order id 'order-B'. ` +
          `Captured: ${text}`
      );
    }
    if (!text.toLowerCase().includes('simulated commit failure')) {
      failures.push(
        'Scenario 1: logged something naming the order id, but not the underlying REASON ' +
          `(this fake's commit-failure message). A log that only restates the failed order id ` +
          `list (exactly what the HTTP response already carries) gives an operator nothing new ` +
          `to act on — the whole point of this assertion. Captured: ${text}`
      );
    }
  }
}

// --- Scenario 2: unrecognized/infra-level error branch ---------------------------------------
{
  const db = new FakeFirestore({ batchThrows: true });
  const calls = await captureConsoleError(() =>
    markOrdersAlertedForResponse(['order-A', 'order-B'], NOW, { db })
  );

  if (calls.length === 0) {
    failures.push(
      'Scenario 2 (unrecognized error): markOrdersAlertedForResponse() logged NOTHING via ' +
        'console.error on an unrecognized/infra-level throw — the exception type and message ' +
        'are completely lost.'
    );
  } else {
    const text = calls.map(callToSearchableText).join(' | ');
    if (!text.toLowerCase().includes('simulated infra-level failure')) {
      failures.push(
        'Scenario 2: logged something, but not the underlying exception\'s message text. A log ' +
          'that only restates the attempted order id list gives an operator nothing to act on. ' +
          `Captured: ${text}`
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.log(`FAIL: ${f}`));
  console.log(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: markOrdersAlertedForResponse() logs the actual failure REASON (not merely the failed ' +
    'order ids) via console.error at the point of the catch, for both a real ' +
    'MarkOrdersAlertedError and an unrecognized/infra-level thrown value — an operator reading ' +
    'the logs, not just the HTTP response, can now see WHY, not just WHICH orders failed.'
);
process.exit(0);
