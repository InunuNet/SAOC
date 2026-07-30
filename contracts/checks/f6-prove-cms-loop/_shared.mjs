// F6 (cms-activation-deploy): shared helpers for proving the CMS loop end-to-end
// against the DEPLOYED host — never localhost, that would prove nothing about what
// the client actually sees. Studio auth mechanism (localStorage token injection) is
// the one already proven working by F2's contracts/checks/f2-deploy-next16/_shared.mjs
// — reused here, not reinvented.

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
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

export function loadEnvOrFail(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`FAIL: ${name} not set in .env.local — cannot proceed (hard fail, not a skip)`);
    process.exit(1);
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
export async function readDatasetField(client) {
  try {
    const doc = await client.fetch(`*[_id == $id][0]{${TARGET_FIELD}}`, { id: TARGET_DOC_ID });
    return doc ? doc[TARGET_FIELD] : undefined;
  } catch (err) {
    console.error(`FAIL: dataset read for ${TARGET_DOC_ID}.${TARGET_FIELD} threw — ${err.message}`);
    process.exit(1);
  }
}

// Fetches the PUBLIC page's rendered HTML — never the Studio, never the Content Lake
// API — and reports whether `needle` appears in the body. This is the only source of
// truth the check trusts for "did the change reach the site" per the mission's
// non-negotiable: read from the rendered page, not a cached response assumed fresh,
// not the field already holding the value.
export async function fetchPublicPageContains(needle) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${TARGET_PAGE_PATH}`, { cache: 'no-store' });
  } catch (err) {
    console.error(`FAIL: could not reach ${BASE_URL}${TARGET_PAGE_PATH} — ${err.message} (host unreachable)`);
    process.exit(1);
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
    console.error(`FAIL: could not reach ${BASE_URL}/api/revalidate — ${err.message}`);
    process.exit(1);
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// Opens the pinned aboutPage document in the deployed Studio, authenticated via the
// proven localStorage-token mechanism. Returns { browser, page, field } — caller must
// close `browser` (always, even on failure — see the check script's try/finally).
export async function openAuthenticatedAboutPageDoc() {
  const token = loadStudioToken();
  if (!token) {
    console.error(
      'FAIL: SANITY_API_TOKEN not set (checked process.env and .env.local) — cannot authenticate ' +
        'the Studio session. Hard fail, not a skip: an unauthenticated session would park on the ' +
        'login screen and prove nothing (Athanor#1322).'
    );
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(`FAIL: Playwright browser launch failed — ${err.message}`);
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.addInitScript(
    ({ key, val }) => window.localStorage.setItem(key, val),
    { key: `__studio_auth_token_${SANITY_PROJECT_ID}`, val: JSON.stringify({ token, authenticated: true }) }
  );

  try {
    await page.goto(`${BASE_URL}/studio/structure/${TARGET_DOC_ID}`, { waitUntil: 'load', timeout: 30000 });
  } catch (err) {
    await browser.close();
    console.error(`FAIL: could not load the Studio at ${BASE_URL}/studio/structure/${TARGET_DOC_ID} — ${err.message}`);
    process.exit(1);
  }
  await page.waitForTimeout(7000); // Studio is a heavy client app; fields render async.
  await page.keyboard.press('Escape'); // dismiss any stray tooltip/portal (observed to block clicks)

  const field = page.locator(`#${TARGET_FIELD}`);
  const fieldCount = await field.count();
  if (fieldCount === 0) {
    await browser.close();
    console.error(
      `FAIL: Studio auth succeeded but #${TARGET_FIELD} was not found on the aboutPage document — ` +
        'schema changed, or auth silently failed to a login screen. Hard fail, not a skip.'
    );
    process.exit(1);
  }

  return { browser, page, field };
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
    console.error(`FAIL: typed value into #${TARGET_FIELD} does not match what was requested — got ${JSON.stringify(typed)}`);
    process.exit(1);
  }
  const publishBtn = page.locator('[data-testid="action-publish"]');
  if ((await publishBtn.count()) === 0) {
    console.error('FAIL: Publish button ([data-testid="action-publish"]) not found — Studio UI changed or auth failed.');
    process.exit(1);
  }
  await publishBtn.click({ force: true });
  await page.waitForTimeout(5000); // publish is an async network call; give it time to land.
}
