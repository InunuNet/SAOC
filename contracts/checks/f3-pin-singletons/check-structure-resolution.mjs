#!/usr/bin/env node
// F3 (cms-activation-deploy): behavioural proof that the Studio desk structure pins
// all SIX page singletons — homePage, aboutPage, nationalShow, contactPage,
// judgingPage, membersPage — to one fixed document each. (Scope change 2026-07-29:
// Brad decided membersPage stays as an empty placeholder singleton for now — schema
// kept, pinned like the rest, no content seeded. That's the same decision this check
// enforces for the other five; there is no more "deferred" type.)
//
// This does NOT grep source text. It imports the real `structure` export from
// sanity/structure.ts, builds a real Sanity StructureBuilder (`sanity/structure`'s
// createStructureBuilder) against the project's actual schema, calls the structure
// function exactly as the Studio does, and inspects the serialized list items it
// produces. The discriminator is real Sanity behaviour, empirically verified against
// this Sanity version (5.31.1) before this check was written:
//   - A pinned singleton item (S.listItem().child(S.document().documentId(id)))
//     serializes its `.child` as a PLAIN OBJECT: { type: 'document', options: { id, type } }.
//   - A stock/list item (S.documentTypeListItem(type), what structureTool() generates
//     by default for every type today) serializes its `.child` as a FUNCTION — a lazy
//     resolver that builds a list pane with a "Create new" template. That function
//     shape is exactly what lets an editor create a second document of that type.
//
// Every one of the 6 types must resolve to the object shape.
//
// Exit codes: 0 = all assertions pass. 1 = any assertion fails OR the import/resolution
// itself throws (e.g. sanity/structure.ts does not exist yet). Never exits 0 on a SKIP —
// per Athanor#1322, a check that cannot run is a FAIL, not a silent pass.

// Run as: node --import tsx/esm contracts/checks/f3-pin-singletons/check-structure-resolution.mjs
// (must load with --import, not a runtime register() call — tsx/esm requires --import
// on this Node version; a dynamic register() throws "must be loaded with --import").
import { createStructureBuilder } from 'sanity/structure';
import { createSchema } from 'sanity';

const PINNED_TYPES = ['homePage', 'aboutPage', 'nationalShow', 'contactPage', 'judgingPage', 'membersPage'];

let failures = [];

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
}

let structureModule;
try {
  structureModule = await import('../../../sanity/structure.ts');
} catch (err) {
  console.error(`FAIL: could not import sanity/structure.ts — ${err.message}`);
  process.exit(1);
}

const structureFn = structureModule.structure ?? structureModule.default;
if (typeof structureFn !== 'function') {
  console.error('FAIL: sanity/structure.ts does not export a `structure` function (named or default).');
  process.exit(1);
}

const { schemaTypes } = await import('../../../sanity/schemas/index.ts');
const schema = createSchema({ name: 'default', types: schemaTypes });

const source = {
  projectId: 'check-f3',
  dataset: 'check-f3',
  schema,
  i18n: {},
  currentUser: null,
  getClient: () => ({}),
  templates: [],
  document: {},
};

const S = createStructureBuilder({ source });

let rootList;
try {
  rootList = await structureFn(S, { schema, currentUser: null, documentStore: undefined });
} catch (err) {
  console.error(`FAIL: structure(S, context) threw — ${err.message}`);
  process.exit(1);
}

const serialized = rootList.serialize({ path: [] });

function findItemById(items, id) {
  return items.find((item) => item.id === id);
}

// serialize()'s `items` can itself be a lazy function on some builders; ours is a plain
// list built from a static array, so it should already be an array here. If it isn't,
// that's a structural surprise worth failing loudly on rather than silently skipping.
if (typeof serialized.items === 'function') {
  fail('root list items is a function (dynamic) — expected a static array for this structure');
} else {
  const items = serialized.items ?? [];

  for (const typeName of PINNED_TYPES) {
    const item = findItemById(items, typeName);
    if (!item) {
      fail(`${typeName}: no list item with id "${typeName}" found in the custom structure`);
      continue;
    }
    if (typeof item.child !== 'object' || item.child === null) {
      fail(
        `${typeName}: expected a pinned document pane (static object child), got ` +
          `${typeof item.child === 'function' ? 'a list resolver function' : typeof item.child} — ` +
          `this type is NOT pinned and can still be duplicated`
      );
      continue;
    }
    if (item.child.type !== 'document') {
      fail(`${typeName}: child.type is "${item.child.type}", expected "document"`);
    }
    if (item.child.options?.id !== typeName) {
      fail(`${typeName}: child document id is "${item.child.options?.id}", expected fixed id "${typeName}"`);
    }
    if (item.child.options?.type !== typeName) {
      fail(`${typeName}: child document type is "${item.child.options?.type}", expected "${typeName}"`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: all 6 pinned types (including membersPage) resolve to a fixed document pane.');
process.exit(0);
