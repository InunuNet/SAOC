// Behavioural check for expandAttendeesByDayToLineItems() (contracts/golden/
// ticketing-flow-redesign-f3/day-quantity-picker.golden.md §1 truth table).
//
// Replaces the old expandDayQuantitiesToLineItems({ attendees, quantitiesByDay }) check —
// that function and its flat-array input shape were REMOVED in the second correction
// (README §5.1): the flat shape is exactly what made the interleaved-edit bug possible.
import { expandAttendeesByDayToLineItems } from '../../../lib/cart.ts';

function sameLineItems(a, b) {
  if (a.length !== b.length) return false;
  return a.every((item, i) =>
    item.ticketType === b[i].ticketType &&
    item.attendeeName === b[i].attendeeName &&
    item.attendeeEmail === b[i].attendeeEmail &&
    item.chosenDay === b[i].chosenDay
  );
}

const TICKET_TYPE = 'day-visitor';
const A = { attendeeName: 'Alice A', attendeeEmail: 'alice@example.com' };
const B = { attendeeName: 'Bob B', attendeeEmail: 'bob@example.com' };
const C = { attendeeName: 'Carla C', attendeeEmail: 'carla@example.com' };
const MON = '2027-09-16';
const WED = '2027-09-18';

let failed = false;

function check(name, fn) {
  try {
    fn();
  } catch (err) {
    failed = true;
    console.error(`FAIL: ${name} — ${err.message}`);
  }
}

check('empty map -> no line items', () => {
  const result = expandAttendeesByDayToLineItems({
    ticketType: TICKET_TYPE,
    attendeesByDay: {},
    showDays: [MON, WED],
  });
  if (!sameLineItems(result, [])) throw new Error(`got ${JSON.stringify(result)}`);
});

check('a day entry with an empty array produces no line items', () => {
  const result = expandAttendeesByDayToLineItems({
    ticketType: TICKET_TYPE,
    attendeesByDay: { [MON]: [] },
    showDays: [MON],
  });
  if (!sameLineItems(result, [])) throw new Error(`got ${JSON.stringify(result)}`);
});

check('mixed quantities: each line item carries its OWN attendee identity, in showDays order', () => {
  const result = expandAttendeesByDayToLineItems({
    ticketType: TICKET_TYPE,
    attendeesByDay: { [MON]: [A, B], [WED]: [C] },
    showDays: [MON, WED],
  });
  const expect = [
    { ticketType: TICKET_TYPE, ...A, chosenDay: MON },
    { ticketType: TICKET_TYPE, ...B, chosenDay: MON },
    { ticketType: TICKET_TYPE, ...C, chosenDay: WED },
  ];
  if (!sameLineItems(result, expect)) throw new Error(`got ${JSON.stringify(result)}`);
});

check('output order follows showDays, never the attendeesByDay object key-insertion order', () => {
  // WED inserted into the object literal BEFORE MON — must not affect output order.
  const result = expandAttendeesByDayToLineItems({
    ticketType: TICKET_TYPE,
    attendeesByDay: { [WED]: [C], [MON]: [A, B] },
    showDays: [MON, WED],
  });
  const expect = [
    { ticketType: TICKET_TYPE, ...A, chosenDay: MON },
    { ticketType: TICKET_TYPE, ...B, chosenDay: MON },
    { ticketType: TICKET_TYPE, ...C, chosenDay: WED },
  ];
  if (!sameLineItems(result, expect)) throw new Error(`got ${JSON.stringify(result)}`);
});

if (failed) {
  console.error('expandAttendeesByDayToLineItems does not match the golden truth table.');
  process.exit(1);
}
console.log('PASS: expandAttendeesByDayToLineItems matches the golden truth table for all cases.');
