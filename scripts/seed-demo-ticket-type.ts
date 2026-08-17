/**
 * F9 (ticketing-foundation) — one-time, idempotent seed for the reserved demo ticket type
 * ("General Admission (Demo)") that F12's and F14's human end-to-end proofs purchase against a
 * real PayFast SANDBOX gateway on a deployed host. See
 * contracts/golden/ticketing-f9-demo-ticket/README.md for the full decision record.
 *
 * Mirrors scripts/migrate-show-sales-fields.ts's shape: reads .env.local directly, a real
 * @sanity/client, --dry-run support. Dry-run is the DEFAULT — mutating requires an explicit
 * --apply flag, exactly like scripts/admin-migrate-roles.ts. Never overwrites an existing
 * document (createIfNotExists only) and never deletes anything.
 *
 * The write/no-write decision itself is computed by planDemoTicketTypeSeed()
 * (lib/demo-ticket-type-seed-plan.ts) — this script only fetches the real active show and the
 * real existing ticketType documents, feeds them to that pure function, and either prints or
 * commits the resulting plan.
 *
 * OUT OF SCOPE for this feature's contract: actually running this script against the live
 * Sanity dataset is a human/deploy step, not a gate check — see golden README, "Why the real
 * seed script is unasserted".
 *
 * Required env (read directly from .env.local, matching scripts/migrate-show-sales-fields.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-demo-ticket-type.ts          (dry-run, default)
 *       or: node --import tsx/esm scripts/seed-demo-ticket-type.ts --apply  (mutates)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import { planDemoTicketTypeSeed, type ExistingTicketTypeDoc } from '../lib/demo-ticket-type-seed-plan';
import { resolveActiveShow, type ShowActivationFields } from '../lib/show-resolution';

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
// scripts/admin-migrate-roles.ts's posture, not migrate-show-sales-fields.ts's --dry-run-flag
// posture, because this script CREATES a document rather than patching existing ones, and
// creation is the more consequential default to guard against.
const APPLY = process.argv.includes('--apply');

async function fetchActiveShowId(): Promise<string> {
  const shows = await client.fetch<ShowActivationFields[]>(`*[_type == "show"]{ _id, active }`);
  const activeShowId = resolveActiveShow(shows);
  if (!activeShowId) {
    throw new Error(
      'resolveActiveShow() found no single active show — cannot seed a demo ticketType ' +
        'without knowing which show to scope it to. Fix the show-activation data in Sanity ' +
        'first.'
    );
  }
  return activeShowId;
}

async function fetchExistingTicketTypes(): Promise<ExistingTicketTypeDoc[]> {
  return client.fetch<ExistingTicketTypeDoc[]>(
    `*[_type == "ticketType"]{ _id, "slug": slug.current, show }`
  );
}

async function main(): Promise<void> {
  console.log(
    `Seeding demo ticket type in Sanity dataset "${dataset}" (project ${projectId})` +
      (APPLY ? ' [--apply — WILL WRITE]' : ' [DRY RUN — no writes]')
  );

  const activeShowId = await fetchActiveShowId();
  const existingTicketTypes = await fetchExistingTicketTypes();

  const plan = planDemoTicketTypeSeed({ activeShowId, existingTicketTypes });

  if (plan.action === 'skip-exists') {
    console.log(`  skip-exists: demo ticketType already present for ${activeShowId} (${plan.existingId}).`);
    console.log('Nothing to do — already seeded.');
    return;
  }

  console.log(`  would create: ${JSON.stringify(plan.document, null, 2)}`);

  if (!APPLY) {
    console.log('\nDry-run only — nothing was written. Re-run with --apply to create the document above.');
    return;
  }

  // createIfNotExists — never overwrites, never deletes. If the document somehow already
  // exists (a race with another run), this is a safe no-op rather than a clobber.
  await client.createIfNotExists(plan.document);
  console.log(`\nCreated ${plan.document._id}.`);
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
