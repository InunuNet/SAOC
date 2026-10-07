/**
 * F3 (conference-workshop-tickets, M2) — one-time migration landing Brad's 2026-10-07
 * ticket-news message 6 (shared 500-ticket early-bird pool across the two admission
 * early-bird SKUs, with no date cutoff; no Thursday on the Day Pass days; flat R2000/80-capacity
 * Symposium/WOSA with no early-bird mechanism) into the Sanity dataset. See
 * .agent/memory/project/specs/conference-workshop-tickets/goldens/f2-sanity-schema-migration.golden.md
 * for the full decision record.
 *
 * THE HARD RULE — there is only ONE Sanity dataset ('production'), read by both local dev
 * and the deployed beta site. A write here is a deploy by side effect. So:
 *
 *   - Default invocation (no flags at all) prints the plan and writes NOTHING. It does not
 *     read any Sanity env var and does not construct a Sanity client — the --apply check
 *     happens FIRST, before any of that, matching scripts/migrate-f2-ticket-taxonomy.ts's
 *     audited-correct precedent.
 *   - `--apply` is the ONLY flag that mutates.
 *   - This migration PATCHES, never CREATES and never DELETES, every pre-existing document
 *     it touches. The one genuinely new admission product this mission adds has nothing to
 *     patch yet — it doesn't exist as a document until scripts/seed-ticketing.ts's own,
 *     unmodified createIfNotExists loop over its product array creates it with zero new
 *     code, once this mission's product list lands.
 *
 * buildMigrationPatches() is a pure function, built directly from lib/provisional-figures.ts's
 * live exports — no file reads, no network, no client. Both the dry-run print path and the
 * --apply patch loop below call this SAME function, so the two paths cannot diverge (2026-10-07
 * correction, after a read-only Sanity query on the live dataset found two patched-in-theory
 * documents still holding their old values because an earlier pass had computed its plan ad
 * hoc rather than through one shared, independently-importable function).
 *
 * Idempotent, keyed on stable identity: every document this script addresses uses a literal
 * `ticketType-<slug>` id, never one derived from a mutable display name — matching
 * scripts/seed-ticketing.ts's own audited-correct convention.
 *
 * Required env (read directly from .env.local, ONLY inside main(), and ONLY when APPLY is
 * set — see buildMigrationPatches()'s pure, I/O-free shape below):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/migrate-conference-workshop-tickets.ts           (dry-run, default)
 *       or: node --import tsx/esm scripts/migrate-conference-workshop-tickets.ts --apply   (mutates — orchestrator-authorised only, after QA passes)
 */

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  RETIRED_CONFERENCE_SLUGS,
  RETIRED_SUNSET_COCKTAILS_SLUGS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
  type ProvisionalAdmissionProduct,
} from '../lib/provisional-figures';

// ---------------------------------------------------------------------------
// Flag — read FIRST, before any env var or Sanity client. This ordering is the entire safety
// property A10 proves at runtime, not just by static grep.
// ---------------------------------------------------------------------------

const APPLY = process.argv.includes('--apply');

// Brad's verbatim ticket news, 2026-10-07 — the one citation every RETIRED_CONFERENCE_SLUGS
// patch carries, since those four documents are not product-backed (they have no entry left
// in any of lib/provisional-figures.ts's live product arrays to read a citation from).
const RETIRED_CONFERENCE_SOURCE_CITATION =
  "Brad's ticket news, 2026-10-07 (verbatim), message 6: 'No early bird for Symposiums and " +
  "confernec' supersedes the earlier differential-price/joint-bundle design these four " +
  'documents backed. Retired, not deleted. See ' +
  '.agent/memory/scratch/brad-ticket-news-2026-10-07.md.';

// ---------------------------------------------------------------------------
// Plan — pure, I/O-free. No file reads, no network, no client. Computable (and printable)
// with zero environment configuration, which is what lets the default no-flag invocation
// succeed with no Sanity credentials at all.
// ---------------------------------------------------------------------------

/**
 * Every field a product-backed ticketType document patch sets, read directly from the
 * product's own entry in lib/provisional-figures.ts — never a second, hand-typed copy of any
 * of these values. Every optional field is coalesced to `null` (never left `undefined`) —
 * see CLAUDE.md "Firestore builders: coalesce optionals or strip undefined"; the same
 * discipline applies here even though this is a Sanity patch, not a Firestore write.
 */
function buildProductPatchFields(product: ProvisionalAdmissionProduct): Record<string, unknown> {
  return {
    price: product.price,
    capacity: product.capacity,
    releasedQuantity: product.releasedQuantity,
    earlyBirdCutoff: product.earlyBirdCutoff,
    regularPrice: product.regularPrice ?? null,
    capacityPool: product.capacityPool ?? null,
    headcountPerUnit: product.headcountPerUnit ?? 1,
    requiresDaySelection: product.requiresDaySelection,
    requiresAttendeeNames: product.requiresAttendeeNames,
    provisional: product.provisional,
    category: product.category,
    excludedDays: product.excludedDays ?? null,
    sourceCitation: product.sourceCitation ?? null,
  };
}

function findProduct(
  products: ProvisionalAdmissionProduct[],
  slug: string
): ProvisionalAdmissionProduct {
  const found = products.find((product) => product.slug === slug);
  if (!found) {
    throw new Error(`Expected '${slug}' in the given product array — check provisional-figures.ts`);
  }
  return found;
}

/**
 * Builds the full migration patch set, keyed by Sanity document `_id`. Pure — no I/O. Both
 * the dry-run print path and the --apply patch loop below call this SAME function (see the
 * call-site count A14 asserts), so the two paths cannot diverge.
 */
export function buildMigrationPatches(): Record<string, Record<string, unknown>> {
  const patches: Record<string, Record<string, unknown>> = {};

  // The six admission/conference products F1/F2's revision changed, each patched from its
  // OWN live entry in ADMISSION_PRODUCTS/CONFERENCE_PRODUCTS. The one genuinely new admission
  // product (not in this list) has no document yet, so nothing to patch for it — see the file
  // header.
  const PATCHED_ADMISSION_CONFERENCE_SLUGS = [
    'vip',
    'weekend-pass',
    'day-visitor',
    'early-bird',
    'saoc-symposium',
    'wosa-conference',
  ] as const;

  for (const slug of PATCHED_ADMISSION_CONFERENCE_SLUGS) {
    const product = findProduct([...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS], slug);
    patches[`ticketType-${product.slug}`] = buildProductPatchFields(product);
  }

  // Sunset Cocktails (Couple) — still patched to its own real figures (re-asserted, not
  // changed by message 6) AND retired, derived from RETIRED_SUNSET_COCKTAILS_SLUGS rather
  // than a hand-typed slug — team-lead's second-pass default (2026-10-07), flagged not a
  // resolution of whether this tier should exist at all.
  for (const slug of RETIRED_SUNSET_COCKTAILS_SLUGS) {
    const product = WORKSHOP_FIELD_TRIP_PRODUCTS.find((entry) => entry.slug === slug);
    const id = `ticketType-${slug}`;
    patches[id] = {
      ...(product ? buildProductPatchFields(product) : {}),
      active: false,
    };
  }

  // The four retired Conferences SKUs — active:false only, derived from the live
  // RETIRED_CONFERENCE_SLUGS constant, never a hand-typed duplicate of the four ids. Not
  // product-backed (no entry remains in any live product array), so no other field is set.
  for (const slug of RETIRED_CONFERENCE_SLUGS) {
    patches[`ticketType-${slug}`] = {
      active: false,
      sourceCitation: RETIRED_CONFERENCE_SOURCE_CITATION,
    };
  }

  return patches;
}

function describePatch(id: string, fields: Record<string, unknown>): string {
  return `${id}: would set ${JSON.stringify(fields)}`;
}

function printPlan(patches: Record<string, Record<string, unknown>>): void {
  console.log(
    'conference-workshop-tickets F3 migration — DRY RUN (no writes, no Sanity credentials required)'
  );
  console.log('  --apply was NOT passed. Nothing below has been applied to the dataset.');
  for (const [id, fields] of Object.entries(patches)) {
    console.log(`  ${describePatch(id, fields)}`);
  }
  console.log('Dry run complete — no documents were touched.');
}

// ---------------------------------------------------------------------------
// Env + client — read/constructed ONLY inside the APPLY branch, never at module scope and
// never on the default dry-run path.
// ---------------------------------------------------------------------------

async function readEnvLocalAndBuildClient() {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { createClient } = await import('@sanity/client');

  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const env: Record<string, string> = {};
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
    env[key] = value;
  }

  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_TOKEN;

  if (!projectId || !dataset || !token) {
    throw new Error(
      'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, ' +
        'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN'
    );
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    token,
    useCdn: false,
  });

  return { client, dataset, projectId };
}

async function runApply(): Promise<void> {
  const { client, dataset, projectId } = await readEnvLocalAndBuildClient();
  const patches = buildMigrationPatches();

  console.log(
    `Applying conference-workshop-tickets F3 migration to Sanity dataset "${dataset}" (project ${projectId})`
  );

  for (const [id, fields] of Object.entries(patches)) {
    await client.patch(id).set(fields).commit({ autoGenerateArrayKeys: false });
    console.log(`  ${id}: patched (applied)`);
  }

  console.log('Apply complete.');
}

async function main(): Promise<void> {
  if (APPLY) {
    await runApply();
    return;
  }
  printPlan(buildMigrationPatches());
}

// Guard against module-scope side effects: importing this file (e.g. so a contract check can
// exercise buildMigrationPatches() directly) must never print the dry-run banner or otherwise
// run main() — only direct execution does. Matches scripts/seed-ticketing.ts's own guard.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
