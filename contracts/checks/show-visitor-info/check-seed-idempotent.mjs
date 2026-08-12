#!/usr/bin/env node
// The seeding rule, proven rather than asserted by grep: running the seed script a second
// time must change nothing.
//
// scripts/seed-page-singletons.ts has the exact bug this guards against — it force-replaces
// documents with hardcoded literals, so re-running it silently reverts whatever the secretary
// edited in Studio. A grep for `createOrReplace` catches the obvious form of that bug; it does
// not catch `.set()` on a field that already has a value, or a `_key` regenerated on every run.
// So this check captures every affected document's `_rev`, runs the real seed script, and
// requires every `_rev` to be unchanged.
//
// It also proves the script does not revert an editor: it writes a distinctive value into a
// seeded field first, runs the seed, and requires that value to survive. Baseline is captured
// before any write and restored in a `finally`.
//
// MUTATION TARGET IS `cloakroom`, NOT `parking`. It used to be parking — the same field
// check-cms-round-trip mutates — so two assertions in one contract could collide with each
// other, and on 2026-08-11 that class of interleaving left a sentinel rendering on a live page.
// Distinct targets plus the shared lock in _mutation-guard.mjs make that impossible twice over.
// cloakroom, like parking, is rendered on exactly one page and read by nothing else.

import { execFileSync } from 'node:child_process';

import { runCheck, getSanityClient } from './_shared.mjs';
import {
  withDatasetLock,
  assertUsableBaseline,
  commitAndCaptureRev,
  restoreGuarded,
  verifyDatasetRestored,
  residueAlert,
} from './_mutation-guard.mjs';

const SEED = 'scripts/seed-show-visitor-info.ts';
const FIELD = 'cloakroom';
const DOC_ID = 'showVisitorInfo';
const REV_QUERY =
  '*[_id == "showVisitorInfo" || _id == "nationalShow" || _type == "showFaq"]{ _id, _rev } | order(_id asc)';

function runSeed() {
  return execFileSync('node', ['--import', 'tsx/esm', SEED], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

await runCheck('check-seed-idempotent', async (r) => {
  const client = getSanityClient({ withToken: true });

  await withDatasetLock('check-seed-idempotent', async () => {
  const before = await client.fetch(REV_QUERY);
  r.check(Array.isArray(before) && before.length > 0, 'seeded documents exist before the re-run');
  if (!before?.length) return;

  console.log(`Captured ${before.length} document revision(s).`);
  runSeed();
  const after = await client.fetch(REV_QUERY);

  const beforeMap = new Map(before.map((d) => [d._id, d._rev]));
  const changed = (after ?? []).filter((d) => beforeMap.has(d._id) && beforeMap.get(d._id) !== d._rev);
  r.check(
    changed.length === 0,
    'a second seed run changes no existing document revision',
    `revisions changed for: ${JSON.stringify(changed.map((d) => d._id))}`,
  );

  const added = (after ?? []).filter((d) => !beforeMap.has(d._id));
  r.check(added.length === 0, 'a second seed run creates no duplicate documents', JSON.stringify(added.map((d) => d._id)));

  // The editor-preservation test. cloakroom is rendered on one page only, so a failed restore
  // has the smallest blast radius — and it is a DIFFERENT field from the one
  // check-cms-round-trip writes, so the two can never fight over the same value.
  const baseline = await client.fetch(`*[_id == $id][0].${FIELD}`, { id: DOC_ID });
  assertUsableBaseline(`${DOC_ID}.${FIELD}`, baseline);

  // Sentinel-shaped so that if this one ever escapes, _mutation-guard's poisoned-baseline
  // detector recognises it in every other check.
  const editorValue = `SVI-EDITORSURVIVES-SENTINEL-${Date.now()}`;
  let mutated = false;
  let sentinelRev = null;
  try {
    sentinelRev = await commitAndCaptureRev(client, DOC_ID, { [FIELD]: editorValue });
    mutated = true;
    runSeed();
    const survived = await client.fetch(`*[_id == $id][0].${FIELD}`, { id: DOC_ID });
    r.check(
      survived === editorValue,
      'a re-run does not revert an editor change (create-if-absent, never createOrReplace)',
      `field now holds ${JSON.stringify(survived)}`,
    );
  } finally {
    if (mutated) {
      try {
        // The seed itself may legitimately have bumped the revision, so re-read it rather than
        // assuming ours is still current — but still guard, so a THIRD party's write fails loudly.
        const currentRev = await client.fetch('*[_id == $id][0]._rev', { id: DOC_ID });
        await restoreGuarded(client, DOC_ID, { [FIELD]: baseline }, currentRev ?? sentinelRev);
        const verified = await verifyDatasetRestored(client, DOC_ID, { [FIELD]: baseline });
        if (!verified.ok) {
          residueAlert([
            `field: ${DOC_ID}.${FIELD}`,
            `sentinel: ${editorValue}`,
            `baseline to restore: ${JSON.stringify(baseline)}`,
          ]);
        } else {
          console.log(`Cleanup verified: ${DOC_ID}.${FIELD} restored to its baseline.`);
        }
      } catch (err) {
        residueAlert([
          `field: ${DOC_ID}.${FIELD}`,
          `sentinel: ${editorValue}`,
          `restore threw: ${err.message}`,
          `baseline to restore: ${JSON.stringify(baseline)}`,
        ]);
      }
    }
  }
  });
});
