#!/usr/bin/env node
// A8 — secondary reinforcement only. Every successful App Hosting build embeds new
// `_next/static/**` asset hashes in the served HTML, so the ETag of `/` changing is
// a cheap, always-true-on-a-real-redeploy signal — independent of whether F1's
// specific content fix is correct (that's A1's job). This check exists to catch
// the "the rollout reported success but a CDN/edge cache is still serving the old
// build" failure mode, which A1/A2 alone would not distinguish from "the deploy
// never actually happened."
import { fail, pass, BASE_URL } from './_shared.mjs';

// Recorded by @architect on 2026-07-29 against the live pre-deploy prod host —
// see contracts/f2-deploy-next16.yaml header for the full curl transcript.
const PRE_DEPLOY_ETAG = '176ebrtkypf1pnd';

let response;
try {
  response = await fetch(`${BASE_URL}/`, { method: 'GET' });
} catch (err) {
  fail(`could not fetch ${BASE_URL}/ — ${err?.message ?? err}`);
}

if (!response.ok) {
  fail(`${BASE_URL}/ returned HTTP ${response.status}`);
}

const etagRaw = response.headers.get('etag');
if (!etagRaw) {
  fail(`${BASE_URL}/ returned no ETag header — cannot compare against the pre-deploy baseline`);
}

const etag = etagRaw.replace(/^"|"$/g, '').replace(/^W\//, '');

if (etag === PRE_DEPLOY_ETAG) {
  fail(
    `${BASE_URL}/ still serves ETag "${etag}", identical to the recorded pre-deploy ` +
      'baseline. Either the deploy has not actually reached this host yet, or a CDN/edge ' +
      'cache is serving the old build.'
  );
}

pass(`${BASE_URL}/ ETag changed from the pre-deploy baseline ("${PRE_DEPLOY_ETAG}" -> "${etag}")`);
