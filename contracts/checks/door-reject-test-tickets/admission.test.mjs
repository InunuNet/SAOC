import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const cases = JSON.parse(readFileSync(path.join(root, 'contracts/golden/door-reject-test-tickets/truth-table.json'), 'utf8'));
const message = 'Test ticket — not valid for entry';
const stamp = { seconds: 1, nanoseconds: 0 };
// Keep #69's provenance and single-use regressions on a valid, deterministic show day.
const today = '2027-09-24';
const now = `${today}T10:00:00.000Z`;
const showWindow = { startDate: new Date(`${today}T07:00:00.000Z`), endDate: new Date(`${today}T15:00:00.000Z`) };

// Transpile real source in memory. Only named dependencies can load: no SDK, secrets,
// process, network, dynamic imports, or application initialisation enter this sandbox.
function loader({ testMode = true, db, session = { ok: true, decodedToken: { uid: 'staff' } }, events = [], audits = [] } = {}) {
  const cache = new Map();
  const stubs = {
    'firebase-admin/firestore': { getFirestore: () => db, Timestamp: { now: () => stamp, fromDate: (date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0, toDate: () => new Date(date) }) } },
    // Mock schedule dependencies; the real context and day policy still execute.
    '@/sanity/lib/client': { client: { fetch: async () => [] } },
    '@/sanity/queries': { ticketTypeScheduleTraitsQuery: 'fixture schedule traits' },
    '@/lib/show-window-lookup': {
      resolveShowWindowLookup: async () => () => showWindow,
      computeShowDays: (window) => {
        assert.equal(window, showWindow);
        return [today];
      },
    },
    '@/lib/firebase-admin': { initAdmin: () => ({}) },
    '@/lib/ticketing-test-mode': { isTicketingTestMode: () => testMode },
    '@/lib/admin-auth': { getAdminSession: async () => session },
    '@/lib/checkin-audit-store': { createFirestoreCheckinAttemptsStore: () => ({ addCheckinAttempt: async (record) => { audits.push(record); return { id: 'audit' }; } }) },
    '@/lib/qr': { generateBookingRefQrDataUri: () => { throw Error('QR generation outside test scope'); } },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    'react/jsx-runtime': require('react/jsx-runtime'),
  };
  const allowed = new Set(['lib/checkin.ts', 'lib/checkin-day-policy.ts', 'lib/checkin-context.ts', 'lib/checkin-test-ticket-guard.ts', 'lib/checkin-audit.ts', 'lib/tickets-constants.ts', 'lib/checkout-reservation.ts', 'lib/orders.ts', 'lib/payments/pending-hold.ts', 'app/api/admin/checkin/route.ts', 'components/admin/DoorResultBanner.tsx']);
  function load(relative) {
    assert.ok(allowed.has(relative), `Unapproved module: ${relative}`);
    if (cache.has(relative)) return cache.get(relative).exports;
    const loadedModule = { exports: {} };
    cache.set(relative, loadedModule);
    const source = readFileSync(path.join(root, relative), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const resolve = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      let target = name.startsWith('@/') ? name.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(relative), name));
      if (!/\.tsx?$/.test(target)) target += '.ts';
      return load(target);
    };
    vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: resolve, console, Date }, { filename: relative, timeout: 5000 });
    if (relative === 'lib/checkin-test-ticket-guard.ts') {
      const decide = loadedModule.exports.decideTestTicketAdmission;
      loadedModule.exports.decideTestTicketAdmission = (input) => { events.push({ kind: 'guard', input }); return decide(input); };
    }
    if (relative === 'lib/checkin.ts') {
      const checkIn = loadedModule.exports.checkInByBookingRef;
      loadedModule.exports.checkInByBookingRef = (ref) => checkIn(ref, { now: () => new Date(now) });
    }
    return loadedModule.exports;
  }
  return load;
}

function noUndefined(value) {
  assert.notEqual(value, undefined);
  if (value && typeof value === 'object') for (const item of Object.values(value)) noUndefined(item);
}
function hasMarker(doc, expected) {
  assert.ok(Object.hasOwn(doc, 'issuedInTestMode'));
  assert.equal(typeof doc.issuedInTestMode, 'boolean');
  assert.equal(doc.issuedInTestMode, expected);
  noUndefined(doc);
}

test('truth table: real pure guard consumes every golden case', () => {
  const decide = loader()('lib/checkin-test-ticket-guard.ts').decideTestTicketAdmission;
  assert.equal(typeof decide, 'function');
  assert.equal(cases.length, 18);
  for (const row of cases) assert.equal(decide(row.input), row.expected, row.id);
  for (const liveMode of [true, false]) {
    assert.equal(decide({ liveMode, issuedInTestMode: undefined }), liveMode ? 'reject_test_ticket' : 'allow');
  }
});

test('builders: both order and every ticket carry server-derived booleans', async () => {
  for (const testMode of [true, false]) {
    const writes = [];
    const db = { collection: (name) => ({ doc: (id = 'new-order') => ({ id, name }) }), runTransaction: async (fn) => fn({ set: (ref, doc) => writes.push({ ref, doc }) }) };
    const load = loader({ testMode, db });
    const builders = load('lib/checkout-reservation.ts');
    const input = { orderId: 'order', bookingRef: 'ref', reference: 'ref', showId: 'show', attendeeName: 'Guest', attendeeEmail: 'guest@example.invalid', buyerName: 'Buyer', buyerEmail: 'buyer@example.invalid', ticketType: 'day-visitor', amount: 100, idempotencyKey: 'key', expiresAt: stamp, recoveryToken: 'fixture', recoveryTokenExpiresAt: stamp, now: stamp, gateway: 'ozow', expectedGatewayAmount: null, orderStatus: 'paid', positionStatus: 'paid', purchasedAt: stamp, gatewayPaymentId: null, m_payment_id: 'ref', pf_payment_id: null };
    // Omitted, undefined and forged caller markers must not control server provenance.
    for (const extra of [{}, { issuedInTestMode: undefined }, { issuedInTestMode: !testMode }]) {
      const single = builders.buildReservationDocs({ ...input, ...extra });
      hasMarker(single.order, testMode);
      hasMarker(single.position, testMode);
      const multi = builders.buildMultiReservationDocs({ ...input, ...extra, lineItems: [0, 1, 2].map((i) => ({ ticketType: 'day-visitor', attendeeName: 'Guest', attendeeEmail: 'guest@example.invalid', amount: 100, bookingRef: `ref-${i}`, chosenDay: null })) });
      hasMarker(multi.order, testMode);
      assert.equal(multi.positions.length, 3);
      multi.positions.forEach((doc) => hasMarker(doc, testMode));
      const created = [];
      builders.writeMultiReservationPair({ create: (ref, doc) => created.push(doc) }, { orderRef: { id: 'order' }, positionRefs: [0, 1, 2].map((id) => ({ id: String(id) })) }, multi);
      assert.equal(created.length, 4);
      created.forEach((doc) => hasMarker(doc, testMode));
      await load('lib/orders.ts').createOrderWithPosition({ ...input, ...extra }, { db });
    }
    assert.equal(writes.length, 6);
    assert.equal(writes.filter(({ ref }) => ref.name === 'orders').length, 3);
    assert.equal(writes.filter(({ ref }) => ref.name === 'tickets').length, 3);
    writes.forEach(({ doc }) => hasMarker(doc, testMode));
  }
});

async function scan(row, { status = 'paid', auth = true, found = true, wrongShow = false } = {}) {
  const events = [], audits = [], writes = [];
  let data;
  const query = { where: () => query, limit: () => query };
  const db = {
    collection: () => { assert.ok(auth, 'unauthorised Firestore access'); return query; },
    runTransaction: async (fn) => fn({
      get: async () => { events.push({ kind: 'read' }); return { empty: !found, docs: found ? [{ id: 'ticket', ref: { id: 'ticket' }, data: () => data }] : [] }; },
      update: (ref, patch) => {
        assert.ok(events.some((event) => event.kind === 'guard'), 'guard must run before checked-in write');
        events.push({ kind: 'write' }); writes.push(patch);
      },
    }),
  };
  const load = loader({ testMode: !row.input.liveMode, db, events, audits, session: auth ? { ok: true, decodedToken: { uid: 'staff' } } : { ok: false, reason: 'no-session' } });
  data = { bookingRef: 'ref', showId: wrongShow ? 'other' : load('lib/tickets-constants.ts').NATIONAL_SHOW_ID, attendeeName: 'Guest', attendeeEmail: 'guest@example.invalid', ticketType: 'day-visitor', chosenDay: today, status, amount: 100, purchasedAt: stamp, checkedInAt: status === 'checked-in' ? stamp : null, orderId: 'order', m_payment_id: 'ref', pf_payment_id: null };
  if (Object.hasOwn(row.input, 'issuedInTestMode')) data.issuedInTestMode = row.input.issuedInTestMode;
  const before = JSON.stringify(data);
  const response = await load('app/api/admin/checkin/route.ts').POST(new Request('http://fixture.invalid/api/admin/checkin', { method: 'POST', body: JSON.stringify({ bookingRef: 'ref', issuedInTestMode: false, liveMode: false }) }));
  assert.equal(JSON.stringify(data), before, 'source document must not be mutated');
  return { response, body: await response.json(), events, writes, audits, load };
}

test('route: real POST invokes real guard before admission writes and renders refusal', async () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const { createElement } = require('react');
  for (const row of cases) {
    const result = await scan(row);
    const reject = row.expected === 'reject_test_ticket';
    assert.equal(result.response.status, reject ? 403 : 200, row.id);
    assert.equal(result.body.success, !reject, row.id);
    assert.equal(result.writes.length, reject ? 0 : 1, row.id);
    const guarded = result.events.find((event) => event.kind === 'guard');
    assert.ok(guarded, row.id);
    assert.equal(guarded.input.liveMode, row.input.liveMode);
    assert.deepEqual(guarded.input.issuedInTestMode, row.input.issuedInTestMode);
    assert.equal(result.audits.length, 1);
    assert.equal(result.audits[0].outcome, reject ? 'test_ticket' : 'admit');
    if (reject) {
      assert.equal(result.body.code, 'test_ticket');
      assert.equal(result.body.error, message);
      const html = renderToStaticMarkup(createElement(result.load('components/admin/DoorResultBanner.tsx').DoorResultBanner, { result: result.body }));
      assert.ok(html.includes(message));
      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes('bg-error'));
      assert.ok(html.includes('Not checked in'));
    } else {
      assert.equal(result.writes[0].status, 'checked-in');
      assert.ok(result.writes[0].checkedInAt);
    }
  }
});

test('regressions: existing refusals and auth remain effective in both modes', async () => {
  for (const liveMode of [false, true]) {
    const row = { input: { liveMode, issuedInTestMode: false }, expected: 'allow' };
    for (const [options, status, error] of [
      [{ status: 'reserved' }, 403, 'This ticket has not been paid for.'],
      [{ status: 'checked-in' }, 409, 'Already checked in'],
      [{ wrongShow: true }, 403, 'This ticket is not for this show.'],
      [{ found: false }, 404, 'Ticket not found'],
      [{ auth: false }, 401, 'Unauthorized'],
    ]) {
      const result = await scan(row, options);
      assert.equal(result.response.status, status);
      assert.equal(result.body.error, error);
      assert.equal(result.writes.length, 0);
      assert.equal(result.audits.length, 1);
    }
  }
});
