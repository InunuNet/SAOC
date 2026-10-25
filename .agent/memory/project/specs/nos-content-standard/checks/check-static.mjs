// A2: static checks. Run from the repo root.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { CROPS, ROUTES } from './_lib.mjs';

const fails = [];
const check = (name, ok, detail = '') => { if (!ok) fails.push(`${name}${detail ? `: ${detail}` : ''}`); };
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const git = (a) => { try { return execFileSync('git', a, { encoding: 'utf8' }); } catch { return ''; } };

/** JPEG width and height from the first SOF marker. */
function jpegSize(p) {
  const b = readFileSync(p);
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
function findPages(seg) {
  const out = [];
  const walk = (dir, depth) => {
    if (!existsSync(dir) || depth > 4) return;
    for (const e of readdirSync(dir)) {
      const p = `${dir}/${e}`;
      if (!statSync(p).isDirectory()) continue;
      if (e === seg && existsSync(`${p}/page.tsx`)) out.push(`${p}/page.tsx`);
      walk(p, depth + 1);
    }
  };
  walk('app/(nos)', 0); walk('app/(shared)', 0);
  return out;
}

// the shared layout: SAOC-owned components/ui/* (pinned API 72f75151) is consumed, never re-implemented or edited
const SHARED_BASE = process.env.NOS_STD_REFSAOC ?? '72f75151';
for (const f of ['components/ui/DocumentLayout.tsx', 'components/ui/DocumentIndex.tsx', 'components/ui/PageHero.tsx', 'lib/hero-facts.ts']) check(`${f} exists (the shared API is merged into the dev branch)`, existsSync(f));
check('components/ui/** and lib/hero-facts.ts are unchanged from the pinned shared API', git(['diff', '--name-only', SHARED_BASE, '--', 'components/ui', 'lib/hero-facts.ts']).trim() === '', git(['diff', '--name-only', SHARED_BASE, '--', 'components/ui', 'lib/hero-facts.ts']).trim());
check('no components/nos/NosDocument.tsx fork of DocumentLayout exists', !existsSync('components/nos/NosDocument.tsx'));
const hero = read('components/nos/NosHero.tsx');
check('NosHero renders facts via normaliseHeroFacts as dl[data-hero-facts] with data-fact-count and [data-hero-fact]', /normaliseHeroFacts/.test(hero) && /data-hero-facts/.test(hero) && /data-fact-count/.test(hero) && /data-hero-fact\b/.test(hero) && /<dl/.test(hero));
const css = `${read('app/(nos)/national-show/nos-structure.css')}\n${read('app/(nos)/national-show/nos-theme.css')}`;
check('the :focus-visible rule in nos-theme.css is wrapped in :where() (specificity fix; the h1 ring itself is #76)', !/\.nos-theme\s+:focus-visible:not\(\.group\)/.test(css) || /:where\(/.test(css));
const REF76 = process.env.NOS_STD_REF76 ?? 'feat/nos-pagehero';
let has76 = false; try { execFileSync('git', ['merge-base', '--is-ancestor', REF76, 'HEAD']); has76 = true; } catch { has76 = false; }
const focuses = /focus\(/.test(read('components/nos/NosRouteScroll.tsx')) || /focus\(/.test(hero);
if (!has76 && !focuses) console.log(`note: focus management is not asserted yet; #76's ring/focus commits (${REF76}) are not merged into this branch. It becomes a hard check the moment ${REF76} is an ancestor of HEAD.`);
check('focus management kept (NosRouteScroll or equivalent still focuses the h1); required once #76 is merged', focuses || !has76);

// IG-G1 (SAOC-approved, additive): conferencePresenter gains optional `country` and `organisation`; neither may carry a required() rule
{
  const src = existsSync('sanity/schemas/documents/conferencePresenter.ts') ? read('sanity/schemas/documents/conferencePresenter.ts') : '';
  for (const name of ['country', 'organisation']) {
    const m = src.match(new RegExp(`defineField\\(\\{[^]*?name:\\s*'${name}'[^]*?\\}\\)`));
    check(`conferencePresenter has an optional "${name}" field (IG-G1)`, Boolean(m) && !/required\(\)/.test(m[0]));
  }
}

// IG-G1: /international-guests renders country and organisation only when present, with no fallback string, and carries no demo values
{
  const dirs = ['app/(nos)/national-show/international-guests'];
  const files = [];
  const walkIg = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const p = `${d}/${e}`; if (statSync(p).isDirectory()) walkIg(p); else if (/\.tsx?$/.test(e)) files.push(p); } };
  for (const d of dirs) walkIg(d);
  for (const d of ['components/show/nos', 'components/nos']) { if (existsSync(d)) for (const e of readdirSync(d)) if (/guest|presenter|profile/i.test(e) && /\.tsx?$/.test(e)) files.push(`${d}/${e}`); }
  const src = files.map((f) => read(f)).join('\n');
  check('IG-G1: the international-guests page and its profile component exist', files.length > 0);
  check('IG-G1: no ABSENCE_STATEMENT or RealEmptyListing on /international-guests (zero guests = hero and sub-nav only)', !/ABSENCE_STATEMENT|RealEmptyListing/.test(src));
  check('IG-G1: no demo values from the design shots (The Exotic Plant Company, data-demo)', !/The Exotic Plant Company|data-demo/.test(src));
  for (const f of ['country', 'organisation']) {
    check(`IG-G1: "${f}" has no fallback string (no ?? or || after it)`, !new RegExp(`\\b${f}\\s*(\\?\\?|\\|\\|)`).test(src));
    check(`IG-G1: "${f}" renders conditionally (&& or ternary guard)`, new RegExp(`\\b${f}\\s*(&&|\\?[^?.])`).test(src) || new RegExp(`(&&|\\?)\\s*[\\w.]*\\b${f}\\b`).test(src));
  }
  check('IG-G1: the listing rule filters on a country that is set and is not South Africa', /South Africa/.test(src) && /country/.test(src));
}

// SY-G1: /symposium shows no placeholder sections, and its date, time and venue come from the CMS ticket, never hard-coded in the page
{
  const sy = read('app/(nos)/national-show/symposium/page.tsx');
  const syJson = read('content/show-pages/06-saoc-symposium.json');
  check('SY-G1: neither the symposium page nor content/show-pages/06-saoc-symposium.json has an "About the Symposium" / "Attending" section or PLACEHOLDER COPY chip', !/About the Symposium|>\s*Attending\s*<|"heading": "Attending"|PLACEHOLDER COPY/.test(sy + syJson));
  check('SY-G1: the symposium page does not hard-code its date or hours (24 September, 9.00 to 17.00)', !/24 September|9\.00 to 17\.00|9h00/.test(sy));
}

// WO-G1 + the Crous name rule: no placeholder sections on /wosa-conference, and no literal Crous spelling anywhere in the source (the name renders from the CMS record; her documents outrank it, so the record is fixed, never mapped in code)
{
  const wo = read('app/(nos)/national-show/wosa-conference/page.tsx') + '\n' + read('content/show-pages/07-wosa-conference.json');
  check('WO-G1: no "About the Conference", "Attending" or "About WOSA" section and no PLACEHOLDER COPY chip on /wosa-conference', !/About the Conference|"heading": "Attending"|>\s*Attending\s*<|About WOSA|PLACEHOLDER COPY/.test(wo));
  const hits = [];
  const scan = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { if (e === 'node_modules' || e.startsWith('.')) continue; const p = `${d}/${e}`; if (statSync(p).isDirectory()) scan(p); else if (/\.(tsx?|mjs|json)$/.test(e) && /Hild[ae]r?gard/.test(read(p))) hits.push(p); } };
  for (const d of ['app', 'components', 'lib', 'sanity']) scan(d);
  check('no literal "Hildagard"/"Hildegard" spelling anywhere in app, components, lib or sanity (the name comes from the CMS record)', hits.length === 0, hits.join(', '));
}

// the presenter order list is keyed by the CMS _id, never by name
{
  const po = read('lib/view-models/presenter-order.ts');
  const list = po.match(/PRESENTER_FALLBACK_SEQUENCE[^=]*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  const entries = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  check('presenter-order.ts: the fallback list is non-empty and keyed by _id (no entry contains a space or looks like a name)', entries.length > 0 && entries.every((e) => !/\s/.test(e) && !/^[A-Z][a-z]+$/.test(e)), entries.join(' | '));
  check('presenter-order.ts: ranks and sorts by _id, not by name (no `.name` in the fallback rank)', /\b_id\b|\.id\b/.test(po) && !/fallbackRank\([^)]*name/.test(po));
}

// SY-G1 / WO-G1: the venue renders from the CMS ticket only: never hard-coded in the pages, never as the FAQ phrase (open owner item cccc: "The Hangar, Stellenbosch Flying Club" vs "Hangar 25, Orca Aero Solutions")
{
  const pages = ['symposium', 'wosa-conference'].map((s) => read(`app/(nos)/national-show/${s}/page.tsx`)).join('\n');
  check('SY-G1/WO-G1: no venue string is hard-coded in the symposium or wosa-conference page (Hangar, Orca Aero, Flying Club, "same venue as")', !/Hangar|Orca Aero|Flying Club|same venue as/i.test(pages));
}

// WK-G1: /workshops drops the builder status box, SESSIONS_NOTE, the lede and the "Programme" heading
{
  const wk = read('app/(nos)/national-show/workshops/page.tsx');
  check('WK-G1: the workshops page has no SESSIONS_NOTE, status chip ("To be confirmed by the show committee"), Sunset Cocktails card or builder lede', !/SESSIONS_NOTE|To be confirmed by the show committee|Book Sunset Cocktails|ShowStatusLine|ShowStatusFoot/.test(wk));
  check('WK-G1: the workshops page has no "Programme" h2 (her doc question) and its metadata drops the builder sentence', !/>\s*Programme\s*</.test(wk) && !/title:[^\n]*Sunset|description:[^\n]*Sunset/.test(wk));
}

// WK-G1: the shared route-hero entry for /workshops has no lede and the title is "Workshops" (origin/main has the builder lede and "Workshops & Field Trips")
{
  const rh = read('components/nos/nos-route-heroes.ts');
  const ent = rh.match(/workshops:\s*\{[^}]*\}/)?.[0] ?? '';
  check('WK-G1: NOS_ROUTE_HEROES.workshops has title "Workshops" and no lede', /title:\s*['"]Workshops['"]/.test(ent) && !/lede\s*:/.test(ent), ent.replace(/\s+/g, ' ').slice(0, 140));
}

// WK-G1 data: workshopSession gains OPTIONAL level / duration / included / bring (SAOC-approved, additive); NO places fields. The places text reads the ticket's per-session value and the pool remaining.
{
  const ws = existsSync('sanity/schemas/documents/workshopSession.ts') ? read('sanity/schemas/documents/workshopSession.ts') : '';
  const fieldBlock = (name) => ws.match(new RegExp(`defineField\\(\\{[^]*?name:\\s*'${name}'[^]*?\\}\\)`))?.[0] ?? null;
  for (const f of ['level', 'duration', 'included', 'bring']) { const b = fieldBlock(f); check(`workshopSession has an optional "${f}" field (WK-G1)`, Boolean(b) && !/required\(\)/.test(b)); }
  const lvl = fieldBlock('level') ?? '';
  check('workshopSession.level is a string list of Beginner, Intermediate and Advanced', /type:\s*'string'/.test(lvl) && ['Beginner', 'Intermediate', 'Advanced'].every((v) => lvl.includes(v)));
  check('workshopSession has no places / capacity / remaining / total field (the total is the ticket\'s per-session value, the remainder is lib/data/pool-remaining.ts)', !/name:\s*'(places|capacity|remaining|total|spaces|seats)'/.test(ws));
  const recSrc = [];
  const walkWk = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const p = `${d}/${e}`; if (statSync(p).isDirectory()) walkWk(p); else if (/\.tsx?$/.test(e)) recSrc.push(p); } };
  walkWk('app/(nos)/national-show/workshops');
  for (const d of ['components/nos', 'components/show']) { if (existsSync(d)) for (const e of readdirSync(d)) if (/workshop/i.test(e) && /\.tsx?$/.test(e)) recSrc.push(`${d}/${e}`); }
  const rs = recSrc.map((f) => read(f)).join('\n');
  if (/data-places/.test(rs)) {
    check('WK-G1: the places text reads getPoolRemaining (lib/data/pool-remaining) and the ticket\'s capacity, never a hard-coded number', /getPoolRemaining|pool-remaining/.test(rs) && /capacity/.test(rs) && !/['"`]\d+ of \d+ places left['"`]/.test(rs) && !/\b\d+\s+of\s+\d+\s+places/.test(rs));
  } else console.log('note: no [data-places] in the workshop sources yet; the places-source check is required once it appears (records render nothing until SAOC enters them)');
}

// banned strings (route-table bannedStrings): the builder WOSA theme line must not exist in source at all
{
  const hits = [];
  const needle = 'With Wild Orchids of Southern Africa';
  const scanB = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { if (e === 'node_modules' || e.startsWith('.')) continue; const p = `${d}/${e}`; if (statSync(p).isDirectory()) scanB(p); else if (/\.(tsx?|json)$/.test(e) && read(p).includes(needle)) hits.push(p); } };
  for (const d of ['app', 'components', 'lib', 'content', 'sanity']) scanB(d);
  check(`CR-G1: the builder WOSA theme line "${needle}" is not in the source (it misnames the organisation)`, hits.length === 0, hits.join(', '));
}

// SAOC ruling: wosa.theme is dropped; the WOSA card shows no theme line until she supplies one (the org name is NOT gated: both "Wild Orchids of Southern Africa" and "Wild Orchids Southern Africa" are her spellings)
{
  const tp = read('lib/data/ticket-presentation.ts'); const i = tp.indexOf("id: 'wosa'"); const j = i < 0 ? -1 : tp.indexOf('slugs:', i);
  const blk = i >= 0 && j > i ? tp.slice(i, j) : '';
  check("ticket-presentation.ts: the 'wosa' product has no theme line", blk.length > 0 && !/\btheme\s*:\s*['"`]/.test(blk), blk.match(/theme[^\n]*/)?.[0] ?? 'wosa block not found');
}

// ticket-presentation.ts: the symposium and WOSA when/meta stay as sourced (24 and 25 September, 9am to 5pm)
{
  const tp = read('lib/data/ticket-presentation.ts');
  const blockOf = (id) => { const i = tp.indexOf(`id: '${id}'`); const j = i < 0 ? -1 : tp.indexOf('slugs:', i); return i >= 0 && j > i ? tp.slice(i, j) : ''; };
  const sy = blockOf('symposium'); const wo = blockOf('wosa');
  check("ticket-presentation.ts: symposium when 'Friday 24 September' and meta '9am to 5pm' are unchanged", /when:\s*'Friday 24 September'/.test(sy) && /meta:\s*'9am to 5pm'/.test(sy), sy.match(/when[^\n]*|meta[^\n]*/g)?.join(' ') ?? 'block not found');
  check("ticket-presentation.ts: WOSA when 'Saturday 25 September' and meta '9am to 5pm' are unchanged", /when:\s*'Saturday 25 September'/.test(wo) && /meta:\s*'9am to 5pm'/.test(wo), wo.match(/when[^\n]*|meta[^\n]*/g)?.join(' ') ?? 'block not found');
}

// AB-G1: /about renders About 2.1 v1.2 verbatim (straight quotes), cites v1.2 rather than the 09-09 snapshot, and drops the facts aside and "Cycle"
{
  const ab = read('app/(nos)/national-show/about/page.tsx');
  check('AB-G1: the about page does not cite the 09-09 snapshot (it renders v1.2)', !/09-09|about-national-show_2026/.test(ab));
  check('AB-G1: the about page has no "Cycle" / "Triennial" facts label and no smartened quote in its copy', !/Cycle|Triennial:/.test(ab) && !/[\u2018\u2019\u201c\u201d]/.test(ab));
}

// ShowFacts is shared: whatever /about needs, the component must keep rendering Dates / Host / Venue / Cycle for every other route, and no existing label line may be removed
{
  const sf = read('components/nos/ShowFacts.tsx');
  let removed = '';
  try { removed = execFileSync('git', ['diff', 'origin/main', '--', 'components/nos/ShowFacts.tsx'], { encoding: 'utf8' }).split('\n').filter((l) => /^-[^-]/.test(l)).join('\n'); } catch { removed = ''; }
  check('ShowFacts.tsx still renders Dates / Host / Venue / Cycle (the shared rows other routes rely on)', ['Dates', 'Host', 'Venue', 'Cycle'].every((l) => sf.includes(l)));
  check('ShowFacts.tsx: the diff against origin/main removes none of the Dates / Host / Venue / Cycle labels', !/Dates|Host|Venue|Cycle/.test(removed), removed.slice(0, 120));
}

// WE-G1: /what-to-expect types no admission price; the prices come from the ticket records, and the Cloakroom block, TBC chip and holding note are gone
{
  const we = read('app/(nos)/national-show/what-to-expect/page.tsx');
  check('WE-G1: the what-to-expect page types no Rand price literal (R350, R360, R120 or any R followed by digits)', !/\bR\s?\d{2,}/.test(we.replace(/\/\/.*$/gm, '')));
  check('WE-G1: no Cloakroom block, no ShowHoldingNote and no uppercase-label CTA remain on the page', !/Cloakroom/i.test(we) && !/ShowHoldingNote/.test(we) && !/uppercase/.test(we));
}

// EX-G1: the Exhibitor entry guide schema stays for her future guide (iiii); the page renders none of the builder sections
{
  const ex = read('app/(nos)/national-show/exhibitors/page.tsx');
  check('EX-G1: the Sanity schemas showExhibitorInfo and showExhibitorStep still exist', existsSync('sanity/schemas/documents/showExhibitorInfo.ts') && existsSync('sanity/schemas/documents/showExhibitorStep.ts'));
  check('EX-G1: the exhibitors page no longer imports the jump chips or the builder sections ("Researched international show practice", "Key dates for exhibitors")', !/ShowJumpChips/.test(ex) && !/Researched international show practice/.test(ex) && !/Key dates for exhibitors/.test(ex));
}

// NAV-G1: the unsourced Workshops descriptor is dropped from nos-nav.ts and nothing else in that file changes
{
  const dropped = JSON.parse(readFileSync('.agent/memory/project/specs/nos-content-standard/goldens/standard.json', 'utf8')).navDropped;
  const nav = read('components/nos-chrome/nos-nav.ts');
  let ch = []; try { ch = execFileSync('git', ['diff', '-U0', 'origin/main', '--', 'components/nos-chrome/nos-nav.ts'], { encoding: 'utf8' }).split('\n').filter((l) => /^[-+][^-+]/.test(l)); } catch { ch = []; }
  check('NAV-G1: nos-nav.ts no longer carries the Workshops descriptor', !nav.includes(dropped));
  { const pre = JSON.parse(readFileSync('.agent/memory/project/specs/nos-content-standard/goldens/standard.json', 'utf8')).navDroppedPrefix; for (const f of ['components/nos/nos-route-heroes.ts', 'app/(nos)/national-show/workshops/page.tsx']) check(`NAV-G1: ${f} carries no "${pre}" line (lede or metadata description)`, !read(f).includes(pre)); }
  check('NAV-G1: the only change to nos-nav.ts against origin/main is the removal of that one descriptor line (no other descriptor, label or href changed)', ch.length === 1 && ch[0].startsWith('-') && ch[0].includes(dropped), ch.join(' || ').slice(0, 200));
}

// CT-G1: the contact form's behaviour is out of scope: the API, its validation, the email path and the form's own field, validation and submit lines are unchanged
{
  const gitShow = (p) => { try { return execFileSync('git', ['show', `origin/main:${p}`], { encoding: 'utf8' }); } catch { return ''; } };
  const behave = (src) => src.split('\n').map((l) => l.trim()).filter((l) => /name="|fetch\(|\/api\/contact|method[:=]|JSON\.stringify|body:|errors\.|\.test\(|trim\(\)|_hp|noValidate|minLength|required/.test(l)).sort().join('\n');
  check('CT-G1: ContactForm.tsx keeps every field-name, fetch, validation and honeypot line of origin/main (only presentation lines may change)', behave(read('components/contact/ContactForm.tsx')) === behave(gitShow('components/contact/ContactForm.tsx')));
  let touched = ''; try { touched = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'app/api/contact', 'lib/contact-input.ts', 'lib/contact-submission.ts', 'lib/contact-submission-admin-notice.ts', 'emails'], { encoding: 'utf8' }).trim(); } catch { touched = ''; }
  check('CT-G1: the contact API route, its input validation, the submission writers and the contact emails are untouched against origin/main', touched === '', touched.slice(0, 160));
  const ct = read('app/(nos)/national-show/contact/page.tsx') + read('components/contact/NosContactAside.tsx') + read('components/nos/ShowContactDetails.tsx');
  check('CT-G1: no NOT CONFIRMED badge and no "[Introduction to be supplied" placeholder remain in the contact page or its components', !/NOT CONFIRMED/i.test(ct) && !/Introduction to be supplied/i.test(ct));
}

// AR-1: the public withhold (r64) is unchanged; the archive page only changes its render
{
  const gitShow = (p) => { try { return execFileSync('git', ['show', `origin/main:${p}`], { encoding: 'utf8' }); } catch { return ''; } };
  const pg = 'app/(nos)/national-show/archive/page.tsx';
  const cnt = (src, re) => (src.match(re) ?? []).length;
  check('AR-1: lib/data/past-shows-public.ts and lib/data/past-shows.ts (the r64 visibility rule) are identical to origin/main', read('lib/data/past-shows-public.ts') === gitShow('lib/data/past-shows-public.ts') && read('lib/data/past-shows.ts') === gitShow('lib/data/past-shows.ts'));
  check('AR-1: the archive page keeps every showPastShowsRoute() guard and every notFound() call of origin/main (generateMetadata and the page)', cnt(read(pg), /showPastShowsRoute\(\)/g) === cnt(gitShow(pg), /showPastShowsRoute\(\)/g) && cnt(read(pg), /notFound\(\)/g) >= cnt(gitShow(pg), /notFound\(\)/g) && cnt(gitShow(pg), /notFound\(\)/g) >= 2);
  check('AR-1: the archive page drops the EditionCard grid, the stat chips and the "Looking for the 19th National Show?" band', !/EditionCard/.test(read(pg)) && !/Looking for the 19th National Show/.test(read(pg)));
}

// CR-G1: the conferences page drops the builder lede and the "Programme" heading
{
  const cr = read('app/(nos)/national-show/conferences/page.tsx');
  check('CR-G1: the conferences page has no builder lede ("Register for the National Orchid Show Symposium or the WOSA Conference.") and no "Programme" heading', !/Register for the National Orchid Show Symposium or the WOSA Conference/.test(cr) && !/>\s*Programme\s*</.test(cr) && !/heading=["']Programme["']|title=["']Programme["']/.test(cr));
}

// every route renders through DocumentLayout; no route re-implements a chip row
for (const r of ROUTES.filter((x) => x.kind === 'document' || x.kind === 'faq')) {
  const seg = r.nos.split('/').filter(Boolean).pop();
  const pages = findPages(seg);
  check(`${r.nos}: a page.tsx exists under app/(nos) or app/(shared)`, pages.length > 0);
  check(`${r.nos}: renders through DocumentLayout (directly or via a component that does)`, pages.some((p) => /DocumentLayout/.test(read(p)) || /from ['"]@\/components\/(nos|show)\//.test(read(p))), pages.join(','));
  check(`${r.nos}: no ShowJumpChips on the page`, !pages.some((p) => /ShowJumpChips/.test(read(p))));
}

// crops: the files the table names exist at the exact proposal size
for (const code of new Set(ROUTES.map((r) => r.photo).filter(Boolean))) {
  const crop = CROPS.find((k) => k.crop === code);
  const file = `public/images/nos-hero-${code}.jpg`;
  check(`${file} exists`, existsSync(file));
  if (existsSync(file) && crop) { const s = jpegSize(file); check(`${file} is ${crop.width}x${crop.height} (the proposal rect)`, s && s.w === crop.width && s.h === crop.height, JSON.stringify(s)); }
}

// the FAQ and chips
const list = read('components/show/ShowFaqList.tsx');
check('ShowFaqList no longer uses ShowJumpChips and has no chip row', !/ShowJumpChips/.test(list) && !/data-faq-chips/.test(list));
check('ShowFaqList keeps native details/summary and adds data-faq-card, no nos-label eyebrow, no legend chip', /<details/.test(list) && /<summary/.test(list) && /data-faq-card/.test(list) && !/nos-label/.test(list) && !/To be confirmed by the show committee/i.test(list));
check('FAQ, exhibitors and media-kit render no ShowJumpChips anywhere in app/(nos)', !/ShowJumpChips/.test((() => { try { return execFileSync('git', ['grep', '-l', 'ShowJumpChips', '--', 'app/(nos)'], { encoding: 'utf8' }).toString(); } catch (e) { if (e.status === 1) return ''; throw e; } })()), 'git grep');
const idx = read('components/show/FaqIndex.tsx');
check('FaqIndex (if it still exists) does not use <details>; the index is DocumentLayout\'s `index` prop', !/<details/.test(idx));
check('StatusMarker.tsx untouched', git(['diff', '--name-only', 'origin/main', '--', 'components/show/_shared/StatusMarker.tsx']).trim() === '');

// added CSS: the craft-floor bans and the token rule
const added = git(['diff', '-U0', 'origin/main', '--', 'app/(nos)/national-show/nos-structure.css', 'app/(nos)/national-show/nos-theme.css']).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
const SANCTIONED_VARS = ['--doc-aside-top', '--doc-index-top', '--doc-scroll-margin']; // the three .nos-theme values SAOC's shared CSS reads
const badVar = added.find((l) => { const m = l.match(/^\s*(--[a-z0-9-]+)\s*:/); return m && !SANCTIONED_VARS.includes(m[1]); });
check('added CSS declares no custom property beyond --doc-aside-top, --doc-index-top and --doc-scroll-margin', !badVar, badVar);
check('added CSS has no raw hex', !added.some((l) => /#[0-9a-fA-F]{3,8}\b/.test(l)), added.find((l) => /#[0-9a-fA-F]{3,8}\b/.test(l)));
check('added CSS adds no @font-face or literal font-family', !added.some((l) => /@font-face|font-family\s*:\s*(?![\s]|var\()/.test(l)));
check('added CSS has no coloured side border above 1px', !added.some((l) => /border-(left|right|inline-start|inline-end)\s*:\s*([2-9]|[1-9]\d)/.test(l)));
check('added CSS has no box-shadow with a zero blur', !added.some((l) => /box-shadow\s*:\s*-?\d+px\s+-?\d+px\s+0(px)?\s/.test(l)));
check('added CSS has no border-radius >= 999 except on the hero eyebrow selector', !added.some((l) => /border-radius\s*:\s*(999|9999|50%|100vw|50vw)/.test(l) && !/eyebrow/.test(l)));
check('added CSS has no dashed 2px rail', !added.some((l) => /border[a-z-]*\s*:\s*[2-9]px\s+dashed/.test(l)));

if (fails.length) { console.error(`nos-content-standard static FAILED:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('nos-content-standard static pass');
