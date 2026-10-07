// F4 (conference-workshop-tickets, M2) — A11: CONCURRENCY — N parallel reservations
// against the shared admission-early-bird pool with exactly K slots remaining yield
// EXACTLY K successes and N-K over-capacity rejections, final sold+reserved count never
// exceeds the ceiling. Mixes weekend-pass-early-bird and early-bird requests in the same
// concurrent burst, proving the SHARED, cross-product nature of the pool — not just a
// single slug's own capacity. See _concurrency-harness.mjs's header for why this is an
// optimistic-concurrency fake (no Firestore emulator on this machine), not a plain
// sequential mock, and why the CONTROL arm below is load-bearing, not decorative.
import { runConcurrentBurst } from './_concurrency-harness.mjs';

const failures = [];
const POOL_KEY = 'admission-early-bird';
const CAPACITY = 500;
const REMAINING = 3; // K
const BURST_SIZE = 10; // N > K, so N-K must be rejected
const SOLD = CAPACITY - REMAINING;

const poolConfigByType = {
  'weekend-pass-early-bird': { pool: POOL_KEY, headcountPerUnit: 1 },
  'early-bird': { pool: POOL_KEY, headcountPerUnit: 1 },
};
const ticketTypeForIndex = (i) => (i % 2 === 0 ? 'weekend-pass-early-bird' : 'early-bird');

// CONTROL — same harness, same inputs, but the pre-fix read-then-write shape with no
// re-check at commit time. This MUST oversell (produce more than K winners) under this
// exact burst, or the harness proves nothing about the real fix below.
const control = await runConcurrentBurst({
  poolKey: POOL_KEY,
  capacity: CAPACITY,
  sold: SOLD,
  concurrentRequests: BURST_SIZE,
  control: true,
  ticketTypeForIndex,
  poolConfigByType,
});
if (control.winners <= REMAINING) {
  failures.push(
    `CONTROL: the pre-fix no-recheck shape was expected to OVERSELL (more than ${REMAINING} winners) under this harness, got ${control.winners} — the harness is serialising callers and this check proves nothing`,
  );
}

// FIX — the real planPooledCapacity() driven through the harness's optimistic-
// concurrency re-check. Exactly K winners, never more.
const fix = await runConcurrentBurst({
  poolKey: POOL_KEY,
  capacity: CAPACITY,
  sold: SOLD,
  concurrentRequests: BURST_SIZE,
  control: false,
  ticketTypeForIndex,
  poolConfigByType,
});
if (fix.winners !== REMAINING) {
  failures.push(`FIX: expected exactly ${REMAINING} winners out of ${BURST_SIZE} concurrent requests, got ${fix.winners}`);
}
if (fix.finalSold > CAPACITY) {
  failures.push(`FIX: final sold count ${fix.finalSold} exceeds the ${CAPACITY} ceiling — oversold`);
}
if (fix.finalSold !== CAPACITY) {
  failures.push(`FIX: final sold count is ${fix.finalSold}, expected exactly ${CAPACITY} (the ceiling, fully but not over-filled)`);
}

if (failures.length > 0) {
  console.error('FAIL: check-concurrency-no-oversell-shared-pool.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `PASS: ${BURST_SIZE} concurrent weekend-pass-early-bird/early-bird requests against ${REMAINING} remaining shared-pool slots yield exactly ${REMAINING} winners, never oversold (control arm proves the harness can express the defect).`,
);
