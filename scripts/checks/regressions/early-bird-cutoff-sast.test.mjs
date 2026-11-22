// Regression test: the early-bird window that checkout charges by (resolveEffectivePrice) and that
// every display surface shows by (ticket-hub-source, ticket-on-sale, the single-ticket pages) is
// ONE function, isWithinEarlyBirdWindow, so the price on screen and the price charged cannot
// disagree. For the cutoff convention the CMS uses (the cutoff DAY at SAST midnight, e.g.
// 2027-02-28T00:00:00+02:00, the value on every active ticket type) the window runs through the end
// of that SAST day: open at 23:30 SAST on the cutoff day, closed at 00:30 SAST the day after.
//   node --test scripts/checks/regressions/early-bird-cutoff-sast.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

function loadCheckoutReservation() {
  const stubs = {
    '@/lib/registration': { buildRegistrationDoc: () => ({}) },
    '@/lib/ticket-issuance-mode': { isIssuanceTestMode: () => false },
  };
  const code = ts.transpileModule(read('lib/checkout-reservation.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const resolve = (name) => {
    assert.ok(Object.hasOwn(stubs, name), `Unapproved module: ${name}`);
    return stubs[name];
  };
  vm.runInNewContext(
    code,
    { module: loaded, exports: loaded.exports, require: resolve, Object, Set, Date, Math, Error, Number, String, console },
    { filename: 'lib/checkout-reservation.ts', timeout: 5000 },
  );
  return loaded.exports;
}

const { isWithinEarlyBirdWindow, resolveEffectivePrice } = loadCheckoutReservation();

// The live value on every active early-bird ticket type (Sanity production, read 2026-11-22).
const CUTOFF = '2027-02-28T00:00:00+02:00';

test('open at 23:30 SAST on the cutoff day, closed at 00:30 SAST the day after', () => {
  assert.equal(isWithinEarlyBirdWindow(new Date('2027-02-28T23:30:00+02:00'), CUTOFF), true);
  assert.equal(isWithinEarlyBirdWindow(new Date('2027-03-01T00:30:00+02:00'), CUTOFF), false);
});

test('the boundary is exactly SAST midnight at the end of the cutoff day', () => {
  assert.equal(isWithinEarlyBirdWindow(new Date('2027-02-28T23:59:59.999+02:00'), CUTOFF), true);
  assert.equal(isWithinEarlyBirdWindow(new Date('2027-03-01T00:00:00+02:00'), CUTOFF), false);
  // The same instants written in UTC, which is what the server clock sees.
  assert.equal(isWithinEarlyBirdWindow(new Date('2027-02-28T21:59:59.999Z'), CUTOFF), true);
  assert.equal(isWithinEarlyBirdWindow(new Date('2027-02-28T22:00:00.000Z'), CUTOFF), false);
});

test('the charged price follows the same window', () => {
  const base = { price: 200, regularPrice: 300, earlyBirdCutoff: CUTOFF };
  assert.equal(resolveEffectivePrice({ ...base, now: new Date('2027-02-28T23:30:00+02:00') }), 200);
  assert.equal(resolveEffectivePrice({ ...base, now: new Date('2027-03-01T00:30:00+02:00') }), 300);
});

test('no cutoff means no restriction', () => {
  assert.equal(isWithinEarlyBirdWindow(new Date('2099-01-01T00:00:00Z'), null), true);
});

test('checkout and every display surface use the one shared window function', () => {
  assert.match(read('app/api/tickets/checkout/route.ts'), /resolveEffectivePrice\(\{/);
  for (const file of [
    'lib/data/ticket-hub-source.ts',
    'lib/ticket-on-sale.ts',
    'app/(nos)/tickets/[slug]/page.tsx',
  ]) {
    assert.match(read(file), /from '@\/lib\/checkout-reservation'/, `${file} must use the shared window`);
  }
  // Nobody re-implements the comparison.
  for (const file of ['app/api/tickets/checkout/route.ts', 'lib/data/ticket-hub-source.ts', 'lib/ticket-on-sale.ts']) {
    assert.doesNotMatch(read(file), /setUTCDate\(/, `${file} must not compute its own cutoff`);
  }
});
