// F6 (conference-workshop-tickets, M4) — A23 (added 2026-10-07, design peer request,
// relayed by team-lead): weekend-pass ships a real, non-null scarcity when its own
// ticketType.capacity is set (A13's existing case, re-confirmed here for contrast), and
// ships scarcity: null — never a fabricated ScarcityLine, never an "unlimited" claim,
// never a getPoolRemaining() call with an invented capacity — specifically and only when
// ticketType.capacity is itself unset/null. Every other in-scope product's scarcity/days
// reading is unaffected by this capacity-null branch (checked here via a sibling slug
// that must still resolve its real counter even while weekend-pass's own capacity is
// null in this same test run).
//
// Driven via loadTicketCardViewModel's DI seam (golden Addendum 2). The getPoolRemaining
// stub THROWS if called with a null/undefined capacity — if the loader's capacity-null
// branch were missing (i.e. it called getPoolRemaining regardless), this test fails loudly
// on that throw rather than silently accepting a fabricated number.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-weekend-pass-null-capacity-scarcity.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];

function depsWithCapacity(capacity) {
  return {
    fetchTicketType: async () => ({
      price: 380,
      capacity,
      capacityPool: null,
      requiresDaySelection: false,
      earlyBirdCutoff: null,
    }),
    getPoolRemaining: async (args) => {
      if (args?.capacity === null || args?.capacity === undefined) {
        throw new Error('getPoolRemaining called with a null/undefined capacity — the loader must skip this call entirely when ticketType.capacity is unset, not invent one');
      }
      return Math.floor(args.capacity / 2);
    },
    computeEarlyBirdRemaining: (remaining) => remaining,
  };
}

// --- capacity set (300): the existing, unaffected case — scarcity must still be real ---
{
  let result;
  try {
    result = await loadTicketCardViewModel('weekend-pass', depsWithCapacity(300));
  } catch (error) {
    failures.push(`loadTicketCardViewModel('weekend-pass', <capacity: 300>) threw ${error.message}`);
  }
  if (result && (result.scarcity === null || result.scarcity === undefined)) {
    failures.push("'weekend-pass' with capacity: 300 resolved scarcity: null — expected a real ScarcityLine (the capacity-null branch must not fire when a real capacity exists)");
  }
}

// --- capacity unset/null: scarcity must be null, no fabricated/"unlimited" ScarcityLine ---
for (const capacity of [null, undefined]) {
  let result;
  try {
    result = await loadTicketCardViewModel('weekend-pass', depsWithCapacity(capacity));
  } catch (error) {
    failures.push(`loadTicketCardViewModel('weekend-pass', <capacity: ${JSON.stringify(capacity)}>) threw ${error.message} — expected a clean scarcity: null, not a crash or a call to getPoolRemaining with an invented capacity`);
    continue;
  }
  if (result.scarcity !== null) {
    failures.push(`'weekend-pass' with capacity: ${JSON.stringify(capacity)} resolved scarcity to ${JSON.stringify(result.scarcity)}, expected null — no capacity number means no counter, never a fabricated or "unlimited" ScarcityLine`);
  }
}

finish(
  'check-weekend-pass-null-capacity-scarcity.mjs',
  failures,
  "weekend-pass resolves a real scarcity when its capacity is set, and a clean scarcity: null (never fabricated) when its capacity is unset/null.",
);
