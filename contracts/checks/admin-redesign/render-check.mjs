// Headless render check for mission admin-redesign. Requires a prior `pnpm build`.
// Usage: node contracts/checks/admin-redesign/render-check.mjs [--no-flag]
//   default   : starts `next start -p 3023` with ADMIN_FIXTURES=1; 7 routes x 4 widths.
//   --no-flag : starts WITHOUT the flag and asserts the fixture route 404s (cannot ship enabled).
// Screenshots: .tmp/sandbox/admin-redesign/screens/<route>-<width>.png
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 3023;
const BASE = `http://localhost:${PORT}`;
const NO_FLAG = process.argv.includes('--no-flag');
const OUT = '.tmp/sandbox/admin-redesign/screens';
const WIDTHS = [1280, 1024, 768, 390];
const ROUTES = [
  { name: 'dashboard', url: '/admin-fixtures/dashboard', active: '/admin' },
  { name: 'tickets', url: '/admin-fixtures/tickets', active: '/admin/tickets', table: true },
  { name: 'door', url: '/admin-fixtures/door', active: '/admin/door' },
  { name: 'vendors', url: '/admin-fixtures/vendors', active: '/admin/vendors', table: true },
  { name: 'applications', url: '/admin-fixtures/applications', active: '/admin/vendors/applications', table: true },
  { name: 'settings', url: '/admin-fixtures/settings', active: '/admin/settings' },
  { name: 'login', url: '/admin/login', active: null },
];

// SITE_PUBLIC_LAUNCH=true only to get past the beta-wall proxy for this local server; never set elsewhere.
const env = { ...process.env, PORT: String(PORT), SITE_PUBLIC_LAUNCH: 'true' };
delete env.ADMIN_FIXTURES;
if (!NO_FLAG) env.ADMIN_FIXTURES = '1';
const server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(PORT)], { env, stdio: 'ignore' });
const failures = [];
const h1ByRoute = {};
const EXPECT_H1 = { dashboard: 'Dashboard', applications: 'Applications', vendors: 'Vendors' };
const FRESH = 'Fresh Fixture Nursery';
const fail = (m) => { failures.push(m); console.error('FAIL: ' + m); };

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/api/admin/whoami'); if (r.status) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server did not start');
}

try {
  await waitUp();
  if (NO_FLAG) {
    const r = await fetch(BASE + '/admin-fixtures/dashboard');
    if (r.status !== 404) fail(`fixture route returned ${r.status} without flag`);
  } else {
    mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch();
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      for (const r of ROUTES) {
        const page = await ctx.newPage();
        const resp = await page.goto(BASE + r.url, { waitUntil: 'networkidle' });
        const tag = `${r.name}@${w}`;
        if (!resp || resp.status() >= 400) { fail(`${tag}: HTTP ${resp?.status()}`); await page.close(); continue; }
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        if (sw > w) fail(`${tag}: scrollWidth ${sw} > viewport ${w}`);
        const h1 = (await page.locator('h1').first().textContent().catch(() => null))?.trim();
        if (w === 1280) {
          h1ByRoute[r.name] = h1;
          if (EXPECT_H1[r.name] && h1 !== EXPECT_H1[r.name]) fail(`${tag}: H1 is ${JSON.stringify(h1)}, want ${EXPECT_H1[r.name]}`);
        }
        if (r.name === 'applications') {
          const firstRow = (await page.locator(w < 640 ? '[data-admin-card]' : 'tbody tr').first().innerText()).trim();
          if (!firstRow.includes(FRESH)) fail(`${tag}: first row is not the fresh pending application`);
          const pressed = await page.locator('[aria-pressed="true"], [aria-checked="true"]').first().innerText().catch(() => '');
          if (!/^(pending|all)$/i.test(pressed.trim())) fail(`${tag}: default status filter is ${JSON.stringify(pressed)}`);
        }
        if (r.name === 'dashboard') {
          const needs = await page.getByText('Needs attention').locator('xpath=ancestor::*[self::section or self::div][1]').innerText().catch(() => '');
          if (!needs.includes(FRESH)) fail(`${tag}: Needs attention omits the fresh pending application`);
        }
        if (r.active && w >= 1024) {
          const badge = (await page.locator('[data-pending-badge]').first().innerText().catch(() => '')).trim();
          if (badge !== '4') fail(`${tag}: pending badge is ${JSON.stringify(badge)}, want 4`);
        }
        if (r.active) {
          const current = await page.locator('[aria-current="page"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
          if (!current.includes(r.active)) fail(`${tag}: aria-current is ${JSON.stringify(current)}, want ${r.active}`);
          if (w >= 1024) {
            if (!(await page.locator('nav[aria-label="Admin"]').first().isVisible())) fail(`${tag}: sidebar not visible`);
          } else {
            const burger = page.getByRole('button', { name: /menu/i }).first();
            await burger.focus(); await page.keyboard.press('Enter');
            const dlg = page.getByRole('dialog').first();
            if (!(await dlg.isVisible())) fail(`${tag}: burger did not open drawer`);
            await page.keyboard.press('Escape');
            if (await dlg.isVisible()) fail(`${tag}: Esc did not close drawer`);
          }
          if (await page.getByText('ADMIN', { exact: true }).count()) fail(`${tag}: ADMIN chip present`);
        }
        if (r.table) {
          const tableVisible = await page.locator('table').first().isVisible().catch(() => false);
          if (w >= 1024 && !tableVisible) fail(`${tag}: table not visible`);
          if (w < 640 && tableVisible) fail(`${tag}: table should be cards below 640`);
        }
        await page.screenshot({ path: `${OUT}/${r.name}-${w}.png`, fullPage: false });
        await page.close();
      }
      await ctx.close();
    }
    const titles = Object.values(h1ByRoute).filter(Boolean);
    if (new Set(titles).size !== titles.length) fail(`duplicate H1s across admin pages: ${JSON.stringify(h1ByRoute)}`);
    await browser.close();
  }
} catch (e) {
  fail(String(e));
} finally {
  server.kill('SIGTERM');
}
if (failures.length) process.exit(1);
console.log(NO_FLAG ? 'PASS[fixtures-404]' : 'PASS[render]');
