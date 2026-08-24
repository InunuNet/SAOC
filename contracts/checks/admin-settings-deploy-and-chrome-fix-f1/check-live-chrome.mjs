// A6 (admin-settings-deploy-and-chrome-fix F1) — proves the /admin/settings chrome fix is
// actually live on beta.saoc.co.za via a REAL authenticated browser session, not a structural
// source grep (A1-A3 already cover that; see contracts/golden/admin-settings-deploy-and-chrome-fix-f1/
// README.md for why a green structural check alone is not trusted here). Gated behind A5
// (check-deploy-freshness.sh) passing first — run this only after the orchestrator has pushed
// and the Firebase App Hosting rollout has picked up the change.
//
// What this script does, end to end:
//   1. Mints a real session cookie for an existing, already-allowlisted admin (never drives the
//      Google/Firebase OAuth login UI, never creates a new sentinel Firebase Auth user) — see
//      README.md "Authenticating the BrowserAgent session against a live admin-gated route":
//        a. getAuth(initAdmin()).getUserByEmail(adminEmail) to look up the real uid.
//        b. getAuth(initAdmin()).createCustomToken(uid, { admin: true }).
//        c. Exchange the custom token for an ID token via Identity Toolkit
//           accounts:signInWithCustomToken.
//        d. POST the ID token to <baseUrl>/api/admin/session and capture the Set-Cookie header.
//   2. For each of two viewports (desktop 1440x900, mobile 375x812), launches Playwright, hands
//      it the session cookie (never the login form), navigates to <baseUrl>/admin/settings, and
//      runs the exact 7 named DOM-derived checks from the README's artifact schema — every
//      pass/fail comes from a real Playwright locator assertion, never from prose/visual
//      judgment. Screenshots are captured as supporting evidence, not as the pass/fail source.
//   3. Writes each run's artifact to
//      .agent/memory/scratch/admin-settings-chrome-runs/<viewport>-<ISO-timestamp>.json per the
//      README's schema, screenshots alongside it.
//   4. Independently re-derives the final PASS/FAIL verdict from both artifacts' own contents
//      (never from this script's own in-memory state of what it thinks happened) — mirrors
//      check-live-purchase.mjs's "never trust the agent's chat output" design: requires all
//      SEVEN named checks present with pass === true in BOTH artifacts, and each artifact's own
//      allChecksPassed === true.
//
// Usage: node check-live-chrome.mjs
//   Env vars:
//     FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY
//       — required, from .env.local (see reference memory reference-saoc-credentials-inventory).
//     NEXT_PUBLIC_FIREBASE_API_KEY — required, from .env.local.
//     LIVE_CHROME_ADMIN_EMAIL — email of an existing, already-allowlisted owner-role admin whose
//       session is minted. Falls back to the first entry in ADMIN_EMAIL_ALLOWLIST if unset.
//     LIVE_CHROME_BASE_URL — defaults to https://beta.saoc.co.za.
//
// FAILS ON: missing credentials; no admin email resolvable; the session mint failing at any
// step; either viewport's DOM checks failing to run; either artifact missing any of the 7
// required checks or having pass !== true on one; either artifact's allChecksPassed !== true.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from 'playwright';

const REQUIRED_CHECKS = [
  'page-loads-200',
  'utility-bar-present',
  'header-present',
  'admin-nav-present',
  'settings-link-in-nav',
  'footer-present',
  'toggle-still-functions',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const ARTIFACT_DIR = path.join(REPO_ROOT, '.agent/memory/scratch/admin-settings-chrome-runs');

const BASE_URL = process.env.LIVE_CHROME_BASE_URL ?? 'https://beta.saoc.co.za';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function resolveAdminEmail() {
  if (process.env.LIVE_CHROME_ADMIN_EMAIL) return process.env.LIVE_CHROME_ADMIN_EMAIL;
  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST;
  if (allowlist) {
    const first = allowlist.split(',').map((e) => e.trim()).filter(Boolean)[0];
    if (first) return first;
  }
  return undefined;
}

function initFirebaseAdmin() {
  if (getApps().length > 0) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    fail('missing FIREBASE_ADMIN_* credentials — cannot mint an admin session');
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function mintSessionCookie(adminEmail) {
  initFirebaseAdmin();

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) fail('missing NEXT_PUBLIC_FIREBASE_API_KEY — cannot exchange the custom token');

  const auth = getAuth();
  let uid;
  try {
    const user = await auth.getUserByEmail(adminEmail);
    uid = user.uid;
  } catch (err) {
    fail(`could not look up admin user '${adminEmail}': ${err.message}`);
  }

  const customToken = await auth.createCustomToken(uid, { admin: true });

  const exchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!exchangeRes.ok) {
    fail(`Identity Toolkit custom-token exchange failed: ${exchangeRes.status} ${await exchangeRes.text()}`);
  }
  const { idToken } = await exchangeRes.json();
  if (!idToken) fail('Identity Toolkit exchange did not return an idToken');

  const sessionRes = await fetch(`${BASE_URL}/api/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!sessionRes.ok) {
    fail(`POST ${BASE_URL}/api/admin/session failed: ${sessionRes.status} ${await sessionRes.text()}`);
  }
  const setCookie = sessionRes.headers.get('set-cookie');
  const match = setCookie?.match(/session=([^;]+)/);
  if (!match) fail(`${BASE_URL}/api/admin/session did not return a session cookie`);

  return match[1];
}

async function runViewportCheck(viewport, sessionCookieValue) {
  const runDir = ARTIFACT_DIR;
  mkdirSync(runDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const checks = [];
  const url = `${BASE_URL}/admin/settings`;
  const browser = await chromium.launch();
  const domain = new URL(BASE_URL).hostname;

  try {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    await context.addCookies([
      {
        name: 'session',
        value: sessionCookieValue,
        domain,
        path: '/',
        httpOnly: true,
        secure: true,
      },
    ]);
    const page = await context.newPage();

    const response = await page.goto(url, { waitUntil: 'networkidle' });
    const status = response?.status() ?? 0;
    const finalUrl = page.url();
    const loaded200 = status === 200 && !finalUrl.includes('/admin/login') && finalUrl.includes('/admin/settings');
    checks.push({
      name: 'page-loads-200',
      pass: loaded200,
      detail: `status=${status}, finalUrl=${finalUrl}`,
    });

    const fullPageScreenshot = `01-full-page-${viewport.name}.png`;
    await page.screenshot({ path: path.join(runDir, fullPageScreenshot), fullPage: true });

    // UtilityBar has no aria label/testid of its own — it is the dark sage bar with the
    // council email mailto link, always the first such link on every chrome-wrapped page.
    const utilityBarVisible = await page
      .locator('a[href="mailto:council@saoc.co.za"]')
      .first()
      .isVisible()
      .catch(() => false);
    checks.push({
      name: 'utility-bar-present',
      pass: utilityBarVisible,
      screenshot: fullPageScreenshot,
      detail: 'UtilityBar root locator visible (council@saoc.co.za mailto link)',
    });

    const headerVisible = await page
      .locator('header')
      .first()
      .isVisible()
      .catch(() => false);
    checks.push({
      name: 'header-present',
      pass: headerVisible,
      screenshot: fullPageScreenshot,
      detail: 'Header root locator visible',
    });

    const adminNav = page.locator('nav[aria-label="Admin"]');
    const adminNavVisible = await adminNav.first().isVisible().catch(() => false);
    checks.push({
      name: 'admin-nav-present',
      pass: adminNavVisible,
      screenshot: fullPageScreenshot,
      detail: "nav[aria-label='Admin'] visible",
    });

    let settingsLinkOk = false;
    const navCloseUpScreenshot = `02-nav-close-up-${viewport.name}.png`;
    if (viewport.name === 'mobile') {
      const menuButton = page.locator('button[aria-label="Admin menu"]');
      if (await menuButton.first().isVisible().catch(() => false)) {
        await menuButton.first().click();
        await page.waitForTimeout(200);
      }
      // AdminNav renders renderLinkList() twice inside the same nav[aria-label="Admin"]
      // for variant="bar" (desktop copy always in DOM but hidden below 1240px, mobile
      // copy only rendered once the hamburger is open) — there is no role="dialog"
      // wrapper for this variant, so match only the currently-visible copy.
      const overlayLink = page.locator('nav[aria-label="Admin"] a[href="/admin/settings"]:visible, [role="dialog"][aria-label="Admin menu"] a[href="/admin/settings"]:visible');
      settingsLinkOk = (await overlayLink.count()) > 0;
      await page.screenshot({ path: path.join(runDir, navCloseUpScreenshot) });
    } else {
      const link = adminNav.locator('a[href="/admin/settings"]');
      settingsLinkOk = (await link.count()) > 0 && (await link.first().isVisible().catch(() => false));
      await adminNav.screenshot({ path: path.join(runDir, navCloseUpScreenshot) }).catch(() => undefined);
    }
    checks.push({
      name: 'settings-link-in-nav',
      pass: settingsLinkOk,
      screenshot: navCloseUpScreenshot,
      detail: "a[href='/admin/settings'] present inside nav[aria-label='Admin'], unhidden on desktop or reachable via the hamburger on mobile",
    });

    const footerVisible = await page.locator('footer').first().isVisible().catch(() => false);
    checks.push({
      name: 'footer-present',
      pass: footerVisible,
      screenshot: fullPageScreenshot,
      detail: 'Footer root locator visible',
    });

    const toggleScreenshot = `03-toggle-${viewport.name}.png`;
    const checkbox = page.locator('input[type="checkbox"]').first();
    const checkboxVisible = await checkbox.isVisible().catch(() => false);
    let toggleMatchesApi = false;
    if (checkboxVisible) {
      const checked = await checkbox.isChecked().catch(() => null);
      const apiRes = await fetch(`${BASE_URL}/api/admin/settings/ozow-sandbox-test-mode`, {
        headers: { cookie: `session=${sessionCookieValue}` },
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        toggleMatchesApi = checked === (data.enabled === true);
      }
      await checkbox.screenshot({ path: path.join(runDir, toggleScreenshot) }).catch(() => undefined);
    }
    checks.push({
      name: 'toggle-still-functions',
      pass: checkboxVisible && toggleMatchesApi,
      screenshot: toggleScreenshot,
      detail: 'existing Ozow sandbox test-mode checkbox present, checked state matches GET /api/admin/settings/ozow-sandbox-test-mode',
    });
  } finally {
    await browser.close();
  }

  const completedAt = new Date().toISOString();
  const allChecksPassed = checks.every((c) => c.pass === true);

  const artifact = {
    viewport: viewport.name,
    widthPx: viewport.width,
    url,
    startedAt,
    completedAt,
    checks,
    allChecksPassed,
  };

  const artifactPath = path.join(runDir, `${viewport.name}-${startedAt}.json`.replace(/:/g, '-'));
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  return artifactPath;
}

function verifyArtifact(artifactPath) {
  if (!existsSync(artifactPath)) fail(`artifact not found at ${artifactPath}`);
  const run = JSON.parse(readFileSync(artifactPath, 'utf8'));

  if (!Array.isArray(run.checks)) fail(`${artifactPath}: checks is not an array`);
  const byName = new Map(run.checks.map((c) => [c.name, c]));
  const missing = REQUIRED_CHECKS.filter((name) => !byName.has(name));
  if (missing.length > 0) fail(`${artifactPath} is missing required check(s): ${missing.join(', ')}`);

  const failed = REQUIRED_CHECKS.filter((name) => byName.get(name).pass !== true);
  if (failed.length > 0) fail(`${artifactPath}: check(s) did not pass: ${failed.join(', ')}`);

  if (run.allChecksPassed !== true) {
    fail(`${artifactPath}: allChecksPassed is ${run.allChecksPassed}, expected true`);
  }
}

async function main() {
  const adminEmail = resolveAdminEmail();
  if (!adminEmail) {
    fail('no admin email resolvable — set LIVE_CHROME_ADMIN_EMAIL or ADMIN_EMAIL_ALLOWLIST');
  }

  const sessionCookieValue = await mintSessionCookie(adminEmail);

  const artifactPaths = [];
  for (const viewport of VIEWPORTS) {
    const artifactPath = await runViewportCheck(viewport, sessionCookieValue);
    artifactPaths.push(artifactPath);
  }

  for (const artifactPath of artifactPaths) {
    verifyArtifact(artifactPath);
  }

  console.log(
    `PASS: both desktop and mobile runs of ${BASE_URL}/admin/settings passed all ${REQUIRED_CHECKS.length} DOM-derived checks.`,
  );
  process.exit(0);
}

main().catch((err) => fail(err?.stack ?? String(err)));
