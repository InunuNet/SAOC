// Shared helpers for the f2-deploy-next16 checks.
//
// Every check here targets the DEPLOYED site by default (PROD_URL below), not
// localhost — that is the entire point of F2. Override with F2_CHECK_BASE_URL only
// for local rehearsal of the scripts themselves; never let a passing local run stand
// in for a passing deployed run in the contract gate.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

export const PROD_URL = 'https://saoc-prod--saoc-webapp.europe-west4.hosted.app';
export const BASE_URL = process.env.F2_CHECK_BASE_URL ?? PROD_URL;
export const THROTTLE_MS = Number(process.env.F2_THROTTLE_MS ?? 1500);
export const SANITY_PROJECT_ID = '26yfbug4';

export function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

export function pass(msg) {
  console.log('PASS:', msg);
  process.exit(0);
}

// Loads SANITY_API_TOKEN. Real deploy secrets never enter apphosting.yaml as plain
// text, but this Editor token exists ONLY to authenticate an ephemeral headless
// browser session against the deployed Studio's OAuth-gated UI, exactly as
// mission's F2 brief specifies (localStorage injection, not env-var passthrough to
// the server). Prefers process.env; falls back to .env.local (checked into no repo,
// gitignored) so the check works out of the box in this dev environment. The token
// value itself is NEVER logged, printed, or written to disk by this file.
export function loadSanityToken() {
  if (process.env.SANITY_API_TOKEN) return process.env.SANITY_API_TOKEN;
  try {
    const envRaw = readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8');
    const line = envRaw.split('\n').find((l) => l.startsWith('SANITY_API_TOKEN='));
    const value = line ? line.split('=').slice(1).join('=').trim() : '';
    return value || null;
  } catch {
    return null;
  }
}

// Opens `path` against BASE_URL with an authenticated Studio session (localStorage
// token injected before any app code runs, matching sanity 5.31.1's own
// AUTH_TOKEN_STORAGE_PREFIX + getAuthTokenStorageKey(projectId) contract — confirmed
// by reading node_modules/sanity/lib/index.js directly, not guessed). Returns
// { bodyText, pageErrors, browser, page } — caller must close `browser`.
export async function openAuthenticatedStudioPage(path) {
  const token = loadSanityToken();
  if (!token) {
    fail(
      'SANITY_API_TOKEN not set (checked process.env and .env.local) — cannot authenticate ' +
        'the Studio session. This must FAIL, not skip: an unauthenticated run would park on ' +
        'the login screen and prove nothing (Athanor#1322).'
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));

  await page.addInitScript(
    ({ key, val }) => window.localStorage.setItem(key, val),
    {
      key: `__studio_auth_token_${SANITY_PROJECT_ID}`,
      val: JSON.stringify({ token, authenticated: true }),
    }
  );

  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(6000); // Studio is a heavy client app; fields render async.

  const bodyText = (await page.textContent('body')).replace(/\s+/g, ' ');
  return { bodyText, pageErrors, browser, page };
}

// Collects hydration signals loading `path`, throttling every `_next/**` asset
// response by THROTTLE_MS before it resolves. Over a real deployed WAN connection
// this reproduces (and worsens) the same server/client wall-clock skew @qa found
// with a local throttle — see contracts/f1-countdown-hydration.yaml for the
// original repro. Never silently skips: a navigation failure throws, and callers
// must treat that as FAIL, not PASS/SKIP (Athanor#1322).
export async function collectHydrationSignals(path = '/') {
  const browser = await chromium.launch();
  const pageErrors = [];
  const hydrationConsoleErrors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /hydrat|error #418|error #419|error #421|error #425/i.test(msg.text())) {
        hydrationConsoleErrors.push(msg.text());
      }
    });

    await page.route('**/_next/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
      await route.continue();
    });

    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: THROTTLE_MS + 30000 });
    await page.waitForTimeout(THROTTLE_MS + 3000);
  } finally {
    await browser.close();
  }
  return { pageErrors, hydrationConsoleErrors };
}
