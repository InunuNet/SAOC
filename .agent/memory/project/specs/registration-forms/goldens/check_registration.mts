// Golden checker for mission registration-forms. Written by the architect; @dev never edits it.
// Run from the repo root (or CHECK_ROOT) as: tsx <this file> <options|cases|shape|unflagged|wiring>
// It loads the dev's lib/registration.ts and lib/checkout-reservation.ts from process.cwd().
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const GOLD = resolve(ROOT, '.agent/memory/project/specs/registration-forms/goldens');
const json = (name: string) => JSON.parse(readFileSync(resolve(GOLD, name), 'utf8'));
const load = async (rel: string) => import(pathToFileURL(resolve(ROOT, rel)).href);
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function findUndefined(value: unknown, path = ''): string | null {
  if (value === undefined) return path || '(root)';
  if (value === null || typeof value !== 'object') return null;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return null; // Timestamp
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const hit = findUndefined(v, `${path}.${k}`);
    if (hit) return hit;
  }
  return null;
}

const mode = process.argv[2];

if (mode === 'options') {
  const fields = json('registration-fields.json');
  const { REGISTRATION_OPTIONS } = await load('lib/registration.ts');
  for (const key of Object.keys(fields.options)) {
    if (!same(REGISTRATION_OPTIONS[key], fields.options[key])) fail(`option list '${key}' differs from golden`);
  }
  if (!same(fields.options.dietary, ['None', 'Vegetarian', 'Halaal'])) fail('golden dietary list altered');
  console.log('PASS options');
} else if (mode === 'cases') {
  const { validateRegistrationGroup } = await load('lib/registration.ts');
  const cases = json('validation-cases.json').cases;
  for (const c of cases) {
    const result = validateRegistrationGroup(c.people, c.ticketType);
    if (result.ok !== c.expect.ok) fail(`${c.id}: expected ok=${c.expect.ok}, got ${result.ok} ${JSON.stringify(result.errors ?? '')}`);
    if (!c.expect.ok) {
      for (const key of c.expect.errorKeys) {
        if (!(key in result.errors)) fail(`${c.id}: missing error key '${key}', got ${Object.keys(result.errors)}`);
      }
      continue;
    }
    result.people.forEach((person: Record<string, unknown>, i: number) => {
      if (person.attendeeNumber !== i + 1) fail(`${c.id}: attendeeNumber of person ${i} is ${person.attendeeNumber}`);
      if (!Array.isArray(person.sameAsAttendee1)) fail(`${c.id}: sameAsAttendee1 missing on person ${i}`);
    });
    for (const [i, field] of c.expect.resolvedEqualsAttendee1 ?? []) {
      if (!same(result.people[i][field], result.people[0][field])) fail(`${c.id}: person ${i} ${field} was not copied from attendee 1`);
    }
    for (const [i, list] of c.expect.sameAsAttendee1 ?? []) {
      if (!same(result.people[i].sameAsAttendee1, list)) fail(`${c.id}: person ${i} sameAsAttendee1 differs`);
    }
  }
  console.log(`PASS cases (${cases.length})`);
} else if (mode === 'shape' || mode === 'unflagged') {
  const shape = json('firestore-registration-shape.json');
  const { buildMultiReservationDocs } = await load('lib/checkout-reservation.ts');
  const { Timestamp } = await import('firebase-admin/firestore');
  const ts = Timestamp.fromMillis(1_800_000_000_000);
  const plan = (ticketType: string, who: { attendeeName: string; attendeeEmail: string }, registration?: unknown) => ({
    ticketType,
    ...who,
    amount: 100,
    bookingRef: `REF-${who.attendeeName}`,
    chosenDay: null,
    ...(registration === undefined ? {} : { registration }),
  });
  const base = {
    orderId: 'order-1', reference: 'REF', showId: 'show-1', ozowSandboxTestMode: false, idempotencyKey: 'k',
    expiresAt: ts, recoveryToken: 't', recoveryTokenExpiresAt: ts, now: ts, gateway: 'ozow', expectedGatewayAmount: null,
  };
  if (mode === 'unflagged') {
    const docs = buildMultiReservationDocs({ ...base, lineItems: [plan('day-visitor', { attendeeName: 'A B', attendeeEmail: 'a@example.invalid' })] });
    if (!same(Object.keys(docs.positions[0]).sort(), [...shape.unflaggedTicketDocKeys].sort())) fail(`unflagged ticket doc keys changed: ${Object.keys(docs.positions[0])}`);
    if (!same(Object.keys(docs.order).sort(), [...shape.orderDocKeys].sort())) fail(`order doc keys changed: ${Object.keys(docs.order)}`);
    const hit = findUndefined(docs);
    if (hit) fail(`undefined value at ${hit}`);
    console.log('PASS unflagged');
  } else {
    const { buildRegistrationDoc } = await load('lib/registration.ts');
    const { attendee1, attendee2CopiedSections, overseasCocktail } = shape.examples;
    const inputOf = (ex: { attendeeEmail: string; registration: Record<string, unknown> }) => ({ ...ex.registration, email: ex.attendeeEmail });
    const examples = [attendee1, attendee2CopiedSections, overseasCocktail];
    for (const ex of examples) {
      const doc = buildRegistrationDoc(inputOf(ex));
      if (!same(Object.keys(doc), shape.registrationKeysInOrder)) fail(`registration key order/set differs: ${Object.keys(doc)}`);
      if (!same(doc, ex.registration)) fail(`registration doc for ${ex.attendeeEmail} differs from golden`);
      if ('email' in doc) fail('email must not be stored inside registration');
    }
    if (buildRegistrationDoc(inputOf(overseasCocktail)).province !== null) fail('non-SA province must be null, not undefined or empty');
    const inputs = [inputOf(attendee1), inputOf(attendee2CopiedSections)];
    const people = [attendee1.registration, attendee2CopiedSections.registration];
    const primary = attendee1;
    const partner = attendee2CopiedSections;
    const docs = buildMultiReservationDocs({
      ...base,
      lineItems: [
        plan('saoc-symposium', primary, inputs[0]),
        plan('saoc-symposium', partner, inputs[1]),
      ],
    });
    docs.positions.forEach((position: Record<string, unknown>, i: number) => {
      if (!same(position.registration, people[i])) fail(`position ${i} registration differs from golden`);
    });
    if (!same(Object.keys(docs.order).sort(), [...shape.orderDocKeys].sort())) fail('order doc keys changed for a flagged cart');
    const hit = findUndefined(docs);
    if (hit) fail(`undefined value at ${hit}`);
    console.log('PASS shape');
  }
} else if (mode === 'wiring') {
  const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');
  const route = read('app/api/tickets/checkout/route.ts');
  const schema = read('sanity/schemas/documents/ticketType.ts');
  if (!/name:\s*'requiresRegistration'/.test(schema)) fail('Sanity schema lacks requiresRegistration');
  if (!/type:\s*'boolean'[\s\S]{0,120}initialValue:\s*false|initialValue:\s*false[\s\S]{0,120}type:\s*'boolean'/.test(schema.slice(schema.indexOf("name: 'requiresRegistration'")))) fail('requiresRegistration must be a boolean defaulting to false');
  if (!/requiresRegistration/.test(route)) fail('checkout route never reads requiresRegistration');
  if (!/validateRegistrationGroup/.test(route)) fail('checkout route does not call validateRegistrationGroup');
  console.log('PASS wiring');
} else {
  fail(`unknown mode '${mode}'`);
}
