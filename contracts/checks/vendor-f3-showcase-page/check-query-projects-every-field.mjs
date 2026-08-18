#!/usr/bin/env node
// A1 — the GROQ query the page uses to fetch nurseries projects EVERY top-level field the
// real vendorNursery schema declares. This is the project's own recurring false-green class,
// named explicitly in sanity/queries.ts's showExhibitorInfoQuery comment: "a field the schema
// declares but the query drops renders as nothing." A schema-shape check (F1F2's A5) cannot
// catch this — it only inspects the schema, never the query. This check reads BOTH the real
// schema object and the real query source, and diffs field names.
//
// Does not hardcode the field list: it derives expected fields from the actual imported
// vendorNursery.fields array, so a future field ADDED to the schema without a matching query
// update fails this check automatically, without this check itself needing an edit.
//
// DEFEATING MUTATION: adding a field to sanity/schemas/documents/vendorNursery.ts (e.g. a new
// "region" field) without adding it to vendorNurseriesQuery in sanity/queries.ts — or a typo'd
// projection key (e.g. "specialization" for "specialisation") that silently returns undefined
// at runtime instead of throwing.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-query-projects-every-field.mjs

import { readFileSync } from 'node:fs';
import { vendorNursery } from '../../../sanity/schemas/documents/vendorNursery.ts';

const failures = [];

const schemaFieldNames = (vendorNursery?.fields ?? [])
  .map((f) => f?.name)
  .filter((n) => typeof n === 'string');

if (schemaFieldNames.length === 0) {
  failures.push('vendorNursery.fields is empty or unreadable — cannot derive expected fields');
}

const queriesSource = readFileSync(new URL('../../../sanity/queries.ts', import.meta.url), 'utf8');

const match = queriesSource.match(
  /export const vendorNurseriesQuery\s*=\s*defineQuery\(`([\s\S]*?)`\)/,
);
if (!match) {
  failures.push(
    "sanity/queries.ts does not export a `vendorNurseriesQuery` built with defineQuery(`...`) " +
      '— checked for the exact export name the golden README specifies',
  );
} else {
  const queryBody = match[1];

  // `_type == "vendorNursery"` — the query must actually target the right document type.
  if (!/_type\s*==\s*["']vendorNursery["']/.test(queryBody)) {
    failures.push('vendorNurseriesQuery does not filter on _type == "vendorNursery"');
  }

  if (!/\b_id\b/.test(queryBody)) {
    failures.push(
      'vendorNurseriesQuery does not project `_id` — VendorGrid needs a stable React key per card',
    );
  }

  for (const field of schemaFieldNames) {
    const wordBoundary = new RegExp(`\\b${field}\\b`);
    if (!wordBoundary.test(queryBody)) {
      failures.push(
        `vendorNurseriesQuery does not project schema field "${field}" — it will read as ` +
          'undefined on every nursery, and the page will silently drop it',
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: vendorNurseriesQuery projects every one of ${schemaFieldNames.length} vendorNursery ` +
    'schema fields plus _id.',
);
process.exit(0);
