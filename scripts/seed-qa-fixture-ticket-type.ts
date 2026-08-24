/**
 * ticketing-hardening — idempotent seed for the QA fixture ticketType document
 * (`ticketType-qa-fixture`, slug `qa-fixture-ticket`) that
 * contracts/checks/ticketing-hardening/_shared.mjs's TARGET_TICKET_TYPE points at.
 *
 * This document was previously created manually, directly against the live
 * `production` Sanity dataset, with no committed seed. If it's ever deleted, or the
 * suite is run against a different dataset (staging, a fresh environment, CI), every
 * check that calls sanityCapacity()/depends on TARGET_TICKET_TYPE fails with a
 * confusing "not found" error instead of a clear "run the seed" one. This script makes
 * the fixture reproducible.
 *
 * Fixed `_id` (not per-show, unlike scripts/seed-demo-ticket-type.ts's demo type) — this
 * is a single permanent fixture, not a per-show product — so createIfNotExists against
 * that pinned id is already idempotent with no separate dedup-plan step needed.
 * createIfNotExists only: never overwrites, never deletes, matches the project's
 * standing concern that createOrReplace is unsafe for seeds.
 *
 * `show` is a required ticketType field (sanity/schemas/documents/ticketType.ts) but is
 * otherwise irrelevant to this fixture's purpose (category 'qa-fixture-only' can never
 * match a real page query regardless of which show it's scoped to) — resolved
 * dynamically via resolveActiveShow() rather than hardcoded, so the seed also works
 * against a dataset whose active show has a different _id.
 *
 * Required env (read directly from .env.local, no dotenv — its startup banner writes to
 * stdout and has corrupted an env value on this project before):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-qa-fixture-ticket-type.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import { resolveActiveShow, type ShowActivationFields } from '../lib/show-resolution';
import { ticketType } from '../sanity/schemas/documents/ticketType';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, no dotenv (see file header).
// ---------------------------------------------------------------------------

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

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

export const QA_FIXTURE_TICKET_TYPE_ID = 'ticketType-qa-fixture';
export const QA_FIXTURE_TICKET_TYPE_SLUG = 'qa-fixture-ticket';

async function fetchActiveShowId(): Promise<string> {
  const shows = await client.fetch<ShowActivationFields[]>(`*[_type == "show"]{ _id, active }`);
  const activeShowId = resolveActiveShow(shows);
  if (!activeShowId) {
    throw new Error(
      'resolveActiveShow() found no single active show — cannot seed the QA fixture ' +
        'ticketType without knowing which show to scope it to. Fix the show-activation ' +
        'data in Sanity first.'
    );
  }
  return activeShowId;
}

async function main(): Promise<void> {
  console.log(
    `Seeding QA fixture ticketType in Sanity dataset "${dataset}" (project ${projectId})`
  );

  const activeShowId = await fetchActiveShowId();

  const document = {
    _id: QA_FIXTURE_TICKET_TYPE_ID,
    _type: 'ticketType' as const,
    name: 'QA Fixture Ticket — Do Not Purchase',
    slug: { _type: 'slug' as const, current: QA_FIXTURE_TICKET_TYPE_SLUG },
    description:
      'Permanent fixture for contracts/checks/ticketing-hardening (TARGET_TICKET_TYPE). ' +
      'Not a real product — never remove the category value or this becomes purchasable.',
    price: 0,
    capacity: 50,
    active: true,
    order: 999,
    demo: true,
    category: 'qa-fixture-only' as const,
    provisional: false,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    show: { _type: 'reference' as const, _ref: activeShowId },
  };

  // createIfNotExists — never overwrites, never deletes; only creates the doc when it's
  // genuinely absent. Safe to re-run.
  await client.createIfNotExists(document);

  // Then unconditionally converge the ENTIRE document to the canonical shape defined above,
  // every run. This fixture's `_id` is exclusively owned by this script — nothing else ever
  // legitimately writes to `ticketType-qa-fixture` — so a full `.set()` of every field can
  // never clobber real content the way createOrReplace would be unsafe for a real editorial
  // document. Enumerating individual "safety-critical fields" to repair (show._ref, then
  // category/demo, then active/slug — see git history) is never complete; converging the
  // whole shape is the only correctness guarantee here.
  //
  // `.set(document)` is a SHALLOW MERGE — it writes the fields present in `document` but
  // does not remove fields absent from it. Any of ticketType's optional F4/F5 schema fields
  // (earlyBirdCutoff, regularPrice, releasedQuantity, capacityPool, headcountPerUnit, ...)
  // that ever land on this doc — by hand, by a future script bug, by schema evolution —
  // would otherwise survive every "convergence" run forever and silently affect this
  // fixture's checkout/capacity behavior. Derive the stray-field list from the schema
  // itself (rather than hand-maintaining it) so a newly added optional field is unset by
  // default instead of silently permitted.
  const schemaFieldNames = ticketType.fields.map((field) => (field as { name: string }).name);
  const canonicalFieldNames = new Set(Object.keys(document).filter((key) => !key.startsWith('_')));
  const strayFieldNames = schemaFieldNames.filter((name) => !canonicalFieldNames.has(name));

  const before = await client.getDocument<Record<string, unknown>>(QA_FIXTURE_TICKET_TYPE_ID);
  // `_id`/`_type` are immutable system attributes — createIfNotExists(document) above needs
  // them, but a `.set()` patch payload must not include them.
  const { _id, _type, ...patchFields } = document;
  const after = await client
    .patch(QA_FIXTURE_TICKET_TYPE_ID)
    .set(patchFields)
    .unset(strayFieldNames)
    .commit();

  // Sanity round-trips object/array key order differently than it was written (e.g. a
  // reference field may come back as {_ref, _type} instead of {_type, _ref}), so comparing
  // via JSON.stringify directly would report false diffs. Normalise key order recursively
  // before comparing so the diff log reflects real changes only.
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .sort()
          .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
      );
    }
    return value;
  };

  const changedFields = Object.keys(document).filter(
    (key) =>
      JSON.stringify(sortKeys((before as Record<string, unknown> | undefined)?.[key])) !==
      JSON.stringify(sortKeys((document as Record<string, unknown>)[key]))
  );
  const unsetStrayFields = strayFieldNames.filter(
    (key) => (before as Record<string, unknown> | undefined)?.[key] !== undefined
  );
  changedFields.push(...unsetStrayFields.map((key) => `${key} (unset)`));

  if (changedFields.length === 0) {
    console.log(`Fixture present and already canonical: ${after._id}.`);
  } else {
    console.log(`Fixture present: ${after._id} (converged fields: ${changedFields.join(', ')}).`);
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
