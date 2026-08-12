#!/usr/bin/env node
// THE DEADLINE-CHANGE TEST — the exhibitor stream's equivalent of the sibling's venue-change test.
//
// The claim being proven is the one the show committee actually cares about: **when the committee
// sets the real entry deadline in Studio, it reaches the page, with no developer involved.** A
// page that merely displays matching text today proves nothing about that. So this check writes a
// sentinel into the dataset and watches for it on the rendered page, two-sided — the new value
// must appear AND the old one must disappear.
//
// Phase 2 proves the fail-closed rule behaviourally: a garbage status value must still render a
// marker. Fail-open here would mean a block with a typo in its status reads as settled SAOC
// policy, which is the precise harm this mission exists to prevent.
//
// WHAT IT MUTATES, AND WHY THOSE FIELDS
//   - showExhibitorInfo.keyDates  — rendered on exactly one page, read by nothing else.
//   - showExhibitorInfo.confirmations.sales — likewise, and 'sales' is the block with the fewest
//     downstream cross-links, so a failed restore has the smallest blast radius.
// It does NOT touch nationalShow: that document is show identity, is read by several pages, and
// contracts/checks/cms-loop-f3-national-show already owns mutating it.
//
// The only other mutating check in this contract is A22 (check-seed-idempotent), and it writes
// showExhibitorInfo.intro — a disjoint field, so the two cannot corrupt each other's baselines the
// way the sibling contract's two checks did. They do share the DOCUMENT, so a concurrent A22 write
// moves this document's revision; the ifRevisionID guards below turn that into a loud failure
// rather than a silent overwrite. Serialising the two properly needs A22 to take the same lock,
// which is a change to another assertion's script and is booked for the orchestrator rather than
// made here.
//
// CLEANUP IS STRUCTURAL: baselines are captured before any write, the restore runs in a `finally`,
// and nothing inside the try calls process.exit() — process.exit() does not unwind the stack, so a
// bare exit inside the try would silently skip the restore. That is a real incident this project
// has already had; see contracts/checks/f6-prove-cms-loop/_shared.mjs.
//
// CLEANUP IS ALSO CONCURRENT-SAFE, which structural cleanup alone is not. Two incidents on
// 2026-08-11 proved that: the sibling contract's round-trip check had two runs interleave and
// restore each other's sentinels, and THIS check had a run abandoned mid-flight, leaving
// EXH-DEADLINE-SENTINEL-1786482650802 rendering on the live exhibitor page with no process left to
// clean it up. In both cases the next run would have captured the sentinel as its baseline and
// restored it, because the only baseline validation was "is a non-empty string / an object".
// See _mutation-guard.mjs for the three defences now applied here: poisoned-baseline rejection, an
// exclusive lock, and revision-guarded writes.
//
// Exit codes: 0 = proven and cleanup verified. 1 = ordinary failure.
// 2 = RESIDUE ALERT — a mutation landed but the restore could not be verified, OR the dataset was
// already holding residue when this check started. Treat either as a live content incident, not as
// "the feature isn't wired yet".

import {
  runCheck,
  fetchPage,
  getSanityClient,
  loadEnvOrFail,
  callRevalidate,
  textContains,
  INFO_DOC_ID,
  PATHS,
} from './_shared.mjs';
import {
  EXIT_CODE_RESIDUE_ALERT,
  PoisonedBaselineError,
  assertNotPoisoned,
  commitAndCaptureRev,
  isRevisionConflict,
  makeSentinel,
  withDatasetLock,
} from './_mutation-guard.mjs';

// 180s was too tight. Propagation is bounded by the Sanity CDN, not by /api/revalidate —
// sanity/lib/fetch.ts sets useCdn:true — and QA measured 64s, 72s and ~96s under concurrent load.
// A timeout that trips on a slow CDN reports "the CMS loop is broken" when the CMS loop is fine,
// and worse, trips it while holding a sentinel in the dataset.
const POLL_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 10_000;

async function poll(predicate, label) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    attempt += 1;
    const result = await predicate();
    console.log(
      `  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s): ${JSON.stringify(result)}`,
    );
    if (result.ok) return { ok: true, attempts: attempt };
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}

await runCheck('check-cms-round-trip', async (r) => {
  const secret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
  const client = getSanityClient({ withToken: true });

  const residue = await withDatasetLock('check-cms-round-trip', () => roundTrip(r, client, secret));

  // The residue exit code has to be raised HERE, not in the cleanup `finally`. Setting
  // process.exitCode inside the finally was dead code: runCheck ends with process.exit(0|1), which
  // overrides it, so every residue alert exited 1 and read as an ordinary failure. Raising it
  // after withDatasetLock has returned means the lock's own finally has already released the lock,
  // so this exit unwinds nothing.
  // Each residue site records its own reporter failure, so the FAIL line names the actual
  // condition; this only escalates the exit code.
  if (residue) {
    console.error(`Exiting ${EXIT_CODE_RESIDUE_ALERT} (RESIDUE ALERT), not 1.`);
    process.exit(EXIT_CODE_RESIDUE_ALERT);
  }
});

// Returns true if residue was left behind — the caller turns that into exit 2.
async function roundTrip(r, client, secret) {
  let residueDetected = false;
  // The baseline is captured INSIDE the lock. Capturing it outside would let another mutating
  // check write between the read and the lock acquisition, which is the whole failure mode.
  const baselineDoc = await client.fetch('*[_id == $id][0]{ keyDates, confirmations, _rev }', {
    id: INFO_DOC_ID,
  });

  const baselineDates = baselineDoc?.keyDates;
  const baselineConfirmations = baselineDoc?.confirmations;
  let currentRev = baselineDoc?._rev;

  // DEFENCE 1 — refuse to start on a poisoned baseline. It returns rather than exiting: an exit
  // here would skip withDatasetLock's `finally` and LEAK THE LOCK FILE, blocking every mutating
  // check in this contract until the stale-lock timeout. (Observed while verifying this fix.) The
  // caller raises exit 2 once the lock is released — a sentinel already in the dataset is a live
  // content incident and must never be mistaken for "the feature isn't wired yet".
  try {
    assertNotPoisoned(`${INFO_DOC_ID}.keyDates`, baselineDates);
    assertNotPoisoned(`${INFO_DOC_ID}.confirmations`, baselineConfirmations);
  } catch (err) {
    if (!(err instanceof PoisonedBaselineError)) throw err;
    console.error('\n' + '='.repeat(78));
    console.error('RESIDUE ALERT — refusing to run against a poisoned dataset');
    console.error(err.message);
    console.error('='.repeat(78) + '\n');
    r.fail(
      'the dataset holds no check residue before the round trip',
      'a sentinel from an earlier run is still in the document (and on the live page)',
    );
    return true;
  }

  if (typeof currentRev !== 'string' || currentRev === '') {
    r.fail(`${INFO_DOC_ID} has a readable _rev`, `got ${JSON.stringify(currentRev)}`);
    return;
  }

  if (!Array.isArray(baselineDates) || baselineDates.length === 0) {
    r.fail(
      `${INFO_DOC_ID}.keyDates holds real rows before the round trip`,
      `got ${JSON.stringify(baselineDates)} — this check restores a captured baseline and needs a real one`,
    );
    return;
  }
  if (!baselineConfirmations || typeof baselineConfirmations !== 'object') {
    r.fail(
      `${INFO_DOC_ID}.confirmations holds a real object before the round trip`,
      `got ${JSON.stringify(baselineConfirmations)}`,
    );
    return;
  }

  const oldDateNote = baselineDates[0]?.dateNote;
  if (typeof oldDateNote !== 'string' || oldDateNote.trim() === '') {
    r.fail('the first key-date row has a real dateNote', `got ${JSON.stringify(oldDateNote)}`);
    return;
  }

  // Both sentinels are shaped so _mutation-guard's SENTINEL_PATTERN recognises them. A check that
  // invents its own shape defeats defence 1 for every other check in this contract.
  const sentinelDate = makeSentinel('DEADLINE');
  const garbageStatus = `not-a-real-status-${Date.now()}`;

  let mutatedDates = false;
  let mutatedStatus = false;

  try {
    // ---------------------------------------------------------------------
    // Phase 1 — the deadline-change test
    // ---------------------------------------------------------------------
    // Patch the whole array rather than a path selector: restoring one captured array is a single
    // atomic write, whereas a path patch would need the item to still be at the same index at
    // restore time.
    const mutatedRows = baselineDates.map((row, i) =>
      i === 0 ? { ...row, dateNote: sentinelDate } : row,
    );
    currentRev = await commitAndCaptureRev(client, INFO_DOC_ID, { keyDates: mutatedRows }, currentRev);
    mutatedDates = true;
    console.log(`Wrote sentinel to ${INFO_DOC_ID}.keyDates[0].dateNote: ${sentinelDate}`);

    const reval = await callRevalidate(secret, INFO_DOC_ID);
    r.check(reval.status === 200, '/api/revalidate accepted the invalidation', `status ${reval.status}`);

    const propagation = await poll(async () => {
      const { status, body } = await fetchPage(PATHS.exhibitors);
      const hasSentinel = textContains(body, sentinelDate);
      const oldGone = !textContains(body, oldDateNote.slice(0, 40));
      return { ok: status === 200 && hasSentinel && oldGone, status, hasSentinel, oldGone };
    }, 'deadline-propagation');

    r.check(
      propagation.ok,
      `a committee edit to the entry deadline reaches ${PATHS.exhibitors} within ${POLL_TIMEOUT_MS / 1000}s`,
      'the sentinel never appeared (or the old value never disappeared) — the key-dates table is ' +
        'not actually reading from Sanity, so the committee cannot change a deadline without a developer',
    );

    // ---------------------------------------------------------------------
    // Phase 2 — fail-closed, behaviourally
    // ---------------------------------------------------------------------
    const infoNow = await client.fetch('*[_id == $id][0]{ pendingLabel }', { id: INFO_DOC_ID });
    const pendingLabel = infoNow?.pendingLabel;

    if (typeof pendingLabel !== 'string' || pendingLabel.trim() === '') {
      r.fail('dataset holds a pendingLabel to fall back to', `got ${JSON.stringify(pendingLabel)}`);
    } else {
      currentRev = await commitAndCaptureRev(
        client,
        INFO_DOC_ID,
        { confirmations: { ...baselineConfirmations, sales: garbageStatus } },
        currentRev,
      );
      mutatedStatus = true;
      console.log(`Wrote garbage status to ${INFO_DOC_ID}.confirmations.sales: ${garbageStatus}`);

      await callRevalidate(secret, INFO_DOC_ID);

      const failClosed = await poll(async () => {
        const { status, body } = await fetchPage(PATHS.exhibitors);
        const showsPending = textContains(body, pendingLabel);
        const leaksGarbage = textContains(body, garbageStatus);
        return { ok: status === 200 && showsPending && !leaksGarbage, status, showsPending, leaksGarbage };
      }, 'fail-closed');

      r.check(
        failClosed.ok,
        'an UNRECOGNISED status still renders the pending marker, and the raw value never leaks to the page',
        'the badge failed OPEN: a block with an unrecognised status rendered as if confirmed. Any ' +
          'typo in a status value would silently turn researched convention into apparent SAOC policy.',
      );
    }
  } finally {
    console.log('--- Cleanup: restoring captured baselines (always attempted) ---');
    let datesRestored = !mutatedDates;
    let statusRestored = !mutatedStatus;
    let cleanupError = null;

    try {
      // DEFENCE 3 — each restore requires the document to still be at the revision OUR last write
      // produced. If a writer that never took the lock (another check, a human in Studio) has
      // touched the document since, the patch throws instead of silently clobbering their value.
      if (mutatedStatus) {
        currentRev = await commitAndCaptureRev(
          client,
          INFO_DOC_ID,
          { confirmations: baselineConfirmations },
          currentRev,
        );
        const after = await client.fetch('*[_id == $id][0].confirmations.sales', { id: INFO_DOC_ID });
        statusRestored = after === baselineConfirmations.sales;
      }
      if (mutatedDates) {
        currentRev = await commitAndCaptureRev(
          client,
          INFO_DOC_ID,
          { keyDates: baselineDates },
          currentRev,
        );
        const after = await client.fetch('*[_id == $id][0].keyDates[0].dateNote', { id: INFO_DOC_ID });
        datesRestored = after === oldDateNote;
      }
      await callRevalidate(secret, INFO_DOC_ID);

      const clean = await poll(async () => {
        const { body } = await fetchPage(PATHS.exhibitors);
        const sentinelGone = !textContains(body, sentinelDate);
        const garbageGone = !textContains(body, garbageStatus);
        return { ok: sentinelGone && garbageGone, sentinelGone, garbageGone };
      }, 'cleanup');

      if (!datesRestored || !statusRestored || !clean.ok) {
        console.error(
          '\n' +
            '='.repeat(78) +
            `\nRESIDUE ALERT — ${INFO_DOC_ID}\n` +
            `date sentinel: ${sentinelDate}\n` +
            `status sentinel: ${garbageStatus}\n` +
            `keyDates restored: ${datesRestored}\n` +
            `confirmations restored: ${statusRestored}\n` +
            `sentinels absent from ${PATHS.exhibitors}: ${clean.ok}\n` +
            'Restore these fields by hand in Studio before doing anything else.\n' +
            '='.repeat(78) +
            '\n',
        );
        r.fail(
          'cleanup restored both baselines and cleared both sentinels from the live page',
          'residue was left behind — see the RESIDUE ALERT above',
        );
        residueDetected = true;
      } else {
        console.log('Cleanup verified: dataset restored and both sentinels are gone from the live page.');
      }
    } catch (err) {
      cleanupError = err;
      console.error(
        '\n' +
          '='.repeat(78) +
          `\nRESIDUE ALERT — cleanup threw for ${INFO_DOC_ID}\n` +
          (isRevisionConflict(err)
            ? 'REVISION CONFLICT: something else wrote to this document while the check held it. ' +
              'The restore was REFUSED rather than clobbering that writer — which means our ' +
              'sentinel may still be in the document. Reconcile both by hand.\n'
            : '') +
          `date sentinel: ${sentinelDate}\n` +
          `status sentinel: ${garbageStatus}\n` +
          `keyDates baseline to restore: ${JSON.stringify(baselineDates)}\n` +
          `confirmations baseline to restore: ${JSON.stringify(baselineConfirmations)}\n` +
          `error: ${err.stack ?? err.message}\n` +
          '='.repeat(78) +
          '\n',
      );
      r.fail('cleanup completed without throwing', `cleanup threw: ${err.message}`);
      residueDetected = true;
    }

    if (cleanupError === null && (mutatedDates || mutatedStatus)) {
      console.log('Mutations were made and cleanup ran regardless of the check outcome.');
    }
  }

  return residueDetected;
}
