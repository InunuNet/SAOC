#!/usr/bin/env node
// A4 — F3 regression guard, read-only.
//
// Wiring the chips to Sanity must not silently reorder them. lib/data/provinces holds
// a curated, non-alphabetical order (WC first, then EC, NC, FS, KZN, GP, MP, LP, NW)
// and the `province` schema has no ordering field today — so a naive
// `| order(name asc)` would quietly reshuffle a visitor-facing control. The contract
// requires an `order` field seeded to preserve exactly the sequence below; this check
// is what makes that requirement real rather than advisory.
//
// Also guards the "ALL" chip: it is a UI affordance, not a province, and must stay
// synthesised in code — an editor must not be able to delete it and break filtering.
//
// Verified live 2026-08-11 that the rendered chip sequence today is exactly the
// EXPECTED array below, so this check PASSES pre-implementation and can only start
// failing if @dev changes the order — which is precisely its job.

import { fetchPage, assertDevServerUp, installCrashGuard, pass, fail } from './_shared.mjs';
import fs from 'node:fs';

installCrashGuard('check-province-chip-order');

const GOLDEN = '.agent/memory/project/specs/cms-wiring-cleanup/goldens/province-chip-order.golden.json';

await assertDevServerUp();

const expected = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')).chipOrder;

const { status, html } = await fetchPage('/societies');
if (status !== 200) fail(`/societies returned ${status}, expected 200`);

// The chips are the only elements carrying aria-pressed inside the province filter group.
const group = html.split('aria-label="Filter by province"')[1];
if (!group) {
  fail(
    '/societies no longer contains the `aria-label="Filter by province"` group — the filter ' +
      'control was restructured, which is out of this contract\'s scope.'
  );
}
const actual = [...group.matchAll(/aria-pressed="(?:true|false)"[^>]*>([^<]+)</g)].map((m) =>
  m[1].trim()
);

if (actual.length === 0) {
  fail('/societies rendered no province chips at all.');
}

const same =
  actual.length === expected.length && actual.every((v, i) => v === expected[i]);

if (!same) {
  fail(
    'province chip order changed.\n' +
      `  expected: ${JSON.stringify(expected)}\n` +
      `  actual:   ${JSON.stringify(actual)}\n` +
      'Wiring the chips to Sanity must preserve the curated order (seed an `order` field), and ' +
      'the "All" chip must stay synthesised in code rather than sourced from a document.'
  );
}

pass(`province chips render in the curated order: ${actual.join(', ')}`);
