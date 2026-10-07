// F4 (conference-workshop-tickets, M2) — A12: CONCURRENCY — N parallel reservations
// against a single day-qualified day-visitor pool (Friday) with exactly K slots
// remaining yield exactly K successes, never oversold. Unlike A11 (reuse of an existing
// mechanism), this exercises the ONE genuinely new piece — resolveDayQualifiedPoolKey()
// (A1) feeding the day-qualified key into the same real planPooledCapacity() — so this
// fails today until A1 ships. Same harness/control-arm discipline as
// check-concurrency-no-oversell-shared-pool.mjs; see _concurrency-harness.mjs's header.
import { loadRepoModule } from './_lib.mjs';
import { runConcurrentBurst } from './_concurrency-harness.mjs';

const failures = [];

let mod;
try {
  mod = await loadRepoModule('lib/checkout-reservation.ts');
} catch (error) {
  console.error('FAIL: check-concurrency-no-oversell-day-cap.mjs');
  console.error(`  - could not import lib/checkout-reservation.ts: ${error.message}`);
  process.exit(1);
}

if (typeof mod.resolveDayQualifiedPoolKey !== 'function') {
  console.error('FAIL: check-concurrency-no-oversell-day-cap.mjs');
  console.error('  - resolveDayQualifiedPoolKey is not exported (see A1) — cannot build the day-qualified pool key this check exercises');
  process.exit(1);
}

const FRIDAY_KEY = mod.resolveDayQualifiedPoolKey('day-visitor', '2027-09-24', true);
const CAPACITY = 1000;
const REMAINING = 4; // K
const BURST_SIZE = 12; // N > K
const SOLD = CAPACITY - REMAINING;

const control = await runConcurrentBurst({
  poolKey: FRIDAY_KEY,
  capacity: CAPACITY,
  sold: SOLD,
  concurrentRequests: BURST_SIZE,
  control: true,
});
if (control.winners <= REMAINING) {
  failures.push(
    `CONTROL: the pre-fix no-recheck shape was expected to OVERSELL (more than ${REMAINING} winners), got ${control.winners} — the harness proves nothing`,
  );
}

const fix = await runConcurrentBurst({
  poolKey: FRIDAY_KEY,
  capacity: CAPACITY,
  sold: SOLD,
  concurrentRequests: BURST_SIZE,
  control: false,
});
if (fix.winners !== REMAINING) {
  failures.push(`FIX: expected exactly ${REMAINING} winners out of ${BURST_SIZE} concurrent Friday requests, got ${fix.winners}`);
}
if (fix.finalSold !== CAPACITY) {
  failures.push(`FIX: final Friday sold count is ${fix.finalSold}, expected exactly ${CAPACITY}`);
}

// Cross-slug regression (QA repro, 2026-10-07): the same burst, but alternating
// BETWEEN day-visitor and early-bird — sibling slugs sharing Friday's one physical
// day-qualified pool (DAY_VISITOR_SHAPED_SLUGS) — via the same poolConfigByType
// mechanism A11 already exercises for the shared early-bird pool. Proves the
// concurrency fix holds across sibling slugs, not just repeated requests for one slug.
const earlyBirdFridayKey = mod.resolveDayQualifiedPoolKey('early-bird', '2027-09-24', true);
const crossSlugPoolConfig = {
  [FRIDAY_KEY]: { pool: FRIDAY_KEY, headcountPerUnit: 1 },
  [earlyBirdFridayKey]: { pool: FRIDAY_KEY, headcountPerUnit: 1 },
};
const crossSlugTicketTypeForIndex = (i) => (i % 2 === 0 ? FRIDAY_KEY : earlyBirdFridayKey);

const crossSlugControl = await runConcurrentBurst({
  poolKey: FRIDAY_KEY,
  capacity: CAPACITY,
  sold: SOLD,
  concurrentRequests: BURST_SIZE,
  control: true,
  ticketTypeForIndex: crossSlugTicketTypeForIndex,
  poolConfigByType: crossSlugPoolConfig,
});
if (crossSlugControl.winners <= REMAINING) {
  failures.push(
    `CONTROL (cross-slug): the pre-fix no-recheck shape was expected to OVERSELL (more than ${REMAINING} winners) alternating day-visitor/early-bird against Friday's shared pool, got ${crossSlugControl.winners} — the harness proves nothing`,
  );
}

const crossSlugFix = await runConcurrentBurst({
  poolKey: FRIDAY_KEY,
  capacity: CAPACITY,
  sold: SOLD,
  concurrentRequests: BURST_SIZE,
  control: false,
  ticketTypeForIndex: crossSlugTicketTypeForIndex,
  poolConfigByType: crossSlugPoolConfig,
});
if (crossSlugFix.winners !== REMAINING) {
  failures.push(`FIX (cross-slug): expected exactly ${REMAINING} winners out of ${BURST_SIZE} concurrent day-visitor/early-bird Friday requests, got ${crossSlugFix.winners}`);
}
if (crossSlugFix.finalSold !== CAPACITY) {
  failures.push(`FIX (cross-slug): final Friday sold count is ${crossSlugFix.finalSold}, expected exactly ${CAPACITY}`);
}

if (failures.length > 0) {
  console.error('FAIL: check-concurrency-no-oversell-day-cap.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `PASS: ${BURST_SIZE} concurrent Friday day-visitor requests against ${REMAINING} remaining day-cap slots yield exactly ${REMAINING} winners, never oversold; cross-slug day-visitor/early-bird alternation against the same shared pool holds too.`,
);
