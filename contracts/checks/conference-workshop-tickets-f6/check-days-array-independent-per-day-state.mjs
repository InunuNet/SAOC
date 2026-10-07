// F6 (conference-workshop-tickets, M4) — A15: each entry in a day-qualified product's
// `days` array has its remaining/total/state resolved INDEPENDENTLY per day via
// getPoolRemaining on that day's own day-qualified pool key — a fixture where Saturday is
// sold out and Friday/Sunday are not must yield days[] with Saturday's state soldOut and
// Friday/Sunday's state available/low in the same array, never a single collapsed
// card-level state applied to all three.
//
// Driven via loadTicketCardViewModel's DI seam (golden Addendum 2): the stub
// getPoolRemaining returns a DIFFERENT remaining count per `chosenDay`, so a loader that
// (incorrectly) resolved one state and broadcast it to all three days would fail this
// check, while a loader that calls getPoolRemaining/resolveTicketCardState once per day
// (per the golden §2's "one call per day... each with its own independently-resolved
// TicketCardState") passes it.
import { loadRepoModule, finish } from './_lib.mjs';

let loadTicketCardViewModel;
try {
  ({ loadTicketCardViewModel } = await loadRepoModule('lib/view-models/load-ticket-card.ts'));
} catch (error) {
  finish('check-days-array-independent-per-day-state.mjs', [`could not import lib/view-models/load-ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

const failures = [];
const DAY_CAP = 1000;

const PER_DAY_REMAINING = {
  '2027-09-24': 900, // Friday — healthy, 'available'
  '2027-09-25': 0,   // Saturday — sold out
  '2027-09-26': 850, // Sunday — healthy, 'available'
};
const EXPECTED_STATE_BY_DAY = {
  '2027-09-24': 'available',
  '2027-09-25': 'soldOut',
  '2027-09-26': 'available',
};

const deps = {
  fetchTicketType: async () => ({
    price: 150,
    capacity: DAY_CAP,
    capacityPool: null,
    requiresDaySelection: true,
    earlyBirdCutoff: null,
  }),
  getPoolRemaining: async (args) => {
    if (!args || !args.chosenDay || !(args.chosenDay in PER_DAY_REMAINING)) {
      throw new Error(`stub getPoolRemaining called with an unrecognised day: ${JSON.stringify(args)}`);
    }
    return PER_DAY_REMAINING[args.chosenDay];
  },
  computeEarlyBirdRemaining: (remaining) => remaining,
};

let result;
try {
  result = await loadTicketCardViewModel('day-visitor', deps);
} catch (error) {
  finish('check-days-array-independent-per-day-state.mjs', [`loadTicketCardViewModel('day-visitor', <fixture deps>) threw ${error.message}`]);
  process.exit(1);
}

if (!Array.isArray(result.days) || result.days.length !== 3) {
  failures.push(`days is ${JSON.stringify(result.days)}, expected a 3-entry array`);
} else {
  for (const entry of result.days) {
    const expectedState = EXPECTED_STATE_BY_DAY[entry.day];
    if (expectedState === undefined) {
      failures.push(`days[] contains an unrecognised day ${JSON.stringify(entry.day)}`);
      continue;
    }
    if (entry.state !== expectedState) {
      failures.push(`day ${entry.day}: state is '${entry.state}', expected '${expectedState}' — each day must resolve its OWN state from its OWN remaining count, not a single card-level state applied to all three`);
    }
    if (entry.remaining !== PER_DAY_REMAINING[entry.day]) {
      failures.push(`day ${entry.day}: remaining is ${entry.remaining}, expected ${PER_DAY_REMAINING[entry.day]}`);
    }
  }

  // The defect this assertion exists to catch: a collapsed single state broadcast to every
  // day. Fail loudly (not just per-entry) if all three ended up identical despite the
  // fixture's deliberately mixed remaining counts.
  const distinctStates = new Set(result.days.map((d) => d.state));
  if (distinctStates.size === 1 && Object.values(EXPECTED_STATE_BY_DAY).some((s) => s !== [...distinctStates][0])) {
    failures.push(`all three days resolved to the same state '${[...distinctStates][0]}' despite Saturday being sold out and Friday/Sunday healthy — states appear collapsed to one card-level value`);
  }
}

finish(
  'check-days-array-independent-per-day-state.mjs',
  failures,
  "A Saturday-sold-out fixture yields days[] with Saturday's own 'soldOut' state and Friday/Sunday's own 'available' state, resolved independently per day.",
);
