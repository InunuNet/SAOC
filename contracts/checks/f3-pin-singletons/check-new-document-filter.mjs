#!/usr/bin/env node
// F3 (cms-activation-deploy): pinning the desk-structure sidebar (checked by
// check-structure-resolution.mjs) is not sufficient on its own — Sanity Studio also
// exposes a global "+ Create new document" menu that bypasses the desk structure
// entirely. If that menu still lists homePage/aboutPage/nationalShow/contactPage/
// judgingPage/membersPage, an editor can create a second document of a "pinned" type
// through that menu even though the sidebar only ever opens the fixed one. This check
// proves the filter that closes that hole actually works, by calling the REAL exported
// filter function with synthetic input — not grepping for its presence in source.
//
// Run as: node --import tsx/esm contracts/checks/f3-pin-singletons/check-new-document-filter.mjs
//
// Exit codes: 0 = filter behaves correctly for all cases below. 1 = missing export,
// import failure, or any case behaves incorrectly. Never a silent skip (Athanor#1322).

const PINNED_TYPES = ['homePage', 'aboutPage', 'nationalShow', 'contactPage', 'judgingPage', 'membersPage'];
const MUST_SURVIVE = ['society', 'event']; // ordinary collections, unaffected by F3

let structureModule;
try {
  structureModule = await import('../../../sanity/structure.ts');
} catch (err) {
  console.error(`FAIL: could not import sanity/structure.ts — ${err.message}`);
  process.exit(1);
}

const filterFn = structureModule.filterNewDocumentOptions;
if (typeof filterFn !== 'function') {
  console.error(
    'FAIL: sanity/structure.ts does not export `filterNewDocumentOptions` — the global ' +
      '"+ Create new" menu is not proven to exclude the pinned singleton types.'
  );
  process.exit(1);
}

// Synthetic input shaped like Sanity's NewDocumentOptionsContext `creatableTypes`/options
// list: one entry per candidate type, each carrying its schemaType name.
const syntheticOptions = [...PINNED_TYPES, ...MUST_SURVIVE].map((templateId) => ({
  templateId,
  schemaType: templateId,
}));

let result;
try {
  result = filterFn(syntheticOptions, { creationContext: { type: 'global' } });
} catch (err) {
  console.error(`FAIL: filterNewDocumentOptions(...) threw — ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(result)) {
  console.error(`FAIL: filterNewDocumentOptions must return an array, got ${typeof result}`);
  process.exit(1);
}

const resultIds = result.map((o) => o.schemaType ?? o.templateId);
let failures = [];

for (const typeName of PINNED_TYPES) {
  if (resultIds.includes(typeName)) {
    failures.push(`${typeName}: still present in filtered "create new" options — can be duplicated via the global menu`);
  }
}
for (const typeName of MUST_SURVIVE) {
  if (!resultIds.includes(typeName)) {
    failures.push(`${typeName}: was removed from "create new" options but must survive (out of F3 scope)`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: global "create new" menu excludes exactly the 6 pinned types; ordinary collections survive.');
process.exit(0);
