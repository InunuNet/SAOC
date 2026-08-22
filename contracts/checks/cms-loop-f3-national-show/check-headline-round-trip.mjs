#!/usr/bin/env node
// cms-loop-f3-national-show A1: THE positive-path, user-visible-outcome assertion —
// same shape as F6's A1 (real Studio, real publish, real deployed page, bounded poll,
// guaranteed cleanup), adapted for THREE fields at once (title, location,
// countdownDate) instead of one, per dispatch brief: "cover more than one field — at
// minimum a text field and the countdown date, so a partial wiring can't pass."
//
// UNLIKE F6's aboutPage.boardIntroText, these three fields are NOT currently empty —
// confirmed live 2026-08-05 via direct Studio DOM inspection (see contract header):
// title = "The 19th South African National Orchid Show", location = "Cape Town
// International Convention Centre", countdownDate = "2027-09-18 09:00". So this check
// uses a different, still-rigorous pattern: capture the real baseline, mutate to
// distinct sentinel values, verify the sentinels appear AND the baseline values
// disappear (two-sided — proves the page re-rendered with new data, not that the
// sentinel happens to already be somewhere on the page), then restore the EXACT
// captured baseline and verify that restoration on both the dataset and the live
// page. This is a genuine causal round trip, not a weaker substitute for F6's
// pattern — just adapted for non-empty starting fields.
//
// GATED ON F1 (contracts/cms-loop-f1-cdn-purge.yaml): /national-show is one of F1's
// CMS_ROUTES. This script refuses to run at all — hard fail before any mutation —
// unless F1's short-TTL fix is confirmed live (assertF1Deployed() in _shared.mjs).
// Before F1 ships, the legacy one-year s-maxage means this check's cleanup step
// (which reverts the DATASET) cannot reach the CDN's already-cached copy — a sentinel
// title or a "2099" countdown could stay visibly cached on the live site, including
// the home page, for up to a year. This is enforced in code, not just documented.
//
// CLEANUP-SAFETY FIX (2026-08-06, same root cause as F6's incident — see
// f6-prove-cms-loop/_shared.mjs and this contract's own _shared.mjs headers): every
// `process.exit(1)` in this script's own local helpers (readAllFields()) and in the
// precondition check below has been converted to `throw`, so the cleanup block in
// `finally` below is never silently skipped. The page-level cleanup verification
// below also now uses verifySustainedCondition (3 consecutive clean reads, 15s apart,
// up to 5 minutes) instead of a single-shot poll that exits on the first clean read —
// a lone "not found" read is not reliable proof of removal across every CDN edge
// node. A verification failure raises a loud, distinctly-exit-coded, durably-logged
// residue alert (raiseResidueAlert / EXIT_CODE_RESIDUE_ALERT) instead of an ordinary
// FAIL, so it can never be confused with "the feature just isn't wired yet."
//
// LOCK + POISONED-BASELINE + REVISION-GUARDED RESTORE (2026-08-22, mission
// fix-live-sentinel-residue-cms-loop-f3): this check had none of the three defences its
// siblings under show-visitor-info/ and show-exhibitor-info/ received on 2026-08-12
// (commit c5240ed) — and, separately, show-visitor-info's check-show-identity-sweep.mjs
// mutates this SAME nationalShow document under a different, non-shared lock file. Both
// gaps together are the confirmed root cause of two live nationalShow sentinel-residue
// incidents (full evidence: .agent/memory/project/specs/fix-live-sentinel-residue-cms-
// loop-f3/goldens/m1-golden.md). Fixed here: (1) the baseline captured in Step 1 is
// rejected outright if it looks like ANY known check's sentinel, not restored as if it
// were real content; (2) the entire mutate/verify/restore body below runs inside
// withDatasetLock, which resolves to docLockPath('nationalShow') — the same lock file
// show-visitor-info's guard now uses, so the two contracts actually serialise for the
// first time; (3) the cleanup restore no longer reopens Studio (the fragile step that
// failed both times) — it is a single client.patch(..., { ifRevisionID }) against the
// revision our own sentinel publish produced, so a concurrent writer in between makes
// the restore fail loudly instead of silently clobbering it. The initial mutation stays
// Studio-UI-driven — that remains the point of this check, proving the editor workflow,
// not just the API.
//
// Exit codes: 0 = all three sentinels appeared on the live page within 120s AND
// cleanup was verified. 1 = F1 not yet deployed, precondition violated, timeout, or
// unreachable host. EXIT_CODE_RESIDUE_ALERT (2) = mutation succeeded but cleanup
// could not be verified — treat as a live incident, not an ordinary FAIL. Never a
// skip.

import {
  getSanityClient,
  fetchPublicPageContains,
  callRevalidate,
  openAuthenticatedDoc,
  loadEnvOrFail,
  poll,
  setFieldsAndPublish,
  assertF1Deployed,
  verifySustainedCondition,
  raiseResidueAlert,
  installCrashGuard,
  EXIT_CODE_RESIDUE_ALERT,
  TARGET_DOC_ID,
  TARGET_PAGE_PATH,
  STRUCTURE_PATH,
  REVALIDATE_TYPE,
} from './_shared.mjs';

import {
  withDatasetLock,
  assertUsableBaseline,
  PoisonedBaselineError,
  restoreGuarded,
  isRevisionConflict,
  LOCK_PATH,
  looksLikeSentinelText,
  looksLikeSentinelDate,
} from './_mutation-guard.mjs';

installCrashGuard({ check: 'check-headline-round-trip', docId: TARGET_DOC_ID });

await assertF1Deployed();

const revalidateSecret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
const client = getSanityClient();
const nonce = Date.now();
const sentinels = {
  title: `F3-TITLE-SENTINEL-${nonce}`,
  location: `F3-LOCATION-SENTINEL-${nonce}`,
};
// A large, unmistakable offset (not a garbage string — datetime fields must hold a
// real date) so the deployed page's HTML is checked against the exact stored ISO
// value read back after publish, not a guessed serialization format.
const SENTINEL_DATETIME_INPUT = '2099-01-01 00:00';

console.log(`Sentinels: ${JSON.stringify(sentinels)}, countdownDate input: ${SENTINEL_DATETIME_INPUT}`);
console.log(`  [lock] this check shares docLockPath('nationalShow') = ${LOCK_PATH} with show-visitor-info's check-show-identity-sweep.mjs`);

let browser;
let mutationAttempted = false;
let baseline;
let baselineRev; // the revision OUR sentinel publish produced — the restore's ifRevisionID guard
let countdownNeedle; // set once the sentinel publish's authoritative stored ISO value is known

// readDatasetField (imported) only reads ONE field by name via a GROQ projection
// built from that name — it does not support a multi-field projection string
// directly, so this check reads all three (plus _rev, needed for the revision-guarded
// restore) with its own small query instead of forcing that helper outside its
// designed shape.
async function readAllFields() {
  try {
    const doc = await client.fetch(`*[_id == $id][0]{title, location, countdownDate, _rev}`, { id: TARGET_DOC_ID });
    return doc ?? {};
  } catch (err) {
    const msg = `FAIL: dataset read for ${TARGET_DOC_ID} threw — ${err.message}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// Retries a dataset read for a short window before accepting it as the final answer.
// DISCOVERED LIVE (2026-08-06, during a real end-to-end run once F1 turned out to
// already be deployed): a single immediate read right after a Studio Publish click
// can race ahead of the write actually landing — one real run showed the "confirm
// publish landed" read report stale values, then the SAME dataset correctly showed
// the sentinel moments later in a subsequent read. That run's underlying mutation
// and cleanup both genuinely succeeded (independently confirmed afterward via a
// direct dataset read matching the exact restored baseline) — only the check's own
// single-shot verification was too impatient. This tolerates that race without
// weakening what's being proven: it still requires the predicate to actually become
// true, just not on the very first read.
async function readAllFieldsUntil(predicate, { attempts = 6, delayMs = 3000 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    last = await readAllFields();
    if (predicate(last)) return { ok: true, fields: last };
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, fields: last };
}

// The ENTIRE mutate/verify/restore round trip runs inside the shared nationalShow lock —
// not just the write step — so a concurrent show-visitor-info sweep of the same document
// cannot interleave with any part of it.
const exitCode = await withDatasetLock('cms-loop-f3-check-headline-round-trip', async () => {
  let code = 1;

  try {
    console.log('--- Step 1: baseline ---');
    baseline = await readAllFields();
    // Reject a poisoned baseline for each of the three fields before any mutation is
    // attempted — a sentinel-shaped value here means an earlier run (this contract's
    // or a sibling's) left residue rendering on the live site, and restoring it would
    // make that residue permanent.
    assertUsableBaseline('title', baseline.title);
    assertUsableBaseline('location', baseline.location);
    assertUsableBaseline('countdownDate', baseline.countdownDate, { isDate: true });
    console.log('Baseline:', JSON.stringify(baseline));

    console.log('--- Step 2: open Studio, edit title+location+countdownDate, publish ---');
    const opened = await openAuthenticatedDoc(TARGET_DOC_ID, 'title', STRUCTURE_PATH);
    browser = opened.browser;
    mutationAttempted = true;
    await setFieldsAndPublish(opened.page, {
      title: sentinels.title,
      location: sentinels.location,
      countdownDate: SENTINEL_DATETIME_INPUT,
    });

    console.log('--- Step 3: confirm publish landed in the dataset (tolerates a short landing delay) ---');
    const { ok: publishOk, fields: afterPublish } = await readAllFieldsUntil(
      (f) => f.title === sentinels.title && f.location === sentinels.location && f.countdownDate && f.countdownDate !== baseline.countdownDate
    );
    if (!publishOk) {
      console.error(`FAIL: Studio publish did not land as expected — dataset shows ${JSON.stringify(afterPublish)}`);
    } else {
      console.log('Publish confirmed in dataset:', JSON.stringify(afterPublish));
      countdownNeedle = afterPublish.countdownDate; // authoritative stored value, not a guessed format
      baselineRev = afterPublish._rev; // the revision our sentinel write produced

      console.log('--- Step 4: call /api/revalidate ---');
      const revalRes = await callRevalidate(revalidateSecret, REVALIDATE_TYPE);
      console.log('revalidate response:', revalRes);
      if (revalRes.status !== 200) {
        console.error(`FAIL: /api/revalidate returned ${revalRes.status}, expected 200`);
      } else {
        console.log('--- Step 5: poll the live public page for all three sentinels (two-sided) ---');
        const propagation = await poll(async () => {
          const r = await fetchPublicPageContains(sentinels.title, TARGET_PAGE_PATH);
          const hasTitle = r.body.includes(sentinels.title);
          const hasLocation = r.body.includes(sentinels.location);
          const hasCountdown = r.body.includes(countdownNeedle);
          const oldTitleGone = !r.body.includes(baseline.title);
          const oldLocationGone = !r.body.includes(baseline.location);
          return {
            ok: hasTitle && hasLocation && hasCountdown && oldTitleGone && oldLocationGone,
            status: r.status,
            hasTitle,
            hasLocation,
            hasCountdown,
            oldTitleGone,
            oldLocationGone,
          };
        }, 'propagation');

        if (propagation.ok) {
          console.log(`PASS (propagation): all three sentinels appeared, old values gone, after ${propagation.attempts} attempt(s).`);
          code = 0;
        } else {
          console.error(
            `FAIL (propagation): sentinels never fully appeared on ${TARGET_PAGE_PATH} within 120s of a ` +
              'confirmed publish + a 200 revalidate response. If F1 (contracts/cms-loop-f1-cdn-purge.yaml) has not been deployed ' +
              'yet, this is the expected, honest pre-fix result — the CDN has no reason to re-check origin. If F1 IS deployed, ' +
              'this means /national-show is not actually querying nationalShowQuery for these fields (data-flow wiring missing ' +
              'or mis-tagged, same failure class F2 found on /events/[slug]).'
          );
        }
      }
    }
  } catch (err) {
    if (err instanceof PoisonedBaselineError) {
      // Nothing was mutated — mutationAttempted is still false, so the finally below
      // performs no restore. This IS the residue alert: the baseline itself is the
      // incident, already reported in the thrown message. Documented as exit 2 in
      // dataset-mutation-safety.golden.md — mirrors runCheck's PoisonedBaselineError
      // handling in show-visitor-info/_shared.mjs so a caller branching on exit code
      // can tell "confirmed live corruption" from an ordinary assertion failure.
      const banner = `RESIDUE ALERT: cms-loop-f3-national-show/check-headline-round-trip refused to start — ${err.message}`;
      console.error(banner);
      console.log(banner);
      code = EXIT_CODE_RESIDUE_ALERT;
    } else {
      console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
    }
  } finally {
    if (mutationAttempted && baseline) {
      console.log('--- Cleanup: restoring the exact captured baseline via a direct, revision-guarded client patch ---');
      try {
        if (browser) {
          await browser.close();
          browser = undefined;
        }

        const restoreValues = { title: baseline.title, location: baseline.location, countdownDate: baseline.countdownDate };
        if (baselineRev) {
          await restoreGuarded(client, TARGET_DOC_ID, restoreValues, baselineRev);
        } else {
          // Step 3 never confirmed the sentinel publish landed (or never ran at all — e.g.
          // setFieldsAndPublish itself threw), so there is no revision from OUR sentinel
          // write to guard against by default. That does NOT mean it's safe to skip the guard
          // entirely: an unconditional patch here would blindly clobber whatever the CURRENT
          // live document holds, including a legitimate write from some unrelated process that
          // landed between Step 1's baseline read and this fallback running.
          //
          // UNOBSERVED-OWN-PUBLISH FIX (round 7): before falling back to the stale baseline._rev
          // guard, check whether the CURRENT live document is actually OUR sentinel publish that
          // Step 3's short polling window simply closed before observing — a timing/observation
          // gap, not a real publish failure. If the current document exactly matches this run's
          // sentinels, the publish DID land; restoring against baseline._rev would always throw
          // in that case (the doc has genuinely moved off that revision — our own publish is
          // what moved it), leaving the just-published sentinel live and merely raising an
          // alert. Restore against the CURRENT revision instead, so cleanup actually succeeds
          // rather than giving up on a publish that in fact worked.
          const currentLive = await readAllFields();
          const isUnobservedOwnPublish =
            currentLive.title === sentinels.title &&
            currentLive.location === sentinels.location &&
            typeof currentLive.countdownDate === 'string' &&
            currentLive.countdownDate !== baseline.countdownDate;

          if (isUnobservedOwnPublish) {
            console.warn(
              '  [fallback] Step 3 never observed the publish landing within its polling window, ' +
                "but the CURRENT live document exactly matches this run's sentinels — the publish " +
                'DID land, just slower than we could see. Restoring against the current revision ' +
                `(${currentLive._rev}) instead of the stale baseline revision.`
            );
            countdownNeedle = countdownNeedle ?? currentLive.countdownDate;
            await restoreGuarded(client, TARGET_DOC_ID, restoreValues, currentLive._rev);
          } else {
            // Neither Step 3 confirmed the publish landed, nor does the current live document
            // match our sentinels — there is genuinely no revision from OUR sentinel write to
            // guard against. Guard against baseline._rev — the revision captured before THIS
            // check touched the document — instead. If the live doc has moved off that revision
            // for any reason (our own partially-landed publish, or an external write),
            // restoreGuarded throws and the outer catch below raises the residue/conflict alert
            // rather than clobbering.
            await restoreGuarded(client, TARGET_DOC_ID, restoreValues, baseline._rev);
          }
        }

        const { ok: datasetClean, fields: afterCleanupDataset } = await readAllFieldsUntil(
          (f) => f.title === baseline.title && f.location === baseline.location && f.countdownDate === baseline.countdownDate
        );
        console.log('Dataset after cleanup:', JSON.stringify(afterCleanupDataset), '| clean:', datasetClean);

        const cleanupRevalidate = await callRevalidate(revalidateSecret, REVALIDATE_TYPE);
        console.log('Cleanup revalidate response:', cleanupRevalidate);

        // DRAFT RESIDUE (2026-08-22): mutationAttempted flips true right after Studio opens,
        // before setFieldsAndPublish's click actually completes — Studio autosaves keystrokes
        // into `drafts.${TARGET_DOC_ID}` as they're typed, independent of Publish. If the
        // publish click then fails or times out, our sentinel text can be left sitting in the
        // draft even though the published doc (patched above) is clean. scan-dataset-residue.ts
        // already sweeps `*[]`, which includes draft documents, so this isn't an undetected
        // gap — but cleaning it here directly, rather than only relying on that outside net,
        // closes it immediately instead of waiting for the next scan.
        //
        // PARTIAL-MATCH FIX (round 6): setFieldsAndPublish (_shared.mjs) fills title, location,
        // and countdownDate SEQUENTIALLY. A crash/timeout after only one field autosaved leaves
        // the draft holding a PARTIAL sentinel — one field sentinel-shaped, the other two whatever
        // they were before. The old all-three-exact-match condition silently skipped that draft
        // (ordinary FAIL, no alert). Match on ANY field looking sentinel-shaped instead, reusing
        // the same marker-recognition logic _mutation-guard.mjs uses for poisoned-baseline
        // rejection (looksLikeSentinelText/looksLikeSentinelDate) rather than a third hand-copied
        // pattern list. A field counts as "explained" (ours to touch) if it's either sentinel-
        // shaped or still equals the pre-mutation baseline (untouched by our write); if every
        // field is explained, this check may act on the draft. If a sentinel-shaped field is
        // mixed with a field that's neither sentinel-shaped nor the baseline value (unrelated
        // in-progress editor content this check cannot attribute to itself), raise the residue
        // alert instead of silently leaving it — erring toward alerting a human over silently
        // leaving suspected residue.
        //
        // TARGETED-UNSET FIX (round 8): "all fields explained" used to mean "safe to
        // client.delete() the WHOLE draft document" — but this check only ever fetched
        // title/location/countdownDate, so it had no way to know whether the draft ALSO held a
        // real editor's legitimate, unrelated, unsaved changes in some OTHER field (hero,
        // showDate, venue, edition, ...). A concurrent in-progress Studio session with genuine
        // work-in-progress in those other fields would have its entire draft silently destroyed —
        // a real data-loss risk to a human, not just leftover test residue. Fixed: the fetch below
        // now pulls the FULL draft document (not a narrow three-field projection), so this check
        // can see every key actually present. Cleanup now only ever touches the three fields THIS
        // check owns, never the whole document. Deleting the now-empty draft outright is still
        // done, but ONLY as a courtesy once a full read confirms no other content-bearing key
        // remains — i.e. the draft was entirely this check's own sentinel data and nothing else.
        //
        // RESTORE-NOT-UNSET FIX (round 9): the round-8 fix used
        // client.patch(draftId).unset(['title','location','countdownDate']) when other editor
        // content was present. That REMOVES those three fields from the draft instead of
        // restoring them to the real `baseline` values this check captured in Step 1 — so if the
        // editor later publishes their draft (with the unrelated changes) after this cleanup ran,
        // the published document would end up missing title/location/countdownDate. This is the
        // exact round-trip guarantee this check exists to uphold: leave the document as it found
        // it. Fixed: .set({ title: baseline.title, location: baseline.location, countdownDate:
        // baseline.countdownDate }) restores the real values instead of dropping the fields. The
        // wholly-ours case (no other content) still safely client.delete()s the draft, since
        // nothing of value survives either way.
        const draftId = `drafts.${TARGET_DOC_ID}`;
        const DRAFT_SYSTEM_KEYS = new Set(['_id', '_type', '_rev', '_createdAt', '_updatedAt']);
        const DRAFT_OWNED_KEYS = new Set(['title', 'location', 'countdownDate']);
        try {
          const draft = await client.fetch(`*[_id == $id][0]`, { id: draftId });
          if (draft) {
            const fieldLooksSentinel = {
              title: looksLikeSentinelText(draft.title),
              location: looksLikeSentinelText(draft.location),
              countdownDate: looksLikeSentinelDate(draft.countdownDate),
            };
            const anySentinelShaped = Object.values(fieldLooksSentinel).some(Boolean);
            const fieldExplained = {
              title: fieldLooksSentinel.title || draft.title === baseline.title,
              location: fieldLooksSentinel.location || draft.location === baseline.location,
              countdownDate: fieldLooksSentinel.countdownDate || draft.countdownDate === baseline.countdownDate,
            };
            const allFieldsExplained = Object.values(fieldExplained).every(Boolean);
            // Any key on the full draft document besides our three owned fields and Sanity's own
            // system metadata — real content a human editor could have put there.
            const otherContentKeys = Object.keys(draft).filter(
              (key) => !DRAFT_SYSTEM_KEYS.has(key) && !DRAFT_OWNED_KEYS.has(key) && draft[key] !== undefined && draft[key] !== null,
            );
            const hasOtherContent = otherContentKeys.length > 0;

            if (!anySentinelShaped) {
              console.warn(
                `  [draft cleanup] ${draftId} exists but does not match our sentinels — leaving it alone ` +
                  `(not ours to touch): ${JSON.stringify(draft)}`,
              );
            } else if (allFieldsExplained) {
              try {
                if (hasOtherContent) {
                  await client
                    .patch(draftId)
                    .set({ title: baseline.title, location: baseline.location, countdownDate: baseline.countdownDate })
                    .commit();
                  console.log(
                    `  [draft cleanup] restored title/location/countdownDate to baseline on ${draftId} — preserved ` +
                      `unrelated editor content in: ${otherContentKeys.join(', ')} (unsetting instead of restoring ` +
                      `would have dropped these fields on a later publish)`,
                  );
                } else {
                  await client.delete(draftId);
                  console.log(
                    `  [draft cleanup] deleted ${draftId} — held ONLY our own abandoned sentinel autosave ` +
                      `(partial or full) and no other content: ${JSON.stringify(draft)}`,
                  );
                }
              } catch (deleteErr) {
                console.warn(`  [draft cleanup] cleanup of sentinel-shaped ${draftId} FAILED — ${deleteErr.message}`);
                raiseResidueAlert({
                  checkName: 'cms-loop-f3-national-show/check-headline-round-trip',
                  docId: draftId,
                  field: 'title/location/countdownDate (draft)',
                  expectedValue: baseline,
                  sentinelValue: JSON.stringify(draft),
                  pagePath: TARGET_PAGE_PATH,
                  extra: `sentinel-shaped draft cleanup failed: ${deleteErr.message}`,
                });
                code = EXIT_CODE_RESIDUE_ALERT;
              }
            } else {
              console.warn(
                `  [draft cleanup] ${draftId} holds a sentinel-shaped field mixed with content that isn't ` +
                  `ours to attribute — leaving untouched, raising alert instead: ${JSON.stringify(draft)}`,
              );
              raiseResidueAlert({
                checkName: 'cms-loop-f3-national-show/check-headline-round-trip',
                docId: draftId,
                field: 'title/location/countdownDate (draft)',
                expectedValue: baseline,
                sentinelValue: JSON.stringify(draft),
                pagePath: TARGET_PAGE_PATH,
                extra: 'partial sentinel-shaped draft mixed with unattributable content — not deleted',
              });
              code = EXIT_CODE_RESIDUE_ALERT;
            }
          }
        } catch (draftErr) {
          console.warn(`  [draft cleanup] check/delete of ${draftId} threw — ${draftErr.message}`);
        }

        // Safety gate is "no sentinel visible on the live page" — NOT "baseline text is
        // visible" (that second condition is only meaningful once /national-show is
        // actually wired; pre-wiring, baseline.title/location were NEVER rendered by
        // the page at all — confirmed live 2026-08-06 that requiring it produced a
        // false FAIL here even though the dataset was genuinely, correctly restored).
        // What actually matters for safety is that no test content is left visible to
        // real visitors; whether the ORIGINAL content re-appears depends on wiring
        // that is out of this script's control.
        const cleanupPropagation = await verifySustainedCondition(async () => {
          const r = await fetchPublicPageContains(sentinels.title, TARGET_PAGE_PATH);
          return (
            !r.body.includes(sentinels.title) &&
            !r.body.includes(sentinels.location) &&
            !(countdownNeedle && r.body.includes(countdownNeedle))
          );
        }, { label: 'cleanup-propagation' });

        if (!datasetClean || !cleanupPropagation.ok) {
          raiseResidueAlert({
            checkName: 'cms-loop-f3-national-show/check-headline-round-trip',
            docId: TARGET_DOC_ID,
            field: 'title/location/countdownDate',
            expectedValue: baseline,
            sentinelValue: JSON.stringify(sentinels) + ` countdownDate=${countdownNeedle}`,
            pagePath: TARGET_PAGE_PATH,
            extra: !datasetClean ? `dataset still shows ${JSON.stringify(afterCleanupDataset)}` : 'dataset confirmed clean; live page could not confirm sentinel absence within the sustained-check window',
          });
          code = EXIT_CODE_RESIDUE_ALERT;
        } else {
          console.log('Cleanup verified: dataset restored AND live page sustained sentinel-absence across 3 consecutive checks.');
        }
      } catch (cleanupErr) {
        const conflictNote = isRevisionConflict(cleanupErr)
          ? ' A revision conflict means something else wrote to nationalShow between our sentinel publish and this restore — ' +
            'exactly the race this guard exists to catch loudly instead of silently clobbering. Restore by hand from ' +
            'scripts/seed-page-singletons.ts, then run node --import tsx/esm scripts/scan-dataset-residue.ts.'
          : '';
        raiseResidueAlert({
          checkName: 'cms-loop-f3-national-show/check-headline-round-trip',
          docId: TARGET_DOC_ID,
          field: 'title/location/countdownDate',
          expectedValue: baseline,
          sentinelValue: JSON.stringify(sentinels),
          pagePath: TARGET_PAGE_PATH,
          extra: `cleanup threw: ${cleanupErr.stack ?? cleanupErr.message}${conflictNote}`,
        });
        code = EXIT_CODE_RESIDUE_ALERT;
      }
    }
    if (browser) await browser.close();
  }

  return code;
});

if (exitCode === 0) {
  console.log('PASS: national-show headline fields reached the live site, and cleanup was verified.');
} else if (exitCode === EXIT_CODE_RESIDUE_ALERT) {
  console.log('RESULT: RESIDUE ALERT (see banner above) — treat as a live incident, not an ordinary FAIL.');
} else {
  console.log('RESULT: FAIL (see above).');
}
process.exit(exitCode);
