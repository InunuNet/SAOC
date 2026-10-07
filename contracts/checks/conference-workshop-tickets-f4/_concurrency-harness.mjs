// Shared concurrency harness for F4's two "no oversell" checks (A11/A12). Same
// discipline as contracts/checks/vendor-gated-registration-flow/
// check-single-use-claim-is-atomic.mjs's own header comment: no Firestore emulator is
// available on this machine (needs a Java runtime that isn't installed), so this models
// the ONE Firestore property the correctness proof depends on — optimistic concurrency:
// a transaction that commits a write whose read-set has changed since it read is
// discarded and re-run against fresh data. A CONTROL arm reproducing the pre-fix
// read-then-write shape MUST produce an oversell under the exact same harness, proving
// the harness can express the defect — otherwise a green result here would prove
// nothing (A13's own requirement).
//
// This drives the REAL, unmodified planPooledCapacity() (lib/checkout-reservation.ts)
// inside a fake optimistic-concurrency transaction, for N parallel reservation attempts
// against a pool with exactly K slots remaining.
import { loadRepoModule } from './_lib.mjs';

const { planPooledCapacity } = await loadRepoModule('lib/checkout-reservation.ts');

/** Minimal store: a single pool's current sold-heads count, version-stamped. */
function createStore(initialSold) {
  return { sold: initialSold, version: 0 };
}

/**
 * Real-shaped reservation attempt: READ the current sold count (version-stamped),
 * decide via the REAL planPooledCapacity(), and — if ok — WRITE (increment sold) only
 * if nothing else committed since the read; otherwise retry against fresh data. This is
 * the same optimistic-concurrency re-run-on-staleness behaviour Firestore transactions
 * give route.ts in production.
 */
// `ticketType` defaults to `poolKey` itself (single-product pool, A12's case). A11 passes
// a DIFFERENT ticketType per concurrent attempt (alternating two distinct products) plus
// a `poolConfigByType` mapping each of them to the SAME `poolKey` — proving the pool
// combines sales ACROSS products, not just within one product's own repeated sales.
async function attemptReservation({ store, poolKey, capacity, requestedQty, ticketType, poolConfigByType, beforeCommit }) {
  const type = ticketType ?? poolKey;
  const config = poolConfigByType ?? {};
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const readVersion = store.version;
    const readSold = store.sold;

    const result = planPooledCapacity({
      requestedQtyByType: { [type]: requestedQty },
      soldCountsByType: { [poolKey]: readSold },
      capacityByType: { [poolKey]: capacity },
      poolConfigByType: config,
    });

    if (beforeCommit) await beforeCommit(attempt);

    if (store.version !== readVersion) continue; // contention — re-run against fresh data

    if (result.kind === 'over-capacity') return false;

    store.sold = readSold + requestedQty;
    store.version += 1;
    return true;
  }
  throw new Error('attemptReservation exceeded retry budget');
}

/** CONTROL: the pre-fix shape — read, decide, write, with NO re-check that the read is
 * still fresh at commit time. Used only to prove the harness can express an oversell. */
async function attemptReservationNoRecheck({ store, poolKey, capacity, requestedQty, ticketType, poolConfigByType, beforeCommit }) {
  const type = ticketType ?? poolKey;
  const config = poolConfigByType ?? {};
  const readSold = store.sold;
  const result = planPooledCapacity({
    requestedQtyByType: { [type]: requestedQty },
    soldCountsByType: { [poolKey]: readSold },
    capacityByType: { [poolKey]: capacity },
    poolConfigByType: config,
  });
  if (beforeCommit) await beforeCommit(0);
  if (result.kind === 'over-capacity') return false;
  store.sold = readSold + requestedQty; // unconditional — no staleness check
  store.version += 1;
  return true;
}

/**
 * Runs `attempts` (default: real, re-checking) concurrent 1-unit reservation requests
 * against a pool starting at `sold`/`capacity`, forcing every attempt to complete its
 * READ before any of them is allowed to COMMIT (a synchronisation barrier via
 * beforeCommit), which is the scenario that actually distinguishes a transaction-
 * faithful harness from a plain sequential mock.
 */
export async function runConcurrentBurst({
  poolKey,
  capacity,
  sold,
  concurrentRequests,
  control = false,
  ticketTypeForIndex,
  poolConfigByType,
}) {
  const store = createStore(sold);
  let arrived = 0;
  let releaseAll;
  const barrier = new Promise((resolve) => {
    releaseAll = resolve;
  });

  const beforeCommit = async (attempt) => {
    if (attempt > 0) return; // only stall each attempt's FIRST pass; retries commit immediately
    arrived += 1;
    if (arrived === concurrentRequests) releaseAll();
    await barrier;
  };

  const attemptFn = control ? attemptReservationNoRecheck : attemptReservation;
  const results = await Promise.all(
    Array.from({ length: concurrentRequests }, (_, i) =>
      attemptFn({
        store,
        poolKey,
        capacity,
        requestedQty: 1,
        ticketType: ticketTypeForIndex ? ticketTypeForIndex(i) : undefined,
        poolConfigByType,
        beforeCommit,
      }),
    ),
  );

  return { results, finalSold: store.sold, winners: results.filter(Boolean).length };
}
