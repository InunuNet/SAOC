#!/usr/bin/env node
// The seed must be safe to re-run. scripts/seed-page-singletons.ts is not — it uses
// createOrReplace, which silently reverts every editor change on each run. That bug is the reason
// this mission writes a new script instead of extending it, and this check is what proves the new
// one does not repeat it.
//
// Three properties, proven against the real dataset:
//   1. Re-running changes no document revision (_rev is stable) — so the seed is a genuine no-op
//      once the content exists.
//   2. Re-running creates no duplicate documents.
//   3. Re-running does not revert an editor's change. This is the one that actually matters, and
//      it is proven by making a change, re-seeding, and checking the change survived.
//
// CLEANUP IS STRUCTURAL: baseline captured before any write, restore in a `finally`, no
// process.exit() inside the try. Exit 2 = RESIDUE ALERT.
//
// BROUGHT UNDER THE MUTATION GUARD — 2026-08-12, alongside QA findings F-1/F-2.
// -----------------------------------------------------------------------------
// This was the second mutating check in the contract and the only one that never took the lock.
// check-cms-round-trip's own header called that out and booked it rather than fixing it. Leaving
// it booked was wrong: the two checks write to the SAME document, so an unlocked A22 could move
// the revision under a running A36 and turn its revision-guarded restore into a hard refusal —
// with A36's sentinel still in the document and on the page. Three things were missing and all
// three are now here.
//
//   1. THE LOCK. Serialises this check against the other two writers.
//   2. A RECOGNISABLE SENTINEL. Its editor-edit marker used to be spelled EDITOR-EDIT-SENTINEL-…,
//      which no other check's poisoned-baseline test recognised — SENTINEL_PATTERN matches the
//      EXH-/SVI- namespaces only. So an abandoned run of THIS check left residue that every
//      defence in the contract was blind to. It now uses makeSentinel(), which puts it inside the
//      pattern every other check screens against.
//   3. POISONED-BASELINE REJECTION on `intro`, for the same reason it exists everywhere else: a
//      baseline that is already a sentinel must never be captured and restored as if it were real
//      content.
//
// The residue exit code is also raised AFTER the lock has been released. Setting process.exitCode
// inside the cleanup `finally` was dead code — runCheck ends with process.exit(0|1), which
// overrides it, so every residue alert here exited 1 and read as an ordinary failure. Same bug,
// same fix, as documented in check-cms-round-trip.mjs.

import { execFileSync } from 'node:child_process';

import { runCheck, getSanityClient, INFO_DOC_ID } from './_shared.mjs';
import {
  EXIT_CODE_RESIDUE_ALERT,
  PoisonedBaselineError,
  assertNotPoisoned,
  makeSentinel,
  withDatasetLock,
} from './_mutation-guard.mjs';

const SEED_CMD = ['pnpm', ['seed:exhibitor']];

function runSeed(label) {
  console.log(`--- running the seed (${label}) ---`);
  execFileSync(SEED_CMD[0], SEED_CMD[1], { stdio: 'inherit' });
}

await runCheck('check-seed-idempotent', async (r) => {
  const client = getSanityClient({ withToken: true });
  const residue = await withDatasetLock('check-seed-idempotent', () => proveIdempotent(r, client));
  if (residue) {
    console.error(`Exiting ${EXIT_CODE_RESIDUE_ALERT} (RESIDUE ALERT), not 1.`);
    process.exit(EXIT_CODE_RESIDUE_ALERT);
  }
});

// Returns true if residue was left behind — the caller turns that into exit 2, once the lock has
// already been released.
async function proveIdempotent(r, client) {
  let residueDetected = false;

  async function snapshot() {
    const info = await client.fetch('*[_id == $id][0]{ _id, _rev, intro }', { id: INFO_DOC_ID });
    const steps = await client.fetch(
      '*[_type == "showExhibitorStep"] | order(_id asc){ _id, _rev }',
    );
    const infoCount = await client.fetch('count(*[_type == "showExhibitorInfo"])');
    return { info, steps, infoCount };
  }

  // The document must already exist — the seed is expected to have been run once by @dev.
  const before = await snapshot();
  if (!before.info) {
    r.fail(
      `${INFO_DOC_ID} exists before the idempotence check`,
      'run `pnpm seed:exhibitor` once first. A check that seeds from scratch would prove creation, not idempotence.',
    );
    return false;
  }

  // Refuse to run against residue, and refuse BEFORE re-running the seed: the seed uses
  // setIfMissing, so a sentinel sitting in `intro` is a present value the seed will happily leave
  // in place, and capturing it as a baseline would make it permanent.
  try {
    assertNotPoisoned(`${INFO_DOC_ID}.intro`, before.info.intro);
  } catch (err) {
    if (!(err instanceof PoisonedBaselineError)) throw err;
    console.error('\n' + '='.repeat(78));
    console.error('RESIDUE ALERT — refusing to run against a poisoned dataset');
    console.error(err.message);
    console.error('='.repeat(78) + '\n');
    r.fail(
      'the dataset holds no check residue before the idempotence run',
      'a sentinel from an earlier run is still in the document (and on the live page)',
    );
    return true;
  }

  // --- 1 & 2: a re-run moves nothing ---
  runSeed('re-run over existing content');
  const after = await snapshot();

  r.check(
    after.info._rev === before.info._rev,
    `${INFO_DOC_ID} revision is unchanged by a re-run`,
    `${before.info._rev} -> ${after.info._rev}. A moving revision means the seed is writing on ` +
      'every run — usually a non-deterministic portable-text _key, or .set() where setIfMissing belongs.',
  );
  r.check(
    after.infoCount === 1,
    `exactly one showExhibitorInfo document exists (got ${after.infoCount})`,
    'a second document means the seed is not using a fixed _id, and the [0] in the GROQ query ' +
      'will pick between them unpredictably',
  );
  r.check(
    after.steps.length === before.steps.length,
    `no duplicate step documents (${before.steps.length} -> ${after.steps.length})`,
  );
  const movedSteps = after.steps.filter((s, i) => s._rev !== before.steps[i]?._rev);
  r.check(
    movedSteps.length === 0,
    'no step document revision moved on a re-run',
    `moved: ${JSON.stringify(movedSteps.map((s) => s._id))}`,
  );

  // --- 3: an editor's change survives a re-seed ---
  const baselineIntro = before.info.intro;
  if (typeof baselineIntro !== 'string' || baselineIntro.trim() === '') {
    r.fail('intro holds real content to edit', `got ${JSON.stringify(baselineIntro)}`);
    return false;
  }

  // makeSentinel() and not a bespoke string: this must land inside SENTINEL_PATTERN so that if
  // this run is killed before its restore, the NEXT run of any mutating check in this contract
  // recognises what it finds and refuses, instead of adopting it as a baseline.
  const editorEdit = `${makeSentinel('EDITOREDIT')} — this text stands in for a change the show committee made in Studio.`;
  let mutated = false;

  try {
    await client.patch(INFO_DOC_ID).set({ intro: editorEdit }).commit();
    mutated = true;

    runSeed('re-run over an editor change');

    const afterEdit = await client.fetch('*[_id == $id][0].intro', { id: INFO_DOC_ID });
    r.check(
      afterEdit === editorEdit,
      "a re-run does NOT revert an editor's change",
      `intro is now ${JSON.stringify(String(afterEdit).slice(0, 80))} — the seed overwrote a Studio ` +
        'edit. This is exactly the seed-page-singletons.ts createOrReplace bug, reintroduced.',
    );
  } finally {
    if (mutated) {
      console.log('--- Cleanup: restoring the captured intro (always attempted) ---');
      try {
        await client.patch(INFO_DOC_ID).set({ intro: baselineIntro }).commit();
        const restored = await client.fetch('*[_id == $id][0].intro', { id: INFO_DOC_ID });
        if (restored !== baselineIntro) {
          console.error(
            '\n' + '='.repeat(78) +
              `\nRESIDUE ALERT — ${INFO_DOC_ID}.intro\n` +
              `expected the captured baseline, got: ${JSON.stringify(String(restored).slice(0, 120))}\n` +
              `baseline to restore by hand: ${JSON.stringify(baselineIntro)}\n` +
              '='.repeat(78) + '\n',
          );
          r.fail(
            'cleanup restored the captured intro',
            'residue was left behind — see the RESIDUE ALERT above',
          );
          residueDetected = true;
        } else {
          console.log('Cleanup verified: intro restored to its captured baseline.');
        }
      } catch (err) {
        console.error(
          '\n' + '='.repeat(78) +
            `\nRESIDUE ALERT — cleanup threw for ${INFO_DOC_ID}.intro\n` +
            `baseline to restore by hand: ${JSON.stringify(baselineIntro)}\n` +
            `error: ${err.stack ?? err.message}\n` +
            '='.repeat(78) + '\n',
        );
        r.fail('cleanup completed without throwing', `cleanup threw: ${err.message}`);
        residueDetected = true;
      }
    }
  }

  return residueDetected;
}
