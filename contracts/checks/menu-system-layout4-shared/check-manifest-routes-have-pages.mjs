#!/usr/bin/env node
// =============================================================
// SAOC — contracts/checks/menu-system-layout4-shared/check-manifest-routes-have-pages.mjs
// Mission menu-system-layout4 M2 — sibling to check-pending-routes-still-pending.mjs.
//
// PROPERTY: every `listed: true` row in content/national-show-routes.json has a
// corresponding app/(marketing)<slug>/page.tsx — checked against ONE EXPLICIT,
// STATED git ref, never a mix of "whatever's on disk right now" and "whatever a
// git command happens to resolve." Both the manifest read and the page-file
// check below hit the SAME ref via `git show`/`git ls-tree` — never the raw
// working-tree filesystem — because a route can look resolved from one tree and
// missing from another, and reporting a verdict without saying which tree
// produced it is exactly how this mission has already collected three separate
// disagreements (per the architect brief).
//
// WHY THIS CATCHES A CLASS OF GAP THE HTTP-based nav-links-200.spec.ts CANNOT:
// the NOS lane is adding a fallback shell so a genuine content gap degrades to
// a rough page instead of a 404 — but that shell replaces a `notFound()` call
// made INSIDE a page component that already ran. A route with NO page file at
// all 404s at the Next.js router itself, before any component — the fallback
// shell — is ever reached. That whole failure class (manifest promises a listed
// route; no file exists for it anywhere) sits outside the fallback shell's net
// entirely, and only a filesystem/git-tree check against the manifest can catch
// it.
//
// CONCRETE INSTANCE THIS CHECKER SURFACES (found live, 2026-09-10): the
// manifest's own slug for the WOSA row is /national-show/wosa (not
// /national-show/wosa-conference — that string only exists as nav-config.ts's
// R3-override NAV href, a display/routing decision layered on top of the
// manifest, not the manifest's own identity for the row). Checked literally
// against the manifest's own slug field, /national-show/wosa DOES have a
// committed page.tsx on origin/nos-site as of this run (see output below) —
// this checker passes for that row today. The mismatch between the manifest's
// slug and NAV's overridden href is a real, separate gap (a request to
// /national-show/wosa-conference 404s unless something redirects it) already
// covered by e2e/nav-links-200.spec.ts's real HTTP check and
// e2e/nav-rendered-reachability.spec.ts — this checker intentionally does not
// re-litigate NAV's own routing decisions; it only proves the manifest's
// promises, by the manifest's own slugs, have real files behind them.
//
// Usage:
//   node check-manifest-routes-have-pages.mjs [--ref <gitref>] [--manifest <path-in-ref>]
//   Defaults: ref = origin/nos-site (where the NOS lane is building pages;
//             override with --ref once that lane merges to main and the
//             manifest/pages live directly in this repo's own history)
//             manifest = content/national-show-routes.json
//
//   node check-manifest-routes-have-pages.mjs --manifest-file <local.json> --ref <gitref>
//   TEST-ONLY escape hatch: reads the manifest from a local file on disk instead
//   of `git show <ref>:<manifest>` -- lets a negative fixture (a manifest row
//   whose slug has no real page anywhere) be checked without first committing
//   it to some ref, which would defeat the point of a disposable fixture. The
//   page-file lookup still goes through `git ls-tree <ref>` exactly as in the
//   production path, so this only swaps where the ROUTE LIST comes from, never
//   how "does a page exist" is decided. Never use --manifest-file for a real
//   gate run -- it exists for goldens/fixtures/f1-negative-fixtures/ only.
//
// Exit 0 = every listed:true row has a page.tsx at the stated ref. Exit 1 = at
// least one is missing (named). Exit 2 = usage/input error (bad ref, manifest
// unreadable/malformed at that ref).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_REF = 'origin/nos-site';
const DEFAULT_MANIFEST_PATH = 'content/national-show-routes.json';

function usageError(message) {
  console.error(`USAGE ERROR: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  let ref = DEFAULT_REF;
  let manifestPath = DEFAULT_MANIFEST_PATH;
  let manifestFile = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ref') {
      ref = argv[++i];
      if (!ref) usageError('--ref requires a value');
    } else if (arg === '--manifest') {
      manifestPath = argv[++i];
      if (!manifestPath) usageError('--manifest requires a value');
    } else if (arg === '--manifest-file') {
      manifestFile = argv[++i];
      if (!manifestFile) usageError('--manifest-file requires a value');
    } else {
      usageError(`unrecognised argument: ${arg}`);
    }
  }
  return { ref, manifestPath, manifestFile };
}

function readAtRef(ref, relPath) {
  try {
    return execFileSync('git', ['show', `${ref}:${relPath}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (err) {
    usageError(`could not read '${relPath}' at ref '${ref}' via git show: ${err.message}`);
  }
}

function loadManifestAtRef(ref, manifestPath) {
  const raw = readAtRef(ref, manifestPath);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    usageError(`'${manifestPath}' at ref '${ref}' is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed.routes)) {
    usageError(`'${manifestPath}' at ref '${ref}' has no 'routes' array`);
  }
  return parsed.routes;
}

// TEST-ONLY — see the --manifest-file usage note at the top of this file.
function loadManifestFromLocalFile(manifestFile) {
  const abs = path.resolve(process.cwd(), manifestFile);
  if (!existsSync(abs)) {
    usageError(`--manifest-file not found: ${manifestFile}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    usageError(`--manifest-file '${manifestFile}' is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed.routes)) {
    usageError(`--manifest-file '${manifestFile}' has no 'routes' array`);
  }
  return parsed.routes;
}

// Same App-Router filename convention as check-pending-routes-still-pending.mjs's
// pageFileForRoute — a route's page file always lives at
// app/(marketing)<slug>/page.tsx for this repo's static (non-dynamic) NOS routes.
function pageFileForSlug(slug) {
  return `app/(marketing)${slug}/page.tsx`;
}

function listTreeAtRef(ref) {
  try {
    const out = execFileSync(
      'git',
      ['ls-tree', '-r', '--name-only', ref, '--', 'app/(marketing)/national-show'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    return new Set(out.split('\n').filter(Boolean));
  } catch (err) {
    usageError(`'git ls-tree' failed for ref '${ref}': ${err.message}`);
  }
}

async function main() {
  const { ref, manifestPath, manifestFile } = parseArgs(process.argv.slice(2));

  const routes = manifestFile
    ? loadManifestFromLocalFile(manifestFile)
    : loadManifestAtRef(ref, manifestPath);
  const listedRoutes = routes.filter((r) => r.listed === true);
  const treeFiles = listTreeAtRef(ref);

  const manifestSourceLabel = manifestFile
    ? `local file '${manifestFile}' (TEST-ONLY override)`
    : `'${manifestPath}' at git ref '${ref}'`;
  console.log(
    `Checking ${listedRoutes.length} listed:true route(s) from ${manifestSourceLabel} -- page-file ` +
      `check reads git ref '${ref}' via git ls-tree.`,
  );

  const missing = [];
  for (const route of listedRoutes) {
    const rel = pageFileForSlug(route.slug);
    const exists = treeFiles.has(rel);
    console.log(`${exists ? 'PASS' : 'FAIL'} ${route.slug} -> ${rel}${exists ? '' : ' (NOT FOUND)'}`);
    if (!exists) missing.push(route.slug);
  }

  console.log(
    `\nSUMMARY: ${listedRoutes.length - missing.length}/${listedRoutes.length} listed:true routes have a ` +
      `page.tsx at ref '${ref}'.`,
  );

  if (missing.length > 0) {
    console.error(
      `\nFAIL: ${missing.length} listed:true manifest route(s) have no page.tsx at ref '${ref}': ` +
        missing.join(', '),
    );
    process.exit(1);
  }

  console.log(`\nPASS: every listed:true route has a page.tsx at ref '${ref}'.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`check-manifest-routes-have-pages.mjs: unexpected error: ${err.stack ?? err}`);
  process.exit(1);
});
