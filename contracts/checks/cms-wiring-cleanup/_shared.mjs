// cms-wiring-cleanup: shared helpers, owned exclusively by this contract.
//
// Deliberately SELF-CONTAINED rather than importing from
// contracts/checks/f6-prove-cms-loop/_shared.mjs or cms-loop-f3-national-show/_shared.mjs.
// Those helpers are built around BASE_URL (the DEPLOYED App Hosting site) and around
// Playwright-driven Studio automation, and several of them hard-gate on F1's
// deployed short-TTL Cache-Control header. This contract is graded against the
// SHARED LOCAL DEV SERVER at http://localhost:3333 (this session has no live domain),
// where none of those gates apply and none of that machinery is needed. Reusing them
// would mean importing a deployed-site assumption into a localhost check.
//
// ============================================================================
// WHY ROUND TRIPS, NOT GREPS
// ============================================================================
// Grep-only assertions have produced repeated false greens on this project — most
// notably `aboutPage.title`, which a naive substring grep passes because the field
// name appears in a fetch and a type annotation, while the value is never rendered.
// Every behavioural claim in this contract is therefore proven by a real HTTP
// round trip: mutate the dataset -> poll the rendered HTML at localhost:3333 ->
// restore the dataset -> confirm the sentinel is gone from the rendered HTML.
// Greps are used ONLY for structural facts (a field removed from a schema file,
// an import form changed) where there is nothing to render.
//
// ============================================================================
// CLEANUP SAFETY — READ BEFORE EDITING
// ============================================================================
// Every mutating helper here THROWS on failure; none calls process.exit(). This is
// the same fix cms-loop-f3-national-show/_shared.mjs documents in its own header:
// process.exit() terminates without unwinding the stack, so a `finally` block whose
// entire purpose is to restore the dataset would be silently skipped. Callers wrap
// every mutation in try/finally and restore an exact captured baseline.
//
// ============================================================================
// SANITY CDN STALENESS — WHY POLLING IS BOUNDED, NOT INSTANT
// ============================================================================
// sanity/lib/client.ts sets `useCdn: true`, so a published mutation can take up to
// ~60s to become visible to the running app even though the dataset is already
// authoritative. Round-trip helpers therefore poll for up to PROPAGATION_TIMEOUT_MS
// rather than reading once. A single immediate read would produce a false FAIL.
//
// Never prints secret values: loadEnv() reports only whether a key is present.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const BASE_URL = process.env.SAOC_CHECK_BASE_URL ?? 'http://localhost:3333';

export const PROPAGATION_TIMEOUT_MS = 90_000;
export const PROPAGATION_INTERVAL_MS = 5_000;
export const CLEANUP_TIMEOUT_MS = 120_000;
export const CLEANUP_INTERVAL_MS = 5_000;

// A residue alert is louder than an ordinary failure: it means a check mutated the
// dataset and could NOT prove it restored the baseline. Distinct exit code so a
// human notices immediately rather than reading it as "assertion failed".
export const EXIT_CODE_RESIDUE_ALERT = 90;

export function loadEnv() {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`FAIL: ${envPath} not found — cannot reach the Sanity dataset.`);
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  const read = (key) => {
    const match = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (!match) return null;
    return match[1].trim().replace(/^["']|["']$/g, '');
  };
  const env = {
    projectId: read('NEXT_PUBLIC_SANITY_PROJECT_ID'),
    dataset: read('NEXT_PUBLIC_SANITY_DATASET') ?? 'production',
    token: read('SANITY_API_TOKEN'),
  };
  const missing = Object.entries(env)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    // Names only — never values.
    throw new Error(`FAIL: missing required .env.local keys: ${missing.join(', ')}`);
  }
  return env;
}

function apiBase(env, kind) {
  return `https://${env.projectId}.api.sanity.io/v2024-10-01/data/${kind}/${env.dataset}`;
}

export async function groq(env, query, params = {}) {
  const url = new URL(apiBase(env, 'query'));
  url.searchParams.set('query', query);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(`$${k}`, JSON.stringify(v));
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.token}` } });
  if (!res.ok) {
    throw new Error(`FAIL: Sanity query returned ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (body.error) throw new Error(`FAIL: Sanity query error — ${JSON.stringify(body.error)}`);
  return body.result;
}

export async function mutate(env, mutations) {
  const res = await fetch(`${apiBase(env, 'mutate')}?returnIds=true&visibility=sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mutations }),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`FAIL: Sanity mutation failed (${res.status}) — ${JSON.stringify(body.error ?? body)}`);
  }
  return body;
}

export async function fetchPage(pathname) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    headers: { 'cache-control': 'no-cache' },
    redirect: 'manual',
  });
  const html = res.status === 204 ? '' : await res.text();
  return { status: res.status, html };
}

export async function assertDevServerUp() {
  let res;
  try {
    res = await fetch(BASE_URL, { headers: { 'cache-control': 'no-cache' } });
  } catch (err) {
    throw new Error(
      `FAIL: no dev server reachable at ${BASE_URL} (${err.message}). This contract is graded ` +
        'against the shared local dev server — start it (or set SAOC_CHECK_BASE_URL) and re-run. ' +
        'Do NOT treat an unreachable server as a pass.'
    );
  }
  if (!res.ok) {
    throw new Error(`FAIL: ${BASE_URL} returned ${res.status} — dev server is up but not healthy.`);
  }
}

// Polls `predicate()` until it returns true or the budget runs out. Returns true/false;
// never throws on a normal timeout so callers can decide whether that is a FAIL or a
// diagnostic. `label` is logged so a timeout says what it was waiting for.
export async function pollUntil(label, predicate, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    let ok = false;
    try {
      ok = await predicate();
    } catch (err) {
      console.log(`  [${label}] attempt ${attempt} threw: ${err.message}`);
    }
    if (ok) {
      console.log(`  [${label}] satisfied on attempt ${attempt}`);
      return true;
    }
    if (Date.now() >= deadline) {
      console.log(`  [${label}] NOT satisfied after ${attempt} attempts (${timeoutMs}ms budget)`);
      return false;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function pageContains(pathname, needle) {
  const { status, html } = await fetchPage(pathname);
  return status === 200 && html.includes(needle);
}

export async function pageOmits(pathname, needle) {
  const { status, html } = await fetchPage(pathname);
  // A 404 also counts as "the sentinel is not visible to a visitor".
  if (status === 404) return true;
  return status === 200 && !html.includes(needle);
}

// Loud, unmissable failure for the case that actually matters: sentinel content was
// written and could not be proven removed from what a real visitor sees.
export function raiseResidueAlert(details) {
  console.error('');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('!! RESIDUE ALERT — test content may still be live. Manual check   !!');
  console.error('!! required. This is NOT an ordinary assertion failure.           !!');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error(details);
  console.error('');
  process.exitCode = EXIT_CODE_RESIDUE_ALERT;
}

export function sentinel(tag) {
  return `ZZCHECK-${tag}-${Date.now().toString(36).toUpperCase()}`;
}

export function pass(message) {
  console.log(`PASS: ${message}`);
  process.exit(process.exitCode === EXIT_CODE_RESIDUE_ALERT ? EXIT_CODE_RESIDUE_ALERT : 0);
}

export function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(process.exitCode === EXIT_CODE_RESIDUE_ALERT ? EXIT_CODE_RESIDUE_ALERT : 1);
}

// Installs a guard so an uncaught throw/rejection still reports as a hard failure
// rather than a silent non-zero with no explanation (Athanor#1322: never a silent skip).
export function installCrashGuard(checkName) {
  const report = (kind) => (err) => {
    console.error(`FAIL: ${checkName} crashed (${kind}) — ${err?.stack ?? err}`);
    process.exit(process.exitCode === EXIT_CODE_RESIDUE_ALERT ? EXIT_CODE_RESIDUE_ALERT : 1);
  };
  process.on('uncaughtException', report('uncaughtException'));
  process.on('unhandledRejection', report('unhandledRejection'));
}
