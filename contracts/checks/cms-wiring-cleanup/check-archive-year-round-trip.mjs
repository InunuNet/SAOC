#!/usr/bin/env node
// A1 — THE positive-path assertion for F2.
//
// Proves that a `show` document created in the Studio for a year that does NOT
// appear in the static lib/data/shows array gets a real, rendering detail page at
// /national-show/archive/<year>. Today it does not: the detail page reads
// staticShows exclusively and calls notFound() on a miss.
//
// Verified live during contract authoring (2026-08-11): the temp 1979 doc was
// created, the dataset readback matched, /national-show/archive/1979 returned 404
// (the honest pre-implementation result), the sentinel DID appear on the
// already-Sanity-backed archive LIST after ~60s (confirming propagation works and
// the check is not measuring a broken pipe), and cleanup was verified from both the
// dataset and the rendered list. So this check fails today for the right reason and
// will pass only when @dev actually wires the detail page.
//
// 1979 is chosen deliberately: it is a real triennial slot, it is absent from
// lib/data/shows, and it is absent from the dataset — so the check cannot collide
// with real content, and a Sanity-only year is exactly the case under test.
//
// MUTATES the dataset. Cleanup is guaranteed by try/finally and verified against
// BOTH the dataset and the rendered page; failure to verify removal raises a
// RESIDUE ALERT (exit 90), not an ordinary failure.

import {
  loadEnv,
  mutate,
  groq,
  fetchPage,
  pollUntil,
  pageOmits,
  sentinel,
  assertDevServerUp,
  raiseResidueAlert,
  installCrashGuard,
  pass,
  fail,
  PROPAGATION_TIMEOUT_MS,
  PROPAGATION_INTERVAL_MS,
  CLEANUP_TIMEOUT_MS,
  CLEANUP_INTERVAL_MS,
} from './_shared.mjs';

installCrashGuard('check-archive-year-round-trip');

const TEMP_ID = 'zzcheck-cms-wiring-show-1979';
const YEAR = 1979;
const PATH = `/national-show/archive/${YEAR}`;

const env = loadEnv();
await assertDevServerUp();

// Refuse to run if a real document already occupies this year — never overwrite content.
const collision = await groq(env, 'count(*[_type == "show" && year == $y && _id != $id])', {
  y: YEAR,
  id: TEMP_ID,
});
if (collision > 0) {
  fail(
    `a real \`show\` document already exists for ${YEAR}. This check refuses to run rather than ` +
      'risk colliding with real content. Pick a different sentinel year and update this check.'
  );
}

const marker = sentinel('ARCHIVEYEAR');
let mutated = false;

try {
  await mutate(env, [
    {
      createOrReplace: {
        _id: TEMP_ID,
        _type: 'show',
        title: `Check Show ${marker}`,
        year: YEAR,
        status: 'past',
        location: marker,
        entries: 111,
      },
    },
  ]);
  mutated = true;
  console.log(`Created temporary \`show\` document for ${YEAR} (sentinel ${marker}).`);

  const rendered = await pollUntil(
    `${PATH} renders the Sanity-only show`,
    async () => {
      const { status, html } = await fetchPage(PATH);
      return status === 200 && html.includes(marker);
    },
    PROPAGATION_TIMEOUT_MS,
    PROPAGATION_INTERVAL_MS
  );

  if (!rendered) {
    const { status } = await fetchPage(PATH);
    console.error(
      `FAIL: ${PATH} did not render the Sanity-only show (last status ${status}). A show document ` +
        'created in the Studio still has no detail page behind it — the defect this feature exists ' +
        'to close. Expected HTTP 200 containing the sentinel location.'
    );
    process.exitCode = 1;
  } else {
    console.log(`${PATH} rendered the Sanity-only show correctly.`);
  }
} finally {
  if (mutated) {
    let removed = false;
    try {
      await mutate(env, [{ delete: { id: TEMP_ID } }]);
      const remaining = await groq(env, 'count(*[_id == $id])', { id: TEMP_ID });
      if (remaining !== 0) {
        throw new Error(`dataset still holds ${remaining} copy/copies of ${TEMP_ID}`);
      }
      console.log('Cleanup: temporary document deleted from the dataset.');
      removed = await pollUntil(
        'sentinel gone from the rendered archive',
        async () =>
          (await pageOmits(PATH, marker)) && (await pageOmits('/national-show/archive', marker)),
        CLEANUP_TIMEOUT_MS,
        CLEANUP_INTERVAL_MS
      );
    } catch (err) {
      raiseResidueAlert(
        `Cleanup of ${TEMP_ID} (sentinel ${marker}) failed: ${err.message}\n` +
          `Delete the document manually and re-check ${PATH} and /national-show/archive.`
      );
      removed = false;
    }
    if (!removed) {
      raiseResidueAlert(
        `Sentinel ${marker} could not be proven gone from the rendered pages within ` +
          `${CLEANUP_TIMEOUT_MS}ms. The dataset delete may have succeeded while a cached copy ` +
          'is still being served — verify manually before trusting this result.'
      );
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
pass(`a Studio-created show for ${YEAR} renders at ${PATH}, and cleanup was verified end to end.`);
