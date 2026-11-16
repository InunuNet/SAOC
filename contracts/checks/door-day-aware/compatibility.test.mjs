import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('scanner: execute actual applyResult; counter is unique tickets, including null state', () => {
  const source = ts.createSourceFile('scanner.tsx', read('components/admin/DoorScannerClient.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let target;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'applyResult') target = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(target, 'retain existing applyResult entry point');
  const code = ts.transpileModule(target.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [initial, result, expected] of [
    [10, { success: true, firstAdmission: true }, 11],
    [10, { success: true, firstAdmission: false }, 10],
    [10, { success: false, error: 'Already checked in' }, 10],
    [null, { success: true, firstAdmission: true }, null],
    [null, { success: true, firstAdmission: false }, null],
  ]) {
    let count = initial;
    const sandbox = { data: result, clearDismissTimer() {}, setResult() {}, pauseScanning() {}, resumeScanning() {}, setCheckedInCount(fn) { count = fn(count); }, dismissTimerRef: { current: null }, setTimeout() { return 1; }, SUCCESS_AUTO_DISMISS_MS: 1 };
    vm.runInNewContext(`${code}\napplyResult(data);`, sandbox, { timeout: 1000 });
    assert.equal(count, expected);
  }
});

// This is the real new context adapter, with only its network/cache boundary injected.
// Export/import names form part of the handoff API, not an alternate implementation.
function contextLoader({ traits = [], window = null, available = true, fail = false } = {}) {
  const events = [];
  const stubs = {
    '@/sanity/lib/client': { client: available ? { fetch: async (query) => { assert.equal(query, 'traits-query'); events.push('catalogue'); if (fail) throw Error('offline failure'); return traits; } } : null },
    '@/sanity/queries': { ticketTypeScheduleTraitsQuery: 'traits-query' },
    '@/lib/tickets-constants': { NATIONAL_SHOW_ID: 'show' },
    '@/lib/show-window-lookup': { resolveShowWindowLookup: async (id, now) => { assert.equal(id, 'show'); assert.equal(now.toISOString(), '2027-09-24T10:00:00.000Z'); events.push('window'); return (showId) => { assert.equal(showId, 'show'); return window; }; } },
  };
  const loaded = { exports: {} };
  const code = ts.transpileModule(read('lib/checkin-context.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require(name) {
    const key = name.startsWith('.') ? `@/${path.posix.normalize(path.posix.join('lib', name))}` : name;
    assert.ok(Object.hasOwn(stubs, key), `Unapproved dependency ${name}`); return stubs[key];
  } }, { timeout: 1000 });
  return { get: loaded.exports.getCheckinContext, events };
}

test('context: actual adapter includes future and inactive flags, historical day slugs and fails closed', async () => {
  const now = new Date('2027-09-24T10:00:00Z');
  const window = { startDate: now, endDate: now };
  const { get, events } = contextLoader({ window, traits: [
    { slug: 'inactive-required', requiresDaySelection: true, active: false },
    { slug: 'future-day-product', requiresDaySelection: true },
    { slug: 'vip', requiresDaySelection: false },
    { slug: 'forged', requiresDaySelection: 'true' },
    { slug: 'weekend-pass', requiresDaySelection: false },
  ] });
  const result = await get(now);
  assert.equal(result.window, window);
  assert.deepEqual(Array.from(result.daySelectionTypes).sort(), ['day-visitor', 'early-bird', 'future-day-product', 'inactive-required']);
  assert.deepEqual(events.sort(), ['catalogue', 'window']);
  for (const options of [{ available: false }, { fail: true }]) await assert.rejects(() => contextLoader(options).get(now));
  const empty = await contextLoader().get(now);
  assert.equal(empty.window, null);
  assert.deepEqual(Array.from(empty.daySelectionTypes).sort(), ['day-visitor', 'early-bird']);
});
