#!/usr/bin/env node
// F1+F2 — A1: proves the naming decision landed in the actual schema, not just in prose.
// Value-imports the real `vendorNursery` module and the real `schemaTypes` array (no @/*
// aliases anywhere in sanity/schemas/**, so `node --import tsx/esm` resolves this fine —
// see README's "npx tsx vs node --import tsx/esm" note) and checks the module's own `.name`
// property plus its presence in the registered array — not a grep of the source text, which
// would pass on a comment or an unused import.
//
// DEFEATING MUTATION: naming the exported document type `exhibitorNursery`, `vendor` (no
// suffix), or leaving it registered under a different `name` than its file/export implies.
// A grep for the literal string "vendor" anywhere in the file would NOT catch this — it would
// pass on a stray comment mentioning "vendor" while the actual Sanity `name` field still says
// something else. This check reads the field Sanity itself uses to key the document type.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f1f2-naming-and-nursery-schema/check-vendornursery-registered-and-named.mjs

import { vendorNursery } from '../../../sanity/schemas/documents/vendorNursery.ts';
import { schemaTypes } from '../../../sanity/schemas/index.ts';

const failures = [];

if (vendorNursery?.type !== 'document') {
  failures.push(`vendorNursery.type is '${vendorNursery?.type}', expected 'document'`);
}

if (vendorNursery?.name !== 'vendorNursery') {
  failures.push(
    `vendorNursery.name is '${vendorNursery?.name}', expected exactly 'vendorNursery' — internal ` +
      `names use vendor*, per F1's naming decision (README §Naming)`
  );
}

const registeredNames = schemaTypes.map((t) => t?.name);
if (!registeredNames.includes('vendorNursery')) {
  failures.push(
    `schemaTypes (sanity/schemas/index.ts) does not include a type named 'vendorNursery' — ` +
      `found: ${JSON.stringify(registeredNames)}`
  );
}

// Same object reference, not a same-named duplicate registered by mistake alongside the
// original module.
const registeredEntry = schemaTypes.find((t) => t?.name === 'vendorNursery');
if (registeredEntry && registeredEntry !== vendorNursery) {
  failures.push(
    `schemaTypes registers a DIFFERENT object under the name 'vendorNursery' than the one ` +
      `exported from sanity/schemas/documents/vendorNursery.ts — two definitions of the same ` +
      `type name, which Sanity will not tolerate at Studio load time`
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: vendorNursery is a document type named exactly 'vendorNursery', registered once in schemaTypes."
);
process.exit(0);
