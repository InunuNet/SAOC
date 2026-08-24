// A10 — behavioural regression check for the interleaved-edit attendee/day mixup QA found
// on re-verification (contracts/golden/ticketing-flow-redesign-f3/README.md §5.1,
// day-quantity-picker.golden.md "A10's regression check").
//
// This drives the REAL, exported state-update primitives useTicketCart.ts calls
// (updateAttendeesByDay, updateAttendeeFieldByFlatIndex, expandAttendeesByDayToLineItems) —
// not a hand-built map — through the exact buyer interaction sequence QA reproduced the bug
// with: add 1 Monday ticket, fill it in; add 1 Wednesday ticket, fill it in; go BACK and add
// a second Monday ticket, fill it in. A buggy implementation that reintroduces either the
// interaction-ordered quantitiesByDay map or the tail-append attendee array will fail this.
import {
  updateAttendeesByDay,
  updateAttendeeFieldByFlatIndex,
  expandAttendeesByDayToLineItems,
} from '../../../lib/cart.ts';

const TICKET_TYPE = 'day-visitor';
const MON = '2027-09-16';
const WED = '2027-09-18';
const SHOW_DAYS = [MON, WED];

function emptyAttendee() {
  return { attendeeName: '', attendeeEmail: '' };
}

let attendeesByDay = {};

function fillFlatRow(index, name, email) {
  attendeesByDay = updateAttendeeFieldByFlatIndex(attendeesByDay, SHOW_DAYS, index, 'attendeeName', name);
  attendeesByDay = updateAttendeeFieldByFlatIndex(attendeesByDay, SHOW_DAYS, index, 'attendeeEmail', email);
}

// 1. Buyer sets Monday to 1, fills the resulting row (flat index 0) with Alice.
attendeesByDay = updateAttendeesByDay(attendeesByDay, MON, 1, emptyAttendee);
fillFlatRow(0, 'Alice A', 'alice@example.com');

// 2. Buyer sets Wednesday to 1, fills the resulting row (flat index 1) with Bob.
attendeesByDay = updateAttendeesByDay(attendeesByDay, WED, 1, emptyAttendee);
fillFlatRow(1, 'Bob B', 'bob@example.com');

// 3. Buyer goes BACK and bumps Monday to 2 — an ordinary "add one more" revisit AFTER a
//    later day was already entered. The new row lands at flat index 1 (Monday's own 2nd
//    slot, in showDays order), NOT at the tail (index 2) — fill it with Carla.
attendeesByDay = updateAttendeesByDay(attendeesByDay, MON, 2, emptyAttendee);
fillFlatRow(1, 'Carla C', 'carla@example.com');

const result = expandAttendeesByDayToLineItems({
  ticketType: TICKET_TYPE,
  attendeesByDay,
  showDays: SHOW_DAYS,
});

const byName = Object.fromEntries(result.map((item) => [item.attendeeName, item.chosenDay]));
const expected = { 'Alice A': MON, 'Bob B': WED, 'Carla C': MON };

let failed = false;
if (result.length !== 3) {
  failed = true;
  console.error(`FAIL: expected 3 line items, got ${result.length}: ${JSON.stringify(result)}`);
}
for (const [name, expectedDay] of Object.entries(expected)) {
  if (byName[name] !== expectedDay) {
    failed = true;
    console.error(
      `FAIL: ${name} expected on ${expectedDay}, got ${byName[name] ?? '(missing)'} — ` +
        `full result: ${JSON.stringify(result)}`
    );
  }
}

if (failed) {
  console.error(
    'Interleaved day-quantity edit produced the wrong attendee-to-day mapping — the exact ' +
      'QA-reported bug (README §5.1): a real attendee gets checked in under the wrong day, or ' +
      "under another buyer-entered attendee's identity."
  );
  process.exit(1);
}
console.log('PASS: interleaved day-quantity edits keep every attendee zipped to the day the buyer meant.');
