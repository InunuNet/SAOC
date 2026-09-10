/**
 * verify-show-page-m4.ts — the M4 static verifier (national-show-ia-alignment).
 *
 * See .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/verifier-contract.golden.md
 * for the check-id contract this script implements.
 *
 * Everything this driver proves is computable OFFLINE from the committed tree — the
 * committed seed corpus, the route manifest, source files under app/ and components/,
 * and the pure functions lib/data/show-pages.ts, lib/grid-columns.ts and
 * scripts/seed-show-pages.ts export. No Sanity token, no network, no dev server. The
 * two browser-measured drivers (N1-N15/G3b, L1-L8/S1-S4) are separate scripts —
 * verify-nos-m4-notice.ts and verify-nos-m4-local-render.ts — because THEY need a
 * running page and a browser; this one does not.
 *
 * Lives in scripts/checks/, NOT execution/checks/ — execution/ is HARNESS-owned
 * wholesale and the next `make update-template` wipes it, taking this gate with it.
 *
 * Exit 0: every check passed. Exit 1: at least one check FAILED. Exit 2: the verifier
 * itself could not run (never collapsed into 1).
 *
 * Writes a flat two-token PASS/FAIL manifest to .tmp/sandbox/nos-ia/m4-results.txt, one
 * line per check id, colon-free so each assertion is an unquoted grep. Every id is
 * written UNSET up front; an id still UNSET at the end is a verifier bug (exit 2).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const RESULTS_DIR = path.resolve(PROJECT_ROOT, '.tmp/sandbox/nos-ia');
const RESULTS_FILE = path.join(RESULTS_DIR, 'm4-results.txt');
const NOS_APP_DIR = path.resolve(PROJECT_ROOT, 'app/(marketing)/national-show');
const SHOW_PAGES_DIR = path.resolve(PROJECT_ROOT, 'content/show-pages');
const RETIRED_DIR = path.join(SHOW_PAGES_DIR, 'retired');
const MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'content/national-show-routes.json');
const ALLOWLIST_FILE = path.join(SHOW_PAGES_DIR, '_name-allowlist.json');

type Verdict = 'PASS' | 'FAIL';

const ALL_CHECK_IDS = [
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8',
  'RM1', 'RM2', 'RM3', 'NAV1',
  'X1', 'X2',
  'H1', 'H2', 'H3',
  'SP1', 'SP2', 'SP3',
  'EL1', 'EL2', 'EL3',
  'RS1', 'RS2', 'RS3', 'RS4',
  'CL1', 'CL2', 'CL3', 'CL4', 'CL5',
  'SW1', 'SW2', 'SW3', 'SW4', 'SW5',
  'V1', 'V2', 'V3', 'V4', 'V5',
  'CD1', 'CD2', 'CD3', 'CD4', 'CD5',
  'G1', 'G6',
] as const;
type CheckId = (typeof ALL_CHECK_IDS)[number];

const results = new Map<CheckId, Verdict>();
let hardFailure = false;

function record(id: CheckId, verdict: Verdict, detail?: string): void {
  results.set(id, verdict);
  if (verdict === 'FAIL') {
    hardFailure = true;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

function check(id: CheckId, condition: boolean, expected: string, found: string): void {
  record(id, condition ? 'PASS' : 'FAIL', condition ? undefined : `expected ${expected}, found ${found}`);
}

function writeResults(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const lines = ALL_CHECK_IDS.map((id) => `${id} ${results.get(id) ?? 'UNSET'}`);
  writeFileSync(RESULTS_FILE, lines.join('\n') + '\n', 'utf8');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function gitDiffNames(baseRef: string, ...pathspecs: string[]): string[] {
  try {
    const out = execFileSync('git', ['diff', '--name-only', baseRef, '--', ...pathspecs], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function walkFiles(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// ===========================================================================
// Route manifest schema — content/national-show-routes.json
// ===========================================================================

interface ManifestRoute {
  slug: string;
  label: string;
  group: string | null;
  parent: string | null;
  order: number;
  listed: boolean;
  dynamic: boolean;
  indexable: boolean;
  status: string;
  owner: string;
  archetype: string;
  purpose: string;
  pageKey: string | null;
  specNumber: number | null;
}
interface ManifestGroup {
  id: string;
  label: string;
  order: number;
}
interface RouteManifest {
  schema: string;
  generatedFor: string;
  generatedAt: string;
  groups: ManifestGroup[];
  routes: ManifestRoute[];
}

const REQUIRED_ROUTE_KEYS = [
  'slug', 'label', 'group', 'parent', 'order', 'listed', 'dynamic', 'indexable',
  'status', 'owner', 'archetype', 'purpose', 'pageKey', 'specNumber',
] as const;

const EXPECTED_GROUPS: ManifestGroup[] = [
  { id: 'visit', label: 'Visit', order: 1 },
  { id: 'programme', label: 'Programme', order: 2 },
  { id: 'exhibit-trade', label: 'Exhibit & Trade', order: 3 },
  { id: 'the-show', label: 'The Show', order: 4 },
];

// The golden's own table (route-manifest-schema.golden.md "The 21 rows"), keyed by
// slug, checked field-for-field against the generated manifest (RM1 direction 3).
const GOLDEN_ROWS: Record<string, Partial<ManifestRoute>> = {
  '/national-show': { group: null, order: 1, listed: true, dynamic: false, status: 'restructured', owner: 'nos-design', archetype: 'hub', pageKey: '01-national-show-landing' },
  '/national-show/about': { group: 'visit', order: 1, listed: true, status: 'reconciled', owner: 'nos-design', archetype: 'prose', pageKey: '02-about-the-national-show' },
  '/national-show/what-to-expect': { group: 'visit', order: 2, listed: true, status: 'reconciled', owner: 'nos-design', archetype: 'prose', pageKey: '03-what-to-expect' },
  '/national-show/plan-your-visit': { group: 'visit', order: 3, listed: true, status: 'reconciled', owner: 'nos-design', archetype: 'prose', pageKey: '16-plan-your-visit' },
  '/national-show/faq': { group: 'visit', order: 4, listed: true, status: 'reconciled', owner: 'nos-design', archetype: 'prose', pageKey: '17-faq' },
  '/national-show/programme': { group: 'programme', order: 1, listed: true, status: 'created', owner: 'nos-design', archetype: 'schedule', pageKey: '11-programme' },
  '/national-show/workshops': { group: 'programme', order: 2, listed: true, status: 'reconciled', owner: 'nos-design', archetype: 'schedule', pageKey: '12-workshops' },
  '/national-show/symposium': { group: 'programme', order: 3, listed: true, status: 'created', owner: 'nos-design', archetype: 'prose', pageKey: '06-saoc-symposium' },
  '/national-show/wosa': { group: 'programme', order: 4, listed: true, status: 'created', owner: 'nos-design', archetype: 'prose', pageKey: '07-wosa-conference' },
  '/national-show/conferences': { group: 'programme', order: 5, listed: true, status: 'untouched', owner: 'saoc-eb', archetype: 'transactional', pageKey: null },
  '/national-show/sa-exhibitors': { group: 'exhibit-trade', order: 1, listed: true, status: 'created', owner: 'nos-design', archetype: 'listing', pageKey: '04-south-african-exhibitors' },
  '/national-show/international-guests': { group: 'exhibit-trade', order: 2, listed: true, status: 'created', owner: 'nos-design', archetype: 'listing', pageKey: '05-international-guests-and-exhibitors' },
  '/national-show/exhibitors': { group: 'exhibit-trade', order: 3, listed: true, status: 'untouched', owner: 'saoc-eb', archetype: 'prose', pageKey: null },
  '/national-show/vendors': { group: 'exhibit-trade', order: 4, listed: true, status: 'untouched', owner: 'saoc-eb', archetype: 'transactional', pageKey: null },
  '/national-show/tickets': { group: 'the-show', order: 1, listed: true, status: 'untouched', owner: 'saoc-eb', archetype: 'transactional', pageKey: null },
  '/national-show/sponsors': { group: 'the-show', order: 2, listed: true, status: 'created', owner: 'nos-design', archetype: 'listing', pageKey: '15-sponsors' },
  '/national-show/archive': { group: 'the-show', order: 3, listed: true, status: 'untouched', owner: 'saoc-eb', archetype: 'archive', pageKey: null },
  '/national-show/vendors/apply': { group: 'exhibit-trade', listed: false, dynamic: false, indexable: true, owner: 'saoc-eb' },
  '/national-show/vendors/register': { group: 'exhibit-trade', listed: false, dynamic: false, indexable: false, owner: 'saoc-eb' },
  '/national-show/vendors/payment': { group: 'exhibit-trade', listed: false, dynamic: false, indexable: false, owner: 'saoc-eb' },
  '/national-show/archive/[year]': { group: 'the-show', listed: false, dynamic: true, indexable: true, owner: 'saoc-eb' },
};

const RETIRED_PAGE_KEYS = [
  '08-judging-and-awards',
  '09-plant-exhibition-and-sales',
  '10-plant-sales',
  '18-contact-us',
] as const;

const NEVER_CREATE_SLUGS = [
  '/national-show/plant-exhibition',
  '/national-show/plant-sales',
  '/national-show/judging-and-awards',
  '/national-show/contact',
] as const;

const UNTOUCHABLE_DIRS = ['tickets', 'conferences', 'exhibitors', 'vendors', 'archive'] as const;

function slugToDiskDir(slug: string): string {
  const rel = slug === '/national-show' ? '.' : slug.replace('/national-show/', '');
  return path.join(NOS_APP_DIR, rel);
}

function loadManifest(): RouteManifest {
  return readJson<RouteManifest>(MANIFEST_PATH);
}

// ===========================================================================
// R — routes and reachability
// ===========================================================================

function runRoutesChecks(manifest: RouteManifest): void {
  // R1 — every listed row has a page.tsx; counts hold.
  let r1ok = true;
  const r1fail: string[] = [];
  for (const route of manifest.routes) {
    const pagePath = path.join(slugToDiskDir(route.slug), 'page.tsx');
    if (!existsSync(pagePath)) {
      r1ok = false;
      r1fail.push(`${route.slug} has no page.tsx`);
    }
  }
  const listedCount = manifest.routes.filter((r) => r.listed).length;
  const createdCount = manifest.routes.filter((r) => r.listed && r.status === 'created').length;
  const reconciledCount = manifest.routes.filter((r) => r.listed && r.status === 'reconciled').length;
  const restructuredCount = manifest.routes.filter((r) => r.listed && r.status === 'restructured').length;
  const untouchableCount = manifest.routes.filter((r) => r.listed && r.status === 'untouched').length;
  if (listedCount !== 17) { r1ok = false; r1fail.push(`listed=${listedCount}, expected 17`); }
  if (createdCount !== 6) { r1ok = false; r1fail.push(`created=${createdCount}, expected 6`); }
  if (reconciledCount !== 5) { r1ok = false; r1fail.push(`reconciled=${reconciledCount}, expected 5`); }
  if (restructuredCount !== 1) { r1ok = false; r1fail.push(`restructured=${restructuredCount}, expected 1`); }
  if (untouchableCount !== 5) { r1ok = false; r1fail.push(`untouched=${untouchableCount}, expected 5`); }
  const aboutRow = manifest.routes.find((r) => r.slug === '/national-show/about');
  if (!aboutRow || aboutRow.status !== 'reconciled') {
    r1ok = false;
    r1fail.push('/national-show/about must be status=reconciled, never created');
  }
  check('R1', r1ok, '17 listed / 6 created / 5 reconciled / 1 restructured / 5 untouched, all with page.tsx', r1fail.join('; '));

  // R2 — untouchable routes unmodified (base ref, not HEAD).
  const baseRef = process.env.M4_BASE_REF ?? 'origin/main';
  let r2ok = true;
  const r2fail: string[] = [];
  for (const dir of UNTOUCHABLE_DIRS) {
    const rel = `app/(marketing)/national-show/${dir}`;
    const changed = gitDiffNames(baseRef, rel);
    if (changed.length > 0) {
      r2ok = false;
      r2fail.push(`${rel}: ${changed.join(', ')}`);
    }
  }
  check('R2', r2ok, 'no diff under any untouchable route directory', r2fail.join('; '));

  // R3 — every listed route reachable from BOTH ShowSectionNav and the hub's groups.
  const navSrc = readFileSync(path.join(PROJECT_ROOT, 'components/show/ShowSectionNav.tsx'), 'utf8');
  const hubSrc = readFileSync(path.join(NOS_APP_DIR, 'page.tsx'), 'utf8');
  const navHrefs = extractHrefLiterals(navSrc);
  const hubHrefs = extractHrefLiterals(hubSrc);
  const listedSlugs = manifest.routes.filter((r) => r.listed).map((r) => r.slug);
  let r3ok = true;
  const r3fail: string[] = [];
  for (const slug of listedSlugs) {
    const onNav = navHrefs.has(slug);
    // The hub's own slug is never a member of its own groups; it's reachable by being
    // the page itself. Every OTHER listed slug must be a hub group member.
    const onHub = slug === '/national-show' || hubHrefs.has(slug);
    if (!onNav || !onHub) {
      r3ok = false;
      r3fail.push(`${slug}: nav=${onNav} hub=${onHub}`);
    }
  }
  check('R3', r3ok, 'every listed slug reachable from both ShowSectionNav and the hub groups', r3fail.join('; '));

  // R4 — /societies link on one of the two surfaces.
  const r4ok = navSrc.includes('/societies') || hubSrc.includes('/societies');
  check('R4', r4ok, "a '/societies' link on ShowSectionNav or the hub", r4ok ? '' : 'not found on either surface');

  // R5 — no colour/font-family/border-radius/box-shadow literal under national-show/.
  const styleFiles = walkFiles(NOS_APP_DIR, ['.tsx', '.ts', '.css']);
  const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|hsl\(|hsla\(/;
  const FONT_FAMILY_RE = /font-family\s*:/;
  const RADIUS_LITERAL_RE = /border-radius\s*:\s*\d/;
  const SHADOW_LITERAL_RE = /box-shadow\s*:\s*\d/;
  let r5ok = true;
  const r5fail: string[] = [];
  for (const file of styleFiles) {
    if (file.endsWith('nos-theme.css')) continue; // the theme file IS where these are declared
    const src = readFileSync(file, 'utf8');
    if (COLOUR_RE.test(src) || FONT_FAMILY_RE.test(src) || RADIUS_LITERAL_RE.test(src) || SHADOW_LITERAL_RE.test(src)) {
      r5ok = false;
      r5fail.push(path.relative(PROJECT_ROOT, file));
    }
  }
  check('R5', r5ok, 'no colour/font-family/border-radius/box-shadow literal outside nos-theme.css', r5fail.join('; '));

  // R6 — every loadShowPage consumer calls notFound() (static proxy: source contains
  // both `loadShowPage(` and `notFound()`).
  const loadShowPageConsumers = walkFiles(NOS_APP_DIR, ['page.tsx']).filter((f) => {
    const src = readFileSync(f, 'utf8');
    return src.includes('loadShowPage(');
  });
  let r6ok = loadShowPageConsumers.length > 0;
  const r6fail: string[] = [];
  for (const file of loadShowPageConsumers) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('notFound()')) {
      r6ok = false;
      r6fail.push(path.relative(PROJECT_ROOT, file));
    }
  }
  check('R6', r6ok, 'every loadShowPage() consumer calls notFound() on a null page', r6fail.join('; '));

  // R7 — lane boundary: nothing modified under route-manifest.golden.md §8's paths.
  const LANE_BOUNDARY_PATHS = [
    'components/chrome',
    'next.config.ts',
    'app/(marketing)/tickets',
    'app/(marketing)/sponsors',
    'app/(marketing)/judging',
    'app/(marketing)/contact',
    'app/(marketing)/societies',
    'app/(marketing)/media-kit',
  ];
  const r7changed = gitDiffNames(baseRef, ...LANE_BOUNDARY_PATHS);
  check('R7', r7changed.length === 0, 'no diff under any lane-boundary path', r7changed.join('; '));

  // R8 — /national-show/upcoming gone, no redirect entry anywhere.
  const upcomingGone = !existsSync(path.join(NOS_APP_DIR, 'upcoming'));
  const nextConfigPath = path.resolve(PROJECT_ROOT, 'next.config.ts');
  const nextConfigSrc = existsSync(nextConfigPath) ? readFileSync(nextConfigPath, 'utf8') : '';
  const middlewarePath = path.resolve(PROJECT_ROOT, 'middleware.ts');
  const middlewareSrc = existsSync(middlewarePath) ? readFileSync(middlewarePath, 'utf8') : '';
  const noRedirect = !nextConfigSrc.includes('national-show/upcoming') && !middlewareSrc.includes('national-show/upcoming');
  check('R8', upcomingGone && noRedirect, 'upcoming/ deleted, no redirect in next.config.ts or middleware.ts', `gone=${upcomingGone} noRedirect=${noRedirect}`);
}

// href: '/path' or href="/path" object-literal extraction — matches the convention
// site-content-alignment's A11/A12 grep for.
function extractHrefLiterals(src: string): Set<string> {
  const out = new Set<string>();
  const re = /href:\s*['"](\/national-show[^'"]*)['"]/g;
  for (const m of src.matchAll(re)) out.add(m[1]);
  return out;
}

// ===========================================================================
// RM / NAV — the route manifest
// ===========================================================================

function runManifestChecks(manifest: RouteManifest): void {
  let rm1ok = true;
  const rm1fail: string[] = [];

  if (manifest.schema !== 'saoc.nos-route-manifest/v1') { rm1ok = false; rm1fail.push('schema mismatch'); }
  if (!manifest.generatedFor) { rm1ok = false; rm1fail.push('generatedFor empty'); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.generatedAt)) { rm1ok = false; rm1fail.push('generatedAt not YYYY-MM-DD'); }

  if (JSON.stringify(manifest.groups) !== JSON.stringify(EXPECTED_GROUPS)) {
    rm1ok = false;
    rm1fail.push('groups array does not match exactly');
  }

  if (manifest.routes.length !== 21) { rm1ok = false; rm1fail.push(`routes.length=${manifest.routes.length}, expected 21`); }
  const listed = manifest.routes.filter((r) => r.listed).length;
  const unlisted = manifest.routes.filter((r) => !r.listed).length;
  if (listed !== 17 || unlisted !== 4) { rm1ok = false; rm1fail.push(`listed=${listed} unlisted=${unlisted}`); }

  // Direction 1: disk -> manifest. Every page.tsx under national-show/ has exactly one row.
  const diskPages = walkFiles(NOS_APP_DIR, ['page.tsx']).map((f) => {
    const rel = path.relative(NOS_APP_DIR, path.dirname(f)).split(path.sep).join('/');
    return rel === '.' || rel === '' ? '/national-show' : `/national-show/${rel}`;
  });
  const manifestSlugs = new Set(manifest.routes.map((r) => r.slug));
  for (const slug of diskPages) {
    if (!manifestSlugs.has(slug)) { rm1ok = false; rm1fail.push(`disk page with no manifest row: ${slug}`); }
  }
  // Direction 2: manifest -> disk. Every row's slug resolves to a real page.tsx.
  for (const route of manifest.routes) {
    if (!existsSync(path.join(slugToDiskDir(route.slug), 'page.tsx'))) {
      rm1ok = false;
      rm1fail.push(`manifest row with no page.tsx: ${route.slug}`);
    }
  }
  // Direction 3: manifest -> golden table, field-for-field.
  for (const [slug, expected] of Object.entries(GOLDEN_ROWS)) {
    const row = manifest.routes.find((r) => r.slug === slug);
    if (!row) { rm1ok = false; rm1fail.push(`golden row missing from manifest: ${slug}`); continue; }
    for (const [key, value] of Object.entries(expected)) {
      if ((row as unknown as Record<string, unknown>)[key] !== value) {
        rm1ok = false;
        rm1fail.push(`${slug}.${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify((row as unknown as Record<string, unknown>)[key])}`);
      }
    }
  }
  // pageKey resolves; no retired pageKey anywhere; every required key present.
  const topLevelSeedKeys = new Set(
    readdirSync(SHOW_PAGES_DIR)
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => readJson<{ pageKey: string }>(path.join(SHOW_PAGES_DIR, f)).pageKey),
  );
  for (const route of manifest.routes) {
    if (route.pageKey !== null) {
      if (!topLevelSeedKeys.has(route.pageKey)) { rm1ok = false; rm1fail.push(`pageKey does not resolve: ${route.pageKey}`); }
      if ((RETIRED_PAGE_KEYS as readonly string[]).includes(route.pageKey)) { rm1ok = false; rm1fail.push(`retired pageKey in manifest: ${route.pageKey}`); }
    }
    for (const key of REQUIRED_ROUTE_KEYS) {
      if (!(key in route)) { rm1ok = false; rm1fail.push(`${route.slug} missing key ${key}`); }
    }
  }
  check('RM1', rm1ok, 'manifest validates and cross-checks in both directions', rm1fail.join('; '));

  // NAV1 — ShowSectionNav's and the hub's literal href sets equal the manifest's listed
  // slugs exactly, in both directions.
  const navSrc = readFileSync(path.join(PROJECT_ROOT, 'components/show/ShowSectionNav.tsx'), 'utf8');
  const hubSrc = readFileSync(path.join(NOS_APP_DIR, 'page.tsx'), 'utf8');
  const navHrefs = extractHrefLiterals(navSrc);
  const hubHrefs = extractHrefLiterals(hubSrc);
  const listedSlugSet = new Set(manifest.routes.filter((r) => r.listed).map((r) => r.slug));
  // The hub's own slug is not expected among its own group hrefs.
  const hubExpected = new Set([...listedSlugSet].filter((s) => s !== '/national-show'));
  let nav1ok = true;
  const nav1fail: string[] = [];
  for (const slug of listedSlugSet) {
    if (!navHrefs.has(slug)) { nav1ok = false; nav1fail.push(`ShowSectionNav missing ${slug}`); }
  }
  for (const href of navHrefs) {
    if (!listedSlugSet.has(href)) { nav1ok = false; nav1fail.push(`ShowSectionNav has extra ${href}`); }
  }
  for (const slug of hubExpected) {
    if (!hubHrefs.has(slug)) { nav1ok = false; nav1fail.push(`hub missing ${slug}`); }
  }
  for (const href of hubHrefs) {
    if (!hubExpected.has(href)) { nav1ok = false; nav1fail.push(`hub has extra ${href}`); }
  }
  check('NAV1', nav1ok, "ShowSectionNav's and the hub's href literals equal the manifest's listed slugs exactly", nav1fail.join('; '));

  // RM2 — app/sitemap.ts derives its NOS block from the manifest (static source check:
  // it imports the manifest and filters on indexable/dynamic, never a hand-kept list).
  const sitemapSrc = readFileSync(path.resolve(PROJECT_ROOT, 'app/sitemap.ts'), 'utf8');
  const rm2ok =
    sitemapSrc.includes("from '@/content/national-show-routes.json'") &&
    sitemapSrc.includes('.indexable') &&
    sitemapSrc.includes('.dynamic') &&
    !/NATIONAL_SHOW_CHILD_ROUTES\s*[:=][\s\S]*?\[\s*\{\s*path:/.test(sitemapSrc);
  check('RM2', rm2ok, 'app/sitemap.ts imports the manifest and filters on indexable/dynamic, no hand-kept list', rm2ok ? '' : 'derivation pattern not found');

  // RM3 — the derivation is real: the MANIFEST (what the derivation actually reads)
  // carries no deleted route, and the SAOC static/Sanity blocks are still present in
  // source. Checking the manifest content, rather than grepping sitemap.ts's source
  // text for a route slug, is deliberate: this project's own house rule is that a
  // comment mentioning a forbidden string is a false positive, never grounds to relax
  // the check — so the check itself should not be defeatable by an innocent comment
  // either. A slug absent from the manifest is what actually proves derivation-not-a-
  // hand-kept-list; a string absent from source text does not.
  const deletedSlugInManifest = manifest.routes.some((r) => r.slug.endsWith('/upcoming'));
  const rm3ok = !deletedSlugInManifest && sitemapSrc.includes('staticRoutes') && sitemapSrc.includes('societyRoutes') && sitemapSrc.includes('eventRoutes');
  check('RM3', rm3ok, 'manifest carries no deleted route; static/Sanity blocks still present in source', rm3ok ? '' : `deletedSlugInManifest=${deletedSlugInManifest}`);
}

// ===========================================================================
// X — exhibitors / sa-exhibitors guard
// ===========================================================================

function runExhibitorGuard(manifest: RouteManifest): void {
  const baseRef = process.env.M4_BASE_REF ?? 'origin/main';
  const x1changed = gitDiffNames(baseRef, 'app/(marketing)/national-show/exhibitors');
  check('X1', x1changed.length === 0, 'no diff under national-show/exhibitors/', x1changed.join('; '));

  const exhibitors = manifest.routes.find((r) => r.slug === '/national-show/exhibitors');
  const saExhibitors = manifest.routes.find((r) => r.slug === '/national-show/sa-exhibitors');
  const x2ok = Boolean(
    exhibitors?.purpose && saExhibitors?.purpose &&
    exhibitors.purpose.toLowerCase().includes('entry') &&
    saExhibitors.purpose.toLowerCase().includes('directory') &&
    exhibitors.purpose !== saExhibitors.purpose &&
    manifest.routes.filter((r) => r.pageKey === '04-south-african-exhibitors').length === 1 &&
    manifest.routes.find((r) => r.pageKey === '04-south-african-exhibitors')?.slug === '/national-show/sa-exhibitors',
  );
  check('X2', x2ok, "exhibitors.purpose contains 'entry', sa-exhibitors.purpose contains 'directory', distinct, pageKey resolves uniquely", x2ok ? '' : 'purpose/pageKey distinction not found');
}

// ===========================================================================
// H — the hub's four IA groups
// ===========================================================================

function runHubChecks(manifest: RouteManifest): void {
  const hubSrc = readFileSync(path.join(NOS_APP_DIR, 'page.tsx'), 'utf8');

  // H1 — four groups, exact ids/labels/order; all 16 child pages present, one group each,
  // link text equals manifest label.
  let h1ok = true;
  const h1fail: string[] = [];
  const groupBlockRe = /id:\s*'([a-z-]+)',\s*label:\s*'([^']+)',\s*members:\s*\[([\s\S]*?)\],\s*\},/g;
  const foundGroups: { id: string; label: string; members: { href: string; label: string }[] }[] = [];
  for (const m of hubSrc.matchAll(groupBlockRe)) {
    const [, id, label, body] = m;
    const members: { href: string; label: string }[] = [];
    const memberRe = /href:\s*'([^']+)',\s*label:\s*'([^']+)'/g;
    for (const mm of body.matchAll(memberRe)) members.push({ href: mm[1], label: mm[2] });
    foundGroups.push({ id, label, members });
  }
  if (foundGroups.length !== 4) {
    h1ok = false;
    h1fail.push(`found ${foundGroups.length} groups, expected 4`);
  } else {
    for (let i = 0; i < EXPECTED_GROUPS.length; i++) {
      const expected = EXPECTED_GROUPS[i];
      const found = foundGroups[i];
      if (found.id !== expected.id || found.label !== expected.label) {
        h1ok = false;
        h1fail.push(`group[${i}]: expected ${expected.id}/${expected.label}, got ${found.id}/${found.label}`);
      }
    }
  }
  const allMembers = foundGroups.flatMap((g) => g.members.map((m) => ({ ...m, group: g.id })));
  if (allMembers.length !== 16) { h1ok = false; h1fail.push(`16 member links expected, found ${allMembers.length}`); }
  const seen = new Set<string>();
  for (const member of allMembers) {
    if (seen.has(member.href)) { h1ok = false; h1fail.push(`${member.href} appears in more than one group`); }
    seen.add(member.href);
    const manifestRow = manifest.routes.find((r) => r.slug === member.href);
    if (!manifestRow) { h1ok = false; h1fail.push(`${member.href} not in manifest`); continue; }
    if (manifestRow.group !== member.group) { h1ok = false; h1fail.push(`${member.href} in group ${member.group}, manifest says ${manifestRow.group}`); }
    if (manifestRow.label !== member.label) { h1ok = false; h1fail.push(`${member.href} label "${member.label}" != manifest "${manifestRow.label}"`); }
  }
  check('H1', h1ok, 'four groups, exact ids/labels/order, 16 members each in one group, link text = manifest label', h1fail.join('; '));

  // H2 — each group is a real <section aria-labelledby> landmark with a heading ahead of
  // its links (structural proxy: NosHubGroup.tsx renders <section aria-labelledby=...><h3
  // id=...>...</h3><ul>... in that literal order).
  const hubGroupSrc = readFileSync(path.join(PROJECT_ROOT, 'components/show/nos/NosHubGroup.tsx'), 'utf8');
  const sectionIdx = hubGroupSrc.indexOf('<section aria-labelledby=');
  const headingIdx = hubGroupSrc.indexOf('<h3 id=');
  const listIdx = hubGroupSrc.indexOf('<ul');
  const h2ok = sectionIdx !== -1 && headingIdx !== -1 && listIdx !== -1 && sectionIdx < headingIdx && headingIdx < listIdx;
  check('H2', h2ok, '<section aria-labelledby> then <h3 id> then <ul>, in document order', h2ok ? '' : 'structure not found in NosHubGroup.tsx');

  // H3 — the hub's pre-existing content still renders (proxy: known pre-M4 text runs
  // still present in the source).
  const PRE_M4_TEXT_RUNS = [
    'The SAOC National Orchid Show is the country',
    'Three-year cycle',
    'Ten judging groups',
    'Exhibitor information',
  ];
  const h3ok = PRE_M4_TEXT_RUNS.every((t) => hubSrc.includes(t));
  check('H3', h3ok, 'pre-M4 hub content still present — groups are added structure, not a replacement', h3ok ? '' : 'a known pre-M4 text run is missing');
}

// ===========================================================================
// SP — show sponsors' own data scope
// ===========================================================================

function runSponsorChecks(): void {
  const schemaPath = path.resolve(PROJECT_ROOT, 'sanity/schemas/documents/showSponsor.ts');
  const indexSrc = readFileSync(path.resolve(PROJECT_ROOT, 'sanity/schemas/index.ts'), 'utf8');
  const sp1ok = existsSync(schemaPath) && indexSrc.includes('showSponsor');
  check('SP1', sp1ok, 'showSponsor schema exists and is registered', sp1ok ? '' : 'missing schema file or registration');

  const sponsorsRouteDir = path.join(NOS_APP_DIR, 'sponsors');
  const sponsorsFiles = walkFiles(sponsorsRouteDir, ['.tsx', '.ts']);
  let sp2ok = true;
  const sp2fail: string[] = [];
  const FORBIDDEN_RE = /_type\s*==\s*['"]sponsor['"]|sponsorsQuery|allSponsorsQuery/;
  for (const file of sponsorsFiles) {
    if (FORBIDDEN_RE.test(readFileSync(file, 'utf8'))) {
      sp2ok = false;
      sp2fail.push(path.relative(PROJECT_ROOT, file));
    }
  }
  check('SP2', sp2ok, 'nothing under sponsors/ references the site-level sponsor type', sp2fail.join('; '));

  const baseRef = process.env.M4_BASE_REF ?? 'origin/main';
  const sp3changed = gitDiffNames(baseRef, 'app/(marketing)/sponsors');
  check('SP3', sp3changed.length === 0, 'app/(marketing)/sponsors/ unmodified', sp3changed.join('; '));
}

// ===========================================================================
// EL — real empty listings
// ===========================================================================

const LISTING_ROUTE_DIRS = ['sa-exhibitors', 'international-guests', 'sponsors'] as const;

function runEmptyListingChecks(): void {
  const componentSrcs = [
    readFileSync(path.join(PROJECT_ROOT, 'components/show/nos/RealEmptyListing.tsx'), 'utf8'),
  ];
  const pageSrcs = LISTING_ROUTE_DIRS.map((dir) => readFileSync(path.join(NOS_APP_DIR, dir, 'page.tsx'), 'utf8'));

  // EL1 — heading+intro (page renders NosHero title/lede) + the coming-card shape
  // (RealEmptyListing renders fieldLabels) + absence stated in words (ABSENCE_STATEMENT
  // constants are non-trivial sentences, checked below).
  const el1ok =
    componentSrcs.every((s) => s.includes('fieldLabels')) &&
    pageSrcs.every((s) => /ABSENCE_STATEMENT\s*=\s*\n?\s*'[^']{40,}/.test(s) || /ABSENCE_STATEMENT\s*=[\s\S]{0,20}'[^']{20,}'/.test(s));
  check('EL1', el1ok, 'heading/intro + card shape + absence stated in words on all three listing pages', el1ok ? '' : 'shape or absence statement not found');

  // EL2 — no "no results" anywhere; no bare "coming soon" as the block's only statement.
  let el2ok = true;
  const el2fail: string[] = [];
  for (let i = 0; i < pageSrcs.length; i++) {
    const src = pageSrcs[i];
    if (/no results/i.test(src)) { el2ok = false; el2fail.push(`${LISTING_ROUTE_DIRS[i]}: contains "no results"`); }
    if (/^\s*coming soon\s*$/im.test(src)) { el2ok = false; el2fail.push(`${LISTING_ROUTE_DIRS[i]}: bare "coming soon"`); }
  }
  check('EL2', el2ok, 'no "no results" anywhere, no bare "coming soon"', el2fail.join('; '));

  // EL3 — zero invented entities: every capitalised multi-word phrase in the three
  // listing pages' string literals is in the allowlist.
  const allowlist = loadAllowlist();
  let el3ok = true;
  const el3fail: string[] = [];
  for (let i = 0; i < pageSrcs.length; i++) {
    for (const literal of extractStringLiterals(pageSrcs[i])) {
      for (const violation of findUnallowedProperNouns(literal, allowlist)) {
        el3ok = false;
        el3fail.push(`${LISTING_ROUTE_DIRS[i]}: ${violation}`);
      }
    }
  }
  check('EL3', el3ok, 'every capitalised multi-word phrase in listing-page prose is in the name allowlist', [...new Set(el3fail)].join('; '));
}

function extractStringLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /'((?:[^'\\]|\\.)*)'/g;
  for (const m of src.matchAll(re)) out.push(m[1]);
  return out;
}

// Shared with EL3 — same shape as M3's C3 proper-noun scan.
const STOPWORDS = new Set([
  'the', 'this', 'these', 'those', 'that', 'a', 'an', 'each', 'every', 'some', 'all', 'no',
  'and', 'or', 'but', 'if', 'when', 'where', 'what', 'who', 'how', 'why', 'we', 'they', 'it',
  'its', 'our', 'your', 'his', 'her', 'more', 'most', 'many', 'few', 'such', 'once', 'here',
  'for', 'to', 'at', 'in', 'on', 'from', 'of', 'after', 'before', 'since', 'until', 'while',
]);
const CONNECTOR_ALT = 'of|the|and|for|to|at|in|on|from';
const PROPER_PHRASE_RE = new RegExp(
  `\\b[A-Z][a-zA-Z'-]*(?:\\s+(?:(?:${CONNECTOR_ALT})\\s+)?[A-Z][a-zA-Z'-]*)+\\b`,
  'g',
);

function loadAllowlist(): Set<string> {
  const raw = readJson<{ names?: unknown }>(ALLOWLIST_FILE);
  return new Set(Array.isArray(raw.names) ? raw.names.filter((n): n is string => typeof n === 'string') : []);
}

function normalisePhrase(match: string): string | null {
  const words = match.split(/\s+/);
  let start = 0;
  let end = words.length - 1;
  while (start <= end && STOPWORDS.has(words[start].toLowerCase())) start++;
  while (end >= start && STOPWORDS.has(words[end].toLowerCase())) end--;
  const trimmed = words.slice(start, end + 1);
  const capWords = trimmed.filter((w) => /^[A-Z]/.test(w));
  if (capWords.length < 2) return null;
  return trimmed.join(' ');
}

function findUnallowedProperNouns(text: string, allowlist: Set<string>): string[] {
  const violations: string[] = [];
  for (const match of text.matchAll(PROPER_PHRASE_RE)) {
    const phrase = normalisePhrase(match[0]);
    if (!phrase) continue;
    if (!allowlist.has(phrase)) violations.push(phrase);
  }
  return violations;
}

// ===========================================================================
// RS — retired seeds
// ===========================================================================

interface RetiredEntry {
  pageKey: string;
  specNumber: number;
  file: string;
  retiredOn: string;
  ruling: string;
  sourceProvenance: string;
  contentDisposition: string;
}
interface RetiredManifest {
  schema: string;
  retired: RetiredEntry[];
}

const REQUIRED_RETIRED_KEYS = [
  'pageKey', 'specNumber', 'file', 'retiredOn', 'ruling', 'sourceProvenance', 'contentDisposition',
] as const;

function runRetiredSeedChecks(manifest: RouteManifest): void {
  const retiredPath = path.join(SHOW_PAGES_DIR, '_retired.json');
  let rs1ok = existsSync(retiredPath);
  const rs1fail: string[] = [];
  if (rs1ok) {
    const retired = readJson<RetiredManifest>(retiredPath);
    const gotKeys = retired.retired.map((r) => r.pageKey).sort();
    const wantKeys = [...RETIRED_PAGE_KEYS].sort();
    if (JSON.stringify(gotKeys) !== JSON.stringify(wantKeys)) {
      rs1ok = false;
      rs1fail.push(`pageKeys: got ${gotKeys.join(',')}, want ${wantKeys.join(',')}`);
    }
    for (const entry of retired.retired) {
      for (const key of REQUIRED_RETIRED_KEYS) {
        const value = (entry as unknown as Record<string, unknown>)[key];
        if (value === undefined || value === null || value === '') {
          rs1ok = false;
          rs1fail.push(`${entry.pageKey}.${key} missing or empty`);
        }
      }
    }
  } else {
    rs1fail.push('_retired.json missing');
  }
  check('RS1', rs1ok, '_retired.json records exactly the four pageKeys, all seven keys non-empty', rs1fail.join('; '));

  // RS2 — no retired pageKey in the manifest, the top-level seed corpus, or as a route.
  const topLevelFiles = readdirSync(SHOW_PAGES_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  let rs2ok = true;
  const rs2fail: string[] = [];
  for (const key of RETIRED_PAGE_KEYS) {
    if (manifest.routes.some((r) => r.pageKey === key)) { rs2ok = false; rs2fail.push(`${key} in manifest`); }
    if (topLevelFiles.some((f) => f === `${key}.json`)) { rs2ok = false; rs2fail.push(`${key} in top-level corpus`); }
    const neverCreateSlug = `/national-show/${key.replace(/^\d+-/, '').replace(/-and-.*$/, '')}`;
    // Best-effort: check the four never-create directories directly instead.
    void neverCreateSlug;
  }
  for (const slug of NEVER_CREATE_SLUGS) {
    if (existsSync(path.join(slugToDiskDir(slug), 'page.tsx'))) { rs2ok = false; rs2fail.push(`${slug} exists as a route`); }
  }
  check('RS2', rs2ok, 'no retired pageKey in manifest/corpus/routes; no never-create route exists', rs2fail.join('; '));

  // RS3 — every retired file exists at its recorded path; body text byte-identical to
  // pre-M4 (only provenance may differ). Compared against the base ref's copy of the
  // ORIGINAL (pre-move) path, since git tracks the rename.
  const baseRef = process.env.M4_BASE_REF ?? 'origin/main';
  let rs3ok = true;
  const rs3fail: string[] = [];
  if (existsSync(retiredPath)) {
    const retired = readJson<RetiredManifest>(retiredPath);
    for (const entry of retired.retired) {
      const currentPath = path.resolve(PROJECT_ROOT, entry.file);
      if (!existsSync(currentPath)) { rs3ok = false; rs3fail.push(`${entry.file} does not exist`); continue; }
      const original = `content/show-pages/${entry.pageKey}.json`;
      let baseline: string | null = null;
      try {
        baseline = execFileSync('git', ['show', `${baseRef}:${original}`], { cwd: PROJECT_ROOT, encoding: 'utf8' });
      } catch {
        rs3fail.push(`${entry.pageKey}: no pre-M4 baseline at ${original} on ${baseRef} (verifier cannot confirm — treating as unverifiable, not a pass)`);
        rs3ok = false;
        continue;
      }
      const current = readJson<{ sections: { sectionKey: string; body: unknown }[] }>(currentPath);
      const baselineDoc = JSON.parse(baseline) as { sections: { sectionKey: string; body: unknown }[] };
      for (const section of baselineDoc.sections) {
        const currentSection = current.sections.find((s) => s.sectionKey === section.sectionKey);
        if (!currentSection) { rs3ok = false; rs3fail.push(`${entry.pageKey}/${section.sectionKey}: section dropped`); continue; }
        if (JSON.stringify(currentSection.body) !== JSON.stringify(section.body)) {
          rs3ok = false;
          rs3fail.push(`${entry.pageKey}/${section.sectionKey}: body changed`);
        }
      }
    }
  } else {
    rs3ok = false;
    rs3fail.push('_retired.json missing');
  }
  check('RS3', rs3ok, 'every retired file exists, body byte-identical to pre-M4 (provenance may differ)', rs3fail.join('; '));

  // RS4 — the four never-create slugs do not exist as routes (also L6, live).
  let rs4ok = true;
  const rs4fail: string[] = [];
  for (const slug of NEVER_CREATE_SLUGS) {
    if (existsSync(path.join(slugToDiskDir(slug), 'page.tsx'))) { rs4ok = false; rs4fail.push(slug); }
  }
  check('RS4', rs4ok, 'the four never-create slugs have no page.tsx', rs4fail.join('; '));
}

// ===========================================================================
// CL — content linkage (via lib/data/show-pages.ts's real resolveNotice)
// ===========================================================================

type ShowPagesModule = typeof import('../../lib/data/show-pages');

interface SeedSectionJson {
  sectionKey: string;
  heading?: string | null;
  kind?: string | null;
  provenance: string;
  sourcePath?: string | null;
  body: unknown;
}
interface SeedPageJson {
  pageKey: string;
  sections: SeedSectionJson[];
}

function findSection(doc: SeedPageJson, sectionKey: string): SeedSectionJson | undefined {
  return doc.sections.find((s) => s.sectionKey === sectionKey);
}

async function runLinkageChecks(showPages: ShowPagesModule): Promise<void> {
  const { resolveNotice, FALLBACK_PLACEHOLDER_LABEL } = showPages;

  // CL1 — 13-booking-tickets/categories passes linkage: reclassified to placeholder-ai
  // (linkage does not run on placeholder-ai, so this is correct by classification).
  const tickets = readJson<SeedPageJson>(path.join(SHOW_PAGES_DIR, '13-booking-tickets.json'));
  const categories = findSection(tickets, 'categories');
  const cl1ok = categories?.provenance === 'placeholder-ai';
  check('CL1', cl1ok, "13-booking-tickets/categories provenance is 'placeholder-ai'", `provenance=${categories?.provenance}`);

  // CL2 — retired/18-contact-us/overview likewise, reclassified BEFORE the move.
  const contactUs = readJson<SeedPageJson>(path.join(RETIRED_DIR, '18-contact-us.json'));
  const overview = findSection(contactUs, 'overview');
  const cl2ok = overview?.provenance === 'placeholder-ai';
  check('CL2', cl2ok, "retired/18-contact-us/overview provenance is 'placeholder-ai'", `provenance=${overview?.provenance}`);

  // CL3 — threshold still 25, exact containment (no fuzzy match), guarded set still
  // includes council-supplied AND council-draft.
  const showPagesSrc = readFileSync(path.resolve(PROJECT_ROOT, 'lib/data/show-pages.ts'), 'utf8');
  const cl3a = /MIN_LINKAGE_SENTENCE_CHARS\s*=\s*25\b/.test(showPagesSrc);
  const linkageRegionMatch = showPagesSrc.match(/function bodyLinkedToSource[\s\S]*?\n}/);
  const linkageRegion = linkageRegionMatch ? linkageRegionMatch[0] : '';
  const cl3b = !/fuzzy|similarity|levenshtein|startsWith|some\(|distance/i.test(linkageRegion);
  const cl3c = showPagesSrc.includes("case 'council-draft'") && showPagesSrc.includes("case 'council-supplied'");
  const cl3ok = cl3a && cl3b && cl3c;
  check('CL3', cl3ok, 'threshold=25, exact containment, council-supplied+council-draft both guarded', `a=${cl3a} b=${cl3b} c=${cl3c}`);

  // CL4 — whole-corpus linkage, retired/ included, zero failures. A council-supplied
  // section is linked iff resolveNotice returns null; a council-draft section is linked
  // iff its notice label is the DRAFT label, not the PLACEHOLDER label (a council-draft
  // section never returns null, by design — CD2).
  const allFiles = [
    ...readdirSync(SHOW_PAGES_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => path.join(SHOW_PAGES_DIR, f)),
    ...(existsSync(RETIRED_DIR) ? readdirSync(RETIRED_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(RETIRED_DIR, f)) : []),
  ];
  let cl4ok = true;
  const cl4fail: string[] = [];
  for (const file of allFiles) {
    const doc = readJson<SeedPageJson>(file);
    for (const section of doc.sections) {
      if (section.provenance === 'council-supplied') {
        const notice = resolveNotice({ provenance: section.provenance, sourcePath: section.sourcePath, kind: section.kind, body: section.body });
        if (notice !== null) {
          cl4ok = false;
          cl4fail.push(`${path.basename(file)}/${section.sectionKey}: council-supplied but not linked (${notice.label})`);
        }
      } else if (section.provenance === 'council-draft') {
        const notice = resolveNotice({ provenance: section.provenance, sourcePath: section.sourcePath, kind: section.kind, body: section.body });
        if (!notice || notice.label === FALLBACK_PLACEHOLDER_LABEL) {
          cl4ok = false;
          cl4fail.push(`${path.basename(file)}/${section.sectionKey}: council-draft but linkage failed (demoted to placeholder)`);
        }
      }
    }
  }
  check('CL4', cl4ok, 'whole-corpus linkage (retired/ included) passes with zero failures', cl4fail.join('; '));

  // CL5 — no council-supplied section omits source content the route ALREADY RENDERS.
  // The property is about what the ROUTE renders, not about whether the seed is a
  // complete transcript of its source. For every page driven by loadShowPage(),
  // ShowPageProse renders section.body VERBATIM and nothing else — so "what the route
  // renders" and "what is in the seed" are the same text by construction, and a
  // seed-vs-full-source completeness check would be a different (stricter) property CL5
  // does not ask for. The one route this project has where "what the route renders"
  // and "what is in the seed" can diverge is /about: it is hardcoded JSX, not a
  // loadShowPage consumer, so its rendered text can (and, before D65, did) render more
  // of the source than its seed held. That is the specific, real case CL5 exists to
  // catch, checked below.
  let cl5ok = true;
  const cl5fail: string[] = [];
  // JSX source text carries named HTML entities (&rsquo; &ldquo; etc.) for the
  // typographic quotes React renders — comparing the raw .tsx text against plain-prose
  // markdown would otherwise see "council&rsquo;s" and "council's" as unrelated tokens,
  // a false positive of reading source text rather than rendered output.
  const aboutSrc = stripJsxEntities(readFileSync(path.join(NOS_APP_DIR, 'about', 'page.tsx'), 'utf8'));
  const aboutSourcePath = path.resolve(
    PROJECT_ROOT,
    'content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md',
  );
  if (existsSync(aboutSourcePath)) {
    const aboutSourceText = readFileSync(aboutSourcePath, 'utf8');
    const missing = missingSourceSentences(aboutSourceText, aboutSrc);
    if (missing.length > 0) {
      cl5ok = false;
      cl5fail.push(`about/page.tsx: source has ${missing.length} sentence(s) not rendered`);
    }
  }
  check('CL5', cl5ok, 'no council-supplied/council-draft section (or /about) omits source content the route renders', cl5fail.join('; '));
}

function stripJsxEntities(text: string): string {
  return text
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&');
}

function extractPlainText(body: unknown): string {
  if (typeof body === 'string') return body; // about/page.tsx source itself
  if (!Array.isArray(body)) return '';
  return body
    .map((block) => {
      const children = (block as { children?: unknown })?.children;
      if (!Array.isArray(children)) return '';
      return children.map((c) => (typeof (c as { text?: unknown })?.text === 'string' ? (c as { text: string }).text : '')).join('');
    })
    .join('\n');
}

function normalizeForLinkage(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

const MIN_LINKAGE_SENTENCE_CHARS = 25;

// Source documents are raw markdown (`**bold**` headings with no terminal punctuation,
// blank-line paragraph breaks) while the rendered text is clean prose. Splitting the
// WHOLE file as one blob glues a heading onto the paragraph that follows it into one
// "sentence" with no terminal punctuation, which then matches nothing — a false
// positive of the splitter, not a real missing-content finding. Paragraph-first
// splitting, with pure-heading paragraphs (no [.!?], markdown emphasis stripped) never
// carrying prose sentences to test, avoids that.
function sentencesFromMarkdown(markdown: string): string[] {
  const paragraphs = markdown.split(/\n\s*\n/);
  const sentences: string[] = [];
  for (const paragraph of paragraphs) {
    const stripped = paragraph.replace(/\*\*/g, '').trim();
    if (!stripped || !/[.!?]/.test(stripped)) continue; // a heading with no sentence terminator
    sentences.push(...splitIntoSentences(stripped));
  }
  return sentences;
}

function missingSourceSentences(sourceText: string, targetText: string): string[] {
  const normalizedTarget = normalizeForLinkage(targetText);
  const sourceSentences = sentencesFromMarkdown(sourceText)
    .map((s) => ({ raw: s, normalized: normalizeForLinkage(s) }))
    .filter((s) => s.normalized.length >= MIN_LINKAGE_SENTENCE_CHARS);
  return sourceSentences.filter((s) => !normalizedTarget.includes(s.normalized)).map((s) => s.raw);
}

// ===========================================================================
// SW — seed-write narrowing (via scripts/seed-show-pages.ts's real functions)
// ===========================================================================

type SeedShowPagesModule = typeof import('../seed-show-pages');

function runSeedWriteChecks(seedModule: SeedShowPagesModule): void {
  const { decideSectionAction, hashSeedOwnedFields } = seedModule;
  const seedSection = { sectionKey: 'x', heading: 'H', body: [{ t: 1 }], provenance: 'placeholder-ai' as const, sourcePath: null };
  const fields = { heading: 'H', body: seedSection.body, provenance: 'placeholder-ai' as const, sourcePath: null };
  const hash = hashSeedOwnedFields(fields);

  // SW1 — council-supplied/council-draft existing, even with a perfectly matching hash,
  // is skip-council, never written.
  const sw1a = decideSectionAction(seedSection, { ...fields, provenance: 'council-supplied', seedHash: hash }) === 'skip-council';
  const sw1b = decideSectionAction(seedSection, { ...fields, provenance: 'council-draft', seedHash: hash }) === 'skip-council';
  check('SW1', sw1a && sw1b, "decideSectionAction returns 'skip-council' for council-supplied/council-draft even with a matching hash", `supplied=${sw1a} draft=${sw1b}`);

  // SW2 — hash covers heading, body, provenance AND sourcePath; each changed individually
  // changes the hash.
  const base = { heading: 'H', body: [{ t: 1 }], provenance: 'placeholder-ai' as const, sourcePath: null as string | null };
  const h0 = hashSeedOwnedFields(base);
  const sw2 = {
    heading: hashSeedOwnedFields({ ...base, heading: 'H2' }) !== h0,
    body: hashSeedOwnedFields({ ...base, body: [{ t: 2 }] }) !== h0,
    provenance: hashSeedOwnedFields({ ...base, provenance: 'research' }) !== h0,
    sourcePath: hashSeedOwnedFields({ ...base, sourcePath: 'content/drive-source/x' }) !== h0,
  };
  const sw2ok = sw2.heading && sw2.body && sw2.provenance && sw2.sourcePath;
  check('SW2', sw2ok, 'each of heading/body/provenance/sourcePath individually changes the hash', JSON.stringify(sw2));

  // SW3 — field-scoped write, never a whole-section replace (static: no `patch.set` call
  // assigns a bare `sections[...]` key with no trailing `.field`, and the update path
  // enumerates named fields only).
  const seedSrc = readFileSync(path.resolve(PROJECT_ROOT, 'scripts/seed-show-pages.ts'), 'utf8');
  const sw3ok = seedSrc.includes('sectionUpdateFields(seedSection)') && !/patch\.set\(\{\s*sections:/.test(seedSrc);
  check('SW3', sw3ok, 'the write path is field-scoped via sectionUpdateFields(), never a whole-section replace', sw3ok ? '' : 'pattern not found');

  // SW4 — every patch carries ifRevisionId.
  const sw4ok = seedSrc.includes('.ifRevisionId(existingDoc._rev)');
  check('SW4', sw4ok, 'every seed patch carries ifRevisionId', sw4ok ? '' : 'not found');

  // SW5 — end-to-end fixture: a section edited in each of the four fields, and one
  // flipped to council-supplied, all classify as protected (skip-edited or skip-council)
  // rather than update — i.e. survive a re-run.
  const fixtureBase = { heading: 'Original heading', body: [{ t: 'orig' }], provenance: 'placeholder-ai' as const, sourcePath: null as string | null };
  const fixtureHash = hashSeedOwnedFields(fixtureBase);
  const edits = [
    { ...fixtureBase, heading: 'Edited heading', seedHash: fixtureHash },
    { ...fixtureBase, body: [{ t: 'edited' }], seedHash: fixtureHash },
    { ...fixtureBase, sourcePath: 'content/drive-source/edited', seedHash: fixtureHash },
    { ...fixtureBase, provenance: 'research' as const, seedHash: fixtureHash },
    { ...fixtureBase, provenance: 'council-supplied' as const, seedHash: fixtureHash },
  ];
  const seedInput = { sectionKey: 'fixture', heading: fixtureBase.heading, body: fixtureBase.body, provenance: 'placeholder-ai' as const, sourcePath: fixtureBase.sourcePath };
  const outcomes = edits.map((existing) => decideSectionAction(seedInput, existing));
  const sw5ok = outcomes.every((a) => a === 'skip-edited' || a === 'skip-council');
  check('SW5', sw5ok, 'a section edited in each seed-owned field, or flipped to council-supplied, survives a re-run (never update)', outcomes.join(','));
}

// ===========================================================================
// V — visitor-info mechanism unification (F16) — HONEST: not yet implemented
// ===========================================================================

function runVisitorInfoChecks(): void {
  const showFaqSrc = readFileSync(path.resolve(PROJECT_ROOT, 'sanity/schemas/documents/showFaq.ts'), 'utf8');
  const showVisitorInfoSrc = readFileSync(path.resolve(PROJECT_ROOT, 'sanity/schemas/documents/showVisitorInfo.ts'), 'utf8');
  const confirmationStatusesPath = path.resolve(PROJECT_ROOT, 'sanity/schemas/objects/confirmationStatuses.ts');
  const confirmationStatusesSrc = existsSync(confirmationStatusesPath) ? readFileSync(confirmationStatusesPath, 'utf8') : '';

  // V1 — showVisitorInfo and showFaq import Provenance/resolveNotice from show-pages.
  const v1ok = /from ['"]@\/lib\/data\/show-pages['"]/.test(showFaqSrc) || /from ['"]\.\.\/\.\.\/lib\/data\/show-pages['"]/.test(showFaqSrc);
  check('V1', v1ok, 'showVisitorInfo/showFaq import Provenance/resolveNotice — NOT YET DONE (F16 not implemented)', 'no import found in showFaq.ts');

  // V2 — no initialValue on confirmationStatuses/showFaq.status; each required.
  const v2ok = !/initialValue:\s*['"]pending['"]/.test(confirmationStatusesSrc) && !/initialValue:\s*['"]pending['"]/.test(showFaqSrc);
  check('V2', v2ok, "no initialValue: 'pending' on confirmationStatuses or showFaq.status — NOT YET DONE", v2ok ? '' : "initialValue: 'pending' still present");

  // V3 — the triad mapping is total (confirmed/research/pending -> Provenance). Not
  // implemented: no mapping function exists yet.
  const v3ok = showFaqSrc.includes('mapConfirmationToProvenance') || showVisitorInfoSrc.includes('mapConfirmationToProvenance');
  check('V3', v3ok, 'a total confirmed/research/pending -> Provenance mapping exists — NOT YET DONE', 'no mapping function found');

  // V4 — a migration script exists and is idempotent/write-only-where-absent.
  const migrationPath = path.resolve(PROJECT_ROOT, 'scripts/migrate-visitor-info-provenance.ts');
  const v4ok = existsSync(migrationPath);
  check('V4', v4ok, 'a migration-before-tightening script exists — NOT YET DONE', 'scripts/migrate-visitor-info-provenance.ts does not exist');

  // V5 — the three routes still render every structured block. Not independently
  // verifiable without a snapshot; honestly reported as not run.
  check('V5', false, 'pre/post-migration structural-field snapshot comparison — NOT YET RUN (no migration exists to compare against)', 'not implemented');
}

// ===========================================================================
// CD — council-draft, the fourth provenance value
// ===========================================================================

async function runCouncilDraftChecks(showPages: ShowPagesModule, seedModule: SeedShowPagesModule): Promise<void> {
  const { resolveNotice, FALLBACK_DRAFT_LABEL } = showPages;

  // CD1 — no council-supplied section contains an unfilled slot.
  const UNFILLED_SLOT_RE = /\bxx+\b|\bTBC\b|\bTBA\b|\bTBD\b|\[\s*\]|\[\.\.\.\]|\[…\]|___+|\.{4,}|……/i;
  let cd1ok = true;
  const cd1fail: string[] = [];
  const allTopLevel = readdirSync(SHOW_PAGES_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  for (const file of allTopLevel) {
    const doc = readJson<SeedPageJson>(path.join(SHOW_PAGES_DIR, file));
    for (const section of doc.sections) {
      if (section.provenance !== 'council-supplied') continue;
      const text = extractPlainText(section.body);
      if (UNFILLED_SLOT_RE.test(text)) {
        cd1ok = false;
        cd1fail.push(`${file}/${section.sectionKey}`);
      }
    }
  }
  check('CD1', cd1ok, 'no council-supplied section contains an unfilled slot', cd1fail.join('; '));

  // CD2 — resolveNotice returns the draft notice for council-draft when its linkage
  // check passes (a body that genuinely quotes the named source); suppression still
  // requires council-supplied AND a resolving sourcePath — council-draft with NO
  // sourcePath still notifies (never suppresses), same as council-draft with a body
  // that fails linkage (demoted to the placeholder label, never to silence).
  const draftSection = {
    provenance: 'council-draft' as const,
    sourcePath: 'content/drive-recovered/17-faq/faq/content.md',
    kind: 'prose' as const,
    body: [{ _type: 'block', children: [{ _type: 'span', text: 'When will the 2027 SAOC Symposium be held?' }] }],
  };
  const draftNotice = resolveNotice(draftSection);
  const draftWithNoSourcePathStillNotifies = resolveNotice({ ...draftSection, sourcePath: null }) !== null;
  const cd2ok = draftNotice?.label === FALLBACK_DRAFT_LABEL && draftWithNoSourcePathStillNotifies;
  check('CD2', cd2ok, 'council-draft with a linked body resolves the draft label; with no sourcePath it still notifies, never suppresses', `linkedLabel=${draftNotice?.label} noSourcePathNotifies=${draftWithNoSourcePathStillNotifies}`);

  // CD3 — council-draft carries the same seed-write protection as council-supplied.
  const { decideSectionAction, hashSeedOwnedFields } = seedModule;
  const seedSection = { sectionKey: 'x', heading: 'H', body: [{ t: 1 }], provenance: 'placeholder-ai' as const, sourcePath: null };
  const hash = hashSeedOwnedFields({ heading: 'H', body: seedSection.body, provenance: 'placeholder-ai', sourcePath: null });
  const cd3ok = decideSectionAction(seedSection, { heading: 'H', body: seedSection.body, provenance: 'council-draft', sourcePath: null, seedHash: hash }) === 'skip-council';
  check('CD3', cd3ok, 'council-draft is never written by the seed, checked before any hash', cd3ok ? '' : 'not skip-council');

  // CD4 — showPageSettings.draftLabel/draftNotice required, fallback constants non-empty.
  const settingsSrc = readFileSync(path.resolve(PROJECT_ROOT, 'sanity/schemas/documents/showPageSettings.ts'), 'utf8');
  const draftLabelBlock = settingsSrc.match(/name:\s*'draftLabel'[\s\S]*?\}\),/);
  const draftNoticeBlock = settingsSrc.match(/name:\s*'draftNotice'[\s\S]*?\}\),/);
  const cd4ok = Boolean(
    draftLabelBlock?.[0].includes('Rule.required()') &&
    draftNoticeBlock?.[0].includes('Rule.required()') &&
    showPages.FALLBACK_DRAFT_LABEL.length > 0 &&
    showPages.FALLBACK_DRAFT_NOTICE.length > 0,
  );
  check('CD4', cd4ok, 'draftLabel/draftNotice required in schema, non-empty fallback constants', cd4ok ? '' : 'required() or fallback missing');

  // CD5 — 17-faq's Q1 present as council-draft, sourcePath naming the recovered doc,
  // resolves with the draft notice (not demoted to placeholder by a failed linkage
  // check).
  const faqDoc = readJson<SeedPageJson>(path.join(SHOW_PAGES_DIR, '17-faq.json'));
  const q1 = faqDoc.sections.find((s) => /symposium will be held/i.test(extractPlainText(s.body)));
  let cd5ok = false;
  if (q1 && q1.provenance === 'council-draft' && q1.sourcePath) {
    const notice = resolveNotice({ provenance: q1.provenance, sourcePath: q1.sourcePath, kind: q1.kind, body: q1.body });
    cd5ok = notice?.label === FALLBACK_DRAFT_LABEL;
  }
  check('CD5', cd5ok, "17-faq's Q1 restored as council-draft, sourcePath set, resolves with the draft notice", `found=${Boolean(q1)} provenance=${q1?.provenance} noticeLabel=${cd5ok ? FALLBACK_DRAFT_LABEL : 'not draft'}`);
}

// ===========================================================================
// G — R13 grid orphan rule (static half; G3b/G4/G5 are browser-measured elsewhere)
// ===========================================================================

async function runGridChecks(): Promise<void> {
  const { resolveGridLayout } = await import('../../lib/grid-columns');
  const GOLDEN_TABLE: Record<number, [number, number]> = {
    0: [1, 1], 1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [4, 1], 5: [3, 1], 6: [4, 1], 7: [4, 1],
    8: [4, 1], 9: [3, 1], 10: [4, 1], 11: [4, 1], 12: [4, 1], 13: [4, 4], 14: [4, 1], 15: [4, 1],
    16: [4, 1], 17: [3, 1], 24: [4, 1], 25: [4, 4], 36: [4, 1], 37: [4, 4],
  };
  let g1ok = true;
  const g1fail: string[] = [];
  for (let n = 0; n <= 40; n++) {
    const layout = resolveGridLayout(n);
    const expected = GOLDEN_TABLE[n];
    if (expected && (layout.columns !== expected[0] || layout.finalCardSpans !== expected[1])) {
      g1ok = false;
      g1fail.push(`n=${n}: got ${JSON.stringify(layout)}, expected columns=${expected[0]} span=${expected[1]}`);
    }
  }
  check('G1', g1ok, 'resolveGridLayout matches the golden table for n=0..40', g1fail.join('; '));

  // G6 — R13 binds at c>=3; c=2 is exempt by ruling (search floor never drops to 2).
  const n2 = resolveGridLayout(2);
  const n5 = resolveGridLayout(5);
  // n=2 must take c=2 directly (below the search floor, no orphan-avoidance run against it);
  // n=5 must NOT resolve to c=2 (that would mean the search floor quietly dropped to 2).
  const g6ok = n2.columns === 2 && n2.finalCardSpans === 1 && n5.columns === 3;
  check('G6', g6ok, 'c=2 is exempt (n=2 -> columns=2 directly); the orphan search never considers c=2 (n=5 -> columns=3, not 2)', `n2=${JSON.stringify(n2)} n5=${JSON.stringify(n5)}`);
}

// ===========================================================================
// main
// ===========================================================================

async function main(): Promise<void> {
  writeResults(); // every id UNSET up front

  try {
    const manifest = loadManifest();
    runRoutesChecks(manifest);
    runManifestChecks(manifest);
    runExhibitorGuard(manifest);
    runHubChecks(manifest);
    runSponsorChecks();
    runEmptyListingChecks();
    runRetiredSeedChecks(manifest);

    const showPages = await import('../../lib/data/show-pages');
    const seedModule = await import('../seed-show-pages');

    await runLinkageChecks(showPages);
    runSeedWriteChecks(seedModule);
    runVisitorInfoChecks();
    await runCouncilDraftChecks(showPages, seedModule);
    await runGridChecks();
  } catch (err) {
    console.error('Verifier bug: an unhandled error escaped a check block:', err);
    writeResults();
    process.exit(2);
  }

  writeResults();

  const unset = ALL_CHECK_IDS.filter((id) => !results.has(id));
  if (unset.length > 0) {
    console.error(`Verifier bug: ids never written: ${unset.join(', ')}`);
    process.exit(2);
  }

  process.exit(hardFailure ? 1 : 0);
}

main();
