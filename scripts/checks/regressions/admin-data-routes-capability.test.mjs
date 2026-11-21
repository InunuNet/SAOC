// Regression test: the four admin data routes must check the role capability, not only the
// session. A signed-in admin without the capability gets 403; one with it succeeds. Each route is
// transpiled in memory with its dependencies stubbed; no SDK, network or secrets are touched.
//   node --test scripts/checks/regressions/admin-data-routes-capability.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SESSION_OK = { ok: true, decodedToken: { uid: 'staff' } };

// Records every capability the route asked for; grants only those listed in `granted`.
function capabilityGate(granted, asked) {
  return {
    adminHasCapability: async (_decodedToken, capability) => {
      asked.push(capability);
      return granted.includes(capability);
    },
  };
}

function loadRoute(file, stubs) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const resolve = (name) => {
    assert.ok(Object.hasOwn(stubs, name), `Unapproved module: ${name}`);
    return stubs[name];
  };
  vm.runInNewContext(
    code,
    { module: loaded, exports: loaded.exports, require: resolve, Response, String, Array, Date, Object, console },
    { filename: file, timeout: 5000 },
  );
  return loaded.exports;
}

const jsonResponse = (body, init) => new Response(JSON.stringify(body), init);
const emptyDb = { collection: () => ({ get: async () => ({ docs: [] }), count: () => ({}) }) };

const baseStubs = (gate, session = SESSION_OK) => ({
  'firebase-admin/firestore': { getFirestore: () => emptyDb },
  'next/server': { NextResponse: { json: jsonResponse } },
  '@/lib/admin-auth': { getAdminSession: async () => session },
  '@/lib/admin-capability-gate': gate,
  '@/lib/firebase-admin': { initAdmin: () => ({}) },
});

test('export-csv: 403 without export-buyer-data, 200 with it', async () => {
  const stubs = (gate) => ({
    ...baseStubs(gate),
    '@/lib/csv-field': { csvField: (value) => value },
    '@/lib/registration': { formatDietary: () => '' },
  });
  const asked = [];
  const denied = loadRoute('app/api/admin/export-csv/route.ts', stubs(capabilityGate([], asked)));
  const refused = await denied.GET();
  assert.equal(refused.status, 403);
  assert.equal(refused.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(asked, ['export-buyer-data']);

  const allowed = loadRoute(
    'app/api/admin/export-csv/route.ts',
    stubs(capabilityGate(['export-buyer-data'], [])),
  );
  assert.equal((await allowed.GET()).status, 200);
});

test('tickets list: 403 without search-buyers, 200 with it', async () => {
  const asked = [];
  const denied = loadRoute('app/api/admin/tickets/route.ts', baseStubs(capabilityGate([], asked)));
  const refused = await denied.GET();
  assert.equal(refused.status, 403);
  assert.deepEqual(await refused.json(), { error: 'Forbidden' });
  assert.deepEqual(asked, ['search-buyers']);

  const allowed = loadRoute(
    'app/api/admin/tickets/route.ts',
    baseStubs(capabilityGate(['search-buyers'], [])),
  );
  assert.equal((await allowed.GET()).status, 200);
});

test('newsletter export: the route asks for export-buyer-data', async () => {
  const asked = [];
  const stubs = (granted) => ({
    'next/server': {},
    '@/lib/admin-auth': { getAdminSession: async () => SESSION_OK },
    '@/lib/admin-capability-gate': capabilityGate(granted, asked),
    '@/lib/newsletter-handler': {
      // Runs the route's own hasCapability dep, the way the real handler does after the session.
      handleNewsletterExport: async (deps) => {
        const session = await deps.getSession();
        const permitted = await deps.hasCapability(session.decodedToken);
        return { status: permitted ? 200 : 403, body: '', headers: {} };
      },
    },
    '@/lib/newsletter-preferences': { NEWSLETTER_LIST_FILTERS: ['all'] },
    '@/lib/newsletter-store': { listAllSubscribers: async () => [] },
    '@/lib/site-hosts': { nosOrigin: () => 'https://nos.test', saocOrigin: () => 'https://saoc.test' },
  });
  const request = { nextUrl: { searchParams: new URLSearchParams() } };

  const denied = loadRoute('app/api/admin/newsletter/export-csv/route.ts', stubs([]));
  assert.equal((await denied.GET(request)).status, 403);
  assert.deepEqual(asked, ['export-buyer-data']);

  const allowed = loadRoute('app/api/admin/newsletter/export-csv/route.ts', stubs(['export-buyer-data']));
  assert.equal((await allowed.GET(request)).status, 200);
});

test('checkin: 403 and an audit record without scan-checkin, admission proceeds with it', async () => {
  const audits = [];
  const stubs = (granted, asked) => ({
    'next/server': { NextResponse: { json: jsonResponse } },
    '@/lib/admin-auth': { getAdminSession: async () => SESSION_OK },
    '@/lib/admin-capability-gate': capabilityGate(granted, asked),
    '@/lib/checkin': {
      checkInByBookingRef: async () => ({
        ok: true,
        firstAdmission: true,
        ticket: { bookingRef: 'REF', showId: 'show', orderId: 'order' },
      }),
    },
    '@/lib/checkin-audit': {
      recordCheckinAttempt: async (_store, attempt) => {
        audits.push(attempt.outcome);
        return { recorded: true };
      },
      logAuditWriteFailure: () => {},
    },
    '@/lib/checkin-audit-store': { createFirestoreCheckinAttemptsStore: () => ({}) },
    '@/lib/tickets-constants': { NATIONAL_SHOW_ID: 'show' },
  });
  const request = { json: async () => ({ bookingRef: 'REF' }) };

  const asked = [];
  const denied = loadRoute('app/api/admin/checkin/route.ts', stubs([], asked));
  const refused = await denied.POST(request);
  assert.equal(refused.status, 403);
  assert.deepEqual(await refused.json(), { success: false, code: 'not-authorized', error: 'Forbidden' });
  assert.deepEqual(asked, ['scan-checkin']);
  assert.deepEqual(audits, ['not-authorized']);

  const allowed = loadRoute('app/api/admin/checkin/route.ts', stubs(['scan-checkin'], []));
  const admitted = await allowed.POST(request);
  assert.equal(admitted.status, 200);
  assert.equal((await admitted.json()).success, true);
  assert.deepEqual(audits, ['not-authorized', 'admit']);
});
