#!/usr/bin/env node
// F5 (cms-activation-deploy): the REAL payoff — /events/<slug> must actually RENDER
// for seeded slugs, not merely have a populated field. This is the check F2 taught us
// to write (six green assertions there all tested the negative path and shipped a
// broken deploy) and the mission brief's explicit requirement: fetch the route, assert
// 200 with expected content.
//
// Verified against the LOCAL DEV SERVER at http://localhost:3333 (already running per
// mission constraints — never started, restarted, or killed by this script). Chosen
// over the deployed host because: (a) F2 — the production deploy — is still in
// progress concurrently (a different dev is mid-flight on it per team-lead), so the
// deployed host's state is not a stable target for F5's own checks right now; (b) F5
// has no dependency on F2 landing — event slugs are dataset content, not a deploy
// concern; (c) the dev server reads the same live Sanity dataset (no local/prod
// dataset split in this project), so a route that renders correctly here reads from
// the same documents F4/F5 write to. Once F2 is confirmed shipped, re-pointing this
// script at the production host is a one-line BASE_URL change, not a rewrite.
//
// Paired positive/negative: every seeded slug must return 200 with the event's title
// in the HTML body; a deliberately-invalid slug must return 404 — proves the route
// isn't just returning 200 unconditionally (e.g. a broken catch-all).
//
// Run as: node --import tsx/esm contracts/checks/f5-event-slugs/check-route-renders.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local and the dev
// server already running on :3333.
// Exit codes: 0 = all seeded slugs render 200 with their title, and the negative
// control 404s. 1 = any mismatch, any unreachable host, or any infrastructure failure
// — never a silent skip.

import { getClientOrFail, fetchAllEvents } from './_shared.mjs';

const BASE_URL = 'http://localhost:3333';
const NEGATIVE_CONTROL_SLUG = 'definitely-not-a-real-event-slug-f5-negative-control';

const client = getClientOrFail();
const events = await fetchAllEvents(client);

if (events.length === 0) {
  console.error('FAIL: 0 societyEvent documents found — expected 18 (or a real, non-zero count)');
  process.exit(1);
}

const missing = events.filter((e) => typeof e.slug !== 'string' || e.slug.trim().length === 0);
if (missing.length > 0) {
  missing.forEach((e) => console.error(`FAIL: ${e._id} ("${e.title}"): no slug — cannot verify its route renders`));
  console.error(`\n${missing.length} of ${events.length} documents have no slug to test.`);
  process.exit(1);
}

async function fetchRoute(slug) {
  try {
    const res = await fetch(`${BASE_URL}/events/${encodeURIComponent(slug)}`, { redirect: 'manual' });
    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    console.error(`FAIL: could not reach ${BASE_URL}/events/${slug} — ${err.message} (is the :3333 dev server up?)`);
    process.exit(1);
  }
}

const failures = [];

for (const e of events) {
  const { status, body } = await fetchRoute(e.slug);
  if (status !== 200) {
    failures.push(`${e._id} ("${e.title}"): GET /events/${e.slug} returned ${status}, expected 200`);
    continue;
  }
  if (!body.includes(e.title)) {
    failures.push(`${e._id} ("${e.title}"): GET /events/${e.slug} returned 200 but the body does not contain the event title`);
  }
}

const negative = await fetchRoute(NEGATIVE_CONTROL_SLUG);
if (negative.status !== 404) {
  failures.push(
    `Negative control: GET /events/${NEGATIVE_CONTROL_SLUG} returned ${negative.status}, expected 404 — a route that 200s for a nonexistent slug would make every check above meaningless`
  );
}

console.log(`Checked ${events.length} event routes + 1 negative control against ${BASE_URL}.`);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(`PASS: all ${events.length} seeded event routes render 200 with their title, and the negative control 404s.`);
process.exit(0);
