/**
 * F2 (ticketing-complete, M1) — READ-ONLY diagnostic, not part of the migration. Answers a
 * single question the team lead raised: for the 5 admission `ticketType` documents, is
 * `category` genuinely ABSENT (setIfMissing is correct) or PRESENT holding `null`
 * (setIfMissing would silently no-op, and `set` is required instead)?
 *
 * GROQ's plain `category` projection returns `null` for both cases — indistinguishable.
 * `defined(category)` does not: it is `false` for both "absent" and "present-and-null",
 * but combined with `coalesce(category, "‹absent-or-null›") ` and the raw stored value we
 * can still tell them apart by asking `_id in *[defined(category)]._id` — a doc appears in
 * that set only when the field is present (Sanity's `defined()` returns false for a field
 * that does not exist at all, and ALSO false for one whose value is JSON `null`, per
 * Sanity's GROQ semantics — `defined()` treats "key absent" and "key present with value
 * null" identically as "not defined"). So `defined()` alone cannot separate the two cases
 * either.
 *
 * The one thing that CAN separate them is asking Sanity's raw document JSON for whether the
 * key exists in the object at all (`Object.prototype.hasOwnProperty`), which requires
 * fetching the whole raw document (no projection) and inspecting it in JS rather than in
 * GROQ, since GROQ's field-selection syntax has no "key exists" operator distinct from
 * `defined()`.
 *
 * NO WRITES. Only `client.fetch()` is called. Never `.patch()`/`.commit()`/`.delete()`/
 * `.create()`.
 *
 * Run with: node --import tsx/esm scripts/f2-diagnose-category-field.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// The 4 documents scripts/migrate-f2-ticket-taxonomy.ts actually category-patches (matching
// lib/provisional-figures.ts's ADMISSION_PRODUCTS array — 4 entries, not the 5 the goldens'
// prose mentions; early-bird-weekend-pass is the likely 5th SKU referred to there, but it is
// retired, not category-patched, by the migration plan). Included here too as a
// cross-reference point since it is also `defined(category) == false` in the live data.
const ADMISSION_IDS = [
  'ticketType-early-bird',
  'ticketType-day-visitor',
  'ticketType-weekend-pass',
  'ticketType-vip',
];
const CROSS_REFERENCE_IDS = ['ticketType-early-bird-weekend-pass'];

async function main(): Promise<void> {
  const env = readEnvLocal();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_TOKEN;

  if (!projectId || !dataset || !token) {
    throw new Error(
      'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, ' +
        'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN'
    );
  }

  // Read-only client — token only needs read access for this query; no write method is
  // ever called below.
  const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

  console.log(`Diagnosing ticketType.category presence in dataset "${dataset}" (READ-ONLY)`);

  // Cross-reference: defined(category) is reported here too. Per Sanity's own GROQ
  // semantics, defined() is false for BOTH "key absent" and "key present holding null" —
  // it cannot settle the question on its own, which is exactly why this script also
  // inspects the raw document JSON below rather than relying on defined() alone.
  const definedCheck = await client.fetch<Array<{ _id: string; categoryDefined: boolean }>>(
    `*[_id in $ids]{ _id, "categoryDefined": defined(category) }`,
    { ids: [...ADMISSION_IDS, ...CROSS_REFERENCE_IDS] }
  );
  console.log('  defined(category) cross-reference (does not alone distinguish absent vs. present-null):');
  for (const row of definedCheck) {
    console.log(`    ${row._id}: defined(category) = ${row.categoryDefined}`);
  }

  // Fetch each document's RAW JSON (no field projection) so we can check key presence in
  // JS with `in`/hasOwnProperty, which GROQ's defined()/coalesce() cannot distinguish from
  // "value is null".
  const docs = await client.fetch<Array<Record<string, unknown> | null>>(
    `*[_id in $ids]`,
    { ids: [...ADMISSION_IDS, ...CROSS_REFERENCE_IDS] }
  );

  const foundById = new Map(docs.filter(Boolean).map((doc) => [(doc as { _id: string })._id, doc as Record<string, unknown>]));

  for (const id of [...ADMISSION_IDS, ...CROSS_REFERENCE_IDS]) {
    const doc = foundById.get(id);
    if (!doc) {
      console.log(`  ${id}: DOCUMENT NOT FOUND in dataset`);
      continue;
    }
    const isPresent = Object.prototype.hasOwnProperty.call(doc, 'category');
    const value = doc.category;
    if (!isPresent) {
      console.log(`  ${id}: category is ABSENT — setIfMissing is correct here.`);
    } else if (value === null) {
      console.log(
        `  ${id}: category is PRESENT and holds null — setIfMissing would SILENTLY NO-OP. ` +
          `Use set(), not setIfMissing(), for this document.`
      );
    } else {
      console.log(`  ${id}: category is PRESENT and holds "${String(value)}" already.`);
    }
  }

  console.log('Diagnosis complete. No documents were written.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
