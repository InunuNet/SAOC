#!/usr/bin/env node
// A5 — F4 positive path: aboutPage.title must actually reach the page.
//
// This is the project's canonical false-green: `title` is fetched at
// app/(marketing)/about/page.tsx:19-20 and declared in AboutPageData, so any
// substring grep for "title" passes — while the PageHero heading is a hardcoded
// literal and the field renders nowhere. Only a round trip catches it, which is why
// this check exists in this form.
//
// The field is currently NULL in the dataset (confirmed live 2026-08-11), so the
// baseline restore is an `unset`, and the page must fall back to its existing
// hardcoded heading afterwards — asserted here, so "wire it" cannot be implemented as
// "delete the fallback and render an empty heading".
//
// MUTATES aboutPage.title. Guaranteed restore; RESIDUE ALERT (exit 90) if unproven.

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

installCrashGuard('check-about-title-round-trip');

const PATH = '/about';
const FALLBACK_HEADING = 'A federated body of growers, since 1968.';

const env = loadEnv();
await assertDevServerUp();

const docId = await groq(env, '*[_type == "aboutPage"][0]._id');
if (!docId) fail('no `aboutPage` singleton found in the dataset.');
const baseline = await groq(env, '*[_type == "aboutPage"][0].title');
console.log(`aboutPage ${docId}: baseline title is ${baseline === null || baseline === undefined ? 'unset' : 'a value (captured)'}.`);

const marker = sentinel('ABOUTTITLE');
let mutated = false;

try {
  await mutate(env, [{ patch: { id: docId, set: { title: marker } } }]);
  mutated = true;

  const visible = await pollUntil(
    `${PATH} renders aboutPage.title`,
    async () => {
      const { status, html } = await fetchPage(PATH);
      return status === 200 && html.includes(marker);
    },
    PROPAGATION_TIMEOUT_MS,
    PROPAGATION_INTERVAL_MS
  );

  if (!visible) {
    console.error(
      `FAIL: aboutPage.title is still not rendered on ${PATH}. It is fetched into a variable and ` +
        'never placed in JSX — the exact silent no-op an editor experiences as "the CMS is broken".'
    );
    process.exitCode = 1;
  } else {
    console.log('aboutPage.title propagated to the rendered page.');
  }
} finally {
  if (mutated) {
    let restored = false;
    try {
      const restore =
        baseline === null || baseline === undefined
          ? { patch: { id: docId, unset: ['title'] } }
          : { patch: { id: docId, set: { title: baseline } } };
      await mutate(env, [restore]);
      const now = await groq(env, '*[_type == "aboutPage"][0].title');
      const exact =
        baseline === null || baseline === undefined
          ? now === null || now === undefined
          : now === baseline;
      if (!exact) throw new Error('post-restore value does not match the captured baseline');
      console.log('Cleanup: aboutPage.title restored to its exact baseline.');
      restored = await pollUntil(
        'sentinel gone from /about',
        () => pageOmits(PATH, marker),
        CLEANUP_TIMEOUT_MS,
        CLEANUP_INTERVAL_MS
      );
    } catch (err) {
      raiseResidueAlert(
        `Restoring aboutPage.title failed: ${err.message}\nSentinel written was ${marker}.`
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

// With the field unset again, the page must still show a heading — wiring may not
// mean "replace the hardcoded copy with nothing".
const after = await pollUntil(
  '/about falls back to its hardcoded heading when title is unset',
  async () => {
    const { status, html } = await fetchPage(PATH);
    return status === 200 && html.includes(FALLBACK_HEADING);
  },
  CLEANUP_TIMEOUT_MS,
  CLEANUP_INTERVAL_MS
);
if (!after) {
  fail(
    `with aboutPage.title unset, ${PATH} no longer renders its fallback heading ` +
      `("${FALLBACK_HEADING}"). Wiring the field must keep a fallback, in ` +
      '(sanityValue ?? fallback) order — never the reverse.'
  );
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
pass('aboutPage.title renders when set, falls back when unset, and the baseline was restored.');
