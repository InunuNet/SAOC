// F3 (conference-workshop-tickets, M2) — A22: a new excludedDays rejection path exists in
// app/api/tickets/checkout/route.ts's per-line-item day-selection validation loop,
// immediately additive after the existing isValidChosenDay() call, distinct from the
// existing show-window-outside error. Same line-position "wiring" proof technique as
// contracts/checks/ticketing-f5-day-attendees/check-chosen-day-persistence-wiring.sh —
// structural, not a full request-mocking harness (isValidChosenDay() itself must stay
// textually UNCHANGED, see A21's sibling grep assertion).
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
  console.error('FAIL: check-excluded-days-checkout-rejection.mjs');
  console.error(`  - could not read ${ROUTE_REL_PATH}: ${error.message}`);
  process.exit(1);
}

const lines = source.split('\n');
const isValidChosenDayLineIdx = lines.findIndex((l) => l.includes('isValidChosenDay(lineItem.chosenDay, showWindow)'));
if (isValidChosenDayLineIdx === -1) {
  failures.push("no 'isValidChosenDay(lineItem.chosenDay, showWindow)' call site found — A21's own anchor is missing");
}

// The new map the golden names, populated the same way requiresDaySelectionByType/
// requiresAttendeeNamesByType already are (route.ts:505-515's pattern).
if (!/excludedDaysByType/.test(source)) {
  failures.push("route.ts never references 'excludedDaysByType' — the new per-type exclusion map the golden specifies is missing");
}

if (isValidChosenDayLineIdx !== -1) {
  // Look within the ~15 lines after the isValidChosenDay() call site (still inside the
  // same per-line-item loop, well before the next field's requiresAttendeeNamesByType
  // block) for a NEW NextResponse.json 400 whose message text differs from both of the
  // two existing ones already in this loop.
  const windowLines = lines.slice(isValidChosenDayLineIdx, isValidChosenDayLineIdx + 15).join('\n');
  const existingMessages = [
    'A day selection is required for this ticket type.',
    'The chosen day is outside the show dates.',
  ];
  const newResponses = [...windowLines.matchAll(/NextResponse\.json\(\s*\{\s*error:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  const distinctNewMessage = newResponses.find((msg) => !existingMessages.includes(msg));
  if (!distinctNewMessage) {
    failures.push(
      `no NEW 400 error message found within 15 lines after the isValidChosenDay() call site (saw: ${JSON.stringify(newResponses)}) — expected a third, distinct rejection message for an excluded day`,
    );
  }
  if (!/excludedDaysByType\[[^\]]+\]/.test(windowLines) && !/excludedDaysByType\.\w+/.test(windowLines)) {
    failures.push("no 'excludedDaysByType[...]' lookup found within 15 lines after the isValidChosenDay() call site");
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-excluded-days-checkout-rejection.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: route.ts rejects an excluded chosenDay via a new, distinct 400 immediately after isValidChosenDay().');
