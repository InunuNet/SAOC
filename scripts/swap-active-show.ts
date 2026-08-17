/**
 * Fictional Test Show — thin wrapper around the GENERIC planActiveShowSwap()
 * (lib/fictional-test-show-active-swap-plan.ts). This is the one script a human runs twice
 * around an F12/F14-style live purchase test against the fictional show: once to make the
 * fictional show the sole active show, once afterward to restore show-19-2027. See
 * contracts/golden/fictional-test-show/README.md "The one human step this design cannot
 * avoid, and why".
 *
 * Reads all `show` documents, calls planActiveShowSwap(shows, targetShowId) where
 * targetShowId is a REQUIRED CLI positional argument — no default, so a bare invocation
 * cannot accidentally swap anything — prints the plan, and only applies it (patching every
 * planned `deactivate` id's `active` to false and the `activate` id's `active` to true, in
 * that order, each as its own Sanity patch() call) behind --apply. Dry-run by default.
 * Refuses to apply a `safe: false` plan under any flag.
 *
 * NOT gated by any assertion — planActiveShowSwap()'s safety invariants are what A9 gates,
 * not this script's live Sanity writes.
 *
 * Mirrors scripts/seed-demo-ticket-type.ts's env-loading shape (reads .env.local directly, a
 * real @sanity/client).
 *
 * Required env (read directly from .env.local):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/swap-active-show.ts <targetShowId>          (dry-run, default)
 *       or: node --import tsx/esm scripts/swap-active-show.ts <targetShowId> --apply  (mutates)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import { planActiveShowSwap, type ShowActivationRecord } from '../lib/fictional-test-show-active-swap-plan';

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

// Dry-run is the DEFAULT. Only a literal --apply in argv mutates.
const APPLY = process.argv.includes('--apply');

// Required CLI positional — the first non-flag argv entry. No default: an operator must name
// the target explicitly, so a bare invocation cannot accidentally swap anything. A missing
// positional refuses loudly with a usage line and a non-zero exit, before the planner (or any
// Sanity client call) is ever reached.
const targetShowIdArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

if (!targetShowIdArg) {
  console.error(
    'Usage: node --import tsx/esm scripts/swap-active-show.ts <targetShowId> [--apply]\n' +
      'Missing required positional argument <targetShowId> — refusing to guess a target.'
  );
  process.exit(1);
}

// Re-bound to a definitely-string const — TS's control-flow narrowing above does not persist
// into main()'s nested closure, and this is clearer than a non-null assertion at the call site.
const targetShowId: string = targetShowIdArg;

async function fetchShows(): Promise<ShowActivationRecord[]> {
  return client.fetch<ShowActivationRecord[]>(`*[_type == "show"]{ _id, active }`);
}

async function main(): Promise<void> {
  console.log(
    `Planning active-show swap to '${targetShowId}' in Sanity dataset "${dataset}" ` +
      `(project ${projectId})` + (APPLY ? ' [--apply — WILL WRITE]' : ' [DRY RUN — no writes]')
  );

  const shows = await fetchShows();
  const plan = planActiveShowSwap(shows, targetShowId);

  if (!plan.safe) {
    console.error(`Refusing: ${plan.reason}`);
    process.exit(1);
  }

  console.log(`  would deactivate: ${JSON.stringify(plan.deactivate)}`);
  console.log(`  would activate: ${plan.activate}`);

  if (!APPLY) {
    console.log('\nDry-run only — nothing was written. Re-run with --apply to apply the plan above.');
    return;
  }

  // Each id is its own patch() call — Sanity's API offers no single multi-document
  // transaction for this. Deactivate first, then activate, matching the plan's own order.
  for (const id of plan.deactivate) {
    await client.patch(id).set({ active: false }).commit();
    console.log(`  deactivated ${id}.`);
  }
  await client.patch(plan.activate).set({ active: true }).commit();
  console.log(`  activated ${plan.activate}.`);
}

main().catch((err: unknown) => {
  console.error('Swap failed:', err);
  process.exit(1);
});
