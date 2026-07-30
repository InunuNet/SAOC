// A10 — build-identity discriminator. Resolves the backlog contradiction: a prior
// build-resource inspection claimed prod served pre-F3 commit df5ee43, while
// behavioural evidence (Studio showing F3's pinned singleton editor) said otherwise.
// See docs/f2-secret-runtime-investigation.md and .agent/memory/project/backlog.md
// "F2 — open contradiction to resolve next session".
//
// ETag (A8) is ruled out per dispatch brief — ISR regeneration changes it independent
// of a real redeploy. Trusting a single build-resource GET in isolation is ALSO
// unreliable, per this same contradiction — the prior inspection read a real build
// (build-2026-07-28-006, commit df5ee43) that was simply no longer the one serving
// traffic by the time Studio was re-checked. So this check cross-validates the
// control plane from two independent APIs instead of one:
//   1. App Hosting's backend traffic object — the source of truth for what a real
//      request actually gets routed to. A split/canary state (more than one build in
//      `current.splits`) is a hard FAIL: partial traffic proves nothing about what any
//      given request will see, so a discriminator can't be "decisive" while split.
//   2. The underlying Cloud Run service, an independent control plane in the same
//      project — its `latestReadyRevision` and its sole `traffic` entry with
//      percent > 0 must name the SAME build as (1). Agreement between the two rules
//      out a stale App Hosting traffic object left over from a reconcile that hasn't
//      finished, and rules out Cloud Run itself still warming up a different revision.
// Only once both agree does this check trust that build's `source.codebase.hash` as
// the real, currently-serving commit — then confirms via `git merge-base
// --is-ancestor` that it descends from all three commits this feature cares about
// (F1 hydration fix, F3 singleton pinning, F2's own apphosting.yaml secrets commit).
// That is decisive in a way no content hash can be: 84dbf58 (F2) touches ONLY
// apphosting.yaml, so a build from 84dbf58 is BYTE-IDENTICAL in its _next/static/**
// output to a build from ffb4225 (F3) — no asset hash or ETag can ever tell those two
// apart. Git ancestry of the build's own recorded commit can.
//
// Auth: reuses the Firebase CLI's own cached OAuth token (no gcloud in this env), per
// docs/f2-secret-runtime-investigation.md "How I'm getting authenticated REST
// access". Never prints the token. A missing/expired token, an unreachable API, a
// split traffic state, disagreement between the two control planes, or a target SHA
// unknown even after `git fetch origin` are all hard FAILs, never a skip
// (Athanor#1322) — this check proves nothing about which build is live without all of
// that lining up.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fail, pass } from './_shared.mjs';

const PROJECT_ID = 'saoc-webapp';
const LOCATION = 'europe-west4';
const BACKEND_ID = 'saoc-prod';
// Commits this feature needs proven live: F1 (hydration), F3 (singleton pinning),
// F2 (this feature's own apphosting.yaml secrets commit). The build must descend
// from all three for A10 to mean anything.
const REQUIRED_ANCESTORS = {
  '604ba3a': 'F1 hydration fix',
  ffb4225: 'F3 singleton pinning',
  '84dbf58': 'F2 apphosting.yaml secrets',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function loadFirebaseAccessToken() {
  let raw;
  try {
    raw = readFileSync(`${process.env.HOME}/.config/configstore/firebase-tools.json`, 'utf8');
  } catch {
    return null;
  }
  try {
    const token = JSON.parse(raw)?.tokens?.access_token;
    return token || null;
  } catch {
    return null;
  }
}

async function googleGet(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'X-Goog-User-Project': PROJECT_ID },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

function buildIdFromResourceName(name) {
  // ".../backends/saoc-prod/builds/<id>" (App Hosting) or a Cloud Run revision name
  // like "saoc-prod-build-2026-07-30-001" — normalise both to the bare build id.
  const parts = name.split('/');
  const last = parts[parts.length - 1];
  return last.startsWith(`${BACKEND_ID}-`) ? last.slice(`${BACKEND_ID}-`.length) : last;
}

const token = loadFirebaseAccessToken();
if (!token) {
  fail(
    'No cached Firebase CLI OAuth token at ~/.config/configstore/firebase-tools.json — ' +
      'cannot query the App Hosting / Cloud Run control planes. This must FAIL, not skip: ' +
      'without real API access this check proves nothing (Athanor#1322).'
  );
}

// --- 1. App Hosting traffic: source of truth for what real requests get routed to ---
let traffic;
try {
  traffic = await googleGet(
    `https://firebaseapphosting.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/backends/${BACKEND_ID}/traffic`,
    token
  );
} catch (err) {
  fail(`Could not fetch App Hosting traffic config: ${err.message}`);
}
const splits = traffic?.current?.splits ?? [];
if (splits.length !== 1) {
  fail(
    `App Hosting traffic is split across ${splits.length} build(s), not a single 100% ` +
      `target (${JSON.stringify(splits)}) — a split/canary state means no single build is ` +
      'decisively "the" one serving, so this check cannot be trusted while split.'
  );
}
if (splits[0].percent !== 100) {
  fail(`App Hosting's sole traffic split is ${splits[0].percent}%, not 100%: ${JSON.stringify(splits[0])}`);
}
const appHostingBuildId = buildIdFromResourceName(splits[0].build);

// --- 2. Cloud Run: independent control plane, must agree with (1) ---
let service;
try {
  service = await googleGet(
    `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${LOCATION}/services/${BACKEND_ID}`,
    token
  );
} catch (err) {
  fail(`Could not fetch the Cloud Run service: ${err.message}`);
}
const latestReadyRevision = service?.latestReadyRevision;
const servingRevisionName = service?.template?.revision;
if (!latestReadyRevision || !servingRevisionName) {
  fail(
    `Cloud Run service is missing latestReadyRevision or template.revision ` +
      `(latestReadyRevision=${latestReadyRevision}, template.revision=${servingRevisionName}).`
  );
}
const latestReadyBuildId = buildIdFromResourceName(latestReadyRevision);
const servingBuildId = buildIdFromResourceName(servingRevisionName);

if (latestReadyBuildId !== servingBuildId) {
  fail(
    `Cloud Run's latestReadyRevision (${latestReadyBuildId}) disagrees with the revision its ` +
      `own template is actually serving (${servingBuildId}) — a reconcile may be in progress.`
  );
}
if (servingBuildId !== appHostingBuildId) {
  fail(
    `App Hosting traffic names build ${appHostingBuildId} at 100%, but Cloud Run is actually ` +
      `serving ${servingBuildId} — the two control planes disagree, so neither can be trusted ` +
      'alone. Do not proceed until they agree.'
  );
}

// --- 3. Resolve that build's recorded source commit ---
let build;
try {
  build = await googleGet(
    `https://firebaseapphosting.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/backends/${BACKEND_ID}/builds/${appHostingBuildId}`,
    token
  );
} catch (err) {
  fail(`Could not fetch build resource ${appHostingBuildId}: ${err.message}`);
}
if (build.state !== 'READY') {
  fail(
    `Build ${appHostingBuildId} — which both control planes agree is serving 100% of traffic ` +
      `— is state=${build.state}, not READY. That should not be possible; investigate.`
  );
}
const commitHash = build?.source?.codebase?.hash;
const commitMessage = build?.source?.codebase?.commitMessage;
const commitTime = build?.source?.codebase?.commitTime;
if (!commitHash) {
  fail(`Build ${appHostingBuildId} has no source.codebase.hash — cannot identify its commit.`);
}

// --- 4. Confirm the served commit descends from every commit this feature needs live ---
try {
  execFileSync('git', ['fetch', 'origin', '--quiet'], { cwd: repoRoot, stdio: 'pipe' });
} catch (err) {
  fail(`git fetch origin failed — cannot verify ancestry without it: ${err.message}`);
}

const missingAncestors = [];
for (const [sha, label] of Object.entries(REQUIRED_ANCESTORS)) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, commitHash], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch {
    missingAncestors.push(`${sha} (${label})`);
  }
}

if (missingAncestors.length > 0) {
  fail(
    `Currently-serving build ${appHostingBuildId} is commit ${commitHash} ("${commitMessage}"), ` +
      `but it does NOT descend from: ${missingAncestors.join(', ')}. Production is not yet ` +
      'running all the code this feature requires.'
  );
}

pass(
  `Currently-serving build is ${appHostingBuildId} (state READY, 100% traffic, agreed by ` +
    `App Hosting and Cloud Run), compiled from commit ${commitHash} ("${commitMessage}", ` +
    `committed ${commitTime}). Confirmed via git merge-base --is-ancestor that it descends ` +
    `from all of: ${Object.entries(REQUIRED_ANCESTORS)
      .map(([sha, label]) => `${sha} (${label})`)
      .join(', ')}. This settles the df5ee43 contradiction: production is serving current code, ` +
    'not the stale pre-F1/F3 build a prior inspection reported.'
);
