// =============================================================
// SAOC — playwright.config.ts
// Mission ticketing-complete M1/F7 — self-test harness, built from zero (no test
// framework existed in this repo before this feature).
//
// Port: NEVER hardcoded. Several stale dev servers were already running on assorted
// other ports when this was written, and the port `dev:secure` names wasn't
// actually in use — a fixed literal here would either collide with a stale
// server's old state or fail outright. getFreeLocalPort() (e2e/support/
// dynamic-port.ts) asks the OS for a genuinely free port at config-load time, and
// that SAME value feeds both `use.baseURL` and the `webServer` command/url below —
// one source of truth, so the two can never drift apart. `webServer.command`
// invokes `next dev` directly (not the `pnpm dev` script, which hardcodes its own
// fixed port) so nothing re-introduces a second, conflicting port.
//
// This file stays plain CommonJS-loaded `.ts` (package.json has no `"type":
// "module"`, and changing that repo-wide is out of this feature's scope), so the
// port lookup can't use a top-level `await`. Instead the whole config is built by
// an async function and exported as a Promise — Playwright's config loader awaits
// a Promise-shaped default export before using it, same net effect as a top-level
// await without requiring ESM.
//
// Playwright's test workers are separate processes that re-`require()` this same
// config file — a naive `await getFreeLocalPort()` on every load would hand the
// main process (which starts `webServer`) one port and each worker (which sets
// `use.baseURL`) a DIFFERENT port, since the OS hands out a new free port on every
// call. The discovered port is cached in `process.env` on first computation; worker
// processes inherit their parent's environment, so every process in one `playwright
// test` invocation resolves to the exact same port without a second network probe.
//
// reuseExistingServer is always false: the port was just probed free, so there is
// never a legitimate existing server on it to reuse — "reuse" here could only mean
// either an impossible collision or accidentally attaching to something unrelated.
import { defineConfig, devices } from '@playwright/test';

import { getFreeLocalPort } from './e2e/support/dynamic-port';

const PORT_ENV_VAR = 'SAOC_E2E_DYNAMIC_PORT';

async function resolvePort(): Promise<number> {
  const cached = process.env[PORT_ENV_VAR];
  if (cached) {
    return Number.parseInt(cached, 10);
  }
  const port = await getFreeLocalPort();
  process.env[PORT_ENV_VAR] = String(port);
  return port;
}

async function buildConfig() {
  const PORT = await resolvePort();
  // "localhost", not "127.0.0.1": Next's dev server only allows same-origin HMR
  // websocket connections from "localhost" by default (next.config.ts's own
  // `allowedDevOrigins` names only one further exception, this project's secure
  // local dev hostname, and this feature must not touch that contract-owned
  // file). Using the literal loopback IP here trips Next's cross-origin
  // dev-request guard, which silently breaks the HMR socket and causes spurious
  // full-page reloads mid-test — exactly the kind of flake this harness exists to
  // avoid.
  const BASE_URL = `http://localhost:${PORT}`;

  return defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : [['list']],

    use: {
      baseURL: BASE_URL,
      trace: 'on-first-retry',
    },

    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],

    webServer: {
      command: `pnpm exec next dev --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  });
}

export default buildConfig();
