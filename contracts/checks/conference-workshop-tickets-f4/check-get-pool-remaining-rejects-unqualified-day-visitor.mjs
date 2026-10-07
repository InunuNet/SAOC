// F4 (conference-workshop-tickets, M2) — A25: display-path companion to A24.
// getPoolRemaining()'s unqualified branch (lib/data/pool-remaining.ts §7 — RELOCATED
// 2026-10-07, build-break fix: this function used to live in lib/checkout-reservation.ts,
// which a client component reaches transitively via lib/vendor-stand-pricing.ts; its
// lib/data/tickets.ts imports pulled firebase-admin into the client bundle and broke
// `pnpm build`. See the golden's build-break addendum) reads `soldCountsByType[resolvedKey]
// ?? 0` against the caller's `capacity` with no awareness that day-visitor has no
// unqualified pool at all (golden §2) — called this way, it would silently surface the
// SAME wrong aggregate-based figure A24 proves the checkout transaction wrongly enforces
// (e.g. 0 remaining off an 1100-aggregate sold count, when the true per-day pools still
// have hundreds of seats free).
//
// Design decision (architect, 2026-10-07): getPoolRemaining() must refuse (throw)
// rather than silently compute a number for this invalid combination — a
// `poolKeyBase`/`requiresDaySelection: false` pair that names a product with no real
// unqualified pool (day-visitor is the only such product today) is a caller bug, not a
// zero-seats-left fact, and must fail loud at the boundary (see coding.md "Fail fast").
//
// Guard landed (confirmed 2026-10-07, same pass as the build-break relocation) — this
// check now runs against the real guard, not the pre-fix absence of one.
import { loadRepoModule, finish } from './_lib.mjs';

let mod;
try {
  mod = await loadRepoModule('lib/data/pool-remaining.ts');
} catch (error) {
  finish('check-get-pool-remaining-rejects-unqualified-day-visitor.mjs', [`could not import lib/data/pool-remaining.ts: ${error.message}`]);
}

if (typeof mod.getPoolRemaining !== 'function') {
  finish('check-get-pool-remaining-rejects-unqualified-day-visitor.mjs', ['getPoolRemaining is not exported (see A18)']);
}

const failures = [];
let threw = false;
try {
  await mod.getPoolRemaining(
    { poolKeyBase: 'day-visitor', requiresDaySelection: false, capacity: 1000, showId: 'fixture-show' },
    {
      getSoldCountsByTicketTypeAndDay: async () => ({}),
      // Aggregate across-all-days total (400 Fri + 400 Sat + 300 Sun), the same shape
      // A24 uses — if this call silently returned a number instead of throwing, it
      // would be Math.max(1000 - 1100, 0) = 0, wrongly reporting day-visitor sold out
      // show-wide while hundreds of per-day seats remain free.
      getSoldCountsByTicketType: async () => ({ 'day-visitor': 1100 }),
    },
  );
} catch {
  threw = true;
}
if (!threw) {
  failures.push(
    "getPoolRemaining({ poolKeyBase: 'day-visitor', requiresDaySelection: false, ... }) did not throw — day-visitor has NO unqualified pool (golden §2); this call shape must fail loud, not silently return a wrong aggregate-based remaining count",
  );
}

finish(
  'check-get-pool-remaining-rejects-unqualified-day-visitor.mjs',
  failures,
  'getPoolRemaining() refuses the invalid day-visitor + requiresDaySelection:false combination instead of surfacing a wrong aggregate figure.',
);
