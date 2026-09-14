/**
 * F2 (ticketing-complete, M1) — one-time migration that lands F2's Sanity ticketType
 * corrections: backfills the 5 admission SKUs' `category` field, retires (`active: false`,
 * never deletes/renames) the two invented Field Trip bundle SKUs plus
 * `early-bird-weekend-pass`, patches the two Sunset Cocktails SKUs to their real cited
 * prices, and seeds the one new flat-rate Field Trip product. See
 * .agent/memory/project/specs/ticketing-complete/goldens/f2-README.md for the full decision
 * record and docs/ticketing-complete-f2-open-decisions.md for what this migration
 * deliberately does NOT resolve.
 *
 * THE HARD RULE — there is only ONE Sanity dataset ('production'), read by both local dev
 * and the deployed beta site. A write here is a deploy by side effect. So:
 *
 *   - Default invocation (no flags at all) prints the plan and writes NOTHING. It does not
 *     read any Sanity env var and does not construct a Sanity client — the --apply check
 *     happens FIRST, before any of that, so a plain accidental invocation can never touch
 *     the live dataset even if credentials happen to be present in the shell.
 *   - `--apply` is the ONLY flag that mutates. There is no `--dry-run` opt-out to forget —
 *     unlike the unsafe precedent (`fix-vip-and-weekend-pass-pricing.ts:79` and five other
 *     scripts swept 2026-09-08, see docs/ticketing-complete-f2-open-decisions.md), whose
 *     default, no-flag invocation MUTATES.
 *   - `--verify` reads live state back (query only, `client.fetch`, never `.patch`/
 *     `.commit`) to confirm a prior real `--apply` run landed correctly.
 *   - This mission never invokes `--apply`. That step is explicitly Brad's, in the morning,
 *     after he reads F8's review.
 *
 * Idempotent, keyed on stable identity: every document this script addresses uses a literal
 * `ticketType-<slug>` id, never one derived from a mutable display name — matching
 * scripts/seed-ticketing.ts's own audited-correct convention.
 *
 * Required env (read directly from .env.local, ONLY inside main(), and ONLY when APPLY or
 * VERIFY is set — see buildMigrationPlan()'s pure, I/O-free shape below):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/migrate-f2-ticket-taxonomy.ts           (dry-run, default)
 *       or: node --import tsx/esm scripts/migrate-f2-ticket-taxonomy.ts --apply   (mutates — NOT run by this mission)
 *       or: node --import tsx/esm scripts/migrate-f2-ticket-taxonomy.ts --verify  (read-only check after a real --apply)
 */

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  RETIRED_FIELD_TRIP_SLUGS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
  type ProvisionalAdmissionProduct,
} from '../lib/provisional-figures';
// F2 (ticketing-complete, M1) defect repair, Codex GPT-5.5 pass: this migration's `create`
// op used to hand-roll its own ticketType document object literal, and that hand-rolled copy
// had already drifted from the real builder — it omitted `slug` and `show` entirely, so the
// created document would never resolve via ticketTypeBySlugQuery and could never be bought.
// Building through the SAME exported, pure `buildTicketTypeDoc()` the real seeder uses (and
// resolving the show id via the SAME exported `fetchActiveShowId()`, not a second
// independently-written resolution path) is what CLAUDE.md's "one source of truth per
// builder" posture requires — see contracts/checks/ticketing-complete-f2/
// check-migration-create-doc-complete.mjs for the round-trip proof.
import { buildTicketTypeDoc, fetchActiveShowId } from './seed-ticketing';

// ---------------------------------------------------------------------------
// Flags — read FIRST, before any env var or Sanity client. This ordering is the entire
// safety property A3/A4 in contract-f2.yaml prove at runtime, not just by static grep.
// ---------------------------------------------------------------------------

const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');

const EARLY_BIRD_WEEKEND_PASS_ID = 'ticketType-early-bird-weekend-pass';

// The real active show id is only resolvable over the network (fetchActiveShowId() needs a
// live Sanity client) — but buildMigrationPlan() must stay callable with zero I/O so the
// default dry-run path never needs credentials. This sentinel stands in for the real id on
// the print-only path; runApply()/runVerify() always pass the real, freshly-fetched id.
const SHOW_ID_PLACEHOLDER_FOR_DRY_RUN = 'ACTIVE_SHOW_ID_RESOLVED_AT_APPLY_TIME';

// ---------------------------------------------------------------------------
// Plan — pure, dependency-free (given a showId). No file reads, no network, no client.
// Computable (and printable) with zero environment configuration when showId is the dry-run
// sentinel above, which is what lets the default no-flag invocation succeed with no Sanity
// credentials at all.
// ---------------------------------------------------------------------------

export interface CategoryPatchOp {
  kind: 'category-patch';
  id: string;
  category: string;
}

export interface RetireOp {
  kind: 'retire';
  id: string;
  reason: string;
}

export interface PricePatchOp {
  kind: 'price-patch';
  id: string;
  // Every field this op sets, already fully coalesced (no undefined values) — a generic bag
  // rather than a fixed {price, sourceCitation} shape, because F2's VIP ruling (Brad,
  // 2026-09-08) needs to patch price/regularPrice/earlyBirdCutoff/provisional/sourceCitation
  // together in one call, while the Sunset Cocktails patches only need price/sourceCitation.
  fields: Record<string, unknown>;
}

export interface CreateOp {
  kind: 'create';
  id: string;
  doc: Record<string, unknown> & { _id: string; _type: string };
}

export type MigrationOp = CategoryPatchOp | RetireOp | PricePatchOp | CreateOp;

function findWorkshopFieldTripProduct(slug: string): ProvisionalAdmissionProduct {
  const found = WORKSHOP_FIELD_TRIP_PRODUCTS.find((product) => product.slug === slug);
  if (!found) {
    throw new Error(`Expected '${slug}' in WORKSHOP_FIELD_TRIP_PRODUCTS — check provisional-figures.ts`);
  }
  return found;
}

/**
 * Builds the full migration plan. Pure — no I/O given `showId` (I/O only happens in the
 * caller, resolving the real show id via fetchActiveShowId() before calling this). Exported
 * so it can be unit-tested without touching the network, and so the CLI's print/apply paths
 * share exactly one source of truth for "what this migration does."
 *
 * @param showId The active show's Sanity document id, used to build the `show` reference on
 *   the new Field Trip document exactly like buildTicketTypeDoc() does for every other
 *   ticketType. Pass SHOW_ID_PLACEHOLDER_FOR_DRY_RUN on the print-only path (no network); pass
 *   the real, freshly-fetched id from runApply()/runVerify().
 */
export function buildMigrationPlan(showId: string): MigrationOp[] {
  const ops: MigrationOp[] = [];

  // 1. Backfill category on ADMISSION_PRODUCTS's 4 documents (setIfMissing semantics at
  //    apply time — never overwrites a value an editor has since set by hand).
  //
  //    CONFIRMED, not assumed (2026-09-08, scripts/f2-diagnose-category-field.ts,
  //    READ-ONLY): the original audit that flagged these as "category: null" came from a
  //    GROQ projection, which returns null for BOTH "field absent" and "field present
  //    holding null" — those two cases are indistinguishable in that output, and
  //    setIfMissing only sets a field that is genuinely ABSENT; against a present-and-null
  //    field it is a silent no-op that still reports success (this project's own audited
  //    "VIP pricing fix was never applied" failure mode, in a different shape). Checked
  //    directly against the live dataset via the raw document JSON (Object.hasOwnProperty),
  //    cross-referenced with GROQ's defined() — both agree `category` is genuinely absent
  //    on all 4 documents, not present-and-null. setIfMissing is correct and the more
  //    conservative choice; kept as-is.
  for (const product of ADMISSION_PRODUCTS) {
    ops.push({
      kind: 'category-patch',
      id: `ticketType-${product.slug}`,
      category: product.category,
    });
  }

  // 2. Retire early-bird-weekend-pass — has 1 REAL Firestore position. Retire only, never
  //    delete, never rename its slug/_id.
  ops.push({
    kind: 'retire',
    id: EARLY_BIRD_WEEKEND_PASS_ID,
    reason:
      'has 1 real Firestore position against this slug — a real booking. Retire only; ' +
      'never delete or rename.',
  });

  // 3. Retire the two invented Field Trip bundle-split SKUs — 0 Firestore positions,
  //    superseded by the single flat-rate product below. Still retire, never delete.
  for (const slug of RETIRED_FIELD_TRIP_SLUGS) {
    ops.push({
      kind: 'retire',
      id: `ticketType-${slug}`,
      reason: 'invented bundle-split figure superseded by the single flat-rate Field Trip product',
    });
  }

  // 4. Patch Sunset Cocktails Single/Couple to their real cited prices (see
  //    docs/ticketing-complete-f2-open-decisions.md — listed as a CHANGED figure, not
  //    silently applied).
  for (const slug of ['sunset-cocktails-single', 'sunset-cocktails-couple']) {
    const product = findWorkshopFieldTripProduct(slug);
    ops.push({
      kind: 'price-patch',
      id: `ticketType-${product.slug}`,
      fields: {
        price: product.price,
        sourceCitation: product.sourceCitation ?? null,
      },
    });
  }

  // 4b. Patch VIP to Brad's ruling (2026-09-08): R625 regular, R500 early-bird (the standard
  //     20% discount, computed — see check-vip-computed-early-bird-price.mjs), settled (not
  //     provisional-pending-council). Reads every value from ADMISSION_PRODUCTS's own VIP
  //     entry — the single source of truth — rather than re-typing these numbers here.
  const vip = ADMISSION_PRODUCTS.find((product) => product.slug === 'vip');
  if (!vip) {
    throw new Error("Expected 'vip' in ADMISSION_PRODUCTS — check provisional-figures.ts");
  }
  ops.push({
    kind: 'price-patch',
    id: `ticketType-${vip.slug}`,
    fields: {
      price: vip.price,
      regularPrice: vip.regularPrice ?? null,
      earlyBirdCutoff: vip.earlyBirdCutoff,
      provisional: vip.provisional,
      sourceCitation: vip.sourceCitation ?? null,
    },
  });

  // 5. Seed the one new flat-rate Field Trip product — built through the SAME
  //    buildTicketTypeDoc() the real seeder uses, not a second hand-rolled object literal
  //    (that hand-rolled copy is exactly what Codex's review caught omitting `slug` and
  //    `show`, making the created document unresolvable and unbuyable). `order` matches the
  //    index this product would carry in scripts/seed-ticketing.ts's own
  //    [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS]
  //    concatenation, so a fresh full reseed and this one-off migration agree on ordering.
  const fieldTrip = findWorkshopFieldTripProduct('field-trip');
  const fieldTripCombinedIndex =
    ADMISSION_PRODUCTS.length +
    CONFERENCE_PRODUCTS.length +
    WORKSHOP_FIELD_TRIP_PRODUCTS.findIndex((product) => product.slug === 'field-trip');
  ops.push({
    kind: 'create',
    id: `ticketType-${fieldTrip.slug}`,
    doc: buildTicketTypeDoc(fieldTrip, fieldTripCombinedIndex, showId),
  });

  return ops;
}

function describeOp(op: MigrationOp): string {
  switch (op.kind) {
    case 'category-patch':
      return `${op.id}: would setIfMissing category = '${op.category}'`;
    case 'retire':
      return `${op.id}: would set active = false (${op.reason})`;
    case 'price-patch':
      return `${op.id}: would set ${JSON.stringify(op.fields)}`;
    case 'create':
      return `${op.id}: would createIfNotExists (name="${op.doc.name}", price=${op.doc.price})`;
    default: {
      const exhaustive: never = op;
      throw new Error(`Unhandled op kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function printPlan(plan: MigrationOp[]): void {
  console.log('F2 ticket taxonomy migration — DRY RUN (no writes, no Sanity credentials required)');
  console.log('  --apply was NOT passed. Nothing below has been applied to the dataset.');
  for (const op of plan) {
    console.log(`  ${describeOp(op)}`);
  }
  console.log('Dry run complete — no documents were touched.');
}

// ---------------------------------------------------------------------------
// Env + client — read/constructed ONLY inside the APPLY/VERIFY branches, never at module
// scope and never on the default dry-run path.
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
  // Same resolution function the real seeder uses (scripts/seed-ticketing.ts's
  // fetchActiveShowId), not a second independently-written lookup — see the import comment
  // at the top of this file.
  const showId = await fetchActiveShowId(client);
  const plan = buildMigrationPlan(showId);

  console.log(
    `Applying F2 ticket taxonomy migration to Sanity dataset "${dataset}" (project ${projectId})`
  );

  for (const op of plan) {
    switch (op.kind) {
      case 'category-patch':
        await client.patch(op.id).setIfMissing({ category: op.category }).commit({
          autoGenerateArrayKeys: false,
        });
        console.log(`  ${op.id}: patched (applied)`);
        break;
      case 'retire':
        await client.patch(op.id).set({ active: false }).commit({ autoGenerateArrayKeys: false });
        console.log(`  ${op.id}: patched (applied)`);
        break;
      case 'price-patch':
        await client.patch(op.id).set(op.fields).commit({ autoGenerateArrayKeys: false });
        console.log(`  ${op.id}: patched (applied)`);
        break;
      case 'create':
        await client.createIfNotExists(op.doc);
        console.log(`  ${op.id}: created (applied)`);
        break;
      default: {
        const exhaustive: never = op;
        throw new Error(`Unhandled op kind: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  console.log('Apply complete.');
}

async function runVerify(): Promise<void> {
  const { client, dataset } = await readEnvLocalAndBuildClient();
  const showId = await fetchActiveShowId(client);
  const plan = buildMigrationPlan(showId);

  console.log(`Verifying F2 ticket taxonomy migration against dataset "${dataset}"`);

  let allPassed = true;
  for (const op of plan) {
    const doc = await client.fetch<Record<string, unknown> | null>(`*[_id == $id][0]`, {
      id: op.id,
    });

    // Every branch checks the ACTUAL resulting field value against what the plan intended
    // — never merely "the document exists" or "the call didn't throw". A verify that would
    // pass against an untouched dataset proves nothing (see the setIfMissing/present-null
    // hazard this function guards against — a silent no-op must show up here as MISMATCH).
    let pass = false;
    if (op.kind === 'category-patch') pass = doc?.category === op.category;
    else if (op.kind === 'retire') pass = doc?.active === false;
    else if (op.kind === 'price-patch') {
      pass = doc != null && Object.entries(op.fields).every(([key, value]) => doc[key] === value);
    } else if (op.kind === 'create') {
      const docSlug = (doc?.slug as { current?: string } | undefined)?.current;
      const docShowRef = (doc?.show as { _ref?: string } | undefined)?._ref;
      const expectedSlug = (op.doc.slug as { current?: string } | undefined)?.current;
      const expectedShowRef = (op.doc.show as { _ref?: string } | undefined)?._ref;
      pass =
        doc != null &&
        doc.price === op.doc.price &&
        doc.category === op.doc.category &&
        doc.active === op.doc.active &&
        docSlug === expectedSlug &&
        docShowRef === expectedShowRef;
    }

    console.log(`  ${op.id}: ${pass ? 'OK' : 'MISMATCH'}`);
    if (!pass) allPassed = false;
  }

  if (!allPassed) {
    console.error('Verification FAILED — one or more documents do not match the plan.');
    process.exitCode = 1;
    return;
  }
  console.log('Verification passed — all documents match the plan.');
}

async function main(): Promise<void> {
  if (APPLY) {
    await runApply();
    return;
  }
  if (VERIFY) {
    await runVerify();
    return;
  }
  printPlan(buildMigrationPlan(SHOW_ID_PLACEHOLDER_FOR_DRY_RUN));
}

// Guard against module-scope side effects: importing this file (e.g. so a contract check can
// exercise buildMigrationPlan() directly) must never print the dry-run banner or otherwise
// run main() — only direct execution does. Matches scripts/seed-ticketing.ts's own guard.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
