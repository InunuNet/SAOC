// Playwright globalSetup: warm the one next/image key the mega-menu logo test depends on.
//
// Next 16.2.12's DEV image optimiser gets stuck when several cold requests for the same
// key (here: the vertical NOS logo, w=256, q=75, webp) arrive concurrently. Every browser
// request for that key then gets no response, and e2e/mega-menu-f8-logo-and-tickets-rail
// .spec.ts "logo image actually loaded and decoded" times out (about half of cold runs at
// 7 workers; other widths and warm caches are fine). One serial request before the
// workers start fills the optimiser cache. Dev-only: production serves via `next start`.
import type { FullConfig } from '@playwright/test';

const LOGO_IMAGE_PATH =
  '/_next/image?url=%2Fimages%2Fnos-2027-logo-full-colour-vertical.png&w=256&q=75';
const WARM_TIMEOUT_MS = 30_000;
const WARM_ATTEMPTS = 2;

async function warmOnce(url: string): Promise<void> {
  const response = await fetch(url, {
    headers: { Accept: 'image/webp' },
    signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (contentType !== 'image/webp') {
    throw new Error(`unexpected content-type ${contentType}`);
  }
  await response.arrayBuffer();
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    throw new Error('warm-image-optimiser: no baseURL configured on the first project');
  }
  const url = new URL(LOGO_IMAGE_PATH, baseURL).toString();

  let lastError: unknown;
  for (let attempt = 1; attempt <= WARM_ATTEMPTS; attempt += 1) {
    try {
      await warmOnce(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`warm-image-optimiser: could not warm ${url}: ${String(lastError)}`);
}
