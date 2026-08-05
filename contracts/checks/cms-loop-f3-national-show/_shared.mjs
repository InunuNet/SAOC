// cms-loop-f3-national-show: shared helpers, owned exclusively by this contract.
// Per dispatch instructions, nothing here modifies
// contracts/checks/f6-prove-cms-loop/_shared.mjs — this file IMPORTS a few
// already-proven helpers from it (openAuthenticatedDoc, readDatasetField,
// fetchPublicPageContains, callRevalidate, getSanityClient, loadEnvOrFail), the same
// sanctioned reuse pattern cms-loop-f2-event-tags already established (pass explicit
// docId/field/structurePath instead of forking the file).

import {
  openAuthenticatedDoc,
  readDatasetField,
  fetchPublicPageContains,
  callRevalidate,
  getSanityClient,
  loadEnvOrFail,
  BASE_URL,
} from '../f6-prove-cms-loop/_shared.mjs';

// Read-only import from F1's own checks directory (not modified, per dispatch
// instructions — F1's contract owns that directory) so the F1-deployed guard below
// uses F1's OWN definition of "deployed" rather than a second, possibly-drifting
// copy of the same threshold.
import { fetchHeaders, parseCacheControl, MAX_ACCEPTABLE_S_MAXAGE, LEGACY_S_MAXAGE } from '../cms-loop-f1-cdn-purge/_shared.mjs';

export {
  openAuthenticatedDoc,
  readDatasetField,
  fetchPublicPageContains,
  callRevalidate,
  getSanityClient,
  loadEnvOrFail,
  BASE_URL,
};

export const TARGET_DOC_ID = 'nationalShow';
export const TARGET_PAGE_PATH = '/national-show';
export const HOME_PAGE_PATH = '/';
export const REVALIDATE_TYPE = 'nationalShow';

// The document is a PINNED SINGLETON (S.document().schemaType('nationalShow')
// .documentId('nationalShow') — see sanity/structure.ts, same pattern as aboutPage),
// so its Studio deep link is just the doc id, confirmed live 2026-08-05:
// /studio/structure/nationalShow loaded #title, #location, #countdownDate, #showDate
// as plain <input type="text"> elements (title/location hold live string values;
// countdownDate displays "2027-09-18 09:00", a typeable local-format string, NOT a
// non-typeable date-picker-only widget; showDate is empty, confirming F4's golden
// "absent" note).
export const STRUCTURE_PATH = TARGET_DOC_ID;

// HARD GATE, called first thing by every check that MUTATES the real nationalShow
// singleton (A1, A3). Per team-lead direction: A1/A3 must not execute until F1's
// short-TTL fix is confirmed live on /national-show — before that, the legacy
// one-year s-maxage means a sentinel round trip's cleanup step (which reverts the
// DATASET) cannot reach the CDN's cached copy, so a fake title or a "2099" countdown
// could stay visibly cached on the live site for up to a year. This is not just
// documentation — it is enforced here so accidentally running A1/A3 early fails
// loudly and safely instead of mutating production.
export async function assertF1Deployed() {
  const headers = await fetchHeaders(TARGET_PAGE_PATH);
  const parsed = parseCacheControl(headers.cacheControl);
  const deployed =
    parsed.sMaxage !== undefined && parsed.sMaxage !== LEGACY_S_MAXAGE && parsed.sMaxage <= MAX_ACCEPTABLE_S_MAXAGE;
  if (!deployed) {
    console.error(
      `FAIL: refusing to run — F1's short-TTL fix is not deployed yet on ${TARGET_PAGE_PATH} ` +
        `(Cache-Control: ${JSON.stringify(headers.cacheControl)}). Running a mutating round trip before F1 ships risks ` +
        'the CDN caching sentinel content for up to a year on this route and on the home page (see contract header ' +
        '"READ FIRST — DEPENDS ON F1"). Run contracts/checks/cms-loop-f1-cdn-purge/check-cms-routes-short-ttl.mjs first ' +
        'to confirm F1 is live, then re-run this check.'
    );
    process.exit(1);
  }
  console.log(`F1 guard passed: ${TARGET_PAGE_PATH} Cache-Control (${headers.cacheControl}) confirms the short-TTL fix is deployed.`);
}

// Sets multiple plain-text Studio input fields (by field id) in one open document
// session, then publishes once. Adapted from f6's setFieldAndPublish for the
// multi-field case this contract needs (title + location + countdownDate together) —
// not a fork of that function, new code, same `{ force: true }` rationale (a
// portal/tooltip intercepts plain clicks even after scrollIntoViewIfNeeded, confirmed
// live in the same investigation that produced F6's selector).
export async function setFieldsAndPublish(page, fieldValues) {
  for (const [fieldId, value] of Object.entries(fieldValues)) {
    const locator = page.locator(`#${fieldId}`);
    if ((await locator.count()) === 0) {
      console.error(`FAIL: #${fieldId} not found in the Studio — schema changed or auth failed.`);
      process.exit(1);
    }
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(value, { force: true });
    // datetime inputs need a blur/Enter to commit their parsed value before the
    // next field grabs focus — Escape alone (used elsewhere to dismiss tooltips)
    // would discard the edit, so use Tab, which both commits and moves on.
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
  }
  const publishBtn = page.locator('[data-testid="action-publish"]');
  if ((await publishBtn.count()) === 0) {
    console.error('FAIL: Publish button ([data-testid="action-publish"]) not found — Studio UI changed or auth failed.');
    process.exit(1);
  }
  await publishBtn.click({ force: true });
  await page.waitForTimeout(5000);
}

// Bound and interval are IDENTICAL to F6's A1 — same reasoning applies unchanged
// (see contract header "TIMING ANALYSIS", inherited from cms-loop-f1-cdn-purge): a
// 60s-or-less s-maxage plus one stale-while-revalidate round trip fits inside 120s
// with margin. /national-show is one of F1's CMS_ROUTES, so it is expected to carry
// the same bounded TTL as /about once F1 is deployed.
export const POLL_TIMEOUT_MS = 120_000;
export const POLL_INTERVAL_MS = 10_000;

export async function poll(predicate, label) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    attempt += 1;
    const result = await predicate();
    console.log(`  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s):`, JSON.stringify(result));
    if (result.ok) return { ok: true, result, attempts: attempt };
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}
