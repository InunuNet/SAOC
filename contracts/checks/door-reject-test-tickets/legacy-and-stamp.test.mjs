import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// F4 (mission nos-security-tiered-access): legacy untagged documents and gateway-coupled stamping.
// DOOR_TEST_ROOT lets contracts/checks/door-reject-test-tickets/mutation.mjs run this file against
// a mutated copy of the source; unset, the real repository is tested.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.DOOR_TEST_ROOT ? path.resolve(process.env.DOOR_TEST_ROOT) : path.resolve(here, '../../..');
const golden = JSON.parse(readFileSync(path.resolve(here, '../../golden/door-reject-test-tickets/legacy-untagged.json'), 'utf8'));
const stamp = { seconds: 1, nanoseconds: 0 };

// Loads real source through an explicit allowlist. `gatewaySandboxOnly` is served to
// lib/ticket-issuance-mode.ts as both adapters' sandbox flags, so a go-live commit can be simulated
// without editing the repo. The adapters' real flags are checked by the 'adapter flags' test.
function loader({ testMode, gatewaySandboxOnly = true, ozowSandbox = gatewaySandboxOnly, payfastSandbox = gatewaySandboxOnly, db } = {}) {
  const cache = new Map();
  const stubs = {
    'firebase-admin/firestore': { getFirestore: () => db, Timestamp: { now: () => stamp } },
    '@/lib/firebase-admin': { initAdmin: () => ({}) },
    '@/lib/ticketing-test-mode': { isTicketingTestMode: () => testMode },
    '@/lib/payments/ozow': { OZOW_SANDBOX_MODE: ozowSandbox },
    '@/lib/payments/payfast': { PAYFAST_SANDBOX_MODE: payfastSandbox },
    '@/lib/qr': { generateBookingRefQrDataUri: () => { throw Error('QR outside test scope'); } },
  };
  const allowed = new Set(['lib/checkin.ts', 'lib/checkin-test-ticket-guard.ts', 'lib/tickets-constants.ts', 'lib/ticket-issuance-mode.ts', 'lib/checkout-reservation.ts', 'lib/orders.ts', 'lib/payments/pending-hold.ts']);
  function load(relative) {
    assert.ok(allowed.has(relative), `Unapproved module: ${relative}`);
    if (cache.has(relative)) return cache.get(relative).exports;
    const mod = { exports: {} };
    cache.set(relative, mod);
    const source = readFileSync(path.join(root, relative), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const resolve = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      let target = name.startsWith('@/') ? name.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(relative), name));
      if (!/\.tsx?$/.test(target)) target += '.ts';
      return load(target);
    };
    vm.runInNewContext(code, { module: mod, exports: mod.exports, require: resolve, console, Date }, { filename: relative, timeout: 5000 });
    return mod.exports;
  }
  return load;
}

const builderInput = { orderId: 'order', bookingRef: 'ref', reference: 'ref', showId: 'show', attendeeName: 'Guest', attendeeEmail: 'guest@example.invalid', buyerName: 'Buyer', buyerEmail: 'buyer@example.invalid', ticketType: 'day-visitor', amount: 100, idempotencyKey: 'key', expiresAt: stamp, recoveryToken: 'fixture', recoveryTokenExpiresAt: stamp, now: stamp, gateway: 'ozow', expectedGatewayAmount: null, orderStatus: 'paid', positionStatus: 'paid', purchasedAt: stamp, gatewayPaymentId: null, m_payment_id: 'ref', pf_payment_id: null };

async function issue({ testMode, gatewaySandboxOnly, ozowSandbox, payfastSandbox }) {
  const writes = [];
  const db = { collection: (name) => ({ doc: (id = 'new-order') => ({ id, name }) }), runTransaction: async (fn) => fn({ set: (ref, doc) => writes.push(doc) }) };
  const load = loader({ testMode, gatewaySandboxOnly, ozowSandbox, payfastSandbox, db });
  const builders = load('lib/checkout-reservation.ts');
  const single = builders.buildReservationDocs(builderInput);
  const multi = builders.buildMultiReservationDocs({ ...builderInput, lineItems: [0, 1].map((i) => ({ ticketType: 'day-visitor', attendeeName: 'Guest', attendeeEmail: 'guest@example.invalid', amount: 100, bookingRef: `ref-${i}`, chosenDay: null })) });
  await load('lib/orders.ts').createOrderWithPosition(builderInput, { db });
  return [single.order, single.position, multi.order, ...multi.positions, ...writes];
}

test('stamp matrix: every creation path stamps test unless BOTH switches are live', async () => {
  for (const row of golden.stampMatrix) {
    const docs = await issue({ testMode: row.ticketingTestMode, gatewaySandboxOnly: row.gatewaySandboxOnly, ozowSandbox: row.ozowSandbox, payfastSandbox: row.payfastSandbox });
    assert.equal(docs.length, 7, row.id);
    for (const doc of docs) {
      assert.ok(Object.hasOwn(doc, 'issuedInTestMode'), row.id);
      assert.strictEqual(doc.issuedInTestMode, row.expectedStamp, row.id);
    }
  }
});

async function scan(ticket, { testMode, gatewaySandboxOnly = true }) {
  const writes = [];
  let data;
  const query = { where: () => query, limit: () => query };
  const db = {
    collection: () => query,
    runTransaction: async (fn) => fn({
      get: async () => ({ empty: false, docs: [{ id: 'ticket', ref: { id: 'ticket' }, data: () => data }] }),
      update: (ref, patch) => writes.push(patch),
    }),
  };
  const load = loader({ testMode, gatewaySandboxOnly, db });
  data = { bookingRef: 'ref', showId: load('lib/tickets-constants.ts').NATIONAL_SHOW_ID, attendeeName: 'Guest', attendeeEmail: 'guest@example.invalid', ticketType: 'day-visitor', amount: 100, purchasedAt: stamp, checkedInAt: null, orderId: 'order', m_payment_id: 'ref', pf_payment_id: null, ...ticket };
  const before = JSON.stringify(data);
  const result = await load('lib/checkin.ts').checkInByBookingRef('ref');
  assert.equal(JSON.stringify(data), before, 'source document must not be mutated');
  return { result, writes };
}

const outcome = (result) => (result.ok ? 'admit' : result.code);

test('legacy rows: untagged and ambiguous documents are refused live and unchanged in test mode', async () => {
  for (const row of golden.rows) {
    const ticket = { ...row.ticket };
    if (ticket.checkedInAt === 'stamp') ticket.checkedInAt = stamp;
    for (const [testMode, expected] of [[false, row.liveDoor], [true, row.testDoor]]) {
      const { result, writes } = await scan(ticket, { testMode });
      assert.equal(outcome(result), expected, `${row.id} testMode=${testMode}`);
      assert.equal(writes.length, expected === 'admit' ? 1 : 0, `${row.id} writes`);
    }
  }
});

test('real order guarantee: documents issued after a full go-live carry literal false and are admitted live', async () => {
  const live = await issue({ testMode: false, gatewaySandboxOnly: false });
  for (const doc of live) assert.strictEqual(doc.issuedInTestMode, false);
  const admitted = await scan({ status: 'paid', issuedInTestMode: live[1].issuedInTestMode }, { testMode: false, gatewaySandboxOnly: false });
  assert.equal(outcome(admitted.result), 'admit');
  const sandboxIssued = await issue({ testMode: false, gatewaySandboxOnly: true });
  const refused = await scan({ status: 'paid', issuedInTestMode: sandboxIssued[1].issuedInTestMode }, { testMode: false });
  assert.equal(outcome(refused.result), 'test_ticket');
});

test('settlement: marking an order paid never rewrites the issued test marker', async () => {
  for (const marker of [true, false]) {
    const patches = [];
    const docs = {
      order: { m_payment_id: 'ref', gateway: 'ozow', status: 'reserved', issuedInTestMode: marker, buyerEmail: 'b@example.invalid', buyerName: 'Buyer' },
      t1: { bookingRef: 'ref-1', attendeeName: 'Guest', ticketType: 'day-visitor', issuedInTestMode: marker },
    };
    const db = {
      collection: (name) => ({
        doc: (id) => ({ id }),
        where: () => ({ get: async () => ({ empty: false, docs: name === 'tickets' ? [{ id: 't1' }] : [{ id: 'order' }] }) }),
      }),
      runTransaction: async (fn) => fn({
        get: async (ref) => ({ exists: true, data: () => docs[ref.id] }),
        update: (ref, patch) => patches.push({ id: ref.id, patch }),
      }),
    };
    const outcome = await loader({ testMode: true, db })('lib/orders.ts').markOrderAndPositionPaidByPaymentId(
      { m_payment_id: 'ref', gatewayPaymentId: 'gw', now: stamp, orderId: 'order', expectedGateway: 'ozow' }, { db });
    assert.equal(outcome.committed, true);
    assert.equal(patches.length, 2, 'order and position are both updated');
    for (const { id, patch } of patches) {
      assert.equal(Object.hasOwn(patch, 'issuedInTestMode'), false, `${id} patch must not carry the marker`);
    }
  }
});

// Reads an adapter's real source (never a stub) so a flag hand-flipped to false while the adapter
// still carries sandbox behaviour is caught. A flag that is not literally `true` or `false` fails.
const ADAPTERS = [
  { file: 'lib/payments/ozow.ts', flag: 'OZOW_SANDBOX_MODE', sandboxMarkers: [/IsTest: OZOW_IS_TEST/, /OZOW_SANDBOX_PRIVATE_KEY/, /OZOW_SANDBOX_SITE_CODE/] },
  { file: 'lib/payments/payfast.ts', flag: 'PAYFAST_SANDBOX_MODE', sandboxMarkers: [/processUrl: PAYFAST_SANDBOX_PROCESS_URL/, /PAYFAST_SANDBOX_MERCHANT_ID/, /PAYFAST_SANDBOX_PASSPHRASE/] },
];

test('adapter flags: an adapter may only declare itself live once no sandbox behaviour is left in it', () => {
  for (const adapter of ADAPTERS) {
    const source = readFileSync(path.join(root, adapter.file), 'utf8');
    const match = source.match(new RegExp(`^export const ${adapter.flag} = (true|false);$`, 'm'));
    assert.ok(match, `${adapter.file}: ${adapter.flag} must be declared as a literal boolean`);
    if (match[1] === 'true') continue;
    for (const marker of adapter.sandboxMarkers) {
      assert.ok(!marker.test(source), `${adapter.file}: ${adapter.flag} is false but sandbox behaviour ${marker} remains`);
    }
  }
  const issuance = readFileSync(path.join(root, 'lib/ticket-issuance-mode.ts'), 'utf8');
  assert.match(issuance, /^export const PAYMENT_GATEWAYS_SANDBOX_ONLY = OZOW_SANDBOX_MODE \|\| PAYFAST_SANDBOX_MODE;$/m);
});
