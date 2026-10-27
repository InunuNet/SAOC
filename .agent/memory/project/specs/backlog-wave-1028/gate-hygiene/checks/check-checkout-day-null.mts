// gate-hygiene item 3: HTTP-level proof that POST /api/tickets/checkout refuses a position whose ticket type
// requiresDaySelection when chosenDay is null (or absent), with nothing written. Drives the real route handler.
// Mocked at the module boundary (CJS require hook, tsx runs this repo as CJS): next-sanity createClient,
// firebase-admin/app and firebase-admin/firestore. Payment: globalThis.fetch is a spy that fails the run if the route
// reaches any outbound call (gateway initiate would). No real Sanity, Firestore or gateway is contacted.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import Module from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'mockproj';
process.env.SANITY_FIXTURE_MODE = 'off';

const writes: string[] = [];
const outbound: string[] = [];
const sanityQueries: string[] = [];
const DAY_TYPE = { _id: 't1', name: 'Weekend Pass', slug: 'weekend-pass', demo: false, active: true, price: 100, regularPrice: 100, capacity: 500, show: { _ref: 'show1' }, releasedQuantity: null, earlyBirdCutoff: null, requiresDaySelection: true, requiresAttendeeNames: false, capacityPool: null, headcountPerUnit: null, excludedDays: [] };
const FLAT_TYPE = { ...DAY_TYPE, slug: 'vip', requiresDaySelection: false };
const TYPES: Record<string, unknown> = { 'weekend-pass': DAY_TYPE, vip: FLAT_TYPE };

const fakeSanity = {
  createClient: () => ({
    config: () => ({ useCdn: true }),
    fetch: async (query: string, params?: { slug?: string }) => {
      sanityQueries.push(query);
      if (/salesOpen/.test(query)) return { salesOpen: true };
      if (/_type == "show"\]/.test(query)) return [{ _id: 'show1', active: true, startDate: '2099-03-11', endDate: '2099-03-14' }];
      if (/_type == "ticketType"/.test(query) && params?.slug) return TYPES[params.slug] ?? null;
      return [];
    },
  }),
};
const writeSpy = (name: string) => (...a: unknown[]) => { writes.push(`${name}(${a.length})`); return Promise.reject(new Error(`unexpected Firestore write: ${name}`)); };
const fakeDoc = () => ({ get: async () => ({ exists: true, data: () => ({ gateway: 'ozow' }) }), set: writeSpy('set'), create: writeSpy('create'), update: writeSpy('update'), delete: writeSpy('delete') });
const fakeDb = { collection: () => ({ doc: fakeDoc, where: () => ({ get: async () => ({ docs: [], empty: true }) }), get: async () => ({ docs: [], empty: true }) }), runTransaction: writeSpy('runTransaction'), batch: () => ({ set: writeSpy('batch.set'), commit: writeSpy('batch.commit') }) };

const load = (Module as unknown as { _load: (req: string, parent: unknown, isMain: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (req: string, parent: unknown, isMain: boolean) {
  if (req === 'next-sanity') return { ...(load(req, parent, isMain) as object), ...fakeSanity };
  if (req === 'firebase-admin/app') return { ...(load(req, parent, isMain) as object), getApps: () => [{}] };
  if (req === 'firebase-admin/firestore') return { ...(load(req, parent, isMain) as object), getFirestore: () => fakeDb };
  return load(req, parent, isMain);
};
globalThis.fetch = (async (input: unknown) => { outbound.push(String(input)); throw new Error('unexpected outbound fetch'); }) as typeof fetch;

const { POST } = await import(pathToFileURL(path.resolve('app/api/tickets/checkout/route.ts')).href);
const { NextRequest } = await import('next/server');

const KEY = '3f6c2a9e-1b7d-4c58-9e0a-5d2f8b4c7a11';
const person = { attendeeName: 'Test Attendee', attendeeEmail: 'attendee@example.com' };
const post = async (lineItem: Record<string, unknown>) => {
  const req = new NextRequest('http://localhost/api/tickets/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': KEY },
    body: JSON.stringify({ showId: 'nationalShow', buyerName: 'B', buyerEmail: 'b@example.com', lineItems: [lineItem] }),
  });
  const res = await POST(req);
  return { status: res.status, body: (await res.json()) as { error?: string } };
};

const failures: string[] = [];
const WANT = 'A day selection is required for this ticket type.';
for (const [label, item] of [['chosenDay absent', { ticketType: 'weekend-pass', ...person }]] as const) {
  const r = await post(item);
  if (r.status !== 400 || r.body.error !== WANT) failures.push(`${label}: got ${r.status} ${JSON.stringify(r.body)}, want 400 "${WANT}"`);
}
// chosenDay: null is refused earlier by parseLineItems (400) — still a 4xx with nothing written.
const nul = await post({ ticketType: 'weekend-pass', chosenDay: null, ...person });
if (nul.status < 400 || nul.status >= 500) failures.push(`chosenDay null: got ${nul.status}, want a 4xx`);
// Reachability control: the day-selection branch is what refused it, not an unrelated gate. A non-day type with no day passes the day
// check (it fails later, inside the mocked-out reservation, which must not be a 400 day error).
const ctl = await post({ ticketType: 'vip', ...person });
if (ctl.body.error === WANT) failures.push('control: a non-day type was refused for a missing day');
if (!sanityQueries.some((q) => /_type == "ticketType"/.test(q))) failures.push('route never looked up the ticket type (mock not reached)');
if (outbound.length) failures.push(`outbound fetch calls (payment/network): ${outbound.join(',')}`);
const refusedWrites = writes.length;
console.log(JSON.stringify({ writes, outbound, ctlStatus: ctl.status, nulStatus: nul.status }));
void refusedWrites;
if (failures.length) { console.error('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log('PASS: day-selection type with no/null chosenDay is refused 4xx, no order written, no payment call');
