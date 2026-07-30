// A9 — POSITIVE-PATH: proves SANITY_REVALIDATE_SECRET actually resolves at runtime on
// the deployed host, not merely that wrong/absent secrets are rejected. This is the
// gap A1-A4/A7/A8 all missed: every one of them tested a negative path (wrong
// content, wrong structure, missing config, unchanged etag) — none could have caught
// prod returning 401 for the CORRECT secret too, which is exactly what happened (see
// docs/f2-secret-runtime-investigation.md, backlog.md "F2 — open contradiction to
// resolve next session").
//
// Exercises BOTH routes gated by the same secret so this cannot be gamed by fixing
// one and leaving the other broken:
//   - POST /api/revalidate: correct secret -> 200, wrong -> 401, absent -> 401
//   - GET /api/draft?secret=...&slug=/: correct secret -> 3xx redirect (not followed),
//     wrong -> 401, absent -> 401
// All six requests run against the same live endpoint in one process, so a fix that
// only weakens the auth guard (e.g. removing the comparison) cannot pass — the
// wrong/absent cases must still 401.
//
// Secret is extracted with grep|cut per mission convention
// (.agent/memory/project/missions/OVERNIGHT-PLAN-2026-07-30.md, "Standing
// constraints") — NEVER via the dotenv package, whose banner has polluted stdout and
// produced a malformed header before. The secret value is never printed, logged, or
// included in any PASS/FAIL message. Its length is asserted (43 chars, the known-good
// value confirmed byte-identical to Secret Manager per this contract's header) before
// use, since a truncated/mangled read would otherwise silently produce a false FAIL.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fail, pass, PROD_URL } from './_shared.mjs';

const EXPECTED_SECRET_LENGTH = 43;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function loadRevalidateSecret() {
  let raw;
  try {
    raw = execSync("grep '^SANITY_REVALIDATE_SECRET=' .env.local | cut -d= -f2-", {
      cwd: repoRoot,
      encoding: 'utf8',
    });
  } catch {
    raw = '';
  }
  return raw.trim();
}

const secret = loadRevalidateSecret();
if (!secret) {
  fail(
    'SANITY_REVALIDATE_SECRET not found in .env.local (grep | cut returned empty) — cannot ' +
      'exercise the positive path without the real secret. This must FAIL, not skip: a ' +
      'missing secret proves nothing about whether the deployed host resolves it ' +
      '(Athanor#1322).'
  );
}
if (secret.length !== EXPECTED_SECRET_LENGTH) {
  fail(
    `Secret read from .env.local is ${secret.length} chars, expected ` +
      `${EXPECTED_SECRET_LENGTH} — the grep|cut read is likely truncated or mangled. ` +
      'Refusing to run the positive-path test against a value that may not match ' +
      'Secret Manager (never logging the value itself).'
  );
}

async function postRevalidateStatus(headers) {
  const res = await fetch(`${PROD_URL}/api/revalidate`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  return res.status;
}

async function getDraftStatus(secretParam) {
  const url = new URL(`${PROD_URL}/api/draft`);
  if (secretParam !== undefined) url.searchParams.set('secret', secretParam);
  url.searchParams.set('slug', '/');
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

const revalidateCorrect = await postRevalidateStatus({
  'content-type': 'application/json',
  'x-sanity-secret': secret,
});
const revalidateWrong = await postRevalidateStatus({
  'content-type': 'application/json',
  'x-sanity-secret': 'wrong-secret-deliberately-invalid',
});
const revalidateAbsent = await postRevalidateStatus({ 'content-type': 'application/json' });

const draftCorrect = await getDraftStatus(secret);
const draftWrong = await getDraftStatus('wrong-secret-deliberately-invalid');
const draftAbsent = await getDraftStatus(undefined);

const problems = [];
if (revalidateCorrect !== 200) {
  problems.push(`POST /api/revalidate correct secret -> expected 200, got ${revalidateCorrect}`);
}
if (revalidateWrong !== 401) {
  problems.push(
    `POST /api/revalidate wrong secret -> expected 401, got ${revalidateWrong} (auth check weakened?)`
  );
}
if (revalidateAbsent !== 401) {
  problems.push(
    `POST /api/revalidate absent secret -> expected 401, got ${revalidateAbsent} (auth check weakened?)`
  );
}
if (draftCorrect < 300 || draftCorrect >= 400) {
  problems.push(`GET /api/draft correct secret -> expected 3xx redirect, got ${draftCorrect}`);
}
if (draftWrong !== 401) {
  problems.push(
    `GET /api/draft wrong secret -> expected 401, got ${draftWrong} (auth check weakened?)`
  );
}
if (draftAbsent !== 401) {
  problems.push(
    `GET /api/draft absent secret -> expected 401, got ${draftAbsent} (auth check weakened?)`
  );
}

if (problems.length > 0) {
  fail(`${PROD_URL}: ${problems.join('; ')}`);
}

pass(
  `${PROD_URL}: /api/revalidate correct->200/wrong->401/absent->401, /api/draft ` +
    'correct->3xx/wrong->401/absent->401. SANITY_REVALIDATE_SECRET resolves at runtime ' +
    'on both gated routes and the auth check still rejects bad input.'
);
