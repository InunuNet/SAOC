// F6 (conference-workshop-tickets, M4) — A29 (added 2026-10-07, Codex finding, verified
// and relayed by team-lead): symposium and wosa-conference await loadTicketCardViewModel()
// with no error handling of their own (app/(marketing)/national-show/symposium/page.tsx,
// .../wosa-conference/page.tsx) — a Firestore (getPoolRemaining) or Sanity
// (fetchTicketTypeFromSanity's raw, un-try/catch'd `client.fetch()` call — see
// load-ticket-card.ts) failure would propagate as an uncaught rejection and 500 these
// public content pages. Golden §2 did not specify a failure contract for this loader; this
// feature's golden is amended (Addendum 4) to require one: the loader never throws past
// its own boundary, logs the failure, and resolves to `null` instead of rejecting.
//
// Driven via loadTicketCardViewModel's existing DI seam (golden Addendum 2) — forces a
// failure from BOTH dependency injection points golden §2 documents the loader calling
// (fetchTicketType = the Sanity-side path; getPoolRemaining = the Firestore-side path),
// matching team-lead's "a Firestore or Sanity failure" framing exactly. Each case must:
//   1. NOT reject — `loadTicketCardViewModel(...)` must resolve, never throw past its
//      own boundary (proven by awaiting with no try/catch here — an uncaught rejection
//      fails this script's own process, which is the point).
//   2. Resolve to `null` (the Addendum 4 contract), not a partially-built view-model.
//   3. Log the failure via console.error with the project's established
//      `[module-tag] message` convention (see app/api/tickets/checkout/route.ts's own
///     `console.error('[tickets/checkout] ...', error)` calls) — never swallow silently.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-loader-never-throws-on-failure.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];

function spyOnConsoleError() {
  const original = console.error;
  const calls = [];
  console.error = (...args) => {
    calls.push(args);
  };
  return {
    calls,
    restore: () => {
      console.error = original;
    },
  };
}

async function runCase(label, deps) {
  const spy = spyOnConsoleError();
  let result;
  let threw = false;
  let thrownError = null;
  try {
    result = await loadTicketCardViewModel('day-visitor', deps);
  } catch (error) {
    threw = true;
    thrownError = error;
  } finally {
    spy.restore();
  }

  if (threw) {
    failures.push(`${label}: loadTicketCardViewModel() REJECTED (${thrownError?.message ?? thrownError}) instead of resolving to null — a page awaiting this with no try/catch of its own would 500`);
    return;
  }
  if (result !== null) {
    failures.push(`${label}: loadTicketCardViewModel() resolved to ${JSON.stringify(result)}, expected null on a dependency failure — never a partially-built view-model`);
  }
  if (spy.calls.length === 0) {
    failures.push(`${label}: no console.error call was observed — a dependency failure must be logged, never swallowed silently`);
  }
}

// --- Sanity-side failure: fetchTicketType rejects ---
await runCase('fetchTicketType throws', {
  fetchTicketType: async () => {
    throw new Error('simulated Sanity client.fetch() failure');
  },
  getPoolRemaining: async (args) => Math.floor((args?.capacity ?? 0) / 2),
  computeEarlyBirdRemaining: (remaining) => remaining,
});

// --- Firestore-side failure: getPoolRemaining rejects ---
await runCase('getPoolRemaining throws', {
  fetchTicketType: async () => ({
    price: 150,
    regularPrice: null,
    capacity: 1000,
    releasedQuantity: null,
    capacityPool: null,
    requiresDaySelection: true,
    earlyBirdCutoff: null,
  }),
  getPoolRemaining: async () => {
    throw new Error('simulated Firestore getPoolRemaining() failure');
  },
  computeEarlyBirdRemaining: (remaining) => remaining,
});

finish(
  'check-loader-never-throws-on-failure.mjs',
  failures,
  'loadTicketCardViewModel() never throws past its own boundary — a Sanity-side (fetchTicketType) or Firestore-side (getPoolRemaining) failure is caught, logged, and resolved to null.',
);
