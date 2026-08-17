#!/usr/bin/env node
// F2 — B2: behavioural proof that "preview shows nursery name + country" (F2's own Done
// criterion in the mission brief) is real, not aspirational. Studio's preview.select maps
// document field paths to preview slots at CONFIGURATION time; the only way to prove the
// mapping actually resolves to the right values is to run preview.prepare() against a fixture
// document shaped the way select claims to read it, and check the OUTPUT — the same method
// contracts/contract-cms-wiring-cleanup.yaml's README explains was needed after a grep-only
// assertion on aboutPage.title passed while the field rendered nowhere.
//
// DEFEATING MUTATION: preview.select declares { title: 'name', subtitle: 'country' } (looks
// correct to a human skim) but prepare() ignores the resolved values and returns a hardcoded
// string, or select points at the wrong field ('title' instead of 'name' — this type has no
// 'title' field, so that mistake would silently render "Untitled" for every nursery in
// Studio). Both are only visible by executing prepare(), never by reading select() alone.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f1f2-naming-and-nursery-schema/check-preview-shows-name-and-country.mjs

import { vendorNursery } from '../../../sanity/schemas/documents/vendorNursery.ts';

const failures = [];
const preview = vendorNursery?.preview;

if (!preview || typeof preview.prepare !== 'function') {
  console.error('FAIL: vendorNursery.preview.prepare is not a function');
  process.exit(1);
}

const select = preview.select ?? {};
if (select.title !== 'name') {
  failures.push(`preview.select.title is '${select.title}', expected 'name'`);
}
if (select.subtitle !== 'country') {
  failures.push(`preview.select.subtitle is '${select.subtitle}', expected 'country'`);
}

// Simulate what Sanity Studio actually does: resolve the selected paths against a document,
// then hand the resolved values (not the raw document) to prepare().
function resolveSelection(doc, selection) {
  const resolved = {};
  for (const [slot, path] of Object.entries(selection)) {
    resolved[slot] = doc[path];
  }
  return resolved;
}

const fixtureDoc = {
  name: 'Cape Orchid Nursery',
  country: 'South Africa',
  owner: 'J. van der Merwe',
};

const resolved = resolveSelection(fixtureDoc, select);
const result = preview.prepare(resolved);

if (result?.title !== 'Cape Orchid Nursery') {
  failures.push(
    `prepare() returned title '${result?.title}' for a document named 'Cape Orchid Nursery' — ` +
      `preview does not actually surface the nursery name`
  );
}
if (result?.subtitle !== 'South Africa') {
  failures.push(
    `prepare() returned subtitle '${result?.subtitle}' for country 'South Africa' — preview ` +
      `does not actually surface the country`
  );
}

// A nursery with no name yet (a freshly created, not-yet-filled-in draft) must not crash
// Studio's document list — the same "honest empty state" convention used throughout this
// codebase (e.g. showExhibitorInfo's entryFormPendingNote).
let emptyDocResult;
try {
  emptyDocResult = preview.prepare(resolveSelection({}, select));
} catch (err) {
  failures.push(`prepare() threw on a document with no fields set: ${err.message}`);
}
if (emptyDocResult && emptyDocResult.title === undefined) {
  failures.push(
    `prepare() returns title === undefined for an empty document — Studio renders a blank ` +
      `list row instead of a fallback label (e.g. 'Untitled nursery')`
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: preview.select maps to name/country and prepare() actually surfaces them, with a safe empty-document fallback.');
process.exit(0);
