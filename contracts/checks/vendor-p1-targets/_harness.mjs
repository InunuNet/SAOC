// Shared helpers for the vendor-p1-targets browser checks (F7).
//
// Serves the LOCAL production build (`next start`) -- never the deployed site, never dev mode
// (dev-mode hydration and overlay timing make target measurements noisy). If
// VENDOR_P1_BASE_URL is set the checks use that server instead and start nothing. Otherwise a
// `next start` is spawned on VENDOR_P1_PORT (default 3417) from the current working directory
// and torn down on exit. Requires a prior `next build` (assertion A4 runs it).
//
// None of the three pages measured needs Firestore or a secret: /vendors/apply is a static
// form, /vendors/register with no session cookie renders the code-entry form, and
// /vendors/payment with no token renders its invalid-link state (all three fall through before
// any Admin SDK call).

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = process.env.VENDOR_P1_PORT ?? '3417';
const EXTERNAL_BASE_URL = process.env.VENDOR_P1_BASE_URL;
export const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];
export const MIN_TARGET_PX = 44;

let serverProcess = null;

export async function startServer() {
  if (EXTERNAL_BASE_URL) return EXTERNAL_BASE_URL;
  if (!existsSync('.next/BUILD_ID')) {
    console.error('No .next/BUILD_ID -- run `node_modules/.bin/next build` first (contract assertion A4).');
    process.exit(2);
  }
  serverProcess = spawn('node_modules/.bin/next', ['start', '-p', PORT], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, PORT },
  });
  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0 && code !== 143) {
      console.error(`next start exited early with code ${code}`);
      process.exit(2);
    }
  });
  const baseUrl = `http://localhost:${PORT}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/national-show/vendors/payment`);
      if (res.status < 500) return baseUrl;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(`next start did not answer on ${baseUrl} within 60s`);
  stopServer();
  process.exit(2);
}

export function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

export async function launch() {
  const baseUrl = await startServer();
  const browser = await chromium.launch();
  return { baseUrl, browser };
}

export async function finish(browser, failures) {
  await browser.close();
  stopServer();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log('OK');
  process.exit(0);
}

// Opens a page at the given viewport with reduced motion, then waits until (a) the network is
// idle, (b) the React-owned element matching `hydratedSelector` carries a React fibre (proof
// hydration finished, so a click handler would actually run) and (c) no finite animation or
// transition is still running (a mid-transition box is a wrong measurement).
export async function openSettled(browser, baseUrl, path, viewport, hydratedSelector) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  if (hydratedSelector) {
    await page.waitForSelector(hydratedSelector, { state: 'visible', timeout: 30_000 });
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return !!el && Object.keys(el).some((key) => key.startsWith('__reactFiber') || key.startsWith('__reactProps'));
      },
      hydratedSelector,
      { timeout: 30_000 },
    );
  }
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .every((animation) => animation.playState !== 'running' && animation.playState !== 'pending'),
    undefined,
    { timeout: 15_000 },
  );
  return { context, page };
}
