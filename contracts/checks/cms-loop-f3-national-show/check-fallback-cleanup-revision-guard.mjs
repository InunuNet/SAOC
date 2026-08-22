#!/usr/bin/env node
// META — proves round 5's fix to A1's cleanup FALLBACK path (the `else` branch that runs when
// Step 3 never confirmed the sentinel publish landed, so `baselineRev` is unset).
//
// WHY THIS CHECK EXISTS
// ----------------------
// Codex GPT-5.5 round 5 found that the fallback branch did a plain, unguarded
// `client.patch(TARGET_DOC_ID).set(restoreValues).commit()` — no `ifRevisionID` at all. Concrete
// failure scenario: `mutationAttempted` flips true right after Studio opens (before
// setFieldsAndPublish actually completes), so if the publish is slow/partial, or the Studio
// open/field-fill step fails before ever reaching a real publish, this fallback still runs. With
// no revision guard it would blindly overwrite whatever the CURRENT live document holds with the
// OLD captured baseline — including a legitimate write from some unrelated process that touched
// `nationalShow` in the window between Step 1's baseline read and this fallback running. That is
// exactly the cross-process clobber the F1 lock work earlier this mission was meant to prevent;
// the lock only stops concurrent HOLDERS from interleaving, it never guarded this holder's own
// fallback against a write that landed just outside its held window.
//
// Fix: the fallback now calls the same `restoreGuarded` used by the main-path cleanup, guarded on
// `baseline._rev` — the revision captured at Step 1, before this check touched the document at
// all — instead of patching unconditionally. A mismatch (something else wrote to the doc) makes
// restoreGuarded throw, which the outer `catch (cleanupErr)` already turns into a residue alert
// (EXIT_CODE_RESIDUE_ALERT) instead of a silent clobber.
//
// check-headline-round-trip.mjs cannot be run end-to-end here (needs a live Sanity project, a
// live deployed site, and real Playwright/Studio login) — same constraint documented in
// check-poisoned-baseline-exit-code.mjs. Instead this check does two things:
//   1. STATIC: isolates the fallback `else` branch specifically (not "restoreGuarded appears
//      somewhere in the file" — the main-path branch a few lines above also calls it) and asserts
//      it now guards on `baseline._rev` via restoreGuarded, not an unconditioned `client.patch`.
//   2. BEHAVIOURAL: runs the REAL `restoreGuarded`/`isRevisionConflict` from `_mutation-guard.mjs`
//      against a fake in-memory Sanity-shaped client that simulates exactly the race described
//      above — baseline captured at rev X, then (simulating an out-of-lock external write) the
//      live doc's rev changes to Y before the fallback-cleanup runs. Proves the fixed fallback
//      logic (a) does NOT clobber the doc — the external write survives untouched — and (b)
//      throws in a way `isRevisionConflict` recognises, so A1's outer catch raises the residue
//      alert. REVERT-AND-CONFIRM-RED: the same scenario replayed against the OLD unconditioned
//      `client.patch(...).set(...).commit()` logic is proven to silently clobber the external
//      write, so this check is shown to actually discriminate pass from fail.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { restoreGuarded, isRevisionConflict } from './_mutation-guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = path.join(HERE, 'check-headline-round-trip.mjs');

let failures = 0;
function check(ok, label, detail = '') {
  if (ok) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// --- 1. STATIC: isolate the fallback `else` branch specifically ----------------------------
const source = readFileSync(TARGET_FILE, 'utf8');
const ifElseMatch = source.match(
  /if \(baselineRev\) \{([\s\S]*?)\n\s*\} else \{([\s\S]*?)\n\s*\}\n\n\s*const \{ ok: datasetClean/
);
check(!!ifElseMatch, 'locates the `if (baselineRev) { ... } else { ... }` restore block in the cleanup finally');

const mainBranchBody = ifElseMatch ? ifElseMatch[1] : '';
const fallbackBranchBody = ifElseMatch ? ifElseMatch[2] : '';

check(
  /restoreGuarded\(client, TARGET_DOC_ID, restoreValues, baselineRev\)/.test(mainBranchBody),
  'main-path branch (baselineRev set) still calls restoreGuarded with baselineRev — unchanged by this fix'
);
check(
  !/client\.patch\(TARGET_DOC_ID\)\.set\(restoreValues\)\.commit\(\)/.test(fallbackBranchBody),
  'fallback branch no longer contains the old unconditioned client.patch(...).set(...).commit()'
);

// ROUND 7: the fallback `else` branch is now itself split into a nested `if
// (isUnobservedOwnPublish) { ... } else { ... }` — isolate each side of that split and assert
// its own restoreGuarded call, rather than only checking "restoreGuarded appears somewhere in
// the outer else branch" (which the round-5 assertions above still do, but can't distinguish
// which revision guard is actually used on which path).
const nestedMatch = fallbackBranchBody.match(
  /if \(isUnobservedOwnPublish\) \{([\s\S]*?)\n\s*\} else \{([\s\S]*?)\n\s*\}/
);
check(!!nestedMatch, 'fallback branch contains the round-7 `if (isUnobservedOwnPublish) { ... } else { ... }` split', fallbackBranchBody);

const unobservedPublishBody = nestedMatch ? nestedMatch[1] : '';
const staleBaselineBody = nestedMatch ? nestedMatch[2] : '';

check(
  /const currentLive = await readAllFields\(\);/.test(fallbackBranchBody),
  'fallback branch re-reads the CURRENT live document before choosing which revision to guard on'
);
check(
  /restoreGuarded\(client, TARGET_DOC_ID, restoreValues, currentLive\._rev\)/.test(unobservedPublishBody),
  'unobserved-own-publish path restores against the FRESH currentLive._rev, not the stale baseline',
  unobservedPublishBody ? `branch body was: ${unobservedPublishBody.trim()}` : 'branch body not found'
);
check(
  /restoreGuarded\(client, TARGET_DOC_ID, restoreValues, baseline\._rev\)/.test(staleBaselineBody),
  'the remaining (no-match) path still restores guarded on baseline._rev — round 5 behaviour preserved',
  staleBaselineBody ? `branch body was: ${staleBaselineBody.trim()}` : 'branch body not found'
);

// --- 2. BEHAVIOURAL: real restoreGuarded/isRevisionConflict vs. a simulated cross-process race ---

// A minimal fake Sanity client: holds one document in memory, and its `.patch(id, { ifRevisionID
// }).set(values).commit()` chain throws a real Sanity-shaped 409 conflict error when the
// requested precondition doesn't match the document's CURRENT revision — mirroring the real
// Sanity client's documented ifRevisionID behaviour closely enough to exercise restoreGuarded's
// actual guard logic, not a reimplementation of it.
function makeFakeSanityClient(initialDoc) {
  let doc = { ...initialDoc };
  return {
    getDoc: () => ({ ...doc }),
    patch(_docId, opts = {}) {
      return {
        set(values) {
          return {
            async commit() {
              if (opts.ifRevisionID && opts.ifRevisionID !== doc._rev) {
                const err = new Error(
                  `Insufficient permissions or document does not exist. Precondition failed: revision mismatch ` +
                    `(expected ${opts.ifRevisionID}, was ${doc._rev})`
                );
                err.statusCode = 409;
                throw err;
              }
              doc = { ...doc, ...values, _rev: `rev-after-write-${Math.random().toString(36).slice(2)}` };
              return { ...doc };
            },
          };
        },
      };
    },
  };
}

const TARGET_DOC_ID = 'nationalShow';
const baseline = { title: 'The 19th South African National Orchid Show', location: 'Original Venue', countdownDate: '2027-09-16T09:00:00.000Z', _rev: 'rev-baseline-X' };
const restoreValues = { title: baseline.title, location: baseline.location, countdownDate: baseline.countdownDate };

// Scenario: baseline captured at rev-baseline-X. Before the fallback-cleanup runs, some other
// process (simulating a write that lands outside this check's held lock window) writes to the
// live doc, changing `location` and moving it off rev-baseline-X — the legitimate concurrent
// write this guard must not destroy. applyExternalWrite() below applies it without any
// precondition, as a real unrelated writer (with no knowledge of our baseline rev) would.
function buildRacedClient() {
  return makeFakeSanityClient(baseline);
}

async function applyExternalWrite(client) {
  await client.patch(TARGET_DOC_ID, {}).set({ location: 'Legitimate Concurrent Edit' }).commit();
}

// --- Fixed fallback logic (copied in shape from the fixed branch) ---
async function fixedFallbackLogic(client) {
  try {
    await restoreGuarded(client, TARGET_DOC_ID, restoreValues, baseline._rev);
    return { clobbered: true, threw: false };
  } catch (err) {
    return { clobbered: false, threw: true, err };
  }
}

// --- Pre-fix fallback logic (the exact bug: unconditioned patch, copied verbatim in shape) ---
async function preFixFallbackLogic(client) {
  try {
    await client.patch(TARGET_DOC_ID).set(restoreValues).commit();
    return { clobbered: true, threw: false };
  } catch (err) {
    return { clobbered: false, threw: true, err };
  }
}

// Fixed path: must NOT clobber the external write, must throw a recognisable revision conflict.
const fixedClient = buildRacedClient();
await applyExternalWrite(fixedClient);
const beforeFixedDoc = fixedClient.getDoc();
check(beforeFixedDoc.location === 'Legitimate Concurrent Edit', 'scenario setup: external write landed before fallback-cleanup runs');

const fixedResult = await fixedFallbackLogic(fixedClient);
const afterFixedDoc = fixedClient.getDoc();
check(fixedResult.threw && !fixedResult.clobbered, 'fixed fallback (restoreGuarded on baseline._rev) throws instead of clobbering', JSON.stringify(fixedResult));
check(
  afterFixedDoc.location === 'Legitimate Concurrent Edit',
  'fixed fallback: the external write survives untouched — doc was NOT overwritten with the stale baseline',
  `doc after fallback: ${JSON.stringify(afterFixedDoc)}`
);
check(
  fixedResult.threw && isRevisionConflict(fixedResult.err),
  'the thrown error is recognised by isRevisionConflict — A1\'s outer catch will raise a residue alert, not treat this as an ordinary FAIL',
  fixedResult.err ? fixedResult.err.message : 'no error'
);

// REVERT-AND-CONFIRM-RED: same race replayed against the OLD unconditioned patch — must clobber.
const preFixClient = buildRacedClient();
await applyExternalWrite(preFixClient);
const preFixResult = await preFixFallbackLogic(preFixClient);
const afterPreFixDoc = preFixClient.getDoc();
check(
  preFixResult.clobbered && !preFixResult.threw,
  'REVERT-AND-CONFIRM-RED: the pre-fix unconditioned patch does NOT throw on the same race (this is the bug)',
  JSON.stringify(preFixResult)
);
check(
  afterPreFixDoc.location === baseline.location,
  'REVERT-AND-CONFIRM-RED: the pre-fix logic silently clobbers the external write, restoring the stale baseline over it — ' +
    'proving this check actually discriminates old (broken) from new (fixed) behaviour',
  `doc after pre-fix fallback: ${JSON.stringify(afterPreFixDoc)}`
);

// Sanity check: when NOTHING else has written (the common case — Step 3 just failed to confirm
// a publish that never actually landed), the fixed fallback must still succeed and restore
// baseline values, not spuriously reject a legitimate no-op restore.
const quietClient = makeFakeSanityClient(baseline);
const quietResult = await fixedFallbackLogic(quietClient);
check(
  quietResult.clobbered && !quietResult.threw,
  'fixed fallback still succeeds when no external write occurred (revision unchanged since baseline)',
  JSON.stringify(quietResult)
);
check(
  quietClient.getDoc().title === baseline.title && quietClient.getDoc().location === baseline.location,
  'fixed fallback restores baseline values correctly in the uncontended case'
);

// --- ROUND 7 scenario: the publish DID land, Step 3 just never observed it in time -----------
// baselineRev is unset (same trigger as every other fallback scenario), but unlike the races
// above, nothing EXTERNAL moved the doc off baseline._rev — OUR OWN sentinel publish did. A
// fresh read of the "current live document" exactly matches this run's sentinels. The round-7
// fix must detect that and restore against the CURRENT revision instead of giving up against
// the now-permanently-stale baseline._rev.
const sentinels = { title: 'F3-TITLE-SENTINEL-999', location: 'F3-LOCATION-SENTINEL-999' };
const sentinelCountdown = '2099-01-01T00:00:00.000Z';

function unobservedPublishFallbackLogic(client, currentLive) {
  const isUnobservedOwnPublish =
    currentLive.title === sentinels.title &&
    currentLive.location === sentinels.location &&
    typeof currentLive.countdownDate === 'string' &&
    currentLive.countdownDate !== baseline.countdownDate;

  if (isUnobservedOwnPublish) {
    return restoreGuarded(client, TARGET_DOC_ID, restoreValues, currentLive._rev).then(
      () => ({ clobbered: true, threw: false, usedGuard: 'current' }),
      (err) => ({ clobbered: false, threw: true, err, usedGuard: 'current' })
    );
  }
  return restoreGuarded(client, TARGET_DOC_ID, restoreValues, baseline._rev).then(
    () => ({ clobbered: true, threw: false, usedGuard: 'baseline' }),
    (err) => ({ clobbered: false, threw: true, err, usedGuard: 'baseline' })
  );
}

// Set up a client whose live doc IS the sentinel state (our own publish landed), at a revision
// different from baseline._rev — exactly what Step 3 would have seen if its poll window had
// been one beat longer.
const ownPublishClient = makeFakeSanityClient(baseline);
await ownPublishClient
  .patch(TARGET_DOC_ID, {})
  .set({ title: sentinels.title, location: sentinels.location, countdownDate: sentinelCountdown })
  .commit();
const currentLiveSnapshot = ownPublishClient.getDoc();
check(
  currentLiveSnapshot.title === sentinels.title && currentLiveSnapshot._rev !== baseline._rev,
  'scenario setup: current live doc matches this run\'s sentinels at a revision past baseline._rev'
);

// OLD (round-5-only) behaviour: guarding on baseline._rev unconditionally throws here, because
// the doc has genuinely moved off baseline._rev — leaving the sentinel live and only alerting.
const oldBehaviourResult = await restoreGuarded(ownPublishClient, TARGET_DOC_ID, restoreValues, baseline._rev).then(
  () => ({ threw: false }),
  (err) => ({ threw: true, err })
);
check(
  oldBehaviourResult.threw && isRevisionConflict(oldBehaviourResult.err),
  'REVERT-AND-CONFIRM-RED: round-5-only logic (guard on stale baseline._rev) throws on this scenario, ' +
    'leaving the just-published sentinel live and merely raising an alert — the bug round 7 fixes',
  JSON.stringify(oldBehaviourResult)
);

// NEW (round 7) behaviour: detect the current doc IS our sentinel, restore against its current
// rev, and succeed — cleanup actually completes instead of alerting on a publish that worked.
const freshOwnPublishClient = makeFakeSanityClient(baseline);
await freshOwnPublishClient
  .patch(TARGET_DOC_ID, {})
  .set({ title: sentinels.title, location: sentinels.location, countdownDate: sentinelCountdown })
  .commit();
const freshCurrentLive = freshOwnPublishClient.getDoc();
const newBehaviourResult = await unobservedPublishFallbackLogic(freshOwnPublishClient, freshCurrentLive);
check(
  newBehaviourResult.usedGuard === 'current' && !newBehaviourResult.threw,
  'round-7 fix: detects the current live doc is our own unobserved publish and restores against its current rev',
  JSON.stringify(newBehaviourResult)
);
check(
  freshOwnPublishClient.getDoc().title === baseline.title && freshOwnPublishClient.getDoc().location === baseline.location,
  'round-7 fix: cleanup actually restores baseline values — no residue left live and no false alert raised',
  JSON.stringify(freshOwnPublishClient.getDoc())
);

if (failures === 0) {
  console.log('PASS: A1\'s fallback cleanup path is revision-guarded on baseline._rev — it no longer blindly clobbers a concurrent write, and still restores correctly when uncontended.');
  process.exit(0);
} else {
  console.error(`FAIL: ${failures} check(s) failed — see above.`);
  process.exit(1);
}
