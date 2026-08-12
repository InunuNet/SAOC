#!/usr/bin/env node
// A3 — THE positive-path assertion for F3 (province wired, not removed).
//
// Renaming a `province` document in the Studio must change what a visitor sees on
// /societies. Today it cannot: the filter chips come from the hardcoded
// lib/data/provinces array, and the nine `province` documents in the dataset are read
// by nothing.
//
// The chips currently render only the two/three-letter CODE ("WC"), never the name,
// so a name edit would have no rendered surface even once the data is wired. The
// contract therefore requires each chip to carry its province name as an aria-label —
// which is also a genuine accessibility fix (a bare "WC" button is opaque to a screen
// reader) rather than a marker invented purely to be testable.
//
// MUTATES one field of one real province document. The exact prior value is captured
// first and restored in a `finally`; failure to prove restoration raises a RESIDUE
// ALERT (exit 90).

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

installCrashGuard('check-province-round-trip');

const PATH = '/societies';
const TARGET_CODE = 'NC'; // Northern Cape — one society, least disruptive if anything lingers.

const env = loadEnv();
await assertDevServerUp();

const doc = await groq(env, '*[_type == "province" && code == $code][0]{_id, name, code}', {
  code: TARGET_CODE,
});
if (!doc?._id) {
  fail(
    `no \`province\` document with code "${TARGET_CODE}" found in the dataset. This check needs a ` +
      'real province document to rename; it will not create one.'
  );
}
const baselineName = doc.name ?? null;
console.log(`Target province document ${doc._id} (code ${TARGET_CODE}), baseline name captured.`);

const marker = sentinel('PROVINCE');
let mutated = false;

try {
  await mutate(env, [{ patch: { id: doc._id, set: { name: marker } } }]);
  mutated = true;

  const visible = await pollUntil(
    `${PATH} reflects the renamed province`,
    async () => {
      const { status, html } = await fetchPage(PATH);
      return status === 200 && html.includes(marker);
    },
    PROPAGATION_TIMEOUT_MS,
    PROPAGATION_INTERVAL_MS
  );

  if (!visible) {
    console.error(
      `FAIL: renaming province ${TARGET_CODE} did not change anything on ${PATH}. The \`province\` ` +
        'document type is still editable in the Studio and read by nothing — an editor publishes ' +
        'and sees no effect, which is exactly what this feature exists to stop. Expected the ' +
        "province name to appear as the chip's aria-label."
    );
    process.exitCode = 1;
  } else {
    console.log('Renamed province propagated to the rendered page.');
  }
} finally {
  if (mutated) {
    let restored = false;
    try {
      const restore =
        baselineName === null
          ? { patch: { id: doc._id, unset: ['name'] } }
          : { patch: { id: doc._id, set: { name: baselineName } } };
      await mutate(env, [restore]);
      const now = await groq(env, '*[_id == $id][0].name', { id: doc._id });
      const exact = baselineName === null ? now === null || now === undefined : now === baselineName;
      if (!exact) throw new Error('dataset value does not match the captured baseline after restore');
      console.log('Cleanup: province name restored to its exact baseline in the dataset.');
      restored = await pollUntil(
        'sentinel gone from the rendered page',
        () => pageOmits(PATH, marker),
        CLEANUP_TIMEOUT_MS,
        CLEANUP_INTERVAL_MS
      );
    } catch (err) {
      raiseResidueAlert(
        `Restoring province ${doc._id} to its baseline name failed: ${err.message}\n` +
          `Sentinel written was ${marker}. Fix the document manually in the Studio.`
      );
      restored = false;
    }
    if (!restored) {
      raiseResidueAlert(
        `Sentinel ${marker} could not be proven gone from ${PATH} within ${CLEANUP_TIMEOUT_MS}ms.`
      );
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
pass('a province renamed in the dataset changes /societies, and the baseline was restored exactly.');
