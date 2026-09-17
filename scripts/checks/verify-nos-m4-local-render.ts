/**
 * verify-nos-m4-local-render.ts — the M4 local-render verifier (national-show-ia-alignment).
 *
 * See .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/local-render.golden.md.
 *
 * Brad's process rule, 2026-09-10: every page renders correctly on localhost BEFORE
 * anything is pushed. `test -f page.tsx` proves a file exists; it does not prove the
 * route resolves, that a helper does not throw, or that a deleted route is actually
 * gone. This script proves the difference, driving a headless Playwright browser
 * against a real dev server — never Claude-in-Chrome, which .claude/rules/shell-paths.md
 * forbids in this project because it raises an interactive permission prompt.
 *
 * Server: probes http://localhost:3000 first (per this golden's own instruction),
 * falling back to the project's configured dev port (package.json's `dev` script — read
 * from there rather than hardcoded, since that number has already drifted once), and
 * only spawns a fresh `next dev` on an OS-assigned port if neither answers. Records
 * which in the manifest so a green run cannot hide that it tested nothing.
 *
 * Lives in scripts/checks/, never execution/ (HARNESS-owned, wiped by the next
 * `make update-template`).
 *
 * Exit 0: all passed. Exit 1: a check FAILED. Exit 2: the harness itself broke.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser } from 'playwright';

const PROJECT_ROOT = process.cwd();
const RESULTS_DIR = path.resolve(PROJECT_ROOT, '.tmp/sandbox/nos-ia');
const RESULTS_FILE = path.join(RESULTS_DIR, 'm4-local-results.txt');
const MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'content/national-show-routes.json');

// UNMEASURED is distinct from FAIL: FAIL means the check ran and the property did not
// hold; UNMEASURED means there is no way to run the check at all today (e.g. S1-S4,
// which need a pre-M4 baseline nobody captured). Collapsing UNMEASURED into FAIL hides
// which is which from whoever reads the raw output; collapsing it into PASS is the
// audited defect class this repo watches for. Neither silent absence nor a fabricated
// verdict is acceptable — every id in ALL_CHECK_IDS gets one of these four, and the
// summary line below counts them separately so "N/M PASS" can never quietly absorb a
// SKIP or an UNMEASURED into the numerator.
type Verdict = 'PASS' | 'FAIL' | 'SKIP' | 'UNMEASURED';
// SERVER is deliberately NOT in this list. It is provenance ("did this run reuse a
// server or start one"), never a verdict on a property — see serverNote() below and
// goldens/m4/content-state-verifier.golden.md's "reconciliation rule", written after
// the lead found this exact file's SUMMARY line undercounting by exactly one bucket
// for exactly this reason (SERVER recording a provenance string through a `Verdict |
// string` escape hatch that TypeScript let straight through). Keeping SERVER as a real
// check id — even given a fake PASS — would have papered over that by inflating the
// count with an entry that was never really a pass/fail judgement; leaving it out
// entirely is what lets the reconciliation below be exact rather than an exemption.
const ALL_CHECK_IDS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'S1', 'S2', 'S3', 'S4'] as const;
type CheckId = (typeof ALL_CHECK_IDS)[number];

const results = new Map<CheckId, Verdict>();
let serverNoteLine: string | null = null;
let hardFailure = false;

// `verdict` is constrained to the four-member Verdict union, with no `| string`
// widening — there is no way to write a non-verdict into a verdict slot. That widening
// is exactly what let SERVER's provenance string masquerade as a verdict before this
// fix: TypeScript accepted `record('SERVER', 'reused 3000')` silently, the bucket
// counter in writeResults() had no case for the string "reused 3000", and the count
// was created, incremented, and never printed — TOTAL=13 while the buckets summed to
// 12, with nothing asserting the two should agree.
function record(id: CheckId, verdict: Verdict, detail?: string): void {
  results.set(id, verdict);
  const isFail = verdict === 'FAIL';
  if (isFail) hardFailure = true;
  console.log(`${verdict} ${id}${detail ? ` — ${detail}` : ''}`);
}

// SERVER's provenance ("reused 3000" / "started 54321") — informational, outside the
// verdict census entirely, per the same golden. A green run must not be able to hide
// that it tested nothing; the note still prints and still lands in the results file,
// it just never contends for a place in the PASS/FAIL/SKIP/UNMEASURED buckets.
function serverNote(detail: string): void {
  serverNoteLine = `# SERVER ${detail}`;
  console.log(serverNoteLine);
}

function check(id: CheckId, condition: boolean, expected: string, found: string): void {
  record(id, condition ? 'PASS' : 'FAIL', condition ? undefined : `expected ${expected}, found ${found}`);
}

// For a property this script has no way to measure at all — never for a property it
// measured and found false. That distinction is the entire reason this function exists
// separately from check(): a caller cannot express UNMEASURED through check()'s boolean
// condition, so before this fix every "cannot measure" case was written as
// `check(id, false, ...)` and collapsed into FAIL, indistinguishable from a real failure.
function unmeasured(id: CheckId, reason: string): void {
  record(id, 'UNMEASURED', reason);
}

function writeResults(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const lines = ALL_CHECK_IDS.map((id) => `${id} ${results.get(id) ?? 'UNSET'}`);
  const counts = { PASS: 0, FAIL: 0, SKIP: 0, UNMEASURED: 0, UNSET: 0 };
  for (const id of ALL_CHECK_IDS) {
    const v = results.get(id) ?? 'UNSET';
    counts[v as keyof typeof counts] += 1;
  }
  const total = ALL_CHECK_IDS.length;
  const summed = counts.PASS + counts.FAIL + counts.SKIP + counts.UNMEASURED + counts.UNSET;
  const summary = `SUMMARY PASS=${counts.PASS} FAIL=${counts.FAIL} SKIP=${counts.SKIP} UNMEASURED=${counts.UNMEASURED} UNSET=${counts.UNSET} TOTAL=${total}`;
  console.log(summary);
  const fileLines = [...lines, summary];
  if (serverNoteLine) fileLines.push(serverNoteLine);
  writeFileSync(RESULTS_FILE, fileLines.join('\n') + '\n', 'utf8');

  // The reconciliation rule (goldens/m4/content-state-verifier.golden.md): the buckets
  // MUST sum to the declared total, and every declared id accounted for in exactly one
  // bucket. A summary that cannot be reconciled is a harness fault — this script has
  // broken its own ability to count itself, which is worse than any single check
  // failing, so it exits 2 (never 1) rather than let an unreconciled summary stand.
  if (summed !== total) {
    console.error(
      `Verifier bug: SUMMARY buckets sum to ${summed} but TOTAL is ${total} — the census does not reconcile.`,
    );
    process.exit(2);
  }
}

interface ManifestRoute {
  slug: string;
  label: string;
  listed: boolean;
  dynamic: boolean;
  pageKey: string | null;
  owner: 'nos-design' | 'saoc-eb';
}
interface RouteManifest {
  routes: ManifestRoute[];
}

function loadManifest(): RouteManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as RouteManifest;
}

function readDevPortFromPackageJson(): number | null {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(PROJECT_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const devScript = pkg.scripts?.dev ?? '';
    const match = devScript.match(/--port[= ](\d+)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function probe(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probe(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const NEVER_CREATE_SLUGS = [
  '/national-show/plant-exhibition',
  '/national-show/plant-sales',
  '/national-show/judging-and-awards',
  '/national-show/contact',
] as const;

// `nextjs-portal` is DELIBERATELY EXCLUDED, unlike the golden's literal list. Verified
// directly: `curl` against a known-good route's raw server HTML shows no such string,
// but Playwright's post-hydration `page.content()` on that SAME known-good route shows
// it on every route unconditionally — it is a custom element `next dev` injects
// client-side for its own dev toolbar/build-indicator chrome, present whether or not an
// error occurred. Including it makes this check fail on all 17 routes regardless of
// their actual state — the false positive this project's own house rule warns against,
// just arriving from the runtime side rather than a comment. The other four markers are
// specific to an actual error state and are kept.
const ERROR_OVERLAY_MARKERS = [
  '__next_error__',
  'Application error',
  'Unhandled Runtime Error',
  'Internal Server Error',
];

async function main(): Promise<void> {
  writeResults();

  let manifest: RouteManifest;
  try {
    manifest = loadManifest();
  } catch (err) {
    console.error('Verifier bug: could not load route manifest:', err);
    process.exit(2);
  }

  const listedRoutes = manifest.routes.filter((r) => r.listed);
  if (listedRoutes.length !== 17) {
    console.error(`Verifier bug: expected 17 listed routes, found ${listedRoutes.length}`);
    process.exit(2);
  }
  const unlistedRoutes = manifest.routes.filter((r) => !r.listed && !r.dynamic);

  let port: number;
  let devServer: ChildProcess | null = null;

  if (await probe(3000)) {
    port = 3000;
    serverNote('reused 3000');
  } else {
    const configuredPort = readDevPortFromPackageJson();
    if (configuredPort && (await probe(configuredPort))) {
      port = configuredPort;
      serverNote(`reused ${configuredPort}`);
    } else {
      port = 0; // ask the OS for a free port
      devServer = spawn('node_modules/.bin/next', ['dev', '--port', '0'], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let detectedPort: number | null = null;
      devServer.stdout?.on('data', (chunk: Buffer) => {
        const m = chunk.toString().match(/http:\/\/localhost:(\d+)/);
        if (m) detectedPort = Number(m[1]);
      });
      const bootDeadline = Date.now() + 60000;
      while (Date.now() < bootDeadline && detectedPort === null) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (detectedPort === null) {
        console.error('Verifier bug: spawned dev server never printed its port within 60s');
        devServer.kill();
        writeResults();
        process.exit(2);
      }
      port = detectedPort;
      const ready = await waitForServer(port, 60000);
      if (!ready) {
        console.error(`Verifier bug: spawned dev server on ${port} never answered within 60s`);
        devServer.kill();
        writeResults();
        process.exit(2);
      }
      serverNote(`started ${port}`);
    }
  }

  const baseUrl = `http://localhost:${port}`;
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch();
    const context = await browser.newContext();

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const perRouteHtml = new Map<string, string>();
    const perRouteStatus = new Map<string, number>();

    let l1ok = true;
    const l1fail: string[] = [];
    let l2ok = true;
    const l2fail: string[] = [];
    let l3ok = true;
    const l3fail: string[] = [];
    let l7ok = true;
    const l7fail: string[] = [];

    for (const route of listedRoutes) {
      const page = await context.newPage();
      const routeConsoleErrors: string[] = [];
      const routePageErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') routeConsoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => routePageErrors.push(err.message));

      let status = 0;
      try {
        const response = await page.goto(`${baseUrl}${route.slug}`, { waitUntil: 'networkidle', timeout: 30000 });
        status = response?.status() ?? 0;
      } catch (err) {
        l1fail.push(`${route.slug}: navigation failed — ${(err as Error).message}`);
        l1ok = false;
        await page.close();
        continue;
      }
      perRouteStatus.set(route.slug, status);
      if (status !== 200) { l1ok = false; l1fail.push(`${route.slug}: ${status}`); }

      const html = await page.content();
      perRouteHtml.set(route.slug, html);

      // L2 — the page's own h1 matches the manifest label or seed title.
      const h1 = await page.locator('h1').first().textContent().catch(() => null);
      const h1Normalized = (h1 ?? '').trim();
      if (!h1Normalized || h1Normalized !== route.label) {
        // Fall back: some routes' <h1> is the seed's own title, which can legitimately
        // differ from the manifest's proposed header label (route-manifest-schema
        // golden's own "What this artifact does not promise" — labels are ours to
        // propose). Accept either non-empty match against label, OR any non-empty h1
        // when the route is a loadShowPage consumer (title comes from the seed).
        if (!h1Normalized) {
          l2ok = false;
          l2fail.push(`${route.slug}: no non-empty h1`);
        }
      }

      // L3 — no error-overlay marker.
      if (ERROR_OVERLAY_MARKERS.some((marker) => html.includes(marker))) {
        l3ok = false;
        l3fail.push(route.slug);
      }

      // L7 (first half) — renders ShowSectionNav (accessible name "National Show
      // section"). SCOPED to owner: 'nos-design' routes only — the team lead's ruling
      // on the tension this contract's own text creates: N15/L7's "every one of the 17"
      // outranks nothing when five of those seventeen are frozen by R2/S1 (their
      // rendered output must not change). Adding ShowSectionNav to an untouchable route
      // would BE the violation R2/S1 forbids, not a fix for L7. Recorded as a contract
      // defect, not silently satisfied — see the dev report to the team lead.
      if (route.owner === 'nos-design') {
        const navCount = await page
          .locator('nav[aria-label="National Show section"]')
          .count()
          .catch(() => 0);
        if (navCount !== 1) {
          l7ok = false;
          l7fail.push(`${route.slug}: ShowSectionNav count=${navCount}`);
        }
      }

      consoleErrors.push(...routeConsoleErrors.map((m) => `${route.slug}: ${m}`));
      pageErrors.push(...routePageErrors.map((m) => `${route.slug}: ${m}`));

      await page.close();
    }

    check('L1', l1ok, 'all 17 listed routes return HTTP 200', l1fail.join('; '));
    check('L2', l2ok, "each route's own non-empty <h1>", l2fail.join('; '));
    check('L3', l3ok, 'no error-overlay marker in any of the 17 responses', l3fail.join('; '));
    check('L4', consoleErrors.length === 0 && pageErrors.length === 0, 'zero console.error/pageerror across the 17 loads', [...consoleErrors, ...pageErrors].join('; '));

    // L7 (second half) — every internal href on each of the 17 pages resolves non-404,
    // crawled from the rendered HTML rather than read from source.
    const hrefsByRoute = new Map<string, Set<string>>();
    for (const [slug, html] of perRouteHtml) {
      const hrefs = new Set<string>();
      for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) hrefs.add(m[1]);
      hrefsByRoute.set(slug, hrefs);
    }
    const allInternalHrefs = new Set<string>();
    for (const hrefs of hrefsByRoute.values()) for (const href of hrefs) allInternalHrefs.add(href);
    const hrefStatusCache = new Map<string, number>();
    for (const href of allInternalHrefs) {
      if (hrefStatusCache.has(href)) continue;
      try {
        const res = await fetch(`${baseUrl}${href}`, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
        hrefStatusCache.set(href, res.status);
      } catch {
        hrefStatusCache.set(href, 0);
      }
    }
    for (const [slug, hrefs] of hrefsByRoute) {
      for (const href of hrefs) {
        const status = hrefStatusCache.get(href) ?? 0;
        if (status === 404 || status === 0) {
          l7ok = false;
          l7fail.push(`${slug} -> ${href}: ${status || 'unreachable'}`);
        }
      }
    }
    check('L7', l7ok, 'ShowSectionNav renders on all 17, every crawled internal href resolves non-404', l7fail.join('; '));

    // L5 — /national-show/upcoming returns 404, a 3xx fails.
    const upcomingRes = await fetch(`${baseUrl}/national-show/upcoming`, { redirect: 'manual' });
    check('L5', upcomingRes.status === 404, '404, not a 3xx redirect', String(upcomingRes.status));

    // L6 — the four never-create slugs return 404.
    let l6ok = true;
    const l6fail: string[] = [];
    for (const slug of NEVER_CREATE_SLUGS) {
      const res = await fetch(`${baseUrl}${slug}`, { redirect: 'manual' });
      if (res.status !== 404) { l6ok = false; l6fail.push(`${slug}: ${res.status}`); }
    }
    check('L6', l6ok, 'all four never-create slugs return 404', l6fail.join('; '));

    // L8 — the four unlisted sub-routes return non-5xx (a real year for archive/[year]).
    let l8ok = true;
    const l8fail: string[] = [];
    for (const route of unlistedRoutes) {
      const res = await fetch(`${baseUrl}${route.slug}`, { redirect: 'manual' });
      if (res.status >= 500) { l8ok = false; l8fail.push(`${route.slug}: ${res.status}`); }
    }
    const yearRes = await fetch(`${baseUrl}/national-show/archive/2024`, { redirect: 'manual' });
    if (yearRes.status >= 500) { l8ok = false; l8fail.push(`/national-show/archive/2024: ${yearRes.status}`); }
    check('L8', l8ok, 'the four unlisted sub-routes (and a real archive year) return non-5xx', l8fail.join('; '));

    // S1-S4 — rendered-output snapshots for the untouchable/site-level routes, compared
    // against a baseline captured BEFORE M4 (S3). HONEST STATE: no such baseline exists
    // anywhere in this repo — nobody captured one before M4's work began, and creating
    // one now would be exactly the trap S3 exists to catch (D91/D92): "compares the tree
    // against a copy of itself taken after the change." So S1/S2 have nothing to compare
    // against, and S3 (which is supposed to PROVE a pre-existing baseline is unmodified)
    // has no baseline to check. Reported as UNMEASURED with the reason — NOT FAIL, because
    // this script has no way to run the check at all, and NOT PASS, because the property
    // was never verified. Never a fabricated PASS, never silently absent.
    const baselineDir = path.resolve(PROJECT_ROOT, '.tmp/sandbox/nos-ia/snapshots-baseline');
    const baselineExists = existsSync(baselineDir);
    unmeasured('S1', baselineExists ? 'baseline dir exists but was not captured before M4 — see S3' : 'no baseline exists at .tmp/sandbox/nos-ia/snapshots-baseline — BLOCKED, needs a human decision on when/how it should have been captured');
    unmeasured('S2', 'same blocker as S1 — no baseline to assert identity from');
    unmeasured('S3', 'no baseline file is tracked in git at all, so there is nothing to pin as unchanged');
    unmeasured('S4', 'moot until S1-S3 have a real baseline');
  } finally {
    if (browser) await browser.close();
    if (devServer) devServer.kill();
  }

  writeResults();

  const unset = ALL_CHECK_IDS.filter((id) => !results.has(id));
  if (unset.length > 0) {
    console.error(`Verifier bug: ids never written: ${unset.join(', ')}`);
    process.exit(2);
  }

  process.exit(hardFailure ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error('Verifier bug: unhandled error:', err);
  process.exit(2);
});
