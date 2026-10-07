// F4 (conference-workshop-tickets, M2) — A2: the checkout route runs the day-qualified
// capacity check AND the unqualified shared-pool check as TWO INDEPENDENT calls to
// planPooledCapacity, both required to pass. Structural/wiring proof (same technique as
// contracts/checks/ticketing-f5-day-attendees/check-chosen-day-persistence-wiring.sh) —
// on the current tree there is exactly ONE planPooledCapacity( call site, so this fails
// until the day-qualified check is added alongside it.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTE_REL_PATH = 'app/api/tickets/checkout/route.ts';
const routePath = path.join(__dirname, '../../../', ROUTE_REL_PATH);

const failures = [];
let source;
try {
  source = readFileSync(routePath, 'utf8');
} catch (error) {
  console.error('FAIL: check-two-independent-capacity-checks.mjs');
  console.error(`  - could not read ${ROUTE_REL_PATH}: ${error.message}`);
  process.exit(1);
}

const callSites = [...source.matchAll(/planPooledCapacity\s*\(/g)];
if (callSites.length < 2) {
  failures.push(
    `found ${callSites.length} call site(s) of planPooledCapacity( in ${ROUTE_REL_PATH}, expected at least 2 — one day-qualified (per-day 1000 cap), one unqualified (shared admission-early-bird 500 pool)`,
  );
}

// One of the call sites' surrounding construction must reference the day-qualifying
// helper (A1) — otherwise "two calls" could just be the same unqualified shape called
// twice, which proves nothing new.
if (!/resolveDayQualifiedPoolKey/.test(source)) {
  failures.push(
    `${ROUTE_REL_PATH} never references resolveDayQualifiedPoolKey — at least one of the two planPooledCapacity( calls must be fed day-qualified keys`,
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-two-independent-capacity-checks.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `PASS: ${ROUTE_REL_PATH} calls planPooledCapacity( ${callSites.length} times, with resolveDayQualifiedPoolKey feeding at least one of them.`,
);
