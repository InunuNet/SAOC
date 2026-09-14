#!/usr/bin/env node
// =============================================================
// SAOC — contracts/checks/menu-system-layout4-shared/check-nav-links-200-gated-by-exemptions.mjs
// Mission menu-system-layout4 M2 — the complement to
// check-pending-routes-still-pending.mjs. That checker fails if a listed
// exemption has resolved (the list can't go STALE). This checker refuses to
// claim mission section 6 property 1 satisfied while ANY exemption still
// exists (the list can't become PERMANENT). Together neither failure mode is
// possible alone.
//
// THE GAP THIS CLOSES: e2e/nav-links-200.spec.ts reads
// f1-pending-nos-routes.json and test.skip()s every href in it. Playwright
// reports a skip as a non-failure -- `npx playwright test` exits 0 with
// "N skipped" alongside "0 failed". run_contract_suite.mjs's `kind: shell`
// evaluation (pre this file) only ever read the shell exit code, so a
// Playwright run that skipped 6 of 17 hrefs and passed the other 11 read as a
// full PASS for property 1 -- exactly this repo's audited "the check ran, the
// property was or was not measured, and the reporting layer collapsed the
// distinction" defect class, this time via a shared test runner's own exit
// code rather than a hand-rolled checker's. Verified live on today's tree
// (2026-09-10): `npx playwright test e2e/nav-links-200.spec.ts` currently
// reports "2 failed, 3 skipped, 16 passed" and exits 1 -- but the 2 failures
// are an ACCIDENT of e2e/nav-links-200.spec.ts still importing the stale,
// under-inclusive f6-pending-nos-routes.json (which lists only 4 of the 6
// actually-pending routes), so 2 genuinely-pending routes
// (sa-exhibitors, international-guests) are asserted 200 and fail. The
// moment @dev makes the CORRECT, CONTRACT-REQUIRED fix -- repointing the
// import to f1-pending-nos-routes.json (contract-f1.yaml A8/A9) -- all 6
// routes skip, the spec goes green, and property 1 would read PASS having
// measured 11 of 17 hrefs. This checker exists so that correct fix cannot
// silently launder the count.
//
// THE RULE: while f1-pending-nos-routes.json's pendingRoutes is non-empty,
// property 1 is UNMEASURED -- this checker exits 3
// (contracts/checks/_shared/run_contract_suite.mjs's SHELL_SKIP_EXIT_CODE),
// never 0, no matter how many of the non-exempt hrefs return 200. It can only
// exit 0 once the list is EMPTY and a real HTTP check of all 17 NAV hrefs
// (collected the same way e2e/nav-rendered-reachability.spec.ts does --
// including lead.leadHref, lead.theShow's links, and featureRail.ctaHref, not
// just the narrower set e2e/nav-links-200.spec.ts's own collectHrefs reads)
// confirms every one is 200.
//
// This is a STANDALONE script, not an edit to e2e/nav-links-200.spec.ts or
// e2e/mobile-nav-reaches-every-section.spec.ts -- @dev is mid-build against
// both files; this deliberately does not touch either.
//
// Usage:
//   node check-nav-links-200-gated-by-exemptions.mjs [--base-url <http://localhost:PORT>] [--pending-routes <path>]
//   --base-url is REQUIRED once pendingRoutes is empty (needed to run the real
//   HTTP check) -- refused if missing at that point, and refused outright if
//   it resolves to a non-local origin (same assertLocalOrigin pattern as
//   contracts/checks/ticketing-complete-f8/verify-walkthrough-routes.mjs and
//   check-pending-routes-still-pending.mjs). Never required while the list is
//   non-empty, since the checker skips before it would ever be used.
//
// Exit 0 = list empty AND all 17 hrefs return 200 (property 1 genuinely
// satisfied). Exit 1 = list empty but at least one href did not return 200
// (named). Exit 3 = list non-empty -- property 1 UNMEASURED, not evaluated,
// never a pass. Exit 2 = usage/input error.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_PENDING_ROUTES = path.join(
  REPO_ROOT,
  '.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json',
);
const SHELL_SKIP_EXIT_CODE = 3;

function usageError(message) {
  console.error(`USAGE ERROR: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  let baseUrl = null;
  let pendingRoutesPath = DEFAULT_PENDING_ROUTES;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base-url') {
      baseUrl = argv[++i];
      if (!baseUrl) usageError('--base-url requires a value');
    } else if (arg === '--pending-routes') {
      pendingRoutesPath = path.resolve(process.cwd(), argv[++i] ?? '');
      if (!pendingRoutesPath) usageError('--pending-routes requires a value');
    } else {
      usageError(`unrecognised argument: ${arg}`);
    }
  }
  return { baseUrl, pendingRoutesPath };
}

function assertLocalOrigin(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    usageError(`--base-url is not a valid URL: ${url}`);
  }
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    usageError(
      `refusing to check routes against non-local origin ${url} -- this check must only run ` +
        'against a real local dev server, never a deployed/live origin.',
    );
  }
}

function loadPendingRoutes(pendingRoutesPath) {
  if (!existsSync(pendingRoutesPath)) {
    usageError(`pending-routes fixture not found: ${pendingRoutesPath}`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(pendingRoutesPath, 'utf8'));
  } catch (err) {
    usageError(`pending-routes fixture is not valid JSON: ${pendingRoutesPath} (${err.message})`);
  }
  if (!Array.isArray(raw.pendingRoutes)) {
    usageError(`pending-routes fixture has no 'pendingRoutes' array: ${pendingRoutesPath}`);
  }
  return raw.pendingRoutes;
}

// Same full-collection logic as e2e/nav-rendered-reachability.spec.ts's
// collectAllNavHrefs -- deliberately wider than nav-links-200.spec.ts's own
// collectHrefs, which misses lead.leadHref, lead.theShow's links, and
// featureRail.ctaHref. Property 1 covers all 17 manifest routes, not just the
// subset one existing spec happens to enumerate.
function collectAllNavHrefs(items) {
  const hrefs = [];
  for (const item of items) {
    if (item.type === 'link') {
      hrefs.push(item.href);
      continue;
    }
    hrefs.push(item.href);
    if (item.lead) {
      hrefs.push(item.lead.leadHref);
      for (const link of item.lead.theShow.links) hrefs.push(link.href);
    }
    for (const column of item.columns) {
      if (column.headingHref) hrefs.push(column.headingHref);
      for (const link of column.links) hrefs.push(link.href);
    }
    if (item.featureRail) hrefs.push(item.featureRail.ctaHref);
  }
  return [...new Set(hrefs)];
}

async function main() {
  const { baseUrl, pendingRoutesPath } = parseArgs(process.argv.slice(2));
  const pendingRoutes = loadPendingRoutes(pendingRoutesPath);

  console.log(
    `Property 1 gate: ${pendingRoutes.length} route(s) currently listed in ` +
      `${path.relative(REPO_ROOT, pendingRoutesPath)}.`,
  );

  if (pendingRoutes.length > 0) {
    console.log('SKIPPED');
    console.log(
      `property 1 ("all NAV hrefs return 200") is UNMEASURED while any route is listed pending: ` +
        `${pendingRoutes.join(', ')}. This must render SKIP, never PASS -- exiting ` +
        `${SHELL_SKIP_EXIT_CODE} (run_contract_suite.mjs's SHELL_SKIP_EXIT_CODE), not 0. A ` +
        `Playwright run of e2e/nav-links-200.spec.ts that skips these same routes and passes ` +
        'the rest is NOT sufficient evidence property 1 holds -- it has measured ' +
        `${17 - pendingRoutes.length} of 17 hrefs, not all 17.`,
    );
    process.exit(SHELL_SKIP_EXIT_CODE);
  }

  if (!baseUrl) {
    usageError(
      'pendingRoutes is empty, so property 1 must now be measured for real -- --base-url is ' +
        'required to run the actual HTTP check (no default is assumed; a missing/unreachable ' +
        'server must never read as a silent pass).',
    );
  }
  assertLocalOrigin(baseUrl);

  const { NAV } = await import(path.join(REPO_ROOT, 'components/chrome/nav-config.ts'));
  const hrefs = collectAllNavHrefs(NAV);
  console.log(`pendingRoutes is empty -- running the real HTTP check against all ${hrefs.length} NAV hrefs.`);

  const failures = [];
  for (const href of hrefs) {
    let status;
    try {
      const res = await fetch(`${baseUrl}${href}`, { redirect: 'manual' });
      status = res.status;
    } catch (err) {
      status = `unreachable (${err.message})`;
    }
    const ok = status === 200;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${href}: ${status}`);
    if (!ok) failures.push(`${href} (${status})`);
  }

  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} of ${hrefs.length} NAV href(s) did not return 200: ${failures.join(', ')}`);
    process.exit(1);
  }

  console.log(`\nPASS: pendingRoutes is empty and all ${hrefs.length} NAV hrefs returned 200 -- property 1 satisfied.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`check-nav-links-200-gated-by-exemptions.mjs: unexpected error: ${err.stack ?? err}`);
  process.exit(1);
});
