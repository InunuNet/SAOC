#!/usr/bin/env node
// A4 — captures the local draft render Brad is actually going to look at:
// full-page screenshots of http://localhost:3002/about at 1280px and 320px
// viewport widths. Requires `pnpm dev` already running on localhost:3002
// (this script does not start the server itself).
//
// The beta password wall can gate localhost dev too (confirmed by hand on
// the sibling saoc-emblem-lockup mission: `curl http://127.0.0.1:3002/`
// 401s with `WWW-Authenticate: Basic realm="SAOC Beta"` when the wall's env
// vars are set). This script reads BETA_BASIC_AUTH_USER/PASSWORD from
// .env.local (via dotenv) and only passes Playwright httpCredentials when
// BOTH are non-empty — an empty/unset pair is read as "wall is off," not a
// hard failure.
//
// Usage: node contracts/checks/saoc-about-page-f1/capture-local-screenshots.mjs
// Writes PNGs under .tmp/sandbox/about-page/screenshots/. Exits 2 if the
// dev server isn't reachable, 1 on any other failure, 0 on success.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });

const URL = 'http://localhost:3002/about';
const OUT_DIR = '.tmp/sandbox/about-page/screenshots';

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
  await page1280.screenshot({ path: `${OUT_DIR}/about-1280.png`, fullPage: true });
  await page1280.close();

  const page320 = await browser.newPage({
    viewport: { width: 320, height: 800 },
    httpCredentials,
  });
  await page320.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page320.screenshot({ path: `${OUT_DIR}/about-320.png`, fullPage: true });
  await page320.close();
} finally {
  await browser.close();
}

console.log(`OK: screenshots written to ${OUT_DIR}/`);
