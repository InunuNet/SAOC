// F6 (conference-workshop-tickets, M4) — A3: TicketCardState precedence order
// (pricePending > soldOut > earlyBirdSoldOut > low > available) is enforced by
// loadTicketCardViewModel's resolution logic, verified against fixture cases covering
// every pairwise precedence collision.
//
// Tested against the real, unmodified `resolveTicketCardState()` (lib/view-models/
// ticket-card.ts, per the golden's Addendum) — a pure function, so every precedence
// collision is directly fixture-testable with no Firestore/Sanity I/O, same split as
// resolveEffectivePrice()/planPooledCapacity()/resolveDayQualifiedPoolKey() elsewhere in
// this codebase. A second check below proves the resolver is actually WIRED into
// loadTicketCardViewModel (textually, the same way check-chosen-day-persistence-wiring.sh
// proves its own strip function is called, not just defined) — a green fixture suite
// against a resolver nobody calls would prove nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRepoModule, finish } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const failures = [];

let resolveTicketCardState;
try {
  ({ resolveTicketCardState } = await loadRepoModule('lib/view-models/ticket-card.ts'));
} catch (error) {
  finish('check-state-precedence-fixtures.mjs', [`could not import lib/view-models/ticket-card.ts: ${error.message}`]);
  process.exit(1);
}

if (typeof resolveTicketCardState !== 'function') {
  finish('check-state-precedence-fixtures.mjs', [
    'lib/view-models/ticket-card.ts does not export a resolveTicketCardState function',
  ]);
  process.exit(1);
}

// Every pairwise collision between adjacent AND non-adjacent precedence levels — not just
// the five "clean" single-condition cases. Each case names which two conditions collide
// and which one must win.
const CASES = [
  // --- pricePending beats every other condition, even when they'd independently fire ---
  {
    name: 'pricePending beats soldOut (remaining<=0 AND priceUsable=false)',
    input: { priceUsable: false, remaining: 0, total: 100, earlyBirdRemaining: null },
    expected: 'pricePending',
  },
  {
    name: 'pricePending beats earlyBirdSoldOut (eb remaining<=0 AND priceUsable=false)',
    input: { priceUsable: false, remaining: 50, total: 100, earlyBirdRemaining: 0 },
    expected: 'pricePending',
  },
  {
    name: 'pricePending beats low (low-stock ratio AND priceUsable=false)',
    input: { priceUsable: false, remaining: 5, total: 100, earlyBirdRemaining: null },
    expected: 'pricePending',
  },
  {
    name: 'pricePending beats available (nothing else would fire AND priceUsable=false)',
    input: { priceUsable: false, remaining: 100, total: 100, earlyBirdRemaining: null },
    expected: 'pricePending',
  },
  // --- soldOut beats earlyBirdSoldOut and low, when priceUsable=true ---
  {
    name: 'soldOut beats earlyBirdSoldOut (both remaining<=0 and eb remaining<=0)',
    input: { priceUsable: true, remaining: 0, total: 100, earlyBirdRemaining: 0 },
    expected: 'soldOut',
  },
  {
    name: 'soldOut wins even though the ratio also reads low (remaining=0 is <=0, not merely low)',
    input: { priceUsable: true, remaining: 0, total: 100, earlyBirdRemaining: null },
    expected: 'soldOut',
  },
  // --- earlyBirdSoldOut beats low, when card-level remaining > 0 ---
  {
    name: 'earlyBirdSoldOut beats low (card remaining is healthy, eb pool is exhausted)',
    input: { priceUsable: true, remaining: 80, total: 100, earlyBirdRemaining: 0 },
    expected: 'earlyBirdSoldOut',
  },
  {
    name: 'earlyBirdSoldOut fires even when card-level remaining is also in the low band',
    input: { priceUsable: true, remaining: 5, total: 100, earlyBirdRemaining: 0 },
    expected: 'earlyBirdSoldOut',
  },
  // --- low beats available, at and just inside the threshold boundary ---
  {
    name: 'low at exactly the 10% boundary (remaining/total*100 === 10)',
    input: { priceUsable: true, remaining: 10, total: 100, earlyBirdRemaining: null },
    expected: 'low',
  },
  {
    name: 'available just above the 10% boundary (11%)',
    input: { priceUsable: true, remaining: 11, total: 100, earlyBirdRemaining: null },
    expected: 'available',
  },
  {
    name: 'low just inside the boundary (9%)',
    input: { priceUsable: true, remaining: 9, total: 100, earlyBirdRemaining: null },
    expected: 'low',
  },
  // --- available is the true base case: nothing else fires ---
  {
    name: 'available: healthy remaining, no eb pool, priceUsable',
    input: { priceUsable: true, remaining: 90, total: 100, earlyBirdRemaining: null },
    expected: 'available',
  },
  {
    name: 'available: healthy remaining, healthy eb pool',
    input: { priceUsable: true, remaining: 90, total: 100, earlyBirdRemaining: 50 },
    expected: 'available',
  },
  // --- remaining: null (no pool tracked, e.g. day-visitor's bare scarcity) ---
  {
    name: 'null remaining can still resolve pricePending',
    input: { priceUsable: false, remaining: null, total: 0, earlyBirdRemaining: null },
    expected: 'pricePending',
  },
  {
    name: 'null remaining never resolves soldOut/low — falls through to available when eb is healthy',
    input: { priceUsable: true, remaining: null, total: 0, earlyBirdRemaining: null },
    expected: 'available',
  },
  {
    name: 'null remaining still lets earlyBirdSoldOut fire from the eb ceiling alone',
    input: { priceUsable: true, remaining: null, total: 0, earlyBirdRemaining: 0 },
    expected: 'earlyBirdSoldOut',
  },
  // --- total: 0 must never divide-by-zero into a false "low" ---
  {
    name: 'total=0 with a positive remaining does not spuriously read as low (total > 0 guard)',
    input: { priceUsable: true, remaining: 5, total: 0, earlyBirdRemaining: null },
    expected: 'available',
  },
];

for (const { name, input, expected } of CASES) {
  let actual;
  try {
    actual = resolveTicketCardState(input);
  } catch (error) {
    failures.push(`${name}: resolveTicketCardState threw ${error.message}`);
    continue;
  }
  if (actual !== expected) {
    failures.push(`${name}: expected '${expected}', got '${JSON.stringify(actual)}' (input=${JSON.stringify(input)})`);
  }
}

// Wiring check: loadTicketCardViewModel must actually CALL resolveTicketCardState — a
// resolver that passes every fixture above but is never invoked by the real loader would
// make this whole suite prove nothing about the shipped behaviour.
const LOADER_REL_PATH = 'lib/view-models/load-ticket-card.ts';
try {
  const loaderSource = readFileSync(path.join(__dirname, '../../../', LOADER_REL_PATH), 'utf8');
  const loaderSourceNoComments = loaderSource
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  if (!/resolveTicketCardState\s*\(/.test(loaderSourceNoComments)) {
    failures.push(`${LOADER_REL_PATH} never calls resolveTicketCardState( — the precedence resolver is defined but not wired in`);
  }
} catch (error) {
  failures.push(`could not read ${LOADER_REL_PATH} to confirm resolveTicketCardState is wired in: ${error.message}`);
}

finish(
  'check-state-precedence-fixtures.mjs',
  failures,
  'resolveTicketCardState() enforces the pinned precedence order across every pairwise collision, and loadTicketCardViewModel actually calls it.',
);
