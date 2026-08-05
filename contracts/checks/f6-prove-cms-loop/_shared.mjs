// F6 (cms-activation-deploy): shared helpers for proving the CMS loop end-to-end
// against the DEPLOYED host — never localhost, that would prove nothing about what
// the client actually sees. Studio auth mechanism (localStorage token injection) is
// the one already proven working by F2's contracts/checks/f2-deploy-next16/_shared.mjs
// — reused here, not reinvented.
//
// ============================================================================
// 2026-08-06 CLEANUP-SAFETY HARDENING (post-M1 incident) — READ BEFORE EDITING
// ============================================================================
// F6's A1 ran for real after F1 (CDN TTL fix) landed. The mutation succeeded and the
// sentinel genuinely reached the live /about page — proof the loop works. Cleanup did
// NOT reliably remove it: the sentinel was found still live on the public page by
// direct curl, well after the check had finished running, discovered by accident, not
// by the check reporting it. Root cause, confirmed by reading every failure path in
// this file: EVERY helper below called `process.exit(1)` directly on failure, instead
// of throwing an Error. `process.exit()` terminates the process immediately — it does
// NOT unwind the stack the way a thrown exception does, so any `try/finally` block
// further up the call stack (specifically, every check script's cleanup block, which
// exists precisely to guarantee cleanup always runs) is silently skipped if any helper
// call inside it hits a failure path. This was most dangerous during the SECOND
// (cleanup) Studio session — a transient failure re-opening the Studio, re-finding the
// field, or re-clicking Publish would kill the process before the cleanup block's own
// "MANUAL CHECK REQUIRED" messaging ever printed, with no distinguishing signal from
// an ordinary pre-mutation FAIL.
//
// Fix applied: every `process.exit(1)` below is now `throw new Error(...)`, so normal
// JS try/catch/finally semantics apply everywhere, including inside a cleanup block's
// own nested try/catch. This is the STRUCTURAL fix — it does not depend on any
// particular script remembering to check a return value; it makes the existing
// try/finally pattern actually work as designed.
//
// Second, independent factor investigated and confirmed live, 2026-08-06: F1's fix is
// `export const revalidate = 60` (bounded TTL + stale-while-revalidate), NOT a CDN
// purge — confirmed via response headers (`cache-control: s-maxage=60,
// stale-while-revalidate=31535940`, `x-nextjs-cache: STALE`). This means a single
// "not found" read from one vantage point does not prove the change has propagated to
// every CDN edge node; the old design (exit a cleanup poll on the FIRST clean read)
// was calibrated against the PREVIOUS one-year TTL, under which propagation had never
// once succeeded in testing, so "sentinel absent" was always trivially true on attempt
// 1 — this path was never genuinely exercised until F1 shipped. `verifyLiveAbsence`
// below replaces that with a requirement for several CONSECUTIVE clean reads spread
// over a longer window, and `raiseResidueAlert` makes a failure to reach that
// confidence bar loud, distinctly exit-coded, and durably logged to disk — never a
// silent or ordinary-looking FAIL. See docs/f6-a1-cleanup-incident-2026-08-06.md for
// the full incident writeup, verification, and audit of every mutating check.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@sanity/client';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

export const BASE_URL = 'https://saoc-prod--saoc-webapp.europe-west4.hosted.app';
export const SANITY_PROJECT_ID = '26yfbug4';

// The sentinel target: aboutPage.boardIntroText. Chosen because (see contract header
// for full reasoning): it is currently empty on the real, F3-pinned "aboutPage"
// document (F4's golden asserts it "absent" — a plain text field with no fallback
// copy, so a temporary value here does not collide with any other contract's
// byte-for-byte assertion), it renders unconditionally when present
// (app/(marketing)/about/page.tsx: `{about?.boardIntroText ? <p>...} : null}`), and
// its Sanity fetch is tagged ['aboutPage', 'sanity'] (sanity/queries.ts aboutPageQuery
// via about/page.tsx) — both the blanket 'sanity' tag AND the type-specific tag match,
// so this field exercises the REVALIDATION MECHANISM cleanly, not a tag-naming defect
// elsewhere in the codebase (a real, separate finding — see contract header "OTHER
// FINDING").
export const TARGET_DOC_ID = 'aboutPage';
export const TARGET_FIELD = 'boardIntroText';
export const TARGET_PAGE_PATH = '/about';

// A distinct exit code for "cleanup could not be verified" — deliberately different
// from the ordinary FAIL code (1, "the feature doesn't work yet") so a residue
// incident can never be mistaken for a normal, expected pre-fix failure in CI/gate
// logic or in a scrollback log. See raiseResidueAlert().
export const EXIT_CODE_RESIDUE_ALERT = 2;

export function loadEnvOrFail(name) {
  const value = process.env[name];
  if (!value) {
    const msg = `FAIL: ${name} not set in .env.local — cannot proceed (hard fail, not a skip)`;
    console.error(msg);
    throw new Error(msg);
  }
  return value;
}

export function getSanityClient() {
  const projectId = loadEnvOrFail('NEXT_PUBLIC_SANITY_PROJECT_ID');
  const dataset = loadEnvOrFail('NEXT_PUBLIC_SANITY_DATASET');
  const token = loadEnvOrFail('SANITY_API_TOKEN');
  return createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });
}

export function loadStudioToken() {
  if (process.env.SANITY_API_TOKEN) return process.env.SANITY_API_TOKEN;
  try {
    const envRaw = readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8');
    const line = envRaw.split('\n').find((l) => l.startsWith('SANITY_API_TOKEN='));
    return line ? line.split('=').slice(1).join('=').trim() : null;
  } catch {
    return null;
  }
}

// Reads the live field value straight from the Content Lake (never through the site's
// cache) — the authoritative source for "did the Studio publish actually happen" and
// "did our cleanup actually revert it", independent of whatever the public page shows.
// `docId`/`field` default to the aboutPage target so every existing caller (F6's A1/A2)
// keeps working unchanged; F2 (cms-loop-f2-event-tags) passes its own societyEvent
// doc id and field explicitly instead of forking this file.
export async function readDatasetField(client, docId = TARGET_DOC_ID, field = TARGET_FIELD) {
  try {
    const doc = await client.fetch(`*[_id == $id][0]{${field}}`, { id: docId });
    return doc ? doc[field] : undefined;
  } catch (err) {
    const msg = `FAIL: dataset read for ${docId}.${field} threw — ${err.message}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// Fetches a PUBLIC page's rendered HTML — never the Studio, never the Content Lake
// API — and reports whether `needle` appears in the body. This is the only source of
// truth the check trusts for "did the change reach the site" per the mission's
// non-negotiable: read from the rendered page, not a cached response assumed fresh,
// not the field already holding the value. `pagePath` defaults to TARGET_PAGE_PATH
// (/about) for backward compatibility; F2 passes /events/<slug> explicitly.
export async function fetchPublicPageContains(needle, pagePath = TARGET_PAGE_PATH) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${pagePath}`, { cache: 'no-store' });
  } catch (err) {
    const msg = `FAIL: could not reach ${BASE_URL}${pagePath} — ${err.message} (host unreachable)`;
    console.error(msg);
    throw new Error(msg);
  }
  const body = await res.text();
  return { status: res.status, hasNeedle: body.includes(needle), body };
}

// Invokes the revalidate endpoint DIRECTLY with the correct secret. This is NOT proof
// that Sanity's own configured webhook fires automatically on publish — see the
// contract header's "WHAT THIS DOES AND DOES NOT PROVE" section. The dataset-scoped
// SANITY_API_TOKEN in .env.local does not have the `sanity.project.webhooks/read`
// grant (confirmed live: a GET to
// https://api.sanity.io/v2021-06-07/hooks/projects/<id> 401s with exactly that
// missing-grant message), so this check cannot inspect or wait on the real webhook
// configuration — it exercises the same endpoint the webhook would call.
export async function callRevalidate(secret, type) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-sanity-secret': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ _type: type }),
    });
  } catch (err) {
    const msg = `FAIL: could not reach ${BASE_URL}/api/revalidate — ${err.message}`;
    console.error(msg);
    throw new Error(msg);
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// Opens ANY document in the deployed Studio, authenticated via the proven
// localStorage-token mechanism. Returns { browser, page, field } — caller must close
// `browser` (always, even on failure — see the check script's try/finally). `docId`/
// `field` default to the aboutPage target for backward compatibility.
//
// `structurePath` is the URL segment after /studio/structure/ and is NOT always
// `docId` — Sanity's deep-link pattern differs by how the desk structure exposes the
// document (see sanity/structure.ts):
//   - PINNED SINGLETON types (aboutPage, homePage, nationalShow, ...) are pinned via
//     `S.document().schemaType(t).documentId(t)` with a fixed list-item id equal to
//     the type name, so the deep link is just the doc id itself (`/studio/structure/
//     aboutPage`) — this is TARGET_DOC_ID's original, still-default behaviour.
//   - COLLECTION types (societyEvent, society, show, ...) use the stock
//     `S.documentTypeListItem(t)`, whose deep-link pattern is `type;documentId`
//     (e.g. `/studio/structure/societyEvent;societyEvent-10-midlands-orchid-show`).
//     Callers targeting a collection document MUST pass `structurePath` explicitly —
//     defaulting it to `docId` alone would silently 404/dead-end for non-singletons
//     (confirmed live, 2026-08-05: `#description` was unreachable on
//     `/studio/structure/societyEvent-10-midlands-orchid-show` until the `type;id`
//     form was used).
export async function openAuthenticatedDoc(docId = TARGET_DOC_ID, field = TARGET_FIELD, structurePath = docId) {
  const token = loadStudioToken();
  if (!token) {
    const msg =
      'FAIL: SANITY_API_TOKEN not set (checked process.env and .env.local) — cannot authenticate ' +
      'the Studio session. Hard fail, not a skip: an unauthenticated session would park on the ' +
      'login screen and prove nothing (Athanor#1322).';
    console.error(msg);
    throw new Error(msg);
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    const msg = `FAIL: Playwright browser launch failed — ${err.message}`;
    console.error(msg);
    throw new Error(msg);
  }

  const page = await browser.newPage();
  await page.addInitScript(
    ({ key, val }) => window.localStorage.setItem(key, val),
    { key: `__studio_auth_token_${SANITY_PROJECT_ID}`, val: JSON.stringify({ token, authenticated: true }) }
  );

  try {
    await page.goto(`${BASE_URL}/studio/structure/${structurePath}`, { waitUntil: 'load', timeout: 30000 });
  } catch (err) {
    await browser.close();
    const msg = `FAIL: could not load the Studio at ${BASE_URL}/studio/structure/${structurePath} — ${err.message}`;
    console.error(msg);
    throw new Error(msg);
  }
  // Wait for the FIELD itself rather than sleeping a fixed interval. A fixed wait
  // races the Studio's async mount: a pinned singleton renders one document pane and
  // usually wins, but a collection deep-link (`type;id`) renders a list pane AND a
  // document pane, so it intermittently loses — the same target passed and then failed
  // with no Studio-affecting change in between (observed 2026-08-05/06). Waiting on the
  // locator returns as soon as the editor mounts and still fails honestly, and loudly,
  // when the field genuinely never appears.
  const fieldLocator = page.locator(`#${field}`);
  const FIELD_MOUNT_TIMEOUT_MS = 30000;
  try {
    await fieldLocator.waitFor({ state: 'visible', timeout: FIELD_MOUNT_TIMEOUT_MS });
  } catch {
    await browser.close();
    const msg =
      `FAIL: Studio auth succeeded but #${field} never mounted on document ${docId} ` +
      `within ${FIELD_MOUNT_TIMEOUT_MS}ms at /studio/structure/${structurePath}. ` +
      'Causes, in order of likelihood: the deep-link resolved to a pane that does not ' +
      'contain this field (check the structurePath form — singletons use the bare doc ' +
      'id, collection types use `type;id`); auth silently fell back to a login screen; ' +
      'or the schema no longer defines this field. Hard fail, not a skip.';
    console.error(msg);
    throw new Error(msg);
  }
  await page.keyboard.press('Escape'); // dismiss any stray tooltip/portal (observed to block clicks)

  return { browser, page, field: fieldLocator };
}

// Backward-compatible alias — F6's own check scripts import this exact name.
export async function openAuthenticatedAboutPageDoc() {
  return openAuthenticatedDoc(TARGET_DOC_ID, TARGET_FIELD);
}

// Types `value` into the field and clicks Publish. `{ force: true }` on both actions —
// observed live that a portal/tooltip element intercepts pointer events on a plain
// click even after scrollIntoViewIfNeeded(); force bypasses Playwright's actionability
// check, which is safe here because we've already confirmed the field is visible,
// enabled, and the correct element (verified in the same investigation that produced
// this selector).
export async function setFieldAndPublish(page, field, value) {
  await field.scrollIntoViewIfNeeded();
  await field.fill(value, { force: true });
  await page.waitForTimeout(1000);
  const typed = await field.inputValue();
  if (typed !== value) {
    const msg = `FAIL: typed value into the field does not match what was requested — got ${JSON.stringify(typed)}, expected ${JSON.stringify(value)}`;
    console.error(msg);
    throw new Error(msg);
  }
  const publishBtn = page.locator('[data-testid="action-publish"]');
  if ((await publishBtn.count()) === 0) {
    const msg = 'FAIL: Publish button ([data-testid="action-publish"]) not found — Studio UI changed or auth failed.';
    console.error(msg);
    throw new Error(msg);
  }
  await publishBtn.click({ force: true });
  await page.waitForTimeout(5000); // publish is an async network call; give it time to land.
}

// ============================================================================
// CLEANUP-SAFETY HELPERS (added 2026-08-06, see file header for the incident)
// ============================================================================

// Cleanup verification is DELIBERATELY more rigorous than the headline propagation
// poll: the propagation poll (in each check script) exits on the FIRST positive read,
// because a single confirmed appearance is real, sufficient evidence the loop works.
// Cleanup verification is the opposite risk shape — a single "not found" read is NOT
// sufficient evidence of removal, because it could be a lucky read from a CDN edge
// node/cache slot that happens to have already refreshed while others have not. This
// requires CLEANUP_REQUIRED_CONSECUTIVE_CLEAN consecutive absent reads, spread over
// CLEANUP_POLL_INTERVAL_MS apart, within a CLEANUP_POLL_TIMEOUT_MS bound long enough to
// span multiple full s-maxage windows (F1's fix uses s-maxage=60 on CMS routes) plus
// the extra request each stale-while-revalidate cycle needs to actually observe fresh
// content. This bound is intentionally DIFFERENT from (and independent of) the 120s
// propagation-poll bound documented in F6/F2/F4's contracts as "do not lengthen" — that
// instruction is about the bound proving the FEATURE works; this is a safety-net bound
// for proving cleanup is SAFE, a different question with different risk tolerance
// (slower-but-certain is the right trade-off for "is something still live on the
// public site").
export const CLEANUP_POLL_TIMEOUT_MS = 300_000; // 5 minutes
export const CLEANUP_POLL_INTERVAL_MS = 15_000;
export const CLEANUP_REQUIRED_CONSECUTIVE_CLEAN = 3;

// Generic sustained-condition verifier: `checkFn()` is called repeatedly (async, no
// args) and must return `true` CLEANUP_REQUIRED_CONSECUTIVE_CLEAN times IN A ROW,
// within CLEANUP_POLL_TIMEOUT_MS, before this resolves ok. Any `false` resets the
// consecutive counter to zero — a single stale read does not "spend down" toward
// success. Used both by verifyLiveAbsence (simple substring-absence case) and by
// check scripts with a more specific condition (e.g. F4's "AM/SAOC is no longer
// rendered last", which isn't a plain substring check).
export async function verifySustainedCondition(checkFn, { label = 'cleanup-verify' } = {}) {
  const start = Date.now();
  let attempt = 0;
  let consecutiveClean = 0;
  while (Date.now() - start < CLEANUP_POLL_TIMEOUT_MS) {
    attempt += 1;
    const conditionMet = await checkFn();
    consecutiveClean = conditionMet ? consecutiveClean + 1 : 0;
    console.log(
      `  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s): ` +
        `conditionMet=${conditionMet}, consecutiveClean=${consecutiveClean}/${CLEANUP_REQUIRED_CONSECUTIVE_CLEAN}`
    );
    if (consecutiveClean >= CLEANUP_REQUIRED_CONSECUTIVE_CLEAN) {
      return { ok: true, attempts: attempt };
    }
    await new Promise((resolve) => setTimeout(resolve, CLEANUP_POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}

// Simple substring-absence case built on verifySustainedCondition — the common case
// used by F6/F2/F4's threshold-style cleanup verification.
export async function verifyLiveAbsence(needle, pagePath, opts = {}) {
  return verifySustainedCondition(async () => {
    const r = await fetchPublicPageContains(needle, pagePath);
    return !r.hasNeedle;
  }, opts);
}

// Raises a LOUD, distinctly-exit-coded, durably-logged failure when cleanup cannot be
// verified — the exact gap that let the F6 incident go unnoticed until a manual curl
// found it by accident. Three independent layers, so this is never missed:
//   1. A large, unmissable console banner naming the document, field, expected value,
//      and the sentinel that may still be live, plus direct links to check by hand.
//   2. A JSON marker file under contracts/checks/RESIDUE-ALERTS/ (created if needed) —
//      durable evidence that survives even if console output scrolls away or a CI log
//      isn't read carefully. NOT auto-deleted; clearing it is a deliberate manual
//      acknowledgement step once the residue is confirmed gone by hand.
//   3. A distinct exit code (EXIT_CODE_RESIDUE_ALERT = 2), so this can never be
//      confused with an ordinary FAIL (1, "the feature doesn't work yet") by anything
//      reading the exit code alone.
// Returns nothing — callers should `process.exit(EXIT_CODE_RESIDUE_ALERT)` immediately
// after calling this, at the TOP level of the script (never from inside a nested
// try/catch that could itself be skipped).
export function raiseResidueAlert({ checkName, docId, field, expectedValue, sentinelValue, pagePath, extra }) {
  const banner = '!'.repeat(78);
  const lines = [
    '',
    banner,
    '!!! RESIDUE ALERT — CLEANUP COULD NOT BE VERIFIED — MANUAL ACTION REQUIRED !!!',
    banner,
    `Check:              ${checkName}`,
    `Document:           ${docId}`,
    `Field:              ${field}`,
    `Expected value:     ${JSON.stringify(expectedValue)}`,
    `Sentinel to check:  ${sentinelValue}`,
    `Public page:        ${BASE_URL}${pagePath}`,
    `Studio document:    ${BASE_URL}/studio/structure/${docId}`,
    extra ? `Note:               ${extra}` : null,
    'ACTION: open the Studio link above, confirm/restore the field to the expected',
    'value shown, publish, and manually verify the public page no longer shows the',
    'sentinel before treating this as resolved.',
    banner,
    '',
  ].filter((l) => l !== null);
  const message = lines.join('\n');
  console.error(message);

  try {
    const dir = new URL('../RESIDUE-ALERTS/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    const fileUrl = new URL(`${checkName}-${Date.now()}.json`, dir);
    writeFileSync(
      fileUrl,
      JSON.stringify(
        { checkName, docId, field, expectedValue, sentinelValue, pagePath, raisedAt: new Date().toISOString(), extra: extra ?? null },
        null,
        2
      )
    );
    console.error(`Residue alert marker written: ${fileUrl.pathname}`);
  } catch (err) {
    console.error(`(could not write residue alert marker file — ${err.message}. The console banner above is the record.)`);
  }
}

// Defense-in-depth safety net: installs process-level handlers so a genuinely
// unexpected failure (one that somehow escapes every try/catch in a check script —
// e.g. an unhandled rejection inside a Playwright internal callback) is LOUD and
// distinctly exit-coded rather than a silent/default Node crash. Honest limitation,
// stated plainly rather than overclaimed: these handlers CANNOT run new async cleanup
// (Node does not allow further async work once 'uncaughtException'/'unhandledRejection'
// fires in a way that guarantees completion) — they are a last-resort loud alarm, not
// a substitute for the primary fix (every helper above now throws instead of exiting,
// so the check script's own try/finally cleanup block is the real guarantee and runs
// correctly in every currently-known failure path).
export function installCrashGuard(context) {
  let handled = false;
  const handler = (err) => {
    if (handled) return; // avoid a double-fire (both handlers) double-printing
    handled = true;
    console.error('\n' + '!'.repeat(78));
    console.error('!!! UNCAUGHT ERROR ESCAPED NORMAL HANDLING — cleanup may not have completed. !!!');
    console.error('!!! Treat as a RESIDUE ALERT, not an ordinary FAIL — verify the target by hand. !!!');
    console.error('!'.repeat(78));
    if (context) console.error(`Context: ${JSON.stringify(context)}`);
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(EXIT_CODE_RESIDUE_ALERT);
  };
  process.on('uncaughtException', handler);
  process.on('unhandledRejection', handler);
}
