/**
 * Contract assertion for admin-nav-active-state/contract-f1.yaml (A6).
 *
 * The load-bearing behavioral proof for this feature. Everything admin-nav-menu's A13 already
 * proves (link presence, reachability, focus rings, sign-out) is NOT re-proven here — see that
 * script (execution/checks/verify_admin_nav.ts) for those cases, still the load-bearing check
 * for admin-nav-menu. This script proves the one property that suite never asked about: whether
 * a sighted user can SEE which nav link is the current page, and whether the two stacked mobile
 * hamburgers are visually distinguishable — not just structurally/semantically distinguishable.
 *
 * Reuses the same real-server + real-fixture-cookie pattern as verify_admin_nav.ts (server-ctl.sh
 * on port 3400, _shared.mjs's createAllowlistedFixtureUser/setCustomClaims/mintIdTokenForUid/
 * postSession) — never a fake/mocked session.
 *
 * Every sub-case is checked independently and reported by name, matching this project's existing
 * per-case failure-reporting convention (verify_admin_nav.ts, verify_reply_to.ts). Setup failures
 * are reported as a distinct "SETUP FAILURE" and exit 2; behavioral failures exit 1.
 *
 * Run: node_modules/.bin/tsx execution/checks/verify_admin_nav_active_state.ts
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

// Reuses the exact WITH_CAP fixture email verify_admin_nav.ts:63 already provisions on the
// running server's ADMIN_EMAIL_ALLOWLIST -- this script does NOT mint its own address. Standing
// admin-capable fixture identities are a security-relevant thing to minimize, not multiply, and
// this project's allowlist has already grown twice tonight; reusing an existing entry is both
// less to maintain and the better posture even for local fixtures.
const WITH_CAP_EMAIL = 'admin-auth-f3-check-allowlisted@saoc.co.za';

// Minimum computed font-weight delta between the active link and an inactive sibling for the
// difference to count as "a human would notice" -- see the golden's "200-unit weight delta is
// the standard threshold Tailwind's own scale treats as a distinct step" rationale (400 normal
// -> 600 semibold skips the ambiguous 500 "medium" step entirely).
const MIN_FONT_WEIGHT_DELTA = 200;

// Minimum extra width (px) the admin trigger must have over the header's icon-only hamburger
// for the two stacked buttons to read as visually different shapes, not just different labels.
const MIN_TRIGGER_WIDTH_DELTA_PX = 20;

// A background is only "genuinely painted" if its alpha is at least this. Below it, the color
// blends too heavily with whatever sits behind the element to read as a distinct fill regardless
// of how different its RGB is -- a chip painted at, say, alpha 0.05 would pass a bare `alpha >
// 0` check while remaining functionally invisible. 0.5 is a conservative floor: a background at
// half opacity or less is not a "chip", it's a tint.
const MIN_VISIBLE_ALPHA = 0.5;

// Minimum Manhattan (summed per-channel) RGB distance for two painted colors to count as
// visibly different. Measured today's real fix: bg-primary-100 (#e8e6dc = 232,230,220) painted
// over the page's parchment background (#f4f3ec = 244,243,236) gives |244-232| + |243-230| +
// |236-220| = 12 + 13 + 16 = 41. Set to 20 -- roughly half the real, QA-confirmed-legible delta,
// leaving headroom for a legitimate future palette adjustment (a slightly different tint token,
// a theme change) without opening the door back up to the defect this contract exists to catch:
// a same-family, low-contrast color swap that is technically non-equal RGB but reads as nothing
// to a human at 14px. A 1-unit-per-channel change (the drill this assertion must reject) sums to
// at most 3, nowhere near 20.
const MIN_COLOR_DELTA = 20;

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

async function ensureMobileNavOpen(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Admin menu' });
  if ((await trigger.count()) === 0) return;
  const expanded = await trigger.first().getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await trigger.first().click();
  }
}

// Parses a CSS rgba()/rgb() computed-style string into a 4-tuple. Returns null (never throws) on
// anything unparseable, so a caller can treat "couldn't parse" as its own explicit failure detail
// rather than crashing the whole run.
function parseColor(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  if (parts.length < 3) return null;
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function colorsDiffer(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  // Alpha-aware: a background painted below MIN_VISIBLE_ALPHA counts as "not really there"
  // regardless of its RGB, and two painted-but-identical colors count as the same -- both are
  // real "no visible diff" false states a bare string-inequality check could miss (e.g.
  // rgba(0,0,0,0) vs rgba(255,255,255,0) are string-different but both fully transparent).
  const aVisible = a[3] >= MIN_VISIBLE_ALPHA;
  const bVisible = b[3] >= MIN_VISIBLE_ALPHA;
  if (aVisible !== bVisible) return true;
  if (!aVisible && !bVisible) return false;

  // Both are genuinely painted -- now require a perceptible RGB distance, not mere inequality.
  // Manhattan (summed per-channel) distance chosen over Euclidean for the same reason the golden
  // gives the font-weight threshold as a flat step rather than a ratio: it's the simplest measure
  // that's directly comparable to the real, QA-confirmed-legible delta this check is calibrated
  // against (see MIN_COLOR_DELTA's comment) -- no square roots needed to reason about "is this
  // half of the real fix's delta, or a tenth of it".
  const manhattanDistance = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  return manhattanDistance >= MIN_COLOR_DELTA;
}

interface LinkStyle {
  label: string;
  active: boolean;
  fontWeight: number;
  backgroundColor: [number, number, number, number] | null;
  color: string;
}

async function readNavLinkStyles(page: Page): Promise<LinkStyle[]> {
  // AdminNav's "bar" variant renders the SAME link list twice in the DOM at once -- a
  // desktop row hidden below 1240px via Tailwind's `hidden` class, and a mobile-hamburger-
  // panel copy hidden above it the same way (confirmed in components/admin/AdminNav.tsx's
  // renderLinkList() being called from both the always-visible container and the collapsed
  // panel). A CSS-only `display: none` hide leaves both subtrees in the DOM, so a selector
  // with no visibility filter double-counts every link at narrow viewports. Filtered here via
  // `el.offsetParent !== null`, the standard cheap "is this laid out and visible" check (it
  // returns null for any display:none ancestor) -- a sighted user can only ever see the one
  // visible copy, so that's the only copy this check may reason about.
  const raw = await page.locator('nav[aria-label="Admin"] a').evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const style = window.getComputedStyle(el as HTMLElement);

        // A link with no explicit background class computes as `rgba(0, 0, 0, 0)` on ITS OWN
        // box -- but that is not what a human sees. A human sees whatever is painted on the
        // nearest opaque ANCESTOR showing through. Comparing each link's raw own-box
        // background, as an earlier version of this check did, meant an inactive link (always
        // transparent-on-itself, by construction -- it never gets a background class) was
        // compared against an active link's painted color via a bare "is one transparent and
        // the other not" test, which is true for ANY painted color, however close to the
        // ambient page background -- the perceptual RGB-distance check below was dead code in
        // practice, never reached, because the alpha branch always won first. Walking up to the
        // first opaque ancestor for BOTH links makes the comparison what it should always have
        // been: "does the active link's effective on-screen color actually differ from what an
        // inactive link's slot actually shows" -- the real chip-vs-no-chip contrast a viewer
        // sees, not an artifact of which element happens to carry a background CSS rule.
        // Inlined rather than a nested named function -- Playwright's injected-eval context
        // has been observed to choke on esbuild's `__name` helper for nested function
        // declarations inside an evaluateAll callback (a build-tooling artifact, not a logic
        // choice); a plain loop avoids it.
        let effectiveBg = 'rgb(255, 255, 255)';
        let ancestor: Element | null = el as HTMLElement;
        while (ancestor) {
          const bg = window.getComputedStyle(ancestor).backgroundColor;
          const m = bg.match(/rgba?\(([^)]+)\)/);
          const alpha = m ? parseFloat(m[1].split(',')[3] ?? '1') : 0;
          if (alpha > 0) {
            effectiveBg = bg;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        return {
          label: (el.textContent || '').trim(),
          active: el.getAttribute('aria-current') === 'page',
          fontWeight: parseFloat(style.fontWeight),
          backgroundColor: effectiveBg,
          color: style.color,
        };
      }),
  );
  return raw.map((r) => ({ ...r, backgroundColor: parseColor(r.backgroundColor) }));
}

// Checks the active-vs-inactive visual delta on a page that has already been navigated to and
// (if needed) had its mobile nav opened. `expectedActiveLabel` lets the caller assert the RIGHT
// link is the one marked active, not just that some link is.
async function checkActiveLinkVisualDistinction(
  page: Page,
  caseLabel: string,
  expectedActiveLabel: string,
): Promise<void> {
  const styles = await readNavLinkStyles(page);
  if (styles.length === 0) {
    record(`${caseLabel} — nav links present`, false, 'no <a> found inside nav[aria-label="Admin"]');
    return;
  }

  const active = styles.filter((s) => s.active);
  record(
    `${caseLabel} — exactly one link carries aria-current="page"`,
    active.length === 1,
    `found ${active.length}: ${JSON.stringify(styles.map((s) => ({ label: s.label, active: s.active })))}`,
  );
  if (active.length !== 1) return;

  record(
    `${caseLabel} — aria-current="page" is on the correct link ("${expectedActiveLabel}")`,
    active[0].label.includes(expectedActiveLabel),
    `aria-current was on "${active[0].label}"`,
  );

  const inactive = styles.filter((s) => !s.active);
  if (inactive.length === 0) {
    record(`${caseLabel} — at least one inactive sibling to compare against`, false, 'only one link rendered');
    return;
  }

  // Font-weight signal: active must be at least MIN_FONT_WEIGHT_DELTA heavier than EVERY
  // inactive sibling (not just one) -- a false state where only one sibling happens to be light
  // (e.g. a browser default on one link) must not let this pass by accident.
  const weightOk = inactive.every((s) => active[0].fontWeight - s.fontWeight >= MIN_FONT_WEIGHT_DELTA);
  record(
    `${caseLabel} — active link font-weight is >=${MIN_FONT_WEIGHT_DELTA} heavier than every inactive sibling`,
    weightOk,
    `active: ${active[0].fontWeight}, inactive: ${JSON.stringify(inactive.map((s) => s.fontWeight))}`,
  );

  // Background-chip signal: active must have a visibly painted background that differs from
  // EVERY inactive sibling's background.
  const bgOk = inactive.every((s) => {
    if (!active[0].backgroundColor || !s.backgroundColor) return false;
    return colorsDiffer(active[0].backgroundColor, s.backgroundColor);
  });
  record(
    `${caseLabel} — active link background-color visibly differs from every inactive sibling`,
    bgOk,
    `active: ${JSON.stringify(active[0].backgroundColor)}, inactive: ${JSON.stringify(inactive.map((s) => s.backgroundColor))}`,
  );

  // Concrete false-state guard: today's shipped code (color-only, text-primary vs text-ink) is
  // exactly what this pair of assertions must reject. It is NOT sufficient for only one of the
  // two to pass -- redundancy is the point (see golden's "concrete false state each signal
  // individually would let through").
  record(`${caseLabel} — both weight AND background signals present (redundant, not color-only)`, weightOk && bgOk);
}

async function checkHamburgerDisambiguation(page: Page, caseLabel: string): Promise<void> {
  const headerTrigger = page.getByRole('button', { name: 'Open menu' });
  const adminTrigger = page.getByRole('button', { name: 'Admin menu' });

  const headerCount = await headerTrigger.count();
  const adminCount = await adminTrigger.count();
  record(`${caseLabel} — both header hamburger and admin trigger present`, headerCount > 0 && adminCount > 0, `header: ${headerCount}, admin: ${adminCount}`);
  if (headerCount === 0 || adminCount === 0) return;

  const adminText = (await adminTrigger.first().textContent())?.trim() ?? '';
  record(
    `${caseLabel} — admin trigger renders a visible text label containing "Admin"`,
    /admin/i.test(adminText),
    `visible text content was "${adminText}"`,
  );

  const headerText = (await headerTrigger.first().textContent())?.trim() ?? '';
  record(
    `${caseLabel} — header hamburger has no visible "Admin" text (stays the site's default trigger)`,
    !/admin/i.test(headerText),
    `header trigger visible text content was "${headerText}"`,
  );

  const headerBox = await headerTrigger.first().boundingBox();
  const adminBox = await adminTrigger.first().boundingBox();
  if (!headerBox || !adminBox) {
    record(`${caseLabel} — both triggers have a measurable bounding box`, false, `header: ${JSON.stringify(headerBox)}, admin: ${JSON.stringify(adminBox)}`);
    return;
  }
  const widthDelta = adminBox.width - headerBox.width;
  record(
    `${caseLabel} — admin trigger is measurably wider than the header hamburger (>=${MIN_TRIGGER_WIDTH_DELTA_PX}px, from the visible label, not just a differing accessible name)`,
    widthDelta >= MIN_TRIGGER_WIDTH_DELTA_PX,
    `header width: ${headerBox.width}, admin width: ${adminBox.width}, delta: ${widthDelta}`,
  );
}

async function main(): Promise<void> {
  const { BASE_URL, createAllowlistedFixtureUser, deleteAllowlistedFixtureUser, mintIdTokenForUid, setCustomClaims, postSession, warmUp, PreconditionError } =
    await import('../../contracts/checks/admin-auth-hardening/_shared.mjs');

  console.log('Building and starting a real production server on port 3400 (server-ctl.sh)...');
  try {
    await runServerCtl(['start']);
  } catch (error) {
    setupFailure(String(error));
  }

  let withCapUid: string | undefined;
  let browser: Browser | undefined;

  try {
    await warmUp(['/', '/admin/login']).catch((error: unknown) => {
      if (error instanceof PreconditionError) setupFailure(error.message);
      throw error;
    });

    console.log('Provisioning a fixture identity with review-vendor-applications...');
    const withCapUser = await createAllowlistedFixtureUser(WITH_CAP_EMAIL);
    withCapUid = withCapUser.uid;
    await setCustomClaims(withCapUid, { admin: true, roles: { '*': ['manager'] } });
    const idToken = await mintIdTokenForUid(withCapUid);
    const session = await postSession(idToken, { baseUrl: BASE_URL });
    if (!session.cookie) {
      setupFailure(`postSession for ${WITH_CAP_EMAIL} did not return a session cookie (status ${session.status})`);
    }
    const cookieValue = session.cookie!.split('=').slice(1).join('=');

    browser = await chromium.launch();

    const VIEWPORTS = [
      { name: '1440', width: 1440, height: 900 },
      { name: '375', width: 375, height: 812 },
      { name: '320', width: 320, height: 568 },
    ] as const;

    // ------------------------------------------------------------------------------------
    // Active-link visual distinction on each of the three real destinations, at every
    // viewport. Uses the WITH_CAP identity throughout so Vendors is always present and its
    // own active state is checkable too.
    // ------------------------------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      const routes: Array<{ path: string; activeLabel: string }> = [
        { path: '/admin', activeLabel: 'Dashboard' },
        { path: '/admin/vendors', activeLabel: 'Vendors' },
      ];
      for (const route of routes) {
        const ctx = await newContextWithCookie(browser, BASE_URL, cookieValue, vp);
        const page = await ctx.newPage();
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' });
        await ensureMobileNavOpen(page);
        await checkActiveLinkVisualDistinction(page, `[${vp.name}px] ${route.path}`, route.activeLabel);
        await ctx.close();
      }
    }

    // /admin/door is the minimal variant -- the active link only exists inside the opened
    // overlay, so open it before reading styles.
    for (const vp of VIEWPORTS) {
      const ctx = await newContextWithCookie(browser, BASE_URL, cookieValue, vp);
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });
      const trigger = page.getByRole('button', { name: 'Admin menu' });
      if ((await trigger.count()) === 0) {
        record(`[${vp.name}px] /admin/door minimal trigger present to open`, false);
      } else {
        await trigger.first().click();
        await checkActiveLinkVisualDistinction(page, `[${vp.name}px] /admin/door (minimal overlay)`, 'Door Scanner');
      }
      await ctx.close();
    }

    // ------------------------------------------------------------------------------------
    // Hamburger disambiguation at 375px and 320px on /admin (both triggers are on-screen
    // there without opening anything -- the header's hamburger and the admin bar's
    // collapsed-mobile trigger render side by side per the existing screenshots).
    // ------------------------------------------------------------------------------------
    for (const vp of VIEWPORTS.filter((v) => v.name !== '1440')) {
      const ctx = await newContextWithCookie(browser, BASE_URL, cookieValue, vp);
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await checkHamburgerDisambiguation(page, `[${vp.name}px] /admin`);
      await ctx.close();
    }

    if (failures.length === 0) {
      console.log('PASS: verify_admin_nav_active_state — all sub-cases passed.');
    } else {
      console.error(`FAIL: verify_admin_nav_active_state — ${failures.length} failing sub-case(s):`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('FAIL [unexpected-error]:', error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    if (withCapUid) await deleteAllowlistedFixtureUser(withCapUid).catch(() => undefined);
    console.log('Stopping the production server (server-ctl.sh stop)...');
    await runServerCtl(['stop']).catch((error) => console.error(String(error)));
  }
}

main();
