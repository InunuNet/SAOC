// e2e/nav-property1-http-gate.spec.ts
// Mission menu-system-layout4 M3/F11 -- wraps
// check-nav-links-200-gated-by-exemptions.mjs as a subprocess so its
// real-HTTP-check branch runs against a NAMED server
// (playwright.config.ts's own webServer-managed dynamic-port dev
// server, injected via Playwright's `baseURL` fixture) rather than an
// ambient port -- closing the gap contract-f6.yaml's A4 left open.
// nos-site-split F3: the checker also fetches the show nav (NOS_NAV) from the NOS host,
// http://nos.localhost:<the same port>, which the dev server's proxy serves as the NOS site.
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';

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

const execFileAsync = promisify(execFile);

const SOFT_404_PATH = '/tickets/does-not-exist-fixture-only-soft404';
const SOFT_404_BODY = '<html><head><meta name="robots" content="noindex"/></head><body></body></html>';

// No real route returns a bare 200 + noindex after TK-404, so the soft-404 detector is exercised
// against a local stub: 200 plain HTML everywhere, 200 + noindex on the fixture's one bad path.
async function withSoft404Stub<T>(run: (url: string) => Promise<T>): Promise<T> {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(req.url === SOFT_404_PATH ? SOFT_404_BODY : '<html><body>ok</body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); // listening: AddressInfo
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runChecker(baseUrl: string, extraArgs: string[]) {
  try {
    // Under tsx so the nav modules' '@/' imports resolve (nos-site-split F3: nav-config now imports
    // the site-host helpers).
    const { stdout } = await execFileAsync(
      'node',
      ['--import', 'tsx', CHECKER, '--base-url', baseUrl, '--pending-routes', EMPTY_PENDING, ...extraArgs],
      { encoding: 'utf8' },
    );
    return { code: 0, output: stdout };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: typeof e.code === 'number' ? e.code : 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test.describe('property 1 HTTP gate (real webServer-managed dev server)', () => {
  test('real NAV: all hrefs return 200', async ({ baseURL }) => {
    expect(baseURL, 'playwright.config.ts must provide baseURL').toBeTruthy();
    const { code, output } = await runChecker(baseURL!, []);
    expect(code, output).toBe(0);
  });

  test('negative fixture: a broken ticket-rail href fails the gate', async ({ baseURL }) => {
    expect(baseURL, 'playwright.config.ts must provide baseURL').toBeTruthy();
    const { code, output } = await runChecker(baseURL!, ['--nav-file', TICKET_RAIL_404_FIXTURE]);
    expect(code).toBe(1);
    expect(output).toContain('/national-show/does-not-exist-fixture-only-404');
    expect(output.toLowerCase()).not.toContain('soft-404');
  });

  // TK-404: an unknown ticket slug used to answer 200 + noindex (a soft-404); it now answers a real
  // 404, so this fixture fails the gate as a hard 404.
  test('negative fixture: an unknown ticket slug is a hard 404 and fails the gate', async ({
    baseURL,
  }) => {
    expect(baseURL, 'playwright.config.ts must provide baseURL').toBeTruthy();
    const { code, output } = await runChecker(baseURL!, ['--nav-file', TICKETS_SOFT_404_FIXTURE]);
    expect(code).toBe(1);
    expect(output).toContain('/tickets/does-not-exist-fixture-only-soft404');
    expect(output.toLowerCase()).not.toContain('soft-404');
  });
});

test('soft-404 detector: a 200 + noindex ticket-rail href fails the gate', async () => {
  const { code, output } = await withSoft404Stub((stubUrl) =>
    runChecker(stubUrl, ['--nav-file', TICKETS_SOFT_404_FIXTURE, '--nos-base-url', stubUrl]),
  );
  expect(code).toBe(1);
  expect(output).toContain(SOFT_404_PATH);
  expect(output.toLowerCase()).toContain('soft-404');
});
