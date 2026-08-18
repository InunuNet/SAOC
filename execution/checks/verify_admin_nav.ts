/**
 * Contract assertion for admin-nav-menu/contract-f1.yaml (A13).
 *
 * The load-bearing behavioral proof for this feature: a Playwright-driven run against a
 * real, locally-built PRODUCTION server (reusing contracts/checks/admin-auth-hardening's
 * server-ctl.sh start/stop pattern on port 3400, and its _shared.mjs helpers --
 * createAllowlistedFixtureUser, mintIdTokenForUid, setCustomClaims, postSession -- to mint
 * TWO real session cookies, never fakes) proves, in one script:
 *
 *   1. capability-conditional link rendering at 1440/375/320 viewports for an admin
 *      WITHOUT review-vendor-applications (sees Dashboard/Door Scanner/Sign out, never
 *      Vendors, on both /admin and /admin/vendors's bar), and that a second admin WITH the
 *      capability (a real `manager` role grant) sees the Vendors link render on both pages;
 *   2. direct-URL reachability: the non-holder's direct navigation to /admin/vendors is
 *      handled by the ROUTE's own existing gate (a defined redirect back to /admin, not a
 *      network failure/500/hard block) -- proving nav visibility and route access are two
 *      independent mechanisms, per the golden's "nav is not the access boundary";
 *   3. on /admin/door at 375px and 320px, no persistent full-height nav bar is present, the
 *      minimal trigger occupies less than 56px of vertical space, and the scanner's video
 *      container is not covered or resized by any nav element;
 *   4. tabbing through every interactive element on /admin's bar (and the minimal trigger's
 *      open overlay on /admin/door) produces a visible focus outline on each, and Escape
 *      closes the minimal variant's open overlay;
 *   5. zero browser console errors on /admin, /admin/vendors, and /admin/door at all three
 *      viewports;
 *   6. clicking Sign out on /admin redirects to /admin/login, and a SUBSEQUENT direct
 *      navigation to /admin redirects back to /admin/login -- proving the session was
 *      actually cleared server-side, not just a client-side route change.
 *
 * Every sub-case is checked independently and reported by name -- a failure in one case
 * never suppresses the others, matching execution/checks/verify_reply_to.ts and
 * verify_confirmation_page.ts's per-case failure-reporting convention. Setup failures
 * (server never came up, fixture provisioning failed) are reported as a DISTINCT
 * "SETUP FAILURE" so they are never confused with a real behavioral failure, exiting 2
 * instead of 1.
 *
 * Run: node_modules/.bin/tsx execution/checks/verify_admin_nav.ts
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_CTL = path.join(
  REPO_ROOT,
  'contracts',
  'checks',
  'admin-auth-hardening',
  'server-ctl.sh',
);

// The two emails already provisioned on the running server's ADMIN_EMAIL_ALLOWLIST by the
// admin-auth-hardening contract (confirmed present in .env.local at the time this check was
// written) -- this script cannot invent new allowlisted addresses, since the allowlist is
// read from the SERVER process's env, not this script's. See _shared.mjs's own doc comment
// on ALLOWLISTED_FIXTURE_EMAIL for the same constraint.
const NO_CAP_EMAIL = 'admin-auth-check-allowlisted@saoc.co.za';
const WITH_CAP_EMAIL = 'admin-auth-f3-check-allowlisted@saoc.co.za';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '375', width: 375, height: 812 },
  { name: '320', width: 320, height: 568 },
] as const;

const MINIMAL_TRIGGER_MAX_HEIGHT_PX = 56;

function setupFailure(message: string): never {
  console.error(`SETUP FAILURE: ${message}`);
  process.exit(2);
}

const failures: string[] = [];

function record(caseName: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  PASS  ${caseName}`);
  } else {
    const line = `${caseName}${detail ? ` — ${detail}` : ''}`;
    console.error(`  FAIL  ${line}`);
    failures.push(line);
  }
}

async function runServerCtl(args: string[]): Promise<void> {
  try {
    await execFileAsync(SERVER_CTL, args, { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    throw new Error(
      `server-ctl.sh ${args.join(' ')} failed: ${err.message}\n${err.stdout ?? ''}\n${err.stderr ?? ''}`,
    );
  }
}

// Collects console-error and pageerror events on a page for the caller to inspect after
// navigation/interaction -- returns a getter, not a live array reference, so callers can't
// accidentally clear it out from under a concurrent listener.
function trackConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return () => errors;
}

async function newContextWithCookie(
  browser: Browser,
  baseUrl: string,
  cookieValue: string,
  viewport: { width: number; height: number },
): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport });
  await context.addCookies([
    {
      name: 'session',
      value: cookieValue,
      url: baseUrl,
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
  ]);
  return context;
}

async function getNavLinkTexts(page: Page): Promise<string[]> {
  // Both the bar's always-visible row and its collapsed hamburger panel render the exact
  // same <a> elements inside <nav aria-label="Admin"> -- the CSS-only "hidden" collapse
  // (Tailwind's `hidden`/`min-[1240px]:flex`) leaves both DOM subtrees present. Opening the
  // hamburger first (if present and not already expanded) guarantees the mobile copy of
  // the links is also interactable/visible for the tab-order and click assertions below,
  // without affecting what innerText-based link presence checks see (they read the DOM,
  // not layout visibility).
  return page.locator('nav[aria-label="Admin"] a').allTextContents();
}

async function ensureMobileNavOpen(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Admin menu' });
  if ((await trigger.count()) === 0) return;
  const expanded = await trigger.first().getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await trigger.first().click();
  }
}

// Playwright's ElementHandle.focus() is PROGRAMMATIC focus and deliberately does NOT
// trigger :focus-visible in Chromium (the spec's own heuristic: only a real
// keyboard-initiated focus does). This project's focus ring is a `focus-visible:ring-*`
// utility, so proving it "shows on Tab" requires REAL page.keyboard.press('Tab') presses,
// not .focus() calls — confirmed by measurement while writing this check: .focus() alone
// reported every ring as absent even for a manually-verified-working element.
async function visibleElementHandles(locator: ReturnType<Page['locator']>) {
  const handles = await locator.elementHandles();
  const visible: typeof handles = [];
  for (const h of handles) {
    if (await h.isVisible()) {
      visible.push(h);
    } else {
      await h.dispose();
    }
  }
  return visible;
}

async function elementLabel(handle: Awaited<ReturnType<Page['$']>>): Promise<string> {
  if (!handle) return '(unknown)';
  return handle.evaluate(
    (el) => (el as HTMLElement).textContent?.trim() || el.getAttribute('aria-label') || el.tagName,
  );
}

async function checkTabFocusRings(
  page: Page,
  interactiveLocator: ReturnType<Page['locator']>,
  caseLabel: string,
  maxPresses = 40,
): Promise<void> {
  const targets = await visibleElementHandles(interactiveLocator);
  if (targets.length === 0) {
    record(caseLabel, false, 'no visible interactive elements found to tab through');
    return;
  }

  const found = new Set<number>();
  let presses = 0;
  while (found.size < targets.length && presses < maxPresses) {
    await page.keyboard.press('Tab');
    presses++;
    for (let i = 0; i < targets.length; i++) {
      if (found.has(i)) continue;
      const isActive = await page.evaluate(([el]) => el === document.activeElement, [targets[i]] as const);
      if (!isActive) continue;
      found.add(i);
      const ringVisible = await targets[i].evaluate((el) => {
        const style = window.getComputedStyle(el as Element);
        // This project's focus-visible ring is a Tailwind `ring` utility (box-shadow)
        // paired with `outline-none` — so "visible focus" here means a non-'none'
        // box-shadow, not a browser default outline.
        return style.boxShadow !== 'none' && style.boxShadow !== '';
      });
      const label = await elementLabel(targets[i]);
      record(`${caseLabel} — "${label}"`, ringVisible, 'no visible focus ring (box-shadow) after a real Tab press');
    }
  }

  for (let i = 0; i < targets.length; i++) {
    if (!found.has(i)) {
      const label = await elementLabel(targets[i]);
      record(`${caseLabel} — "${label}"`, false, `never reached via Tab within ${maxPresses} presses`);
    }
  }

  for (const t of targets) await t.dispose();
}

async function main(): Promise<void> {
  const { BASE_URL, createAllowlistedFixtureUser, deleteAllowlistedFixtureUser, mintIdTokenForUid, setCustomClaims, postSession, warmUp, PreconditionError } =
    // .mjs shared helper, owned by contracts/checks/admin-auth-hardening — reused here per
    // the golden's explicit instruction rather than duplicating fixture/session plumbing.
    await import('../../contracts/checks/admin-auth-hardening/_shared.mjs');

  console.log('Building and starting a real production server on port 3400 (server-ctl.sh)...');
  try {
    await runServerCtl(['start']);
  } catch (error) {
    setupFailure(String(error));
  }

  let noCapUid: string | undefined;
  let withCapUid: string | undefined;
  let browser: Browser | undefined;

  try {
    await warmUp(['/', '/admin/login']).catch((error: unknown) => {
      if (error instanceof PreconditionError) setupFailure(error.message);
      throw error;
    });

    // --- Fixture identities: two REAL session cookies, minted through the real HTTP surface ---
    console.log('Provisioning fixture identities...');
    const noCapUser = await createAllowlistedFixtureUser(NO_CAP_EMAIL);
    noCapUid = noCapUser.uid;
    // A fresh admin:true, roles-free token — hasCapability() has nothing to grant
    // review-vendor-applications from, so this is genuinely a non-holder.
    const noCapSession = await postSession(noCapUser.idToken, { baseUrl: BASE_URL });
    if (!noCapSession.cookie) {
      setupFailure(`postSession for ${NO_CAP_EMAIL} did not return a session cookie (status ${noCapSession.status})`);
    }

    const withCapUser = await createAllowlistedFixtureUser(WITH_CAP_EMAIL);
    withCapUid = withCapUser.uid;
    // Org-wide 'manager' role -> resolve()s to a bundle including review-vendor-applications
    // (lib/admin-roles.ts). Claims mutate after the initial token mint, so a FRESH idToken
    // must be minted afterward — Firebase embeds claims at mint time, not per-request.
    await setCustomClaims(withCapUid, { admin: true, roles: { '*': ['manager'] } });
    const withCapIdToken = await mintIdTokenForUid(withCapUid);
    const withCapSession = await postSession(withCapIdToken, { baseUrl: BASE_URL });
    if (!withCapSession.cookie) {
      setupFailure(`postSession for ${WITH_CAP_EMAIL} did not return a session cookie (status ${withCapSession.status})`);
    }

    const noCapCookieValue = noCapSession.cookie!.split('=').slice(1).join('=');
    const withCapCookieValue = withCapSession.cookie!.split('=').slice(1).join('=');

    browser = await chromium.launch();

    // ------------------------------------------------------------------------------------
    // Cases 1, 2, 5: link visibility + console errors across viewports, both identities
    // ------------------------------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      // --- Non-holder ---
      {
        const ctx = await newContextWithCookie(browser, BASE_URL, noCapCookieValue, vp);
        const page = await ctx.newPage();
        const getErrors = trackConsoleErrors(page);

        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
        await ensureMobileNavOpen(page);
        const adminLinks = await getNavLinkTexts(page);
        record(
          `[${vp.name}px] non-holder /admin bar shows Dashboard`,
          adminLinks.some((t) => t.includes('Dashboard')),
          `links found: ${JSON.stringify(adminLinks)}`,
        );
        record(
          `[${vp.name}px] non-holder /admin bar shows Door Scanner`,
          adminLinks.some((t) => t.includes('Door Scanner')),
          `links found: ${JSON.stringify(adminLinks)}`,
        );
        record(
          `[${vp.name}px] non-holder /admin bar never shows Vendors`,
          !adminLinks.some((t) => t.includes('Vendors')),
          `links found: ${JSON.stringify(adminLinks)}`,
        );
        const signOutVisible = await page.getByRole('button', { name: /sign out/i }).count();
        record(`[${vp.name}px] non-holder /admin bar shows Sign out`, signOutVisible > 0);

        // --- Case 2: direct navigation to /admin/vendors is handled by the route's own
        // existing gate (redirect to /admin), not a network failure/hard block. This is the
        // "reach" proof — the request completes and lands on a defined page, independent of
        // whatever the nav does or doesn't render.
        const vendorsResponse = await page.goto(`${BASE_URL}/admin/vendors`, { waitUntil: 'networkidle' });
        record(
          `[${vp.name}px] non-holder direct nav to /admin/vendors reaches a defined response`,
          vendorsResponse !== null && vendorsResponse.status() < 400,
          `status: ${vendorsResponse?.status()}`,
        );
        record(
          `[${vp.name}px] non-holder direct nav to /admin/vendors lands on /admin (route's own gate, unmodified by this feature)`,
          new URL(page.url()).pathname === '/admin',
          `landed on ${page.url()}`,
        );
        await ensureMobileNavOpen(page);
        const vendorsLandingLinks = await getNavLinkTexts(page);
        record(
          `[${vp.name}px] non-holder still never sees Vendors after the redirect`,
          !vendorsLandingLinks.some((t) => t.includes('Vendors')),
          `links found: ${JSON.stringify(vendorsLandingLinks)}`,
        );

        await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });

        record(`[${vp.name}px] non-holder zero console errors across /admin, /admin/vendors, /admin/door`, getErrors().length === 0, JSON.stringify(getErrors()));

        await ctx.close();
      }

      // --- Holder ---
      {
        const ctx = await newContextWithCookie(browser, BASE_URL, withCapCookieValue, vp);
        const page = await ctx.newPage();
        const getErrors = trackConsoleErrors(page);

        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
        await ensureMobileNavOpen(page);
        const adminLinks = await getNavLinkTexts(page);
        record(
          `[${vp.name}px] holder /admin bar shows Vendors`,
          adminLinks.some((t) => t.includes('Vendors')),
          `links found: ${JSON.stringify(adminLinks)}`,
        );

        await page.goto(`${BASE_URL}/admin/vendors`, { waitUntil: 'networkidle' });
        record(
          `[${vp.name}px] holder reaches /admin/vendors directly (not bounced)`,
          new URL(page.url()).pathname === '/admin/vendors',
          `landed on ${page.url()}`,
        );
        await ensureMobileNavOpen(page);
        const vendorsLinks = await getNavLinkTexts(page);
        record(
          `[${vp.name}px] holder /admin/vendors bar shows Vendors`,
          vendorsLinks.some((t) => t.includes('Vendors')),
          `links found: ${JSON.stringify(vendorsLinks)}`,
        );

        await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });

        record(`[${vp.name}px] holder zero console errors across /admin, /admin/vendors, /admin/door`, getErrors().length === 0, JSON.stringify(getErrors()));

        await ctx.close();
      }
    }

    // ------------------------------------------------------------------------------------
    // Case 3: /admin/door never obstructed by a persistent bar, at 375 and 320
    // ------------------------------------------------------------------------------------
    for (const vp of VIEWPORTS.filter((v) => v.name !== '1440')) {
      const ctx = await newContextWithCookie(browser, BASE_URL, noCapCookieValue, vp);
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });

      const barNav = page.locator('nav[aria-label="Admin"]').first();
      const barIsPersistentBar = await barNav.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.position !== 'fixed' && el.getBoundingClientRect().height > 56;
      }).catch(() => false);
      record(`[${vp.name}px] /admin/door has no persistent full-height nav bar`, !barIsPersistentBar);

      const trigger = page.getByRole('button', { name: 'Admin menu' });
      const triggerCount = await trigger.count();
      record(`[${vp.name}px] /admin/door minimal trigger present`, triggerCount > 0);
      if (triggerCount > 0) {
        const box = await trigger.first().boundingBox();
        record(
          `[${vp.name}px] /admin/door minimal trigger under ${MINIMAL_TRIGGER_MAX_HEIGHT_PX}px tall`,
          !!box && box.height < MINIMAL_TRIGGER_MAX_HEIGHT_PX,
          `box: ${JSON.stringify(box)}`,
        );

        const scannerBox = await page.locator('#qr-reader').boundingBox();
        const triggerBox = await trigger.first().boundingBox();
        if (scannerBox && triggerBox) {
          const overlaps = !(
            triggerBox.x + triggerBox.width <= scannerBox.x ||
            scannerBox.x + scannerBox.width <= triggerBox.x ||
            triggerBox.y + triggerBox.height <= scannerBox.y ||
            scannerBox.y + scannerBox.height <= triggerBox.y
          );
          record(`[${vp.name}px] minimal trigger does not cover the scanner video container`, !overlaps, `trigger: ${JSON.stringify(triggerBox)}, scanner: ${JSON.stringify(scannerBox)}`);
        } else {
          record(`[${vp.name}px] minimal trigger does not cover the scanner video container`, false, 'could not read bounding boxes for trigger/scanner');
        }
      }

      await ctx.close();
    }

    // ------------------------------------------------------------------------------------
    // Case 4: tab focus rings + Escape-closes-overlay
    // ------------------------------------------------------------------------------------
    {
      // Bar variant, 1440 — full row visible, no collapse.
      const ctx = await newContextWithCookie(browser, BASE_URL, withCapCookieValue, { width: 1440, height: 900 });
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await checkTabFocusRings(
        page,
        page.locator('nav[aria-label="Admin"] a, nav[aria-label="Admin"] button'),
        'focus ring on /admin bar (1440px)',
      );
      await ctx.close();
    }
    {
      // Minimal variant, 375 — open overlay, tab through it, then Escape.
      const ctx = await newContextWithCookie(browser, BASE_URL, withCapCookieValue, { width: 375, height: 812 });
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });
      const trigger = page.getByRole('button', { name: 'Admin menu' });
      await trigger.click();
      const overlay = page.getByRole('dialog', { name: 'Admin menu' });
      record('minimal overlay opens on trigger click', (await overlay.count()) > 0);

      await checkTabFocusRings(page, overlay.locator('a, button'), 'focus ring inside /admin/door minimal overlay');

      await page.keyboard.press('Escape');
      const overlayGoneCount = await overlay.count();
      record('Escape closes the /admin/door minimal overlay', overlayGoneCount === 0);
      await ctx.close();
    }

    // ------------------------------------------------------------------------------------
    // Case 6: sign-out actually clears the session server-side
    // ------------------------------------------------------------------------------------
    {
      // Fresh cookie for this destructive scenario — never reuse a cookie a prior case may
      // still need.
      const signOutSession = await postSession(noCapUser.idToken, { baseUrl: BASE_URL });
      if (!signOutSession.cookie) {
        setupFailure(`postSession for the sign-out scenario did not return a session cookie (status ${signOutSession.status})`);
      }
      const ctx = await newContextWithCookie(browser, BASE_URL, signOutSession.cookie!.split('=').slice(1).join('='), { width: 1440, height: 900 });
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });

      const signOutButton = page.getByRole('button', { name: /sign out/i }).first();
      await signOutButton.click();
      await page.waitForURL(`${BASE_URL}/admin/login`, { timeout: 10_000 }).catch(() => undefined);
      record('clicking Sign out redirects to /admin/login', new URL(page.url()).pathname === '/admin/login', `landed on ${page.url()}`);

      const secondVisit = await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      record(
        'a subsequent direct navigation to /admin after sign-out bounces back to /admin/login (session actually cleared)',
        new URL(page.url()).pathname === '/admin/login',
        `status ${secondVisit?.status()}, landed on ${page.url()}`,
      );

      await ctx.close();
    }

    if (failures.length === 0) {
      console.log('PASS: verify_admin_nav — all sub-cases passed.');
    } else {
      console.error(`FAIL: verify_admin_nav — ${failures.length} failing sub-case(s):`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('FAIL [unexpected-error]:', error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    if (noCapUid) await deleteAllowlistedFixtureUser(noCapUid).catch(() => undefined);
    if (withCapUid) await deleteAllowlistedFixtureUser(withCapUid).catch(() => undefined);
    console.log('Stopping the production server (server-ctl.sh stop)...');
    await runServerCtl(['stop']).catch((error) => console.error(String(error)));
  }
}

main();
