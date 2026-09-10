/**
 * verify-nos-content-state.ts — the F24 content-state verifier (national-show-ia-alignment, M4).
 *
 * See .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/content-state-verifier.golden.md
 * for the full NF1-NF18 check-id contract this script implements.
 *
 * A NEW driver, NOT an edit to verify-nos-m4-local-render.ts — that verifier guards
 * eleven frozen routes with live green assertions in contract-m4.yaml, and the lead's
 * ranking is explicit: any regression there outranks everything in this feature. A
 * separate file, a separate results manifest and separate exit codes mean F24 cannot
 * break M4's gate no matter what it gets wrong.
 *
 * Two proof strategies, both against REAL code:
 *   - Live-route checks (NF1, NF2, NF3, NF4, NF5, NF10, NF14, NF16, NF17) drive a real
 *     dev server, some via a headless Playwright browser, some via plain fetch.
 *   - Direct checks (NF6, NF7, NF8, NF9, NF11, NF12, NF13) import
 *     lib/data/show-pages.ts and components/show/nos/ShowContentState.tsx directly (the
 *     same pattern scripts/checks/verify-show-page-m1.ts already uses for
 *     ShowPageProse) and render through react-dom/server — this is how the reserved
 *     probe pageKey `__nos-absent-probe__` is exercised end-to-end: no real route is
 *     wired to accept an arbitrary pageKey, so the only way to drive the REAL loader
 *     and REAL component against it is to call them directly, exactly as a route module
 *     would.
 *
 * Lives in scripts/checks/, NEVER execution/ (HARNESS-owned, wiped by the next
 * `make update-template`).
 *
 * Exit 0: all passed. Exit 1: a check FAILED. Exit 2: the harness itself broke, never
 * collapsed into 1.
 */
import { execSync, type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, type Browser } from 'playwright';

const PROJECT_ROOT = process.cwd();
const RESULTS_DIR = path.resolve(PROJECT_ROOT, '.tmp/sandbox/nos-ia');
const RESULTS_FILE = path.join(RESULTS_DIR, 'content-state-results.txt');
const CENSUS_FILE = path.join(RESULTS_DIR, 'content-state-census.json');
const MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'content/national-show-routes.json');
const WORDING_PATH = path.resolve(
  PROJECT_ROOT,
  '.agent/memory/project/specs/national-show-ia-alignment/goldens/m4/fixtures/f24-fallback-wording.json',
);
const BASELINE_PATH = path.resolve(
  PROJECT_ROOT,
  '.agent/memory/project/specs/national-show-ia-alignment/goldens/m4/fixtures/f24-content-baseline.json',
);

// Verdict-bearing ids only. SERVER is deliberately NOT a member — it is provenance
// (which port answered, or that one was spawned), never a verdict, and folding it in
// here is exactly the reporting-collapse class this golden's "reconciliation rule"
// section calls out in the driver next door: a typed escape hatch that lets a
// non-verdict string land in a verdict slot, silently dropped from the bucket counts.
// SERVER is emitted as an informational comment line instead — see recordServerInfo().
type Verdict = 'PASS' | 'FAIL' | 'DRIFT';
const ALL_CHECK_IDS = [
  'NF1', 'NF2', 'NF3', 'NF4', 'NF5', 'NF6', 'NF7', 'NF8', 'NF9', 'NF10',
  'NF11', 'NF12', 'NF13', 'NF14', 'NF15', 'NF16', 'NF17', 'NF18',
] as const;
type CheckId = (typeof ALL_CHECK_IDS)[number];

const results = new Map<CheckId, Verdict>();
let hardFailure = false;
let serverInfo = '';

// `verdict` is Verdict alone, with no string-widening escape hatch — there is no way to
// write a non-verdict value into a verdict slot, which is what NF18/A40b exist to keep
// true (A40b's static guard re-checks this signature never regains that hatch).
function record(id: CheckId, verdict: Verdict, detail?: string): void {
  results.set(id, verdict);
  if (verdict === 'FAIL') hardFailure = true;
  console.log(`${verdict} ${id}${detail ? ` — ${detail}` : ''}`);
}

function check(id: CheckId, condition: boolean, expected: string, found: string): void {
  record(id, condition ? 'PASS' : 'FAIL', condition ? undefined : `expected ${expected}, found ${found}`);
}

/** SERVER is provenance, never a verdict (A40c) — recorded as an informational comment
 * line, outside ALL_CHECK_IDS and outside the reconciliation NF18 checks. */
function recordServerInfo(info: string): void {
  serverInfo = info;
  console.log(`# SERVER ${info}`);
}

function writeResults(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const lines = [
    `# SERVER ${serverInfo || 'UNSET'}`,
    ...ALL_CHECK_IDS.map((id) => `${id} ${results.get(id) ?? 'UNSET'}`),
  ];
  writeFileSync(RESULTS_FILE, lines.join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Env — loaded from .env.local directly (NOT the `dotenv` package — its banner writes
// to stdout and has corrupted captured values on this project before), same pattern as
// scripts/seed-show-pages.ts's readEnvLocal(). Sanity's client is constructed from
// module-level `process.env` reads (sanity/env.ts), so this MUST run before the first
// import of lib/data/show-pages.ts below.
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  const envPath = path.resolve(PROJECT_ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

// ---------------------------------------------------------------------------
// Fixtures and manifest.
// ---------------------------------------------------------------------------

interface ManifestRoute {
  slug: string;
  label: string;
  purpose: string;
  pageKey: string | null;
  listed: boolean;
  owner: string;
}
interface RouteManifest {
  routes: ManifestRoute[];
}

interface FallbackWording {
  markerAttribute: string;
  markerValues: { published: string; fallback: string };
  fixedSentence: string;
  bannedPhrases: string[];
  reservedProbePageKey: string;
  inScopeRoutes: { slug: string; pageKey: string }[];
  censusSchema: string;
  censusArtifact: string;
}

interface ContentBaseline {
  schema: string;
  expectedPublished: { slug: string; pageKey: string; seed: string }[];
}

function loadJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

const manifest = loadJson<RouteManifest>(MANIFEST_PATH);
const wording = loadJson<FallbackWording>(WORDING_PATH);
const baseline = loadJson<ContentBaseline>(BASELINE_PATH);

const MARKER = wording.markerAttribute; // 'data-nos-content-state'
const PUBLISHED = wording.markerValues.published; // 'published'
const FALLBACK = wording.markerValues.fallback; // 'fallback-unpublished'
const PROBE_KEY = wording.reservedProbePageKey; // '__nos-absent-probe__'

const IN_SCOPE_SLUGS = wording.inScopeRoutes.map((r) => r.slug);
const listedRoutes = manifest.routes.filter((r) => r.listed);
const inScopeRoutes = listedRoutes.filter((r) => IN_SCOPE_SLUGS.includes(r.slug));
const outOfScopeListedRoutes = listedRoutes.filter((r) => !IN_SCOPE_SLUGS.includes(r.slug));

function slugToPagePath(slug: string): string {
  return `app/(marketing)${slug}/page.tsx`;
}

// ---------------------------------------------------------------------------
// Balanced-brace function extraction — for NF9's static check on
// loadShowPageOrFallback, same technique as scripts/checks/assert-fallback-builder-shape.sh
// (A5's separate, independent layer — neither trusts the other).
// ---------------------------------------------------------------------------

function extractFunctionSource(src: string, name: string): string | null {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return src.slice(start, i);
}

// ---------------------------------------------------------------------------
// HTML text extraction — no jsdom/cheerio dependency. Used only against markup THIS
// script itself produced via renderToStaticMarkup (never against arbitrary/live HTML),
// so a plain tag-strip + entity-decode is sufficient and exact for NF13's purposes.
// ---------------------------------------------------------------------------

function stripTagsAndNormalize(html: string): string {
  const noTags = html.replace(/<[^>]+>/g, ' ');
  const decoded = noTags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
  return decoded.replace(/\s+/g, ' ').trim();
}

/** Slices from the last `<div` before the marker attribute to the end of the string.
 * Valid ONLY because every direct-render call in this script renders ShowContentState
 * on its own (no trailing siblings) — the marked div is always the final element in the
 * fragment's output. */
function extractMarkedSubtreeHtml(fullHtml: string, stateValue: string): string | null {
  const attr = `${MARKER}="${stateValue}"`;
  const attrIdx = fullHtml.indexOf(attr);
  if (attrIdx === -1) return null;
  const openTagStart = fullHtml.lastIndexOf('<div', attrIdx);
  if (openTagStart === -1) return null;
  return fullHtml.slice(openTagStart);
}

// ---------------------------------------------------------------------------
// Server: probe :3000 first, else the configured dev port, else spawn a fresh one.
// Same convention as verify-nos-m4-local-render.ts, reimplemented here rather than
// imported — that file is not to be touched or depended on by this one (A29's
// independence requirement).
// ---------------------------------------------------------------------------

function readDevPortFromPackageJson(): number | null {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(PROJECT_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const devScript = pkg.scripts?.dev ?? '';
    const m = devScript.match(/--port[= ](\d+)/);
    return m ? Number(m[1]) : null;
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

async function main(): Promise<void> {
  writeResults();

  if (listedRoutes.length !== 17) {
    console.error(`Verifier bug: expected 17 listed routes, found ${listedRoutes.length}`);
    process.exit(2);
  }
  if (inScopeRoutes.length !== 6) {
    console.error(`Verifier bug: expected 6 in-scope routes from fixture, found ${inScopeRoutes.length}`);
    process.exit(2);
  }

  let port: number;
  let devServer: ChildProcess | null = null;

  if (await probe(3000)) {
    port = 3000;
    recordServerInfo('reused 3000');
  } else {
    const configuredPort = readDevPortFromPackageJson();
    if (configuredPort && (await probe(configuredPort))) {
      port = configuredPort;
      recordServerInfo(`reused ${configuredPort}`);
    } else {
      port = 0;
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
      recordServerInfo(`started ${port}`);
    }
  }

  const baseUrl = `http://localhost:${port}`;
  let browser: Browser | null = null;

  try {
    // -------------------------------------------------------------------
    // NF1 — scope/structure, pure fs/grep, no browser needed.
    // -------------------------------------------------------------------
    let notFoundSites: string[] = [];
    let consumerSites: string[] = [];
    try {
      notFoundSites = execSync(
        `grep -rl "notFound(" "app/(marketing)/national-show/" --include='*.tsx'`,
        { cwd: PROJECT_ROOT, encoding: 'utf8' },
      )
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      notFoundSites = [];
    }
    try {
      consumerSites = execSync(
        `grep -rl "loadShowPageOrFallback" "app/(marketing)/national-show/" --include='*.tsx'`,
        { cwd: PROJECT_ROOT, encoding: 'utf8' },
      )
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      consumerSites = [];
    }
    const expectedNotFound = ['app/(marketing)/national-show/archive/[year]/page.tsx'];
    const expectedConsumers = inScopeRoutes.map((r) => slugToPagePath(r.slug));
    const notFoundSetEq =
      notFoundSites.length === expectedNotFound.length &&
      expectedNotFound.every((f) => notFoundSites.includes(f));
    const consumerSetEq =
      consumerSites.length === expectedConsumers.length &&
      expectedConsumers.every((f) => consumerSites.includes(f)) &&
      consumerSites.every((f) => expectedConsumers.includes(f));
    check(
      'NF1',
      notFoundSetEq && consumerSetEq,
      `notFound( only in ${expectedNotFound.join(', ')}; loadShowPageOrFallback in exactly the 6 in-scope routes`,
      `notFound( in [${notFoundSites.join(', ')}]; consumers [${consumerSites.join(', ')}]`,
    );

    // -------------------------------------------------------------------
    // NF14 — router-level hole, pure fs/git, no browser needed. Both trees checked:
    // working tree (what `next build` compiles) and git index (what actually deploys).
    // -------------------------------------------------------------------
    let trackedFiles: Set<string>;
    try {
      trackedFiles = new Set(execSync('git ls-files', { cwd: PROJECT_ROOT, encoding: 'utf8' }).split('\n'));
    } catch (err) {
      console.error('Verifier bug: git ls-files failed:', err);
      trackedFiles = new Set();
    }
    const nf14Failures: string[] = [];
    for (const route of listedRoutes) {
      const pagePath = slugToPagePath(route.slug);
      const onDisk = existsSync(path.resolve(PROJECT_ROOT, pagePath));
      const inIndex = trackedFiles.has(pagePath);
      if (!onDisk) nf14Failures.push(`NF14a ${route.slug}: no page.tsx in working tree`);
      else if (!inIndex) nf14Failures.push(`NF14b ${route.slug}: page.tsx untracked by git`);
    }
    check('NF14', nf14Failures.length === 0, 'every listed route has a page.tsx on disk and in the git index', nf14Failures.join('; '));

    // -------------------------------------------------------------------
    // NF15 (part 1, static) — structural emission: exactly one file emits the marker
    // literal, and no in-scope route module touches `.sections` directly. The
    // ShowPageResult single-consumer grep guard (A37) is run as its own contract
    // assertion; re-run here too so NF15 stands on its own evidence.
    // -------------------------------------------------------------------
    let markerEmitterCount = 0;
    try {
      markerEmitterCount = execSync(
        `grep -rl '${MARKER}=' components/ app/ --include='*.tsx'`,
        { cwd: PROJECT_ROOT, encoding: 'utf8' },
      )
        .split('\n')
        .filter(Boolean).length;
    } catch {
      markerEmitterCount = 0;
    }
    let sectionsAccessCount = 0;
    for (const route of inScopeRoutes) {
      const src = readFileSync(path.resolve(PROJECT_ROOT, slugToPagePath(route.slug)), 'utf8');
      if (/\.sections\b/.test(src)) sectionsAccessCount++;
    }
    let singleConsumerGuardOk = false;
    try {
      execSync('bash scripts/checks/assert-content-state-single-consumer.sh', { cwd: PROJECT_ROOT });
      singleConsumerGuardOk = true;
    } catch {
      singleConsumerGuardOk = false;
    }
    check(
      'NF15',
      markerEmitterCount === 1 && sectionsAccessCount === 0 && singleConsumerGuardOk,
      'exactly 1 marker emitter, 0 in-scope routes touching .sections, single-consumer guard PASS',
      `emitters=${markerEmitterCount} sectionsAccess=${sectionsAccessCount} guard=${singleConsumerGuardOk}`,
    );

    // -------------------------------------------------------------------
    // NF5 — all 17 listed routes return 200. Plain fetch, no browser needed.
    // -------------------------------------------------------------------
    const nf5Failures: string[] = [];
    for (const route of listedRoutes) {
      try {
        const res = await fetch(`${baseUrl}${route.slug}`, { redirect: 'manual' });
        if (res.status !== 200) nf5Failures.push(`${route.slug}: ${res.status}`);
      } catch (err) {
        nf5Failures.push(`${route.slug}: ${(err as Error).message}`);
      }
    }
    check('NF5', nf5Failures.length === 0, 'all 17 listed routes return 200', nf5Failures.join('; '));

    // -------------------------------------------------------------------
    // NF16 — server-rendered, externally consumable. Fetched with NO JavaScript
    // execution at all (plain fetch never runs JS) — the raw HTTP response body of
    // each of the six must contain the marker.
    // -------------------------------------------------------------------
    const nf16Failures: string[] = [];
    for (const route of inScopeRoutes) {
      try {
        const res = await fetch(`${baseUrl}${route.slug}`);
        const body = await res.text();
        if (!body.includes(`${MARKER}=`)) nf16Failures.push(`${route.slug}: marker absent from raw response body`);
      } catch (err) {
        nf16Failures.push(`${route.slug}: ${(err as Error).message}`);
      }
    }
    check('NF16', nf16Failures.length === 0, 'raw HTTP response body of each of the six contains the marker', nf16Failures.join('; '));

    // -------------------------------------------------------------------
    // Browser-driven checks — NF2, NF3 (census), NF4 (disclosure), NF10, NF17.
    // -------------------------------------------------------------------
    browser = await chromium.launch();
    const context = await browser.newContext();

    type RouteCensusEntry = { slug: string; state: 'published' | 'fallback-unpublished'; disclosed: boolean | null };
    const censusRoutes: RouteCensusEntry[] = [];
    const nf2Failures: string[] = [];
    const nf4Failures: string[] = [];

    for (const route of inScopeRoutes) {
      const page = await context.newPage();
      await page.goto(`${baseUrl}${route.slug}`, { waitUntil: 'networkidle', timeout: 30000 });
      const markerLocator = page.locator(`[${MARKER}]`);
      const count = await markerLocator.count();
      if (count !== 1) {
        nf2Failures.push(`${route.slug}: marker count=${count}`);
        await page.close();
        continue;
      }
      const stateValue = await markerLocator.first().getAttribute(MARKER);
      if (stateValue !== PUBLISHED && stateValue !== FALLBACK) {
        nf2Failures.push(`${route.slug}: unrecognised marker value "${stateValue}"`);
        await page.close();
        continue;
      }
      const state = stateValue as 'published' | 'fallback-unpublished';
      let disclosed: boolean | null = null;
      if (state === FALLBACK) {
        const notice = markerLocator.first().locator('[role="note"]');
        const noticeCount = await notice.count();
        if (noticeCount >= 1) {
          const chip = await notice.first().locator('span').first().textContent();
          const fullText = await notice.first().textContent();
          const chipText = (chip ?? '').trim();
          const restText = (fullText ?? '').replace(chipText, '').trim();
          disclosed = chipText.length > 0 && restText.length > 0;
        } else {
          disclosed = false;
        }
        if (!disclosed) nf4Failures.push(`${route.slug}: fallback with no disclosure`);
      }
      censusRoutes.push({ slug: route.slug, state, disclosed });
      await page.close();
    }
    check('NF2', nf2Failures.length === 0, 'exactly one recognised marker on each of the six', nf2Failures.join('; '));
    check('NF4', nf4Failures.length === 0, 'every fallback carries a disclosure', nf4Failures.join('; '));

    const totals = {
      published: censusRoutes.filter((r) => r.state === 'published').length,
      fallback: censusRoutes.filter((r) => r.state === 'fallback-unpublished').length,
      total: censusRoutes.length,
    };
    const censusComplete =
      censusRoutes.length === 6 &&
      totals.published + totals.fallback === totals.total &&
      totals.total === 6 &&
      censusRoutes.every((r) => r.state === PUBLISHED || r.state === FALLBACK);
    check('NF3', censusComplete, 'census covers all 6 routes with recognised states summing to 6', `covered=${censusRoutes.length} totals=${JSON.stringify(totals)}`);

    const census = {
      schema: wording.censusSchema,
      generatedAt: new Date().toISOString(),
      totals,
      routes: censusRoutes,
    };
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(CENSUS_FILE, JSON.stringify(census, null, 2) + '\n', 'utf8');

    // NF17 — content-presence tripwire. A baseline, never a count.
    const publishedSlugs = new Set(censusRoutes.filter((r) => r.state === PUBLISHED).map((r) => r.slug));
    const baselineSlugs = new Set(baseline.expectedPublished.map((r) => r.slug));
    const manifestListedSlugs = new Set(listedRoutes.map((r) => r.slug));
    const regressed = [...baselineSlugs].filter((s) => !publishedSlugs.has(s) && manifestListedSlugs.has(s));
    const driftExtra = [...publishedSlugs].filter((s) => !baselineSlugs.has(s));
    const driftRetired = [...baselineSlugs].filter((s) => !manifestListedSlugs.has(s));
    if (regressed.length > 0) {
      record('NF17', 'FAIL', `tripwire fired — baselined route(s) not published: ${regressed.join(', ')}`);
      hardFailure = true;
    } else if (driftExtra.length > 0 || driftRetired.length > 0) {
      record(
        'NF17',
        'DRIFT',
        `baseline and live set disagree without a regression — extra published: [${driftExtra.join(', ')}], baseline entries no longer listed: [${driftRetired.join(', ')}]. Edit the baseline.`,
      );
    } else {
      record('NF17', 'PASS');
    }

    // NF10 — the eleven non-consuming listed routes render zero markers.
    const nf10Failures: string[] = [];
    for (const route of outOfScopeListedRoutes) {
      const page = await context.newPage();
      await page.goto(`${baseUrl}${route.slug}`, { waitUntil: 'networkidle', timeout: 30000 });
      const count = await page.locator(`[${MARKER}]`).count();
      if (count !== 0) nf10Failures.push(`${route.slug}: marker count=${count}`);
      await page.close();
    }
    check('NF10', nf10Failures.length === 0, 'the 11 non-consuming listed routes render 0 markers', nf10Failures.join('; '));

    await context.close();

    // -------------------------------------------------------------------
    // Direct checks — NF6, NF7, NF8, NF9, NF11, NF12, NF13. Import the real modules
    // and drive them directly with react-dom/server, exactly as
    // verify-show-page-m1.ts already does for ShowPageProse. This is the only way to
    // exercise the reserved probe pageKey end-to-end: no real route accepts an
    // arbitrary pageKey.
    // -------------------------------------------------------------------
    let showPagesMod: typeof import('../../lib/data/show-pages');
    let showContentStateMod: typeof import('../../components/show/nos/ShowContentState');
    try {
      showPagesMod = await import('@/lib/data/show-pages.ts');
      showContentStateMod = await import('@/components/show/nos/ShowContentState.tsx');
    } catch (err) {
      console.error('Verifier bug: could not import lib/data/show-pages.ts or ShowContentState.tsx:', err);
      writeResults();
      process.exit(2);
    }
    const { loadShowPage, loadShowPageOrFallback } = showPagesMod;
    const { ShowContentState } = showContentStateMod;

    // Use the programme route's own real label/purpose — the "real shell" is exercised
    // with the SAME fallback input a real route supplies, just against a pageKey
    // guaranteed absent (NF6) or guaranteed present (NF7).
    const probeRoute = inScopeRoutes.find((r) => r.slug === '/national-show/programme') ?? inScopeRoutes[0];
    const fallbackInput = { label: probeRoute.label, purpose: probeRoute.purpose };

    // NF8 — the null/non-null the fallback consumes is really produced by the loader.
    const nullPage = await loadShowPage(PROBE_KEY);
    const realPage = await loadShowPage(probeRoute.pageKey as string);
    const nf8Ok = nullPage === null && realPage !== null && realPage.isFallback !== true;
    check('NF8', nf8Ok, 'loadShowPage(probe) resolves null; loadShowPage(real) resolves non-null with isFallback falsy', `nullPage=${nullPage} realPage.isFallback=${realPage?.isFallback}`);

    // NF6 — negative discriminator, end-to-end, real loader + real component.
    const negativeResult = await loadShowPageOrFallback(PROBE_KEY, fallbackInput);
    const negativeHtml = renderToStaticMarkup(
      React.createElement(ShowContentState, { result: negativeResult, heroImage: '/images/orchid-yellow.jpg', layout: 'prose' }),
    );
    const negativeMarked = extractMarkedSubtreeHtml(negativeHtml, FALLBACK);
    const nf6Ok =
      negativeMarked !== null &&
      negativeHtml.includes(`${MARKER}="${FALLBACK}"`) &&
      !negativeHtml.includes(`${MARKER}="${PUBLISHED}"`) &&
      negativeHtml.includes(fallbackInput.label) &&
      negativeHtml.includes(fallbackInput.purpose) &&
      negativeHtml.includes(wording.fixedSentence) &&
      /role="note"/.test(negativeMarked ?? '');
    check('NF6', nf6Ok, 'fallback marker, label, verbatim purpose, fixed sentence, disclosure — no published marker', `marked=${!!negativeMarked}`);

    // NF7 — positive discriminator, same code path, a pageKey that exists.
    const positiveResult = await loadShowPageOrFallback(probeRoute.pageKey as string, fallbackInput);
    const positiveHtml = renderToStaticMarkup(
      React.createElement(ShowContentState, { result: positiveResult, heroImage: '/images/orchid-yellow.jpg', layout: 'prose' }),
    );
    // Real seed body text (content/show-pages/11-programme.json, section "intro") —
    // >= 40 chars, quoted verbatim so this can only pass against the real document.
    const REAL_BODY_SUBSTRING =
      'This page will bring together the master timetable for every National Show activity in one place, once the full programme is confirmed.';
    const nf7Ok =
      positiveHtml.includes(`${MARKER}="${PUBLISHED}"`) &&
      !positiveHtml.includes(`${MARKER}="${FALLBACK}"`) &&
      REAL_BODY_SUBSTRING.length >= 40 &&
      positiveHtml.includes(REAL_BODY_SUBSTRING);
    check('NF7', nf7Ok, 'published marker, no fallback marker, real body substring present', `htmlLen=${positiveHtml.length}`);

    // NF9 — no try/catch around the load. Independent re-derivation of A5's check.
    const showPagesSrc = readFileSync(path.resolve(PROJECT_ROOT, 'lib/data/show-pages.ts'), 'utf8');
    const loaderSrc = extractFunctionSource(showPagesSrc, 'loadShowPageOrFallback');
    const nf9Ok = loaderSrc !== null && !/\btry\b/.test(loaderSrc) && !/\bcatch\b/.test(loaderSrc);
    check('NF9', nf9Ok, 'loadShowPageOrFallback contains no try/catch', `found=${loaderSrc === null ? 'function not found' : 'try/catch present'}`);

    // NF11 — fixed sentence exact + no banned phrases, against the marked subtree.
    const negativeText = stripTagsAndNormalize(negativeMarked ?? '');
    const bannedFound = wording.bannedPhrases.filter((p) => negativeText.toLowerCase().includes(p.toLowerCase()));
    const nf11Ok = negativeText.includes(wording.fixedSentence) && bannedFound.length === 0;
    check('NF11', nf11Ok, 'fixed sentence present exactly, zero banned phrases', `bannedFound=${bannedFound.join(', ')}`);

    // NF12 — the reserved probe key appears in zero seeds/content files, and zero live
    // documents (reusing NF8's loadShowPage(PROBE_KEY) === null as the live-dataset
    // half of this proof).
    let staticMatches: string[] = [];
    try {
      staticMatches = execSync(`grep -rl "${PROBE_KEY}" content/ scripts/ --include='*.json' --include='*.ts'`, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      })
        .split('\n')
        .filter((l) => l.trim().length > 0 && l.trim() !== `.agent/memory/project/specs/national-show-ia-alignment/goldens/m4/fixtures/f24-fallback-wording.json`);
    } catch {
      staticMatches = [];
    }
    // The fixture and this driver itself legitimately reference the reserved key in
    // prose/config — exclude scripts/checks/ (this file) and the goldens fixture from
    // the "zero in seeds/content" check, which is about SEED DATA, not about the spec
    // that reserves the key.
    const seedMatches = staticMatches.filter((f) => !f.startsWith('scripts/checks/'));
    const nf12Ok = seedMatches.length === 0 && nullPage === null;
    check('NF12', nf12Ok, 'probe key absent from all seeds/content files and zero live documents', `staticMatches=${seedMatches.join(', ')} liveNull=${nullPage === null}`);

    // NF13 — text census. The marked subtree's normalized visible text equals exactly
    // the union of: notice label, notice text, verbatim purpose, fixed sentence.
    const noticeChipMatch = negativeMarked?.match(/text-\[11px\][^>]*>([^<]*)</);
    const noticeTextMatch = negativeMarked?.match(/text-ink\/80">([^<]*)</);
    const noticeLabel = (noticeChipMatch?.[1] ?? '').trim();
    const noticeText = (noticeTextMatch?.[1] ?? '').trim();
    const expectedUnion = stripTagsAndNormalize(
      `${noticeLabel} ${noticeText} ${fallbackInput.purpose} ${wording.fixedSentence}`,
    );
    const nf13Ok = noticeLabel.length > 0 && noticeText.length > 0 && negativeText === expectedUnion;
    check('NF13', nf13Ok, 'marked subtree text equals exactly the union of notice label, notice text, purpose, fixed sentence', `got="${negativeText}" expected="${expectedUnion}"`);
  } finally {
    if (browser) await browser.close();
    if (devServer) devServer.kill();
  }

  // -------------------------------------------------------------------
  // NF18 — the driver can count itself. Computed over every OTHER declared id, before
  // NF18 is itself recorded: the per-verdict buckets must sum to exactly
  // ALL_CHECK_IDS.length - 1, and every one of those ids must be present exactly once
  // (results is a Map, so "exactly once" is structural). A mismatch means the harness
  // itself is broken — exit 2, never a recorded FAIL — because a verifier that cannot
  // count its own output cannot be trusted about anything else it reported.
  // -------------------------------------------------------------------
  const idsExcludingNF18 = ALL_CHECK_IDS.filter((id): id is Exclude<CheckId, 'NF18'> => id !== 'NF18');
  const missingBeforeNF18 = idsExcludingNF18.filter((id) => !results.has(id));
  const buckets: Record<Verdict, number> = { PASS: 0, FAIL: 0, DRIFT: 0 };
  for (const id of idsExcludingNF18) {
    const v = results.get(id);
    if (v) buckets[v]++;
  }
  const bucketTotal = buckets.PASS + buckets.FAIL + buckets.DRIFT;
  const reconciled = missingBeforeNF18.length === 0 && bucketTotal === idsExcludingNF18.length;
  if (!reconciled) {
    console.error(
      `Verifier bug: NF18 reconciliation failed — missing=[${missingBeforeNF18.join(', ')}] bucketTotal=${bucketTotal} expected=${idsExcludingNF18.length}`,
    );
    writeResults();
    process.exit(2);
  }
  record('NF18', 'PASS');

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
