// Playwright config for the ONE e2e spec that needs the Sanity fixture OFF (sanity-fetch-fixture-miss.spec.ts, "with the fixture off a failed fetch still resolves to null").
// It has no webServer (the spec is unit-style: no browser, no server), so nothing can read Sanity; run-e2e.sh runs it in its own invocation with SANITY_FIXTURE_MODE unset
// and the Sanity API blocked by block-sanity-net.cjs.
import path from 'node:path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: path.resolve(process.cwd(), 'e2e'),
  testMatch: 'sanity-fetch-fixture-miss.spec.ts',
  workers: 1,
  reporter: 'line',
});
