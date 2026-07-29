// Shared helper for the f1-countdown-hydration behavioural checks.
//
// These checks drive a headless browser against a LIVE dev server (default
// http://localhost:3333 — the port a dev server is already running on in
// this environment; override with F1_CHECK_BASE_URL). They throttle every
// `_next/**` asset request by F1_THROTTLE_MS (default 3000ms) before
// navigating to `/`, which is what makes the client's first render land in
// a LATER second than the server's Date.now() snapshot — the exact
// condition @qa reproduced the bug under. On a fast unthrottled localhost
// load, server and client can land in the same second and the bug does not
// reproduce; do not remove the throttle "to make the check faster".
import { chromium } from 'playwright';

export const BASE_URL = process.env.F1_CHECK_BASE_URL ?? 'http://localhost:3333';
export const THROTTLE_MS = Number(process.env.F1_THROTTLE_MS ?? 3000);

// Collects page errors (uncaught exceptions, which is how React reports a
// hydration mismatch in the browser) and console "error"-level messages
// mentioning hydration, while `/` loads under the `_next/**` throttle.
//
// Returns { pageErrors, hydrationConsoleErrors } — arrays of message
// strings. Caller decides pass/fail; this helper never exits the process,
// so it composes into more than one assertion.
export async function collectHydrationSignals({ path = '/', throttleMs = THROTTLE_MS } = {}) {
  const browser = await chromium.launch();
  const pageErrors = [];
  const hydrationConsoleErrors = [];
  try {
    const page = await browser.newPage();

    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message ?? err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /hydrat/i.test(msg.text())) {
        hydrationConsoleErrors.push(msg.text());
      }
    });

    // Delay every Next.js asset/chunk response so the client's JS parses
    // and first-renders in a later wall-clock second than the server did —
    // reproducing the throttled-network condition from @qa's 2026-07-29
    // Playwright run, not just an artificially slow localhost fluke.
    await page.route('**/_next/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, throttleMs));
      await route.continue();
    });

    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: throttleMs + 30000 });

    // Give hydration (and any resulting mismatch error) time to fire after
    // `load` — hydration happens once the throttled JS chunks finish
    // arriving and executing, which is itself delayed by the route hook.
    await page.waitForTimeout(throttleMs + 3000);
  } finally {
    await browser.close();
  }
  return { pageErrors, hydrationConsoleErrors };
}

export function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

export function pass(msg) {
  console.log('PASS:', msg);
  process.exit(0);
}
