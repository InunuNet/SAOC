#!/usr/bin/env node
// A10 — captures the local draft render Brad is actually going to look at:
// header + footer at 1280px, and header + footer at 320px (mobile-menu
// closed, proving the existing `hidden sm:flex` collapse to mark-only still
// renders cleanly with the new, larger mark). Also guards that the footer's
// new stacked Lapis lockup doesn't overflow at 320px ("sized correctly" per
// Brad's footer instruction). Requires `pnpm dev` already running on
// localhost:3002 (team-lead's own instruction — this script does not start
// the server itself).
//
// The beta password wall (proxy.ts, mission beta-password-wall) can run on
// EVERY request regardless of host, including localhost dev — confirmed by
// hand on 2026-10-08: `curl http://127.0.0.1:3002/` 401s with
// `WWW-Authenticate: Basic realm="SAOC Beta"`. Team-lead reports the local
// server's wall is now OFF (blank BETA_BASIC_AUTH_* in its env) but to keep
// the credential support anyway since it's harmless — so this script reads
// BETA_BASIC_AUTH_USER/PASSWORD from .env.local (via dotenv) and only passes
// Playwright httpCredentials when BOTH are non-empty; an empty/unset pair is
// read as "wall is off", not a hard failure.
//
// Usage: node contracts/checks/saoc-emblem-lockup-f1/capture-local-screenshots.mjs
// Writes PNGs under .tmp/sandbox/emblem-lockup/screenshots/. Exits 2 if the
// dev server isn't reachable, 1 on any other failure (including a 320px
// footer overflow), 0 on success.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });

const URL = 'http://localhost:3002/';
const OUT_DIR = '.tmp/sandbox/emblem-lockup/screenshots';

const username = process.env.BETA_BASIC_AUTH_USER;
const password = process.env.BETA_BASIC_AUTH_PASSWORD;
const httpCredentials = username && password ? { username, password } : undefined;

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

try {
  const page1280 = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    httpCredentials,
  });
  let resp;
  try {
    resp = await page1280.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (err) {
    console.error(`could not reach ${URL} — is 'pnpm dev' running on :3002? (${err.message})`);
    await browser.close();
    process.exit(2);
  }
  if (!resp || !resp.ok()) {
    console.error(`${URL} returned ${resp ? resp.status() : 'no response'}`);
    await browser.close();
    process.exit(1);
  }

  const header1280 = page1280.locator('header').first();
  await header1280.screenshot({ path: `${OUT_DIR}/header-1280.png` });
  const footer1280 = page1280.locator('footer').first();
  await footer1280.scrollIntoViewIfNeeded();
  await footer1280.screenshot({ path: `${OUT_DIR}/footer-1280.png` });
  await page1280.close();

  const page320 = await browser.newPage({
    viewport: { width: 320, height: 800 },
    httpCredentials,
  });
  await page320.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  const header320 = page320.locator('header').first();
  await header320.screenshot({ path: `${OUT_DIR}/header-320.png` });

  const footer320 = page320.locator('footer').first();
  await footer320.scrollIntoViewIfNeeded();
  await footer320.screenshot({ path: `${OUT_DIR}/footer-320.png` });

  // "Sized correctly" (Brad's footer instruction) includes: the new stacked
  // Lapis lockup must not force the footer wider than the 320px viewport.
  const overflowPx = await page320.evaluate(() => {
    const el = document.querySelector('footer');
    return el ? el.scrollWidth - document.documentElement.clientWidth : 0;
  });
  if (overflowPx > 0) {
    console.error(`footer overflows the 320px viewport by ${overflowPx}px`);
    await browser.close();
    process.exit(1);
  }

  // Open the mobile menu to capture its own mark-only lockup echo too.
  const hamburger = page320.getByRole('button', { name: 'Open menu' });
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
    await page320.waitForTimeout(300);
    await page320.screenshot({ path: `${OUT_DIR}/mobile-menu-320.png` });
  }
  await page320.close();
} finally {
  await browser.close();
}

console.log(`OK: screenshots written to ${OUT_DIR}/`);
