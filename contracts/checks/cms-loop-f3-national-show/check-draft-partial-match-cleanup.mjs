#!/usr/bin/env node
// META — proves round 6's fix to A1's draft-residue cleanup match condition (the block that
// deletes a stray `drafts.${TARGET_DOC_ID}` left behind by a partially-landed Studio autosave).
//
// WHY THIS CHECK EXISTS
// ----------------------
// Codex GPT-5.5 round 6 found that the draft-cleanup block only deleted the stray draft when
// title, location, AND countdownDate ALL matched this run's sentinel values exactly. But
// setFieldsAndPublish (_shared.mjs) fills those three fields SEQUENTIALLY. If the Studio
// autosave/publish flow fails or times out after only ONE field had been autosaved into the
// draft, the draft holds a PARTIAL sentinel — one field sentinel-shaped, the other two still
// whatever they were before. That does NOT match the old all-three-exact condition, so cleanup
// silently skipped it and the check exited as an ORDINARY FAIL instead of raising the residue
// alert this exact "known sentinel-shaped residue left behind" situation should trigger.
//
// Fix: match on ANY field looking sentinel-shaped (reusing looksLikeSentinelText /
// looksLikeSentinelDate from _mutation-guard.mjs, the same marker-recognition logic used for
// poisoned-baseline rejection), not an all-three exact match. A field counts as "explained" if
// it's sentinel-shaped OR equals the pre-mutation baseline; if every field is explained, delete
// (alerting instead if the delete itself fails); if a sentinel-shaped field is mixed with content
// that's neither sentinel-shaped nor baseline (unattributable), raise the residue alert rather
// than silently leaving it.
//
// check-headline-round-trip.mjs cannot be run end-to-end here (needs a live Sanity project, a
// live deployed site, real Playwright/Studio login) — same constraint documented in
// check-fallback-cleanup-revision-guard.mjs. Instead this check does two things:
//   1. STATIC: isolates the draft-cleanup block specifically and asserts it now branches on
//      "any field sentinel-shaped" via looksLikeSentinelText/looksLikeSentinelDate, not the old
//      all-three-field `===` chain.
//   2. BEHAVIOURAL: runs the REAL looksLikeSentinelText/looksLikeSentinelDate from
//      _mutation-guard.mjs against a fixture simulating a PARTIAL-match draft (title
//      sentinel-shaped, location/countdownDate untouched baseline values) through a copy of the
//      fixed match/attribution logic, proving it now (a) recognises the partial match as
//      residue and (b) attempts cleanup / raises an alert instead of silently passing through.
//      REVERT-AND-CONFIRM-RED: the same fixture replayed against the OLD all-three-exact-match
//      predicate is proven to silently treat it as "not ours" and skip cleanup entirely, so this
//      check actually discriminates old (broken) from new (fixed) behaviour.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { looksLikeSentinelText, looksLikeSentinelDate } from './_mutation-guard.mjs';

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

// --- 1. STATIC: the draft-cleanup block no longer uses the old all-three exact match ----------
const source = readFileSync(TARGET_FILE, 'utf8');
const draftBlockMatch = source.match(/const draftId = `drafts\.\$\{TARGET_DOC_ID\}`;[\s\S]*?\n {8}\} catch \(draftErr\) \{/);
check(!!draftBlockMatch, 'locates the draft-cleanup block in check-headline-round-trip.mjs');
const draftBlockBody = draftBlockMatch ? draftBlockMatch[0] : '';

check(
  /looksLikeSentinelText\(draft\.title\)/.test(draftBlockBody) &&
    /looksLikeSentinelText\(draft\.location\)/.test(draftBlockBody) &&
    /looksLikeSentinelDate\(draft\.countdownDate\)/.test(draftBlockBody),
  'draft-cleanup block checks each field individually with looksLikeSentinelText/looksLikeSentinelDate',
);
check(
  !/draft\.title === sentinels\.title &&\s*\n\s*draft\.location === sentinels\.location/.test(draftBlockBody),
  'draft-cleanup block no longer requires the old all-three-field exact `===` match against sentinels',
);
check(
  /anySentinelShaped/.test(draftBlockBody) && /allFieldsExplained/.test(draftBlockBody),
  'draft-cleanup block branches on "any field sentinel-shaped" + "all fields explained", not all-or-nothing exact match',
);
check(
  /EXIT_CODE_RESIDUE_ALERT/.test(draftBlockBody) && /raiseResidueAlert/.test(draftBlockBody),
  'draft-cleanup block can raise the residue alert (not just log+skip) when a sentinel-shaped draft cannot be cleanly attributed or deleted',
);

// --- 1b. STATIC (round 8): the block fetches the FULL draft document and unsets rather than
// blanket-deletes when other content is present — the fix for the draft-destruction finding ----
check(
  /client\.fetch\(`\*\[_id == \$id\]\[0\]`, \{ id: draftId \}\)/.test(draftBlockBody),
  'draft-cleanup block fetches the FULL draft document (no narrow title/location/countdownDate projection), so it can see every key present',
);
check(
  !/\*\[_id == \$id\]\[0\]\{title, location, countdownDate\}/.test(draftBlockBody),
  'draft-cleanup block no longer uses the old narrow three-field projection that could not see other content',
);
check(
  /otherContentKeys/.test(draftBlockBody) && /hasOtherContent/.test(draftBlockBody),
  'draft-cleanup block computes whether the draft holds content outside the three fields this check owns',
);
check(
  /if \(hasOtherContent\)/.test(draftBlockBody),
  'draft-cleanup block branches on hasOtherContent before choosing restore (preserve) vs. delete (courtesy cleanup)',
);

// --- 1c. STATIC (round 9): restore-to-baseline, not unset — unsetting drops the fields entirely,
// which would leave the published document missing title/location/countdownDate if the editor
// later publishes their draft's unrelated changes. Restoring to baseline is what this check's own
// round-trip guarantee (leave the document as it found it) actually requires. -------------------
check(
  !/client\.patch\(draftId\)\.unset\(\['title', 'location', 'countdownDate'\]\)\.commit\(\)/.test(draftBlockBody),
  'draft-cleanup block no longer unsets title/location/countdownDate on the hasOtherContent branch (round 8 bug: drops the fields instead of restoring them)',
);
check(
  /client\s*\.patch\(draftId\)\s*\.set\(\{\s*title: baseline\.title,\s*location: baseline\.location,\s*countdownDate: baseline\.countdownDate\s*\}\)\s*\.commit\(\)/.test(
    draftBlockBody,
  ),
  'draft-cleanup block restores title/location/countdownDate to the captured baseline values on the hasOtherContent branch, not an unset',
);

// --- 2. BEHAVIOURAL: fixed match/attribution logic vs. a simulated partial-match draft ---------

const baseline = {
  title: 'The 19th South African National Orchid Show',
  location: 'Cape Town International Convention Centre',
  countdownDate: '2027-09-18T09:00:00.000Z',
};
const sentinels = { title: 'F3-TITLE-SENTINEL-1755800000000', location: 'F3-LOCATION-SENTINEL-1755800000000' };

// Simulates: only `title` autosaved before a crash/timeout — location/countdownDate are still
// whatever they were pre-mutation (here, exactly the baseline — the common real-world case).
const partialDraft = { title: sentinels.title, location: baseline.location, countdownDate: baseline.countdownDate };

// --- Fixed logic (copied in shape from the fixed block) ---
function fixedMatchLogic(draft) {
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
  if (!anySentinelShaped) return { action: 'skip' };
  if (allFieldsExplained) return { action: 'delete' };
  return { action: 'alert' };
}

// --- Pre-fix logic (the exact bug: all-three exact match against sentinels) ---
function preFixMatchLogic(draft) {
  const draftIsOurSentinel =
    draft.title === sentinels.title &&
    draft.location === sentinels.location &&
    draft.countdownDate === sentinels.countdownDate;
  return draftIsOurSentinel ? { action: 'delete' } : { action: 'skip' };
}

// --- Round 8: draft-destruction / targeted-unset logic ------------------------------------------
//
// The ROUND-7 fixedMatchLogic above only ever decided "delete or don't" for the whole draft
// document — it never looked at whether the draft held content beyond title/location/
// countdownDate. This mirrors the OLD (destructive) cleanup in check-headline-round-trip.mjs
// exactly: `allFieldsExplained` -> `client.delete(draftId)`, full stop.
//
// The FIXED cleanup (round 8) additionally computes hasOtherContent from a full-document read
// and only deletes when there is none; otherwise it unsets just the three owned fields.
const DRAFT_SYSTEM_KEYS = new Set(['_id', '_type', '_rev', '_createdAt', '_updatedAt']);
const DRAFT_OWNED_KEYS = new Set(['title', 'location', 'countdownDate']);

function hasOtherContent(fullDraft) {
  return Object.keys(fullDraft).some(
    (key) => !DRAFT_SYSTEM_KEYS.has(key) && !DRAFT_OWNED_KEYS.has(key) && fullDraft[key] !== undefined && fullDraft[key] !== null,
  );
}

// The FIXED (round 9) cleanup decision, operating on a FULL draft document (not just the three
// fields). Restores the three owned fields to baseline rather than unsetting them, so a later
// publish of the editor's unrelated changes doesn't ship with title/location/countdownDate gone.
function fixedCleanupAction(fullDraft) {
  const matchResult = fixedMatchLogic(fullDraft);
  if (matchResult.action !== 'delete') return matchResult; // 'skip' or 'alert' — unchanged by round 8/9
  if (!hasOtherContent(fullDraft)) return { action: 'delete' };
  return {
    action: 'restore',
    values: { title: baseline.title, location: baseline.location, countdownDate: baseline.countdownDate },
  };
}

// The OLD (pre-round-8) cleanup decision: identical to fixedMatchLogic — "all fields explained"
// always meant a full document delete, regardless of what else the draft held.
function preRound8CleanupAction(fullDraft) {
  return fixedMatchLogic(fullDraft);
}

// The ROUND-8 (pre-round-9) cleanup decision: branches on hasOtherContent like the fixed logic,
// but UNSETS the three owned fields instead of restoring them to baseline — this is the round-9
// bug: the fields are simply removed from the draft, not returned to their real content.
function round8CleanupAction(fullDraft) {
  const matchResult = fixedMatchLogic(fullDraft);
  if (matchResult.action !== 'delete') return matchResult;
  return hasOtherContent(fullDraft) ? { action: 'unset' } : { action: 'delete' };
}

// Simulates applying a cleanup action to a draft, so the test can assert on the RESULTING draft
// shape rather than only the action label — this is what actually proves data loss vs. safety.
function applyCleanupAction(fullDraft, cleanupAction) {
  const next = { ...fullDraft };
  if (cleanupAction.action === 'restore') {
    Object.assign(next, cleanupAction.values);
  } else if (cleanupAction.action === 'unset') {
    delete next.title;
    delete next.location;
    delete next.countdownDate;
  }
  return next;
}

const fixedResult = fixedMatchLogic(partialDraft);
check(
  fixedResult.action === 'delete',
  'fixed logic recognises a partial-match draft (one sentinel-shaped field, others still baseline) as ours and attempts cleanup',
  JSON.stringify(fixedResult),
);

// A partial draft where the OTHER fields are neither sentinel-shaped nor baseline (unrelated
// in-progress editor content) must raise the alert, not silently delete someone else's edit.
const partialDraftWithForeignContent = { title: sentinels.title, location: 'Some Other Editor Was Mid-Edit Here', countdownDate: baseline.countdownDate };
const foreignResult = fixedMatchLogic(partialDraftWithForeignContent);
check(
  foreignResult.action === 'alert',
  'fixed logic raises an alert (does not delete) when a sentinel-shaped field is mixed with unattributable foreign content',
  JSON.stringify(foreignResult),
);

// A draft matching none of our sentinels and none of the baseline must still be left alone.
const unrelatedDraft = { title: 'Someone Else Entirely', location: 'Unrelated Venue', countdownDate: '2028-01-01T00:00:00.000Z' };
const unrelatedResult = fixedMatchLogic(unrelatedDraft);
check(unrelatedResult.action === 'skip', 'fixed logic still leaves a wholly unrelated draft alone', JSON.stringify(unrelatedResult));

// REVERT-AND-CONFIRM-RED: same partial-match fixture replayed against the OLD all-three-exact
// predicate — must silently skip (this was the bug: silent FAIL, no alert, no cleanup attempt).
const preFixResult = preFixMatchLogic(partialDraft);
check(
  preFixResult.action === 'skip',
  'REVERT-AND-CONFIRM-RED: the pre-fix all-three-exact-match predicate silently skips the same partial-match draft — proving this check discriminates old (broken) from new (fixed) behaviour',
  JSON.stringify(preFixResult),
);

// Sanity check: a full exact match (all three fields sentinel-shaped) still triggers cleanup
// under the fixed logic, same as it always did — the fix must not regress the common case.
const fullDraft = { title: sentinels.title, location: sentinels.location, countdownDate: '2099-01-01T00:00:00.000Z' };
const fullResult = fixedMatchLogic(fullDraft);
check(fullResult.action === 'delete', 'fixed logic still deletes a full (all-three) sentinel-shaped draft, unchanged from before', JSON.stringify(fullResult));

// --- 3. DATA-LOSS SCENARIO (round 8): sentinel-shaped title/location/countdownDate PLUS a real
// editor's unrelated, unsaved, legitimate in-progress content in another field (`hero`). This is
// exactly the finding: "a real human editor's legitimate work must not be destroyed." -----------
const draftWithRealEditorContent = {
  _id: 'drafts.nationalShow',
  _type: 'nationalShow',
  title: sentinels.title,
  location: sentinels.location,
  countdownDate: '2099-01-01T00:00:00.000Z',
  hero: { asset: { _ref: 'image-abc123-1600x900-jpg' }, alt: "Editor's in-progress hero image update" },
  edition: 20, // another unrelated field a real editor might be mid-edit on
};

const fixedDataLossResult = fixedCleanupAction(draftWithRealEditorContent);
check(
  fixedDataLossResult.action === 'restore',
  'FIXED (round 9) cleanup chooses a targeted restore-to-baseline (not delete, not unset) when the draft also holds unrelated real editor content (hero, edition)',
  JSON.stringify(fixedDataLossResult),
);
check(
  fixedDataLossResult.values &&
    fixedDataLossResult.values.title === baseline.title &&
    fixedDataLossResult.values.location === baseline.location &&
    fixedDataLossResult.values.countdownDate === baseline.countdownDate,
  'FIXED (round 9) cleanup restores title/location/countdownDate to the captured baseline values, not arbitrary or sentinel values',
  JSON.stringify(fixedDataLossResult),
);

// REVERT-AND-CONFIRM-RED: replay the exact same fixture against the OLD (pre-round-8) cleanup
// decision — proving the old logic WOULD have destroyed the editor's hero/edition content via a
// full client.delete(draftId), which is the concrete data-loss this round's finding described.
const preRound8Result = preRound8CleanupAction(draftWithRealEditorContent);
check(
  preRound8Result.action === 'delete',
  'REVERT-AND-CONFIRM-RED: the OLD pre-round-8 logic would have issued a full client.delete(draftId) on this same fixture, destroying the unrelated hero/edition content — proving this test discriminates old (destructive) from new (safe) behaviour',
  JSON.stringify(preRound8Result),
);

// REVERT-AND-CONFIRM-RED (round 9): replay the same fixture against the ROUND-8 (unset-based)
// cleanup decision, and simulate the editor publishing their draft's unrelated changes afterward
// (i.e. the draft, as left by cleanup, becomes the published document). Round 8's unset-based
// cleanup left the draft with title/location/countdownDate MISSING entirely — proving the
// round-9 finding: round 8 "preserved" the unrelated content but silently dropped the fields
// this check itself is supposed to restore, which the round-9 set-to-baseline fix does not.
const round8Result = round8CleanupAction(draftWithRealEditorContent);
check(
  round8Result.action === 'unset',
  'the ROUND-8 (pre-round-9) cleanup decision unsets the three owned fields rather than restoring them',
  JSON.stringify(round8Result),
);
const round8PublishedShape = applyCleanupAction(draftWithRealEditorContent, round8Result);
check(
  round8PublishedShape.title === undefined && round8PublishedShape.location === undefined && round8PublishedShape.countdownDate === undefined,
  'REVERT-AND-CONFIRM-RED: applying the ROUND-8 unset-based cleanup and then publishing leaves title/location/countdownDate MISSING from the document — the round-9 data-loss finding',
  JSON.stringify(round8PublishedShape),
);
const round9PublishedShape = applyCleanupAction(draftWithRealEditorContent, fixedDataLossResult);
check(
  round9PublishedShape.title === baseline.title && round9PublishedShape.location === baseline.location && round9PublishedShape.countdownDate === baseline.countdownDate,
  'the ROUND-9 restore-to-baseline cleanup leaves title/location/countdownDate correctly present with real content after a later publish — proving this test discriminates round-8 (still lossy) from round-9 (fixed) behaviour',
  JSON.stringify(round9PublishedShape),
);

// Confirm the "wholly ours, safe to fully delete" case is unaffected by the round-8 change: a
// full draft document containing ONLY our three fields (plus Sanity's own system keys) still
// results in an actual delete, not a needless unset-then-orphan.
const wholeOwnDraft = {
  _id: 'drafts.nationalShow',
  _type: 'nationalShow',
  _rev: 'rev-abc',
  _createdAt: '2026-08-22T10:00:00.000Z',
  _updatedAt: '2026-08-22T10:00:05.000Z',
  title: sentinels.title,
  location: sentinels.location,
  countdownDate: '2099-01-01T00:00:00.000Z',
};
const wholeOwnResult = fixedCleanupAction(wholeOwnDraft);
check(
  wholeOwnResult.action === 'delete',
  'fixed cleanup still fully deletes a draft holding ONLY our sentinel fields plus Sanity system keys — no other content to preserve',
  JSON.stringify(wholeOwnResult),
);

// A draft with unrelated content but NO sentinel-shaped field at all must still be left alone —
// round 8 must not start deleting/unsetting fields on drafts this check never touched.
const unrelatedWithContent = {
  _id: 'drafts.nationalShow',
  _type: 'nationalShow',
  title: 'Some Editor Title Not Ours',
  location: baseline.location,
  countdownDate: baseline.countdownDate,
  hero: { alt: 'Unrelated' },
};
const unrelatedWithContentResult = fixedCleanupAction(unrelatedWithContent);
check(
  unrelatedWithContentResult.action === 'skip',
  'fixed cleanup still leaves a draft alone entirely when no field is sentinel-shaped, even if it holds other content',
  JSON.stringify(unrelatedWithContentResult),
);

if (failures === 0) {
  console.log(
    "PASS: A1's draft-cleanup now matches on any sentinel-shaped field (not an all-or-nothing exact match), " +
      'attempting cleanup and alerting rather than silently skipping a partially-landed sentinel autosave.',
  );
  process.exit(0);
} else {
  console.error(`FAIL: ${failures} check(s) failed — see above.`);
  process.exit(1);
}
