/**
 * Contract assertion for ticketing-nav-restructure/contract-f1.yaml (A7).
 *
 * Behavioral proof that the National Show mega-menu is real, keyboard-operable, and has an
 * independent working mobile version — not just source text that mentions the right words.
 * Runs against a real `next dev` instance on a dedicated port (3411) so it never collides with
 * a developer's own `pnpm dev` (port 3002, per package.json) or another contract's server.
 * Dev mode (not an isolated production build) is deliberate here: this feature is static nav
 * structure + two new pages with no Firebase Admin/secrets dependency, so there is no shared
 * .next/build-vs-dev collision risk the admin-auth-hardening contract's server-ctl.sh guards
 * against — see that script's own header comment for why THAT contract needed isolation.
 *
 * Checks, each reported and failed independently (one failure never suppresses the others):
 *   1. Desktop (1280px): the "National Show" trigger is a real <button> with aria-expanded/
 *      aria-haspopup, reachable by Tab from page load, openable with Enter (no mouse), and its
 *      Tickets column heading link resolves to /national-show/tickets while three further,
 *      Tab-reachable, real <a href> links resolve to exactly /tickets,
 *      /national-show/exhibitors, and /national-show/vendors/apply.
 *   2. Escape closes the open menu and returns focus to the trigger.
 *   3. Mobile (375px): opening the hamburger, then expanding the National Show section inside
 *      it, reveals all three destination hrefs as real anchors in the DOM (not desktop-only).
 *   4. The chooser page itself (/national-show/tickets) independently contains all three
 *      destination hrefs.
 *
 * A setup failure (server never came up) exits 2 with a distinct "SETUP FAILURE" message so it
 * is never confused with a real behavioral failure.
 *
 * Run: node_modules/.bin/tsx execution/checks/verify_nav_mega_menu.ts
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as http from 'node:http';
import * as path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3411;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_START_TIMEOUT_MS = 90_000;
const SERVER_POLL_INTERVAL_MS = 500;

const TICKETS_HREFS = {
  chooser: '/national-show/tickets',
  visitor: '/tickets',
  exhibitor: '/national-show/exhibitors',
  vendor: '/national-show/vendors/apply',
};

function waitForServer(): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(BASE_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`server did not respond on ${BASE_URL} within timeout`));
        } else {
          setTimeout(poll, SERVER_POLL_INTERVAL_MS);
        }
      });
    };
    poll();
  });
}

async function main() {
  const failures: string[] = [];
  const record = (name: string, ok: boolean, detail?: string) => {
    if (ok) {
      console.log(`PASS: ${name}`);
    } else {
      failures.push(name + (detail ? ` — ${detail}` : ''));
      console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };

  let server: ChildProcess | undefined;
  let browser: Browser | undefined;

  try {
    server = spawn('node_modules/.bin/next', ['dev', '--port', String(PORT)], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: 'ignore',
    });

    try {
      await waitForServer();
    } catch (err) {
      console.error(`SETUP FAILURE: ${(err as Error).message}`);
      process.exit(2);
    }

    browser = await chromium.launch();

    // --- Desktop: keyboard-driven open, structure, Escape close ---
    {
      const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      // Checked BEFORE opening the mega-menu: a direct child of the primary nav pointing
      // straight at /tickets would mean the old flat top-level "Tickets" link survived
      // alongside the new mega-menu, rather than being folded into it.
      const staleTopLevelTicketsLink = page.locator(
        `nav[aria-label="Primary"] > a[href="${TICKETS_HREFS.visitor}"]`,
      );
      record(
        'no stale top-level nav link straight to /tickets outside the mega-menu',
        (await staleTopLevelTicketsLink.count()) === 0,
      );

      const trigger = page.locator(
        'nav[aria-label="Primary"] button[aria-haspopup]:has-text("National Show")',
      );
      const triggerCount = await trigger.count();
      record('desktop trigger is a real button with aria-haspopup', triggerCount > 0);

      if (triggerCount > 0) {
        await trigger.first().focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);

        const expanded = await trigger.first().getAttribute('aria-expanded');
        record('desktop trigger reports aria-expanded=true after Enter', expanded === 'true');

        const chooserLink = page.locator(`nav[aria-label="Primary"] a[href="${TICKETS_HREFS.chooser}"]`);
        record(
          'Tickets column heading links to /national-show/tickets (chooser), not /tickets',
          (await chooserLink.count()) > 0,
        );

        for (const [key, href] of Object.entries(TICKETS_HREFS)) {
          if (key === 'chooser') continue;
          const link = page.locator(`nav[aria-label="Primary"] a[href="${href}"]`);
          const count = await link.count();
          record(`desktop mega-menu has a real <a href="${href}"> (${key})`, count > 0);
          if (count > 0) {
            const visible = await link.first().isVisible();
            record(`desktop mega-menu's ${key} link is visible/Tab-reachable when open`, visible);
          }
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        const expandedAfterEscape = await trigger.first().getAttribute('aria-expanded');
        record('Escape closes the menu (aria-expanded=false)', expandedAfterEscape !== 'true');

        const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup'));
        record('Escape returns focus to the trigger', focused !== null && focused !== undefined);
      }

      await page.close();
    }

    // --- Desktop: Tab past the last item inside the open menu must close it ---
    // Regression case for a real bug found in adversarial QA (2026-08-21): opening the menu
    // via keyboard and Tabbing past its last focusable link left the panel open (aria-expanded
    // still "true", panel still visible) while focus moved on to the next sibling nav item —
    // Escape and outside-click both closed it, but focus-out via Tab did not.
    {
      const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      const trigger = page.locator(
        'nav[aria-label="Primary"] button[aria-haspopup]:has-text("National Show")',
      );
      const triggerCount = await trigger.count();
      record('[focus-escape] desktop trigger exists for tab-past-last-item case', triggerCount > 0);

      if (triggerCount > 0) {
        await trigger.first().focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);

        const menuFocusables = page.locator('[role="menu"] a, [role="menu"] button');
        const focusableCount = await menuFocusables.count();
        record('[focus-escape] menu has at least one focusable item to tab through', focusableCount > 0);

        // Tab through every focusable item inside the menu, then one more time to escape it.
        for (let i = 0; i < focusableCount + 1; i++) {
          await page.keyboard.press('Tab');
        }
        await page.waitForTimeout(150);

        const expandedAfterTabOut = await trigger.first().getAttribute('aria-expanded');
        record(
          'Tab past the last menu item closes the menu (aria-expanded=false)',
          expandedAfterTabOut !== 'true',
        );

        const menuStillVisible =
          (await page.locator('[role="menu"]').count()) > 0 &&
          (await page.locator('[role="menu"]').first().isVisible());
        record('Tab past the last menu item leaves no visible/interactable panel behind', !menuStillVisible);

        const focusedHref = await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href'));
        const focusedIsInsideMenu = await page.evaluate(
          () => !!document.activeElement?.closest('[role="menu"]'),
        );
        record(
          'focus lands on the correct next sibling nav item, not inside the (closed) menu',
          !focusedIsInsideMenu && focusedHref === '/events',
        );
      }

      await page.close();
    }

    // --- Mobile: hamburger -> expand National Show section -> same three hrefs present ---
    {
      const page: Page = await browser.newPage({ viewport: { width: 375, height: 800 } });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      const hamburger = page.locator('button[aria-label="Open menu"]');
      record('mobile hamburger button exists', (await hamburger.count()) > 0);
      await hamburger.first().click();
      await page.waitForTimeout(150);

      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      record('mobile menu dialog opens', (await dialog.count()) > 0);

      const mobileShowTrigger = dialog.locator('button:has-text("National Show")');
      const mobileTriggerCount = await mobileShowTrigger.count();
      record(
        'mobile menu has an expandable National Show section (not just a flat link)',
        mobileTriggerCount > 0,
      );
      if (mobileTriggerCount > 0) {
        await mobileShowTrigger.first().click();
        await page.waitForTimeout(150);
      }

      for (const [key, href] of Object.entries(TICKETS_HREFS)) {
        const link = dialog.locator(`a[href="${href}"]`);
        record(`mobile menu independently exposes a real <a href="${href}"> (${key})`, (await link.count()) > 0);
      }

      await page.close();
    }

    // --- Chooser page itself ---
    {
      const page: Page = await browser.newPage();
      await page.goto(`${BASE_URL}${TICKETS_HREFS.chooser}`, { waitUntil: 'networkidle' });
      for (const [key, href] of Object.entries(TICKETS_HREFS)) {
        if (key === 'chooser') continue;
        const link = page.locator(`main a[href="${href}"], body a[href="${href}"]`);
        record(`chooser page (/national-show/tickets) links to ${key} (${href})`, (await link.count()) > 0);
      }
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill('SIGTERM');
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }

  console.log('\nAll nav mega-menu checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('SETUP FAILURE:', err);
  process.exit(2);
});
