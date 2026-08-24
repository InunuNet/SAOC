// A4 (door-checkin-one-handed F1) — proves the /admin/door "Check In" button is actually
// inside the visible viewport, with no page-level scroll needed, via a REAL rendered
// Playwright pass at 375x667 and 320x568 (not a structural source grep — A1 already
// covers that). Mirrors admin-settings-deploy-and-chrome-fix-f1/check-live-chrome.mjs's
// session-minting pattern: never drives the login UI, mints a real session cookie for an
// existing allowlisted admin via a Firebase custom token exchange.
//
// What this script does, end to end:
//   1. Mints a real session cookie the same way check-live-chrome.mjs does:
//        a. getAuth(initAdmin()).getUserByEmail(adminEmail) to look up the real uid.
//        b. getAuth(initAdmin()).createCustomToken(uid, { admin: true }).
//        c. Exchange the custom token for an ID token via Identity Toolkit
//           accounts:signInWithCustomToken.
//        d. POST the ID token to <baseUrl>/api/admin/session and capture the Set-Cookie.
//   2. For each of the two required viewports (375x667, 320x568), launches Playwright,
//      hands it the session cookie, navigates to <baseUrl>/admin/door, waits for the
//      manual-entry "Check In" button to be attached, performs NO scroll, then reads:
//        - the button's getBoundingClientRect() (rect.top >= 0, rect.bottom <= viewportHeight)
//        - document.scrollingElement's scrollHeight vs clientHeight (page needs no scroll)
//      and captures a full-viewport screenshot as supporting evidence.
//   3. Writes each run's artifact to
//      .agent/memory/scratch/door-checkin-one-handed-runs/<viewport>-<ISO-timestamp>.json,
//      screenshot alongside it.
//   4. Independently re-derives PASS/FAIL from the artifacts' own contents (never from
//      in-memory script state) — requires both required checks pass === true in both
//      artifacts, and each artifact's own allChecksPassed === true.
//
// Usage: node check-live-viewport.mjs
//   Env vars:
//     FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY
//       — required, from .env.local.
//     NEXT_PUBLIC_FIREBASE_API_KEY — required, from .env.local.
//     DOOR_VIEWPORT_ADMIN_EMAIL — email of an existing, already-allowlisted admin whose
//       session is minted. Falls back to the first entry in ADMIN_EMAIL_ALLOWLIST if unset.
//     DOOR_VIEWPORT_BASE_URL — defaults to https://beta.saoc.co.za.
//
// FAILS ON: missing credentials; no admin email resolvable; the session mint failing at
// any step; either viewport's checks failing to run; either artifact missing a required
// check or having pass !== true; either artifact's allChecksPassed !== true.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from 'playwright';

const REQUIRED_CHECKS = ['button-within-viewport', 'page-does-not-scroll'];

const VIEWPORTS = [
  { name: '375x667', width: 375, height: 667 },
  { name: '320x568', width: 320, height: 568 },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const ARTIFACT_DIR = path.join(REPO_ROOT, '.agent/memory/scratch/door-checkin-one-handed-runs');

const BASE_URL = process.env.DOOR_VIEWPORT_BASE_URL ?? 'https://beta.saoc.co.za';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function resolveAdminEmail() {
  if (process.env.DOOR_VIEWPORT_ADMIN_EMAIL) return process.env.DOOR_VIEWPORT_ADMIN_EMAIL;
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
  const url = `${BASE_URL}/admin/door`;
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

    await page.goto(url, { waitUntil: 'networkidle' });

    const button = page.getByRole('button', { name: 'Check In', exact: true });
    await button.waitFor({ state: 'attached', timeout: 15000 });

    // No scroll performed — measure exactly what an operator sees on load.
    const rect = await button.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });

    const screenshotName = `full-viewport-${viewport.name}.png`;
    await page.screenshot({ path: path.join(runDir, screenshotName), fullPage: false });

    const buttonWithinViewport = rect.top >= 0 && rect.bottom <= viewport.height;
    checks.push({
      name: 'button-within-viewport',
      pass: buttonWithinViewport,
      screenshot: screenshotName,
      detail: `rect.top=${rect.top}, rect.bottom=${rect.bottom}, viewportHeight=${viewport.height}`,
    });

    const scrollMetrics = await page.evaluate(() => {
      const el = document.scrollingElement;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    });
    const pageDoesNotScroll = scrollMetrics.scrollHeight <= scrollMetrics.clientHeight + 1;
    checks.push({
      name: 'page-does-not-scroll',
      pass: pageDoesNotScroll,
      detail: `scrollHeight=${scrollMetrics.scrollHeight}, clientHeight=${scrollMetrics.clientHeight}`,
    });
  } finally {
    await browser.close();
  }

  const completedAt = new Date().toISOString();
  const allChecksPassed = checks.every((c) => c.pass === true);

  const artifact = {
    viewport: viewport.name,
    widthPx: viewport.width,
    heightPx: viewport.height,
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
    fail('no admin email resolvable — set DOOR_VIEWPORT_ADMIN_EMAIL or ADMIN_EMAIL_ALLOWLIST');
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
    `PASS: both 375x667 and 320x568 runs of ${BASE_URL}/admin/door show the Check In button fully within the viewport with no page-level scroll needed.`,
  );
  process.exit(0);
}

main().catch((err) => fail(err?.stack ?? String(err)));
