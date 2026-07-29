// Shared helper for the f6-home-fidelity rendered-output checks.
// These checks drive a headless browser against the LOCAL DEV SERVER —
// they require `pnpm dev` running and reachable (default
// http://localhost:3002, override with F6_CHECK_BASE_URL). They do NOT
// work against a static build output; do not run them concurrently with
// `pnpm build` (build and dev share `.next` and a concurrent build
// corrupts the dev server's asset manifest — sequence build checks
// before or after, never during, a dev-server check run).
import { chromium } from 'playwright';

export const BASE_URL = process.env.F6_CHECK_BASE_URL ?? 'http://localhost:3002';

export async function withPage(viewport, fn) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

export function pass(msg) {
  console.log('PASS:', msg);
  process.exit(0);
}
