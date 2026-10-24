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
const cases = JSON.parse(readFileSync(path.join(root, 'contracts/golden/door-day-aware/truth-table.json'), 'utf8'));
const provenanceCases = JSON.parse(readFileSync(path.join(root, 'contracts/golden/door-reject-test-tickets/truth-table.json'), 'utf8'));
const windowFields = { startDate: '2027-09-23T07:00:00Z', endDate: '2027-09-26T13:00:00Z' };
const context = { window: { startDate: new Date(windowFields.startDate), endDate: new Date(windowFields.endDate) }, daySelectionTypes: ['day-visitor', 'early-bird', 'future-day-product'] };
const nowDefault = '2027-09-24T10:00:00Z';
function timestamp(value) { return { seconds: Math.floor(new Date(value).getTime() / 1000), nanoseconds: 0, toDate: () => new Date(value) }; }
const stamp = { seconds: 1, nanoseconds: 0 };

// Transpile real source in memory. Only named dependencies can load: no SDK, secrets,
// process, network, dynamic imports, or application initialisation enter this sandbox.
function loader({ testMode = true, db, session = { ok: true, decodedToken: { uid: 'staff' } }, events = [], audits = [], now = nowDefault, contextValue = context, auditFails = false } = {}) {
  const cache = new Map();
  const stubs = {
    'firebase-admin/firestore': { getFirestore: () => db, Timestamp: { now: () => timestamp(now), fromDate: (date) => timestamp(date) } },
    '@/lib/firebase-admin': { initAdmin: () => ({}) },
    '@/lib/ticketing-test-mode': { isTicketingTestMode: () => testMode },
    '@/lib/admin-auth': { getAdminSession: async () => session },
    '@/lib/checkin-audit-store': { createFirestoreCheckinAttemptsStore: () => ({ addCheckinAttempt: async (record) => { audits.push(record); if (auditFails) throw Error('audit unavailable'); return { id: 'audit' }; } }) },
    '@/lib/qr': { generateBookingRefQrDataUri: () => { throw Error('QR generation outside test scope'); } },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/checkin-context': { getCheckinContext: async () => { if (contextValue instanceof Error) throw contextValue; return contextValue; } },
    '../sanity/lib/client': { client: null },
    '../sanity/queries': {},
    'react/jsx-runtime': require('react/jsx-runtime'),
  };
  const allowed = new Set(['lib/checkin.ts', 'lib/checkin-day-policy.ts', 'lib/show-window-lookup.ts', 'lib/show-resolution.ts', 'lib/checkin-test-ticket-guard.ts', 'lib/checkin-audit.ts', 'lib/tickets-constants.ts', 'lib/checkout-reservation.ts', 'lib/orders.ts', 'lib/payments/pending-hold.ts', 'app/api/admin/checkin/route.ts', 'components/admin/DoorResultBanner.tsx']);
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
    vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: resolve, console: { ...console, error: () => {} }, Date: relative === 'app/api/admin/checkin/route.ts' ? Date : class extends Date { constructor(...args) { if (!args.length) throw Error('Inject the clock'); super(...args); } static now() { throw Error('Inject the clock'); } } }, { filename: relative, timeout: 5000 });
    if (relative === 'lib/checkin-test-ticket-guard.ts') {
      const decide = loadedModule.exports.decideTestTicketAdmission;
      loadedModule.exports.decideTestTicketAdmission = (input) => { events.push({ kind: 'guard', input }); return decide(input); };
    }
    if (relative === 'lib/checkin.ts') {
      const real = loadedModule.exports.checkInByBookingRef;
      loadedModule.exports.checkInByBookingRef = (ref) => real(ref, { now: () => { events.push({ kind: 'clock' }); return new Date(now); }, getContext: async () => { events.push({ kind: 'context' }); if (contextValue instanceof Error) throw contextValue; return contextValue; } });
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

function pureInput(row) {
  const input = structuredClone(row.input);
  input.now = new Date(input.now);
  if (input.window) input.window = { startDate: new Date(input.window.startDate), endDate: new Date(input.window.endDate) };
  if (input.ticket.checkedInAt) input.ticket.checkedInAt = new Date(input.ticket.checkedInAt);
  return input;
}

test('truth table: real pure policy, clock injection and no mutation', () => {
  const decide = loader()('lib/checkin-day-policy.ts').decideDayAdmission;
  assert.equal(typeof decide, 'function');
  assert.ok(cases.length >= 231);
  for (const row of cases) {
    const input = pureInput(row);
    const before = JSON.stringify(input);
    assert.deepEqual(JSON.parse(JSON.stringify(decide(input))), row.expected, row.id);
    assert.equal(JSON.stringify(input), before, row.id);
  }
});

async function scan({ ticket = {}, now = nowDefault, liveMode = false, auth = true, reason = 'no-session', found = true, wrongShow = false, bookingRef = 'ref', malformed = false, contextValue = context, retry = false, retryWinner = false, auditFails = false, dbFails = false } = {}) {
  const events = [], audits = [], writes = [];
  const data = { bookingRef: 'ref', showId: 'national-show', attendeeName: 'Guest', attendeeEmail: 'guest@example.invalid', ticketType: 'vip', status: 'paid', amount: 100, purchasedAt: stamp, checkedInAt: null, orderId: 'order', issuedInTestMode: false, ...ticket };
  if (typeof data.checkedInAt === 'string') data.checkedInAt = timestamp(data.checkedInAt);
  const query = { where: () => query, limit: () => query };
  const db = {
    collection: () => { assert.ok(auth, 'auth must precede ticket access'); return query; },
    runTransaction: async (fn) => {
      if (dbFails) throw Error('database unavailable');
      let pending = [];
      let snapshotData = data;
      const tx = {
        get: async () => { events.push('read'); return { empty: !found, docs: found ? [{ id: 'ticket', ref: { id: 'ticket' }, data: () => snapshotData }] : [] }; },
        update: (ref, patch) => { assert.ok(events.some((e) => e.kind === 'guard')); noUndefined(patch); pending.push(patch); },
      };
      let result = await fn(tx);
      if (retry || retryWinner) {
        if (retryWinner) snapshotData = { ...data, ...pending[0] };
        pending = []; result = await fn(tx);
      }
      writes.push(...pending);
      return result;
    },
  };
  const load = loader({ db, events, audits, now, contextValue, testMode: !liveMode, auditFails, session: auth ? { ok: true, decodedToken: { uid: 'staff' } } : { ok: false, reason } });
  data.showId = wrongShow ? 'other' : load('lib/tickets-constants.ts').NATIONAL_SHOW_ID;
  const before = JSON.stringify(data);
  const response = await load('app/api/admin/checkin/route.ts').POST(new Request('http://fixture.invalid/api/admin/checkin', { method: 'POST', body: malformed ? '{' : JSON.stringify({ bookingRef, now: '2099-01-01', chosenDay: '2099-01-01', requiresDaySelection: false, checkIns: {}, issuedInTestMode: false, liveMode: false }) }));
  assert.equal(JSON.stringify(data), before, 'read data must not be mutated');
  return { response, body: await response.json(), writes, audits, events, load };
}

function refusal(result, status, code, error, outcome = code) {
  assert.equal(result.response.status, status);
  assert.equal(result.body.success, false);
  assert.equal(result.body.code, code);
  assert.equal(result.body.error, error);
  assert.equal(result.writes.length, 0);
  assert.equal(result.audits.length, 1);
  assert.equal(result.audits[0].outcome, outcome);
  assert.equal(result.audits[0].refusalReason, error);
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(require('react').createElement(result.load('components/admin/DoorResultBanner.tsx').DoorResultBanner, { result: result.body }));
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes(error));
  assert.ok(html.includes(code === 'already-checked-in' ? 'Already used' : 'Not checked in'));
}

test('route: entire golden table through real POST and real service', async () => {
  for (const row of cases) {
    const input = pureInput(row);
    const result = await scan({ ticket: row.input.ticket, now: row.input.now, contextValue: { window: input.window, daySelectionTypes: input.requiresDaySelection ? [input.ticket.ticketType] : [] } });
    if (!row.expected.ok) {
      refusal(result, row.expected.httpStatus, row.expected.code, row.expected.error);
    } else {
      assert.equal(result.response.status, 200, row.id);
      assert.equal(result.body.success, true, row.id);
      assert.equal(result.body.firstAdmission, row.expected.firstAdmission, row.id);
      assert.equal(result.writes.length, 1, row.id);
      assert.equal(result.audits.length, 1);
      assert.equal(result.audits[0].outcome, 'admit');
      const patch = result.writes[0];
      assert.equal(patch.status, 'checked-in');
      assert.equal(result.body.ticket.status, 'checked-in');
      assert.equal(result.body.ticket.checkedInAt.seconds, patch.checkedInAt.seconds);
      if (Object.hasOwn(input.ticket, 'chosenDay')) assert.equal(result.body.ticket.chosenDay, input.ticket.chosenDay);
      if (patch.checkIns) assert.deepEqual(result.body.ticket.checkIns, JSON.parse(JSON.stringify(patch.checkIns)));
      const first = row.input.ticket.checkedInAt;
      assert.equal(patch.checkedInAt.seconds, timestamp(first || row.input.now).seconds, row.id);
      if (['weekend-pass', 'weekend-pass-early-bird'].includes(input.ticket.ticketType)) {
        if (first) {
          const firstDay = new Date(new Date(first).getTime() + 7200000).toISOString().slice(0, 10);
          if (!Object.hasOwn(input.ticket.checkIns || {}, firstDay)) assert.equal(patch.checkIns[firstDay].seconds, timestamp(first).seconds);
        }
        assert.equal(patch.checkIns[row.expected.day].seconds, timestamp(row.input.now).seconds, row.id);
        for (const [day, previous] of Object.entries(input.ticket.checkIns || {})) assert.deepEqual(patch.checkIns[day], previous, row.id);
      }
    }
  }
});

test('regressions: every PR69 provenance row in real route and guard precedence', async () => {
  for (const row of provenanceCases) {
    const reject = row.expected === 'reject_test_ticket';
    const ticket = { ticketType: 'vip', issuedInTestMode: row.input.issuedInTestMode };
    const result = await scan({ ticket, liveMode: row.input.liveMode });
    if (reject) refusal(result, 403, 'test_ticket', 'Test ticket — not valid for entry');
    else { assert.equal(result.response.status, 200, row.id); assert.equal(result.writes.length, 1); }
    if (reject) {
      for (const contextValue of [{ ...context, window: null }, new Error('context unavailable')]) {
        const blocked = await scan({ ticket: { ...ticket, status: 'checked-in', chosenDay: 'bad' }, liveMode: true, contextValue });
        refusal(blocked, 403, 'test_ticket', 'Test ticket — not valid for entry');
      }
    }
  }
});

test('regressions: auth, validation, lookup, ordering, unpaid and infrastructure', async () => {
  for (const liveMode of [false, true]) {
    for (const [options, status, code, copy, outcome] of [
      [{ auth: false }, 401, 'not-authorized', 'Unauthorized'],
      [{ auth: false, reason: 'invalid-session' }, 401, 'not-authorized', 'Unauthorized'],
      [{ auth: false, reason: 'not-admin' }, 403, 'not-authorized', 'Forbidden'],
      [{ malformed: true }, 400, 'bad-request', 'Invalid request body.', 'malformed'],
      [{ bookingRef: '' }, 400, 'bad-request', 'A booking reference is required.', 'malformed'],
      [{ bookingRef: 42 }, 400, 'bad-request', 'A booking reference is required.', 'malformed'],
      [{ found: false, contextValue: new Error('context unavailable') }, 404, 'not-found', 'Ticket not found'],
      [{ wrongShow: true, ticket: { issuedInTestMode: true } }, 403, 'wrong-show', 'This ticket is not for this show.'],
      [{ ticket: { status: 'reserved' } }, 403, 'unpaid', 'This ticket has not been paid for.'],
      [{ ticket: { status: 'checked-in' } }, 409, 'already-checked-in', 'Already checked in'],
      [{ ticket: { status: 'reserved', ticketType: 'day-visitor', chosenDay: '2027-09-25' }, contextValue: { ...context, window: null } }, 403, 'not_show_day', 'The show is not open today.'],
      [{ ticket: { status: 'reserved', ticketType: 'day-visitor', chosenDay: '2027-09-25' } }, 403, 'wrong_day', 'Valid on Saturday 25 September 2027'],
      [{ dbFails: true }, 500, 'infra-error', 'Check-in failed. Please try again.'],
      [{ contextValue: new Error('catalogue unavailable') }, 500, 'infra-error', 'Check-in failed. Please try again.'],
    ]) {
      const result = await scan({ ...options, liveMode });
      refusal(result, status, code, copy, outcome);
      if (options.auth === false || options.malformed || Object.hasOwn(options, 'bookingRef')) assert.equal(result.events.length, 0);
    }
  }
});

test('route: concurrent winner forces retry refusal with one audit', async () => {
  refusal(await scan({ ticket: { ticketType: 'weekend-pass' }, retryWinner: true }), 409, 'already-checked-in', 'Already checked in');
});

test('route: retry yields one audit; day two preserves first stamp; sequential duplicate refuses', async () => {
  let ticket = { ticketType: 'weekend-pass' };
  const first = await scan({ ticket, retry: true });
  assert.equal(first.response.status, 200);
  assert.equal(first.audits.length, 1);
  assert.equal(first.writes.length, 1);
  assert.equal(first.events.filter((e) => e.kind === 'clock').length, 1);
  assert.equal(first.events.filter((e) => e.kind === 'context').length, 1);
  ticket = { ...ticket, ...first.writes[0] };
  refusal(await scan({ ticket }), 409, 'already-checked-in', 'Already checked in');
  const second = await scan({ ticket, now: '2027-09-25T10:00:00Z' });
  assert.equal(second.response.status, 200);
  assert.equal(second.body.firstAdmission, false);
  assert.equal(second.writes[0].checkedInAt.seconds, first.writes[0].checkedInAt.seconds);
  assert.deepEqual(Object.keys(second.writes[0].checkIns).sort(), ['2027-09-24', '2027-09-25']);
  ticket = { ...ticket, ...second.writes[0] };
  const third = await scan({ ticket, now: '2027-09-26T10:00:00Z' });
  assert.equal(third.response.status, 200);
  assert.equal(third.body.firstAdmission, false);
  refusal(await scan({ ticket: { ...ticket, ...third.writes[0] }, now: '2027-09-26T10:00:00Z' }), 409, 'already-checked-in', 'Already checked in');
  const unavailable = await scan({ ticket: { ticketType: 'day-visitor', chosenDay: '2027-09-25' }, auditFails: true });
  refusal(unavailable, 403, 'wrong_day', 'Valid on Saturday 25 September 2027');
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

