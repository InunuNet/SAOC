#!/usr/bin/env node
// =============================================================
// SAOC — contracts/checks/menu-system-layout4-shared/check-pending-routes-still-pending.mjs
// Mission menu-system-layout4 M2 — closes the stale-exemption gap: the six NOS
// routes in goldens/fixtures/f1-pending-nos-routes.json are skipped by
// e2e/nav-links-200.spec.ts, e2e/mobile-nav-reaches-every-section.spec.ts, and
// contracts/checks/ticketing-complete-f8/verify-walkthrough-routes.mjs — but
// nothing anywhere re-checks that a listed route is STILL actually pending.
// The fixture's own `removeFromListWhen` field ("do not leave a route here that
// already returns 200") is prose, not a gate — the moment the NOS lane merges,
// those six routes resolve and stay exempt from the 200 check forever, because
// the only thing that would empty the list is a person remembering to. This is
// property 7 (nothing unmeasured may report as passing) applied to the
// exemption list itself, not just to the checks it feeds.
//
// PROPERTY: every route in pendingRoutes genuinely does not resolve. FAILS,
// naming the route, the moment either signal below says otherwise.
//
// TWO SIGNALS, BOTH GATING (an OR, not an AND):
//
//   1. FILESYSTEM (mandatory, always evaluated) — does a page.tsx exist for
//      this route, checked via `git ls-tree` against an EXPLICIT, STATED git
//      ref (default HEAD; --ref overrides), never the raw working-tree
//      filesystem. This is the same class of disagreement the mission report
//      flagged directly: "three separate disagreements today came from
//      filesystem and branch checks that did not say which tree they were
//      reading." git ls-tree against a named ref is deterministic and CI-safe
//      with no live server required.
//
//      Deliberately treated as SUFFICIENT ON ITS OWN to call a route stale,
//      even though a page.tsx CAN exist while the route still 404s from an
//      internal `notFound()` call (a legitimate mid-build stub). That's a
//      conscious choice, not an oversight: a route with a committed page file
//      is no longer "nothing has been built for this" — it needs a human to
//      look again and either promote it off the pending list or explain why a
//      real file is still 404ing, not stay silently exempted forever. Erring
//      towards re-checking too early (a stub file) is far cheaper than the
//      failure mode this checker exists to close (a real route silently
//      staying exempt forever).
//
//   2. HTTP (opportunistic — only evaluated when --base-url is given and
//      resolves to localhost/127.0.0.1, same refusal-of-non-local-origins
//      pattern as contracts/checks/ticketing-complete-f8/
//      verify-walkthrough-routes.mjs's assertLocalOrigin). A 200 response is
//      corroborating, gating evidence when available, but its ABSENCE never
//      passes the check — there is deliberately no "trust HTTP over
//      filesystem" path, because the NOS lane is about to add a fallback shell
//      that makes 200 trivially true for routes with no real content yet
//      (their own words: a content gap degrades to a rough page, not a 404).
//      A cheap, always-on HTTP check with no filesystem backstop would let a
//      generic 200 shell silently launder every remaining pending route the
//      moment that shell lands, which is a worse version of exactly the bug
//      this checker exists to close. Filesystem stays the mandatory gate;
//      HTTP only ever ADDS a reason to fail, never removes one.
//
// Also prints the exempt-route COUNT on every run, pass or fail, so "0 exempt"
// (or 6, or any number) is always visible — a metric that only appears when
// non-zero is indistinguishable from a metric that isn't running.
//
// Usage:
//   node check-pending-routes-still-pending.mjs [pendingRoutesFixture.json] [--ref <gitref>] [--base-url <http://localhost:PORT>]
//   Defaults: fixture = .agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json
//             ref = HEAD
//             base-url = (unset — HTTP signal skipped, filesystem-only run)
//
// Exit 0 = every pendingRoutes entry still genuinely pending (or the fixture
// is empty). Exit 1 = at least one entry has resolved (name printed). Exit 2 =
// usage/input error (fixture missing/malformed, non-local --base-url).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_FIXTURE = path.join(
  REPO_ROOT,
  '.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json',
);

function usageError(message) {
  console.error(`USAGE ERROR: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  let fixturePath = DEFAULT_FIXTURE;
  let ref = 'HEAD';
  let baseUrl = null;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ref') {
      ref = argv[++i];
      if (!ref) usageError('--ref requires a value');
    } else if (arg === '--base-url') {
      baseUrl = argv[++i];
      if (!baseUrl) usageError('--base-url requires a value');
    } else {
      positional.push(arg);
    }
  }
  if (positional[0]) fixturePath = path.resolve(process.cwd(), positional[0]);
  return { fixturePath, ref, baseUrl };
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
        'against a real local dev server, never a deployed/live origin (same standard as ' +
        'contracts/checks/ticketing-complete-f8/verify-walkthrough-routes.mjs).',
    );
  }
  return parsed;
}

function loadFixture(fixturePath) {
  if (!existsSync(fixturePath)) {
    usageError(`pending-routes fixture not found: ${fixturePath}`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(fixturePath, 'utf8'));
  } catch (err) {
    usageError(`pending-routes fixture is not valid JSON: ${fixturePath} (${err.message})`);
  }
  if (!Array.isArray(raw.pendingRoutes)) {
    usageError(`pending-routes fixture has no 'pendingRoutes' array: ${fixturePath}`);
  }
  return raw.pendingRoutes;
}

// A route like "/national-show/programme" maps to the page file
// "app/(marketing)/national-show/programme/page.tsx" -- App Router's own
// filename convention, same mapping check-manifest-routes-have-pages.mjs uses.
function pageFileForRoute(route) {
  return `app/(marketing)${route}/page.tsx`;
}

function pageExistsAtRef(route, ref) {
  const rel = pageFileForRoute(route);
  try {
    const out = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', rel], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return out.trim().length > 0;
  } catch (err) {
    usageError(`'git ls-tree' failed for ref '${ref}': ${err.message}`);
  }
}

async function httpStatusFor(route, baseUrl) {
  try {
    const res = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    return res.status;
  } catch {
    return null; // server unreachable -- treated as "not attempted", never as evidence either way
  }
}

async function main() {
  const { fixturePath, ref, baseUrl } = parseArgs(process.argv.slice(2));
  if (baseUrl) assertLocalOrigin(baseUrl);

  const pendingRoutes = loadFixture(fixturePath);

  console.log(
    `Checking ${pendingRoutes.length} pending route(s) from ${path.relative(REPO_ROOT, fixturePath)} ` +
      `-- filesystem signal against git ref '${ref}'` +
      (baseUrl ? `, HTTP signal against ${baseUrl}` : ' (no --base-url given -- HTTP signal skipped)') +
      '.',
  );

  const staleRoutes = [];
  for (const route of pendingRoutes) {
    const fileExists = pageExistsAtRef(route, ref);
    const httpStatus = baseUrl ? await httpStatusFor(route, baseUrl) : null;
    const isStale = fileExists || httpStatus === 200;

    const signals = [
      `page.tsx@${ref}: ${fileExists ? 'EXISTS' : 'absent'}`,
      baseUrl ? `http: ${httpStatus === null ? 'unreachable (not attempted)' : httpStatus}` : 'http: not attempted',
    ].join(', ');

    if (isStale) {
      staleRoutes.push(route);
      console.log(`STALE   ${route} (${signals}) -- no longer pending, remove from the exemption list`);
    } else {
      console.log(`PENDING ${route} (${signals})`);
    }
  }

  console.log(`\nCURRENTLY EXEMPT: ${pendingRoutes.length} route(s) (${staleRoutes.length} stale).`);

  if (staleRoutes.length > 0) {
    console.error(
      `\nFAIL: ${staleRoutes.length} route(s) in the pending exemption list have resolved and must ` +
        `be removed: ${staleRoutes.join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`\nPASS: all ${pendingRoutes.length} exempt route(s) are still genuinely pending.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`check-pending-routes-still-pending.mjs: unexpected error: ${err.stack ?? err}`);
  process.exit(1);
});
