/**
 * Fictional Test Show — one-time, idempotent seed for the reserved fictional show document
 * and its scoped ticket type. Isolates F12's and F14's human end-to-end proofs away from the
 * real 2027 show. See contracts/golden/fictional-test-show/README.md for the full decision
 * record.
 *
 * Mirrors scripts/seed-demo-ticket-type.ts's exact shape: reads .env.local directly, a real
 * @sanity/client, --dry-run support. Dry-run is the DEFAULT — mutating requires an explicit
 * --apply flag. Never overwrites an existing document (createIfNotExists only) and never
 * deletes anything.
 *
 * The write/no-write decisions are computed by planFictionalTestShowDocument() and
 * planFictionalTestShowTicketTypeSeed() (lib/fictional-test-show-seed-plan.ts) — this script
 * only fetches the real existing `show` and `ticketType` documents, feeds them to those pure
 * functions, and either prints or commits the resulting plans. The ticket type's `create` plan
 * is only ever attempted after the show document is confirmed to exist — either freshly
 * created or already present — since the ticket type's `show._ref` must resolve.
 *
 * OUT OF SCOPE for this feature's contract: actually running this script against the live
 * Sanity dataset is a human/deploy step, not a gate check — see golden README, "Why the real
 * seed script is unasserted".
 *
 * Required env (read directly from .env.local, matching scripts/seed-demo-ticket-type.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-fictional-test-show.ts          (dry-run, default)
 *       or: node --import tsx/esm scripts/seed-fictional-test-show.ts --apply  (mutates)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import {
  planFictionalTestShowDocument,
  planFictionalTestShowTicketTypeSeed,
  type ExistingShowDoc,
  type ExistingTicketTypeDoc,
} from '../lib/fictional-test-show-seed-plan';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local (see file header).
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

// Dry-run is the DEFAULT. Only a literal --apply in argv mutates — matches
// scripts/seed-demo-ticket-type.ts's posture, because this script CREATES documents rather
// than patching existing ones, and creation is the more consequential default to guard against.
const APPLY = process.argv.includes('--apply');

async function fetchExistingShows(): Promise<ExistingShowDoc[]> {
  return client.fetch<ExistingShowDoc[]>(`*[_type == "show"]{ _id, "slug": slug.current }`);
}

async function fetchExistingTicketTypes(): Promise<ExistingTicketTypeDoc[]> {
  return client.fetch<ExistingTicketTypeDoc[]>(
    `*[_type == "ticketType"]{ _id, "slug": slug.current, show }`
  );
}

async function main(): Promise<void> {
  console.log(
    `Seeding fictional test show in Sanity dataset "${dataset}" (project ${projectId})` +
      (APPLY ? ' [--apply — WILL WRITE]' : ' [DRY RUN — no writes]')
  );

  const existingShows = await fetchExistingShows();
  const showPlan = planFictionalTestShowDocument(existingShows);

  if (showPlan.action === 'skip-exists') {
    console.log(`  show: skip-exists — fictional show already present (${showPlan.existingId}).`);
  } else {
    console.log(`  show: would create ${JSON.stringify(showPlan.document, null, 2)}`);
    if (APPLY) {
      // createIfNotExists — never overwrites, never deletes. If the document somehow already
      // exists (a race with another run), this is a safe no-op rather than a clobber.
      await client.createIfNotExists(showPlan.document);
      console.log(`  show: created ${showPlan.document._id}.`);
    }
  }

  // The ticket type's `show._ref` must resolve, so only attempt it once the show document is
  // confirmed to exist — either freshly created (APPLY only) or already present.
  if (!APPLY && showPlan.action === 'create') {
    console.log(
      '\nDry-run only — nothing was written. Re-run with --apply to create the documents above.'
    );
    return;
  }

  const existingTicketTypes = await fetchExistingTicketTypes();
  const ticketTypePlan = planFictionalTestShowTicketTypeSeed(existingTicketTypes);

  if (ticketTypePlan.action === 'skip-exists') {
    console.log(`  ticketType: skip-exists — already present (${ticketTypePlan.existingId}).`);
    console.log('\nNothing further to do — already seeded.');
    return;
  }

  console.log(`  ticketType: would create ${JSON.stringify(ticketTypePlan.document, null, 2)}`);

  if (!APPLY) {
    console.log(
      '\nDry-run only — nothing was written. Re-run with --apply to create the document above.'
    );
    return;
  }

  await client.createIfNotExists(ticketTypePlan.document);
  console.log(`  ticketType: created ${ticketTypePlan.document._id}.`);
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
