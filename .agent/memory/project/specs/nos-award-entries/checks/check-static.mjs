// A2: static proof of the Award Entries change (AE-1 + SAOC Option R). Run from the repo root.
//   1. every award string is a verbatim substring of Brad's relayed thread (no invented copy);
//   2. every audit "change" row has its old source text gone and its new text present; every class-b "keep" row survives;
//   3. the Award Entries page has the title, both sections (data-award-type), both ledes verbatim, the marker and no class-a "exhibitor" wording;
//   4. the route moved: app/(nos)/national-show/award-entries/page.tsx exists, exhibitors/ is gone, proxy.ts 308s both old paths keeping the query;
//   5. no internal href or path string still points at /exhibitors outside proxy.ts.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SPEC = '.agent/memory/project/specs/nos-award-entries';
const audit = JSON.parse(readFileSync(`${SPEC}/goldens/exhibitor-audit.json`, 'utf8')).rows;
const copy = JSON.parse(readFileSync(`${SPEC}/goldens/award-copy.json`, 'utf8'));
const thread = readFileSync(`${SPEC}/goldens/source-council-thread.md`, 'utf8');
const OLD_PAGE = 'app/(nos)/national-show/exhibitors/page.tsx';
const PAGE = 'app/(nos)/national-show/award-entries/page.tsx';
const MOVED = { [OLD_PAGE]: PAGE };
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null);

// 1. provenance
check("page title is in Brad's thread", thread.includes(copy.pageTitle));
for (const s of copy.sections) {
  check(`heading "${s.heading}" is in Brad's thread`, thread.includes(s.heading));
  check(`definition for "${s.heading}" is verbatim in Brad's thread`, thread.includes(s.definition));
  check(`lede for "${s.heading}" is the tail of that definition`, s.definition.endsWith(` — ${s.lede}`));
}

// 2. audit rows
for (const r of audit) {
  if (r.action !== 'change' && r.action !== 'keep') continue;
  const file = MOVED[r.file] ?? r.file;
  const src = read(file);
  check(`${r.id}: ${file} exists`, src !== null);
  if (src === null) continue;
  if (r.action === 'change') {
    check(`${r.id}: old text gone from ${file} (was ${r.file}:${r.line})`, !src.includes(r.current), JSON.stringify(r.current));
    check(`${r.id}: new text present in ${file}`, src.includes(r.new), JSON.stringify(r.new));
  } else {
    check(`${r.id}: class-b text kept in ${file}`, src.includes(r.current), JSON.stringify(r.current));
  }
}

// 3. the page
const page = read(PAGE) ?? '';
check('PAGE_TITLE is Award Entries', /const PAGE_TITLE = 'Award Entries';/.test(page));
for (const s of copy.sections) {
  check(`page has heading "${s.heading}"`, page.includes(`'${s.heading}'`) || page.includes(`"${s.heading}"`) || page.includes(`>${s.heading}<`));
  check(`page has the ${s.awardType} lede verbatim`, page.includes(s.lede));
  check(`page names awardType ${s.awardType}`, page.includes(`data-award-type="${s.awardType}"`) || page.includes(`awardType: '${s.awardType}'`));
  check(`page does not render the "X Award Entries —" label before the lede`, !page.includes(s.definition));
}
check('page carries the awaiting-committee-copy marker label', page.includes(copy.markerLabel));
check('page uses the existing ExhibitorStatusBadge, not a new marker component', /ExhibitorStatusBadge/.test(page));
const noComments = page.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/throw new Error/.test(l)).join('\n');
const scrubbed = noComments.replace(/\/national-show\/award-entries/g, '').replace(/ExhibitorEntryGuidePage|ExhibitorStatusBadge/g, '').replace(/Display Exhibitors?/g, '');
const stray = scrubbed.match(/.{0,40}exhibitor.{0,40}/gi);
check('page has no class-a "exhibitor" wording left', !stray, stray ? stray.join(' | ') : '');
check('no third award type hook', !/data-award-type="(?!national-show"|saoc")/.test(page));

// 4. route move
check('award-entries route page exists', existsSync(PAGE));
check('old exhibitors route directory is gone', !existsSync('app/(nos)/national-show/exhibitors'));
const proxy = read('proxy.ts') ?? '';
check("proxy.ts redirects '/exhibitors' and '/national-show/exhibitors' to /award-entries", /['"]\/exhibitors['"]/.test(proxy) && /['"]\/national-show\/exhibitors['"]/.test(proxy) && /\/award-entries/.test(proxy));
check('proxy.ts keeps the query string on that redirect (no search-dropping nosUrl("/award-entries"))', /award-entries\$\{search\}|\$\{AWARD_ENTRIES_PATH\}\$\{search\}|search/.test(proxy) && !/redirectTo\(nosUrl\(['"`]\/award-entries['"`]\)\)/.test(proxy));
const nav = read('components/nos-chrome/nos-nav.ts') ?? '';
check("nav leaf id 'exhibitors' reads Award Entries and links /award-entries", /id: 'exhibitors',\s*label: 'Award Entries',\s*href: showPath\('\/award-entries'\)/.test(nav));

// 5. no internal reference to the old path outside proxy.ts (comment lines ignored)
const OLD_REF = /['"`]\/(national-show\/)?exhibitors(['"`/?#]|\b)/;
const hits = [];
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (!['node_modules', '.next'].includes(n)) walk(p); continue; }
    if (!/\.(tsx?|json|mjs)$/.test(n) || p === 'proxy.ts') continue;
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (OLD_REF.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) hits.push(`${p}:${i + 1}`); });
  }
};
for (const d of ['app', 'components', 'lib', 'e2e']) walk(d);
if (existsSync('playwright.config.ts') && OLD_REF.test(readFileSync('playwright.config.ts', 'utf8'))) hits.push('playwright.config.ts');
for (const f of ['content/national-show-routes.json', 'scripts/generate-nos-route-manifest.ts']) readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (OLD_REF.test(l)) hits.push(`${f}:${i + 1}`); });
check('no internal path string or href still points at /exhibitors', hits.length === 0, hits.join(', '));
const band = read('components/home/ShowBand.tsx') ?? '';
check("ShowBand CTA links nosUrl('/award-entries')", band.includes("nosUrl('/award-entries')"));

if (failures.length) { console.error(`check-static FAILED (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('check-static pass');
