// Regression test: the authenticated admin ticket CSV export carries attendee names and emails,
// so its 200 response must be `Cache-Control: no-store`. The route is transpiled in memory with
// its dependencies stubbed; no SDK, network or secrets are touched.
//   node --test scripts/checks/regressions/export-csv-no-store.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ROUTE = 'app/api/admin/export-csv/route.ts';

function loadRoute(session) {
  const db = { collection: () => ({ get: async () => ({ docs: [] }) }) };
  const stubs = {
    'firebase-admin/firestore': { getFirestore: () => db },
    '@/lib/admin-auth': { getAdminSession: async () => session },
    '@/lib/csv-field': { csvField: (value) => value },
    '@/lib/firebase-admin': { initAdmin: () => ({}) },
  };
  const source = readFileSync(path.join(ROOT, ROUTE), 'utf8');
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
    { module: loaded, exports: loaded.exports, require: resolve, Response, String },
    { filename: ROUTE, timeout: 5000 },
  );
  return loaded.exports;
}

test('authenticated CSV export response is Cache-Control: no-store', async () => {
  const { GET } = loadRoute({ ok: true, decodedToken: { uid: 'staff' } });
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Disposition') ?? '', /^attachment/);
});
