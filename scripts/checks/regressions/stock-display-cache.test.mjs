// Regression test: the stock read that feeds the ticket pages and the sitemap goes through a
// 60 second tagged cache, returns exactly the shape the live scan produces, and the checkout path
// (lib/data/tickets.ts, never imported here) is untouched by it.
//   node --test scripts/checks/regressions/stock-display-cache.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FILE = 'lib/data/admission-availability.ts';

const SOLD = { 'early-bird': 3, 'day-visitor': 1, 'day-visitor::2027-09-24': 2 };
const SOLD_BY_DAY_KEYS = { 'day-visitor::2027-09-24': 2, 'early-bird::2027-09-25': 4 };

function loadModule() {
  const cacheCalls = [];
  const scans = { plain: 0, byDay: 0 };
  const noop = {};
  const stubs = {
    'next/cache': {
      // Identity wrapper that records how the function was registered.
      unstable_cache: (fn, keyParts, options) => {
        cacheCalls.push({ keyParts, options });
        return fn;
      },
    },
    '@/sanity/lib/fetch': { sanityFetch: async () => null },
    '@/sanity/queries': {},
    '@/lib/checkout-reservation': { effectiveCapacity: () => 0, planPooledCapacity: () => ({}) },
    '@/lib/data/ticket-card-view-models': noop,
    '@/lib/data/ticket-hub-source': { buildHubCards: () => ({}), TICKET_CATEGORIES: [] },
    '@/lib/data/tickets': {
      getSoldCountsByTicketType: async () => {
        scans.plain += 1;
        return SOLD;
      },
      getSoldCountsByTicketTypeAndDay: async () => {
        scans.byDay += 1;
        return SOLD_BY_DAY_KEYS;
      },
    },
    '@/lib/demo-ticket-type': { filterPubliclyListableTicketTypes: (rows) => rows },
    '@/lib/provisional-figures': { DAY_VISITOR_SELLABLE_DAYS: [], DAY_VISITOR_SHAPED_SLUGS: ['day-visitor', 'early-bird'] },
    '@/lib/show-resolution': { resolveActiveShow: () => null },
    '@/lib/ticket-on-sale': { ticketTypeMatchesActiveShow: () => true },
    '@/lib/tickets-constants': { NATIONAL_SHOW_ID: 'show' },
  };
  const source = readFileSync(path.join(ROOT, FILE), 'utf8');
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
    { module: loaded, exports: loaded.exports, require: resolve, Object, Set, Promise, Math, console, Error },
    { filename: FILE, timeout: 5000 },
  );
  return { exports: loaded.exports, cacheCalls, scans };
}

test('the display stock read is registered with a 60 second revalidate and the ticket-stock tag', () => {
  const { cacheCalls, exports } = loadModule();
  assert.equal(cacheCalls.length, 1);
  assert.equal(cacheCalls[0].options.revalidate, 60);
  assert.deepEqual([...cacheCalls[0].options.tags], ['ticket-stock']);
  assert.equal(exports.TICKET_STOCK_CACHE_TAG, 'ticket-stock');
  assert.equal(exports.TICKET_STOCK_REVALIDATE_SECONDS, 60);
});

test('the cached read returns the same shape the live scans produce', async () => {
  const { exports, scans } = loadModule();
  const reading = await exports.getCachedStockReading();
  assert.deepEqual(JSON.parse(JSON.stringify(reading)), {
    sold: SOLD,
    // Only keys carrying a day separator are split out, grouped by ticket type then day.
    byDay: { 'day-visitor': { '2027-09-24': 2 }, 'early-bird': { '2027-09-25': 4 } },
  });
  assert.deepEqual(scans, { plain: 1, byDay: 1 });
});
