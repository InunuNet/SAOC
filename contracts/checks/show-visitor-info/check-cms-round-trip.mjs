#!/usr/bin/env node
// THE VENUE-CHANGE TEST, causal half — proves an edit in the dataset actually reaches the
// rendered page, rather than the page merely happening to display matching text today.
//
// MUTATES showVisitorInfo.parking, deliberately: that field is rendered on exactly one page
// (/national-show/plan-your-visit) and is read by nothing else on the site, so a failed
// cleanup has the smallest possible blast radius. It does NOT mutate nationalShow.venue —
// that document is show identity and is also read by /contact and (via location) the landing
// hero, and contracts/checks/cms-loop-f3-national-show already owns mutating that document.
//
// CLEANUP IS STRUCTURAL: the baseline is captured before any write, the restore runs in a
// `finally`, and nothing inside the try block calls process.exit() — process.exit() does not
// unwind the stack, so a bare exit inside the try would silently skip the restore. That is a
// real incident this project has already had; see
// contracts/checks/f6-prove-cms-loop/_shared.mjs.
//
// CLEANUP IS ALSO CONCURRENCY-SAFE, since 2026-08-11. It was not before, and the omission put
// QA sentinel text on a live public page. Two runs interleaved: run B captured run A's sentinel
// as its "baseline" — the only validation was `typeof === 'string' && !== ''`, which a sentinel
// passes — and then restored that garbage and reported a clean cleanup. That, not slowness, is
// why A42 was intermittently red. See .agent/memory/scratch/visitor-qa.md S3. Three defences
// now, all in _mutation-guard.mjs: a sentinel-shaped baseline is a hard refusal to start, the
// whole window is held under an exclusive lock, and the restore is guarded by the revision our
// own write produced so a concurrent writer makes it fail loudly instead of silently clobbering.
//
// Exit codes: 0 = round trip proven and cleanup verified. 1 = ordinary failure.
// 2 = RESIDUE ALERT — the mutation landed but the restore could not be verified. Treat that
// as a live content incident, not as "the feature isn't wired yet".

import {
  runCheck,
  fetchPage,
  getSanityClient,
  loadEnvOrFail,
  callRevalidate,
  textContains,
  PATHS,
} from './_shared.mjs';
import {
  withDatasetLock,
  assertUsableBaseline,
  makeSentinel,
  commitAndCaptureRev,
  restoreGuarded,
  verifyDatasetRestored,
  residueAlert,
} from './_mutation-guard.mjs';

const DOC_ID = 'showVisitorInfo';
const FIELD = 'parking';
// Propagation is bounded by the Sanity CDN, not by /api/revalidate: sanity/lib/fetch.ts sets
// useCdn:true, so revalidateTag purges the Next cache and the refetch then reads a CDN copy that
// can still be stale. @qa measured 64s, 72s and ~96s across three mutations under load — 180s
// was only ~2x the worst observed, which is not headroom, it is a coin flip.
const POLL_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 5_000;

async function poll(predicate, label) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    attempt += 1;
    const result = await predicate();
    console.log(`  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s): ${JSON.stringify(result)}`);
    if (result.ok) return { ok: true, attempts: attempt };
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}

await runCheck('check-cms-round-trip', async (r) => {
  const secret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
  const client = getSanityClient({ withToken: true });

  await withDatasetLock('check-cms-round-trip', async () => {
  const baselineDoc = await client.fetch('*[_id == $id][0]{ parking }', { id: DOC_ID });
  const baseline = baselineDoc?.[FIELD];

  // Defence 1: a sentinel-shaped baseline means an earlier run left residue that has been
  // RENDERING LIVE. Throwing here is deliberate — restoring it would make the residue permanent.
  assertUsableBaseline(`${DOC_ID}.${FIELD}`, baseline);

  const sentinel = makeSentinel('PARKING');
  let mutated = false;
  let proven = false;
  let sentinelRev = null;

  try {
    sentinelRev = await commitAndCaptureRev(client, DOC_ID, { [FIELD]: sentinel });
    mutated = true;
    console.log(`Wrote sentinel to ${DOC_ID}.${FIELD}: ${sentinel}`);

    const reval = await callRevalidate(secret, DOC_ID);
    r.check(reval.status === 200, '/api/revalidate accepted the invalidation', `status ${reval.status}`);

    // Two-sided: the sentinel must appear AND the baseline must disappear. One-sided would
    // pass against a page that renders both, or that renders neither and matched on the
    // sentinel appearing somewhere in an unrelated payload.
    const propagation = await poll(async () => {
      const { status, body } = await fetchPage(PATHS.plan);
      const hasSentinel = textContains(body, sentinel);
      const baselineGone = !textContains(body, baseline.slice(0, 60));
      return { ok: status === 200 && hasSentinel && baselineGone, status, hasSentinel, baselineGone };
    }, 'propagation');

    proven = propagation.ok;
    r.check(
      propagation.ok,
      `an edit to ${DOC_ID}.${FIELD} reaches ${PATHS.plan} within ${POLL_TIMEOUT_MS / 1000}s`,
      'the sentinel never appeared (or the old value never disappeared) — the page is not actually reading this field from Sanity',
    );
  } finally {
    if (mutated) {
      console.log('--- Cleanup: restoring the captured baseline (always attempted) ---');
      try {
        // Defence 3: only restore if the document is still at the revision OUR write produced.
        // If anything else wrote in between, this throws rather than silently overwriting it.
        await restoreGuarded(client, DOC_ID, { [FIELD]: baseline }, sentinelRev);
        const verified = await verifyDatasetRestored(client, DOC_ID, { [FIELD]: baseline });
        await callRevalidate(secret, DOC_ID);

        const clean = await poll(async () => {
          const { body } = await fetchPage(PATHS.plan);
          return { ok: !textContains(body, sentinel), sentinelGone: !textContains(body, sentinel) };
        }, 'cleanup');

        if (!verified.ok || !clean.ok) {
          residueAlert([
            `field: ${DOC_ID}.${FIELD}`,
            `sentinel: ${sentinel}`,
            `dataset restored: ${verified.ok}`,
            `sentinel absent from ${PATHS.plan}: ${clean.ok}`,
            `baseline to restore: ${JSON.stringify(baseline)}`,
          ]);
        } else {
          console.log('Cleanup verified: dataset restored and the sentinel is gone from the live page.');
        }
      } catch (cleanupErr) {
        residueAlert([
          `field: ${DOC_ID}.${FIELD}`,
          `sentinel: ${sentinel}`,
          `restore threw: ${cleanupErr.message}`,
          'A revision-guard failure means SOMETHING ELSE WROTE to this document during the check.',
          `baseline to restore: ${JSON.stringify(baseline)}`,
        ]);
      }
    }
    if (!proven && mutated) {
      console.log('NOTE: the round trip was not proven, but cleanup ran regardless.');
    }
  }
  });
});
