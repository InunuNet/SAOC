// A2: static proof of the Award Entries terminology change. Run from the repo root.
//   1. every award string is a verbatim substring of Brad's relayed thread (no invented copy);
//   2. every audit row with action "change" no longer carries its old source text and carries its new one;
//   3. every class-b "keep" row still carries its text (vendor and stand wording survives);
//   4. the exhibitors page source has the title, both sections, both definition lines, the marker, the data hooks and no class-a "exhibitor";
//   5. the URL path and nav leaf are unchanged (no route rename).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SPEC = '.agent/memory/project/specs/nos-award-entries';
const audit = JSON.parse(readFileSync(`${SPEC}/goldens/exhibitor-audit.json`, 'utf8')).rows;
const copy = JSON.parse(readFileSync(`${SPEC}/goldens/award-copy.json`, 'utf8'));
const thread = readFileSync(`${SPEC}/goldens/source-council-thread.md`, 'utf8');
const PAGE = 'app/(nos)/national-show/exhibitors/page.tsx';
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null);

// 1. provenance
for (const s of copy.sections) {
  check(`heading "${s.heading}" is in Brad's thread`, thread.includes(s.heading));
  check(`definition for "${s.heading}" is verbatim in Brad's thread`, thread.includes(s.definition));
}
check('page title "Award Entries" is in Brad\'s thread', thread.includes(copy.pageTitle));

// 2 and 3. audit rows
for (const r of audit) {
  if (r.action !== 'change' && r.action !== 'keep') continue;
  const src = read(r.file);
  check(`${r.id}: ${r.file} exists`, src !== null);
  if (src === null) continue;
  if (r.action === 'change') {
    check(`${r.id}: old text gone from ${r.file}:${r.line}`, !src.includes(r.current), JSON.stringify(r.current));
    check(`${r.id}: new text present in ${r.file}`, src.includes(r.new), JSON.stringify(r.new));
  } else {
    check(`${r.id}: class-b text kept in ${r.file}`, src.includes(r.current), JSON.stringify(r.current));
  }
}

// 4. the page
const page = read(PAGE) ?? '';
check('PAGE_TITLE is Award Entries', /const PAGE_TITLE = 'Award Entries';/.test(page));
for (const s of copy.sections) {
  check(`page has heading "${s.heading}"`, page.includes(`>${s.heading}<`) || page.includes(`'${s.heading}'`) || page.includes(`"${s.heading}"`));
  check(`page has the ${s.awardType} definition line verbatim`, page.includes(s.definition));
  check(`page has data-award-type="${s.awardType}"`, page.includes(`data-award-type="${s.awardType}"`) || page.includes(`'data-award-type': '${s.awardType}'`) || page.includes(`awardType: '${s.awardType}'`));
}
check('page carries the awaiting-committee-copy marker label', page.includes(copy.markerLabel));
check('page uses the existing ExhibitorStatusBadge, not a new marker component', /ExhibitorStatusBadge/.test(page));
const noComments = page.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/throw new Error/.test(l)).join('\n');
const scrubbed = noComments.replace(/\/national-show\/exhibitors/g, '').replace(/ExhibitorEntryGuidePage|ExhibitorStatusBadge/g, '').replace(/Display Exhibitors?/g, '');
const stray = scrubbed.match(/.{0,40}exhibitor.{0,40}/gi);
check('page has no class-a "exhibitor" wording left', !stray, stray ? stray.join(' | ') : '');
check('only the two sections carry the award type hooks (no third type)', (page.match(/data-award-type=/g) ?? []).length + (page.match(/awardType:/g) ?? []).length >= 2 && !/data-award-type="(?!national-show"|saoc")/.test(page));

// 5. no route rename
check('exhibitors route directory still holds page.tsx', existsSync(PAGE));
const awardDirs = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (/award/i.test(n)) awardDirs.push(p); walk(p); } } };
walk('app');
check('no new award* route directory under app/', awardDirs.length === 0, awardDirs.join(', '));
const nav = read('components/nos-chrome/nos-nav.ts') ?? '';
check("nav leaf id 'exhibitors' keeps href showPath('/exhibitors')", /id: 'exhibitors',\s*label: 'Award Entries',\s*href: showPath\('\/exhibitors'\)/.test(nav));
const band = read('components/home/ShowBand.tsx') ?? '';
check("ShowBand CTA still links nosUrl('/exhibitors')", band.includes("nosUrl('/exhibitors')"));

if (failures.length) { console.error(`check-static FAILED (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('check-static pass');
