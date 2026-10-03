// e2e/nav-property1-http-gate.spec.ts
// Mission menu-system-layout4 M3/F11 -- wraps
// check-nav-links-200-gated-by-exemptions.mjs as a subprocess so its
// real-HTTP-check branch runs against a NAMED server
// (playwright.config.ts's own webServer-managed dynamic-port dev
// server, injected via Playwright's `baseURL` fixture) rather than an
// ambient port -- closing the gap contract-f6.yaml's A4 left open.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const CHECKER = path.resolve(
  __dirname,
  '../contracts/checks/menu-system-layout4-shared/check-nav-links-200-gated-by-exemptions.mjs',
);
const EMPTY_PENDING = path.resolve(
  __dirname,
  '../.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/pending-routes-empty-fixture.json',
);
const TICKET_RAIL_404_FIXTURE = path.resolve(
  __dirname,
  '../.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-negative-fixtures/nav-config-ticket-rail-404.mjs',
);
const TICKETS_SOFT_404_FIXTURE = path.resolve(
  __dirname,
  '../.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-negative-fixtures/nav-config-tickets-soft-404.mjs',
);

function runChecker(baseUrl: string, extraArgs: string[]) {
  try {
    const stdout = execFileSync(
      'node',
      [CHECKER, '--base-url', baseUrl, '--pending-routes', EMPTY_PENDING, ...extraArgs],
      { encoding: 'utf8' },
    );
    return { code: 0, output: stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test.describe('property 1 HTTP gate (real webServer-managed dev server)', () => {
  test('real NAV: all hrefs return 200', async ({ baseURL }) => {
    expect(baseURL, 'playwright.config.ts must provide baseURL').toBeTruthy();
    const { code, output } = runChecker(baseURL!, []);
    expect(code, output).toBe(0);
  });

  test('negative fixture: a broken ticket-rail href fails the gate', async ({ baseURL }) => {
    expect(baseURL, 'playwright.config.ts must provide baseURL').toBeTruthy();
    const { code, output } = runChecker(baseURL!, ['--nav-file', TICKET_RAIL_404_FIXTURE]);
    expect(code).toBe(1);
    expect(output).toContain('/national-show/does-not-exist-fixture-only-404');
    expect(output.toLowerCase()).not.toContain('soft-404');
  });

  test('negative fixture: a soft-404 (200 + noindex) ticket-rail href fails the gate', async ({
    baseURL,
  }) => {
    expect(baseURL, 'playwright.config.ts must provide baseURL').toBeTruthy();
    const { code, output } = runChecker(baseURL!, ['--nav-file', TICKETS_SOFT_404_FIXTURE]);
    expect(code).toBe(1);
    expect(output).toContain('/tickets/does-not-exist-fixture-only-soft404');
    expect(output.toLowerCase()).toContain('soft-404');
  });
});
