// A2: static checks. Run from the repo root.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { CROPS, ROUTES } from './_lib.mjs';

/** The text of ONE defineField({...}) call whose own `name:` is `name`, found by balanced parentheses so it can never run across a field boundary or stop early at a nested `})`. */
function defineFieldBlock(src, name) {
  for (let from = src.indexOf('defineField('); from !== -1; from = src.indexOf('defineField(', from + 1)) {
    let depth = 0; let end = -1;
    for (let i = from + 'defineField'.length; i < src.length; i += 1) { const ch = src[i]; if (ch === '(') depth += 1; else if (ch === ')') { depth -= 1; if (depth === 0) { end = i; break; } } }
    if (end === -1) return null;
    const block = src.slice(from, end + 1);
    // the field's own name is the first top-level `name:` after the opening brace, before any nested object
    const own = block.match(/^defineField\(\{\s*(?:[^{}]*?,\s*)*?name:\s*'([^']+)'/);
    if (own && own[1] === name) return block;
  }
  return null;
}

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

// the shared layout: SAOC-owned components/ui/* (pinned API 823308f5) is consumed, never re-implemented or edited
const SHARED_BASE = process.env.NOS_STD_REFSAOC ?? '823308f5';
for (const f of ['components/ui/DocumentLayout.tsx', 'components/ui/DocumentIndex.tsx', 'components/ui/PageHero.tsx', 'lib/hero-facts.ts']) check(`${f} exists (the shared API is merged into the dev branch)`, existsSync(f));
check('components/ui/** and lib/hero-facts.ts are unchanged from the pinned shared API', git(['diff', '--name-only', SHARED_BASE, '--', 'components/ui', 'lib/hero-facts.ts']).trim() === '', git(['diff', '--name-only', SHARED_BASE, '--', 'components/ui', 'lib/hero-facts.ts']).trim());
check('no components/nos/NosDocument.tsx fork of DocumentLayout exists', !existsSync('components/nos/NosDocument.tsx'));
const hero = read('components/nos/NosHero.tsx');
check('NosHero renders facts via normaliseHeroFacts as dl[data-hero-facts] with data-fact-count and [data-hero-fact]', /normaliseHeroFacts/.test(hero) && /data-hero-facts/.test(hero) && /data-fact-count/.test(hero) && /data-hero-fact\b/.test(hero) && /<dl/.test(hero));
const css = `${read('app/(nos)/national-show/nos-structure.css')}\n${read('app/(nos)/national-show/nos-theme.css')}`;
check('the :focus-visible rule in nos-theme.css is wrapped in :where() (specificity fix; the h1 ring itself is #76)', !/\.nos-theme\s+:focus-visible:not\(\.group\)/.test(css) || /:where\(/.test(css));

// IG-G1 (SAOC-approved, additive): conferencePresenter gains optional `country` and `organisation`; neither may carry a required() rule
{
  const src = existsSync('sanity/schemas/documents/conferencePresenter.ts') ? read('sanity/schemas/documents/conferencePresenter.ts') : '';
  for (const name of ['country', 'organisation']) {
    const m = [defineFieldBlock(src, name)];
    check(`conferencePresenter has an optional "${name}" field (IG-G1)`, Boolean(m[0]) && !/required\(\)/.test(m[0]));
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
  const fieldBlock = (name) => defineFieldBlock(ws, name);
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

// WE-G1: /what-to-expect types no admission price; the prices come from the ticket records, and the Cloakroom block, TBC chip and holding note are gone
{
  const we = read('app/(nos)/national-show/what-to-expect/page.tsx');
  check('WE-G1: the what-to-expect page types no Rand price literal (R350, R360, R120 or any R followed by digits)', !/\bR\s?\d{2,}/.test(we.replace(/\/\/.*$/gm, '')));
  check('WE-G1: no Cloakroom block, no ShowHoldingNote and no uppercase-label CTA remain on the page', !/Cloakroom/i.test(we) && !/ShowHoldingNote/.test(we) && !/uppercase/.test(we));
}

// EX-G1: the showExhibitorInfo and showExhibitorStep schemas stay for her future guide (iiii); the page renders none of the builder sections
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
  const ren = JSON.parse(readFileSync('.agent/memory/project/specs/nos-content-standard/goldens/standard.json', 'utf8')).navRenamed;
  const allowedLine = (l) => (l.startsWith('-') && (/descriptor/.test(l) || /^-\s*['"].*['"],?\s*$/.test(l))) || /^[-+]\s*\/\//.test(l) || (l.startsWith('-') && l.includes(dropped)) || (l.startsWith('-') && l.includes(ren.from)) || (l.startsWith('+') && l.includes(ren.to) && !l.includes(ren.from));
  check('NAV-G1 / NL-2: every change to nos-nav.ts against origin/main is the removal of a descriptor (ND-1: all of them), a comment line, or the rename of the nav label to her "Plant Entry/Registration" (no other descriptor, label or href changed)', ch.length >= 1 && ch.every(allowedLine) && ch.filter((l) => l.startsWith('-') && l.includes(dropped)).length === 1, ch.join(' || ').slice(0, 220));
  check('NL-2: nos-nav.ts and the exhibitors page carry "Plant Entry/Registration" and no "Exhibitor entry guide"', [nav, read('app/(nos)/national-show/exhibitors/page.tsx')].every((src) => src.includes(ren.to) && !src.includes(ren.from)));
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

// HM-G1: the home page carries none of the builder copy that had no Drive source
{
  const home = read('app/(nos)/national-show/page.tsx') + read('app/(nos)/page.tsx');
  for (const t of ['Three years in the making', 'Ten judging groups', '100-point', 'Start planning your entry now', 'opens in September 2027', 'honestly marked', "South Africa's triennial orchid competition", "label: 'Cycle'"]) check(`HM-G1: the home source no longer contains "${t}"`, !home.includes(t));
  check('HM-G1: lib/data/show-facts.ts still builds Dates, Host and Venue (Cycle is gone); the home page selects Dates and Venue only', ['Dates', 'Host', 'Venue'].every((l) => read('lib/data/show-facts.ts').includes(l)));
}

// Cycle is out of ShowFacts on every route (NOS Design ruling 2026-10-25, R7): neither the component nor the facts builder may carry the label
{
  const banned = JSON.parse(readFileSync('.agent/memory/project/specs/nos-content-standard/goldens/standard.json', 'utf8')).showFactsLabels.banned;
  for (const f of ['components/nos/ShowFacts.tsx', 'lib/data/show-facts.ts']) { const src = read(f); check(`${f} carries no ${banned.join(' / ')} label`, banned.every((w) => !new RegExp(`['"\`>]${w}\\b`).test(src) && !src.includes(`label: '${w}'`)), banned.filter((w) => src.includes(w)).join(', ')); }
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

// RB-1 (NOS Design, comms.md "HR-1 hero ramp + RB-1 button radius", 2026-10-26): R17 wins, every NOS Button is 10px; exactly ONE --radius-button definition in the NOS CSS, at 10px.
{
  const cssFiles = (d) => (existsSync(d) ? readdirSync(d, { recursive: true }).filter((f) => String(f).endsWith('.css')).map((f) => `${d}/${f}`) : []);
  const nosCss = [...cssFiles('app/(nos)'), ...cssFiles('components/nos'), ...cssFiles('components/nos-chrome')];
  const defs = nosCss.flatMap((f) => read(f).split('\n').map((l, i) => ({ f, i: i + 1, l })).filter((x) => /--radius-button\s*:/.test(x.l)));
  check(`RB-1: exactly one --radius-button definition in the NOS CSS (${defs.map((d) => `${d.f}:${d.i}`).join(', ') || 'none'})`, defs.length === 1);
  check('RB-1: that definition is 10px', defs.length === 1 && /--radius-button\s*:\s*10px\s*;/.test(defs[0].l), defs.map((d) => d.l.trim()).join(' | '));
  check('RB-1: components/nos/Button.tsx cites R17 / 10px, not R2 2px', !/R2[^\n]*2px|2px[^\n]*R2/.test(read('components/nos/Button.tsx')));
}
// HR-1 (same message): on every DS-1 hero at >= 1024 the scrim ramp is exactly the value below; no plate, no crop change. The computed value is gated in gate-standard.
{
  const norm = (t) => t.replace(/\s+/g, '');
  const RAMP = norm('linear-gradient(90deg, rgba(11, 10, 20, 0.92) 0%, rgba(11, 10, 20, 0.88) 38%, rgba(11, 10, 20, 0.45) 56%, rgba(11, 10, 20, 0.12) 76%, rgba(11, 10, 20, 0.04) 100%)');
  const css = ['app/(nos)', 'components/nos'].flatMap((d) => (existsSync(d) ? readdirSync(d, { recursive: true }).filter((f) => String(f).endsWith('.css')).map((f) => read(`${d}/${f}`)) : [])).map(norm).join('\n');
  check('HR-1: the NOS hero CSS carries the exact HR-1 ramp', css.includes(RAMP));
  const HUB = norm('rgba(11, 10, 20, 0.92) 0%, rgba(11, 10, 20, 0.86) calc(min(640px, 50%) + 48px), rgba(11, 10, 20, 0.42) 66%, rgba(11, 10, 20, 0.18) 82%, rgba(11, 10, 20, 0.06) 100%');
  check('HR-1 scope (Rev 44, NOS Design b8c55ad): the NOS hub .nos-hero-scrim keeps its own stops (.92 0%, .86 calc(min(640px,50%)+48px), .42 66%, .18 82%, .06 100%); the DS-1 ramp applies to content heroes only', css.includes(HUB));
}

// Rev 44 / 46c (SAOC asked for the italic preload in OUR branch; they review it in the merge): exactly one new preloaded face, the italic Fraunces at 300, declared in ONE module that only the routes with a theme lede import (/symposium and /about),
// so next/font preloads it for those routes only. NosThemeScope.tsx returns to its origin/main state; components/nos-chrome/fonts.ts (imported by the shared marketing layout) and app/layout.tsx stay untouched. The lede reservation is removed.
{
  const LEDE_SEGMENTS = ['app/(nos)/national-show/symposium/', 'app/(nos)/national-show/about/'];
  const src = ['app', 'components'].flatMap((d) => (existsSync(d) ? readdirSync(d, { recursive: true }).map((f) => `${d}/${f}`).filter((f) => /\.(ts|tsx)$/.test(f)) : []));
  const face = src.filter((f) => /Fraunces-latin-italic/.test(read(f)) && /preload\s*:\s*true/.test(read(f)));
  check(`FONT-1: exactly one module declares a preloaded Fraunces italic face (${face.join(', ') || 'none'})`, face.length === 1);
  const body = face.length ? read(face[0]) : '';
  check('FONT-1: that module has exactly one `preload: true`, one font path (Fraunces-latin-italic.woff2), weight 300, style italic, and mentions neither Karla nor the normal face', (body.match(/preload\s*:\s*true/g) ?? []).length === 1 && (body.match(/path\s*:/g) ?? []).length === 1 && /weight\s*:\s*'300'/.test(body) && /style\s*:\s*'italic'/.test(body) && !/Karla|latin-normal/.test(body));
  const base = face.length ? face[0].replace(/^.*\//, '').replace(/\.(ts|tsx)$/, '') : '\0';
  const importers = src.filter((f) => f !== face[0] && new RegExp(`from\\s+['"][^'"]*/${base}['"]|from\\s+['"]\\./${base}['"]`).test(read(f)));
  check(`FONT-1: the module is imported only from the theme-lede route segments (${importers.join(', ') || 'no importer'}), so no other route preloads it`, importers.length > 0 && importers.every((f) => LEDE_SEGMENTS.some((sg) => f.startsWith(sg))));
  check('FONT-1: components/nos/NosThemeScope.tsx is unchanged from origin/main (the preload moved out of the all-NOS-routes scope)', git(['diff', '--name-only', 'origin/main', '--', 'components/nos/NosThemeScope.tsx']).trim() === '');
  check('FONT-1: components/nos-chrome/fonts.ts is unchanged from origin/main', git(['diff', '--name-only', 'origin/main', '--', 'components/nos-chrome/fonts.ts']).trim() === '');
  check('FONT-1: app/layout.tsx is unchanged from origin/main (no root font change)', git(['diff', '--name-only', 'origin/main', '--', 'app/layout.tsx']).trim() === '');
  // The reservation is matched by SELECTOR, not by text: the unrelated `.nk-fan .nk-name` rule on /tickets legitimately uses 3lh, and rewriting it to dodge a loose regex is not the gate's business.
  const struct = read('app/(nos)/national-show/nos-structure.css') + '\n' + read('app/(nos)/national-show/nos-theme.css');
  const ledeRules = [...struct.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((r) => /nos-hero-lede|data-nos-lede/.test(r[1]));
  check('SY-G1 (Rev 44): no rule on the hero lede selector (.nos-hero-lede, [data-nos-lede]) reserves height with min-height 3lh or calc(3 * 1lh)', !ledeRules.some((r) => /min-height\s*:\s*(3lh|calc\(\s*3\s*\*\s*1lh\s*\))/.test(r[2])), ledeRules.filter((r) => /min-height/.test(r[2])).map((r) => r[1].trim()).join(' | '));
  check('SY-G1 (Rev 44): the "reserving three lines" comment is gone', !/reserving three lines/.test(struct));
}

// ND-1 (NOS Design, root comms.md "ND-1 nav descriptors: remove all 14", 2026-10-26; supersedes the Rev 46d single-descriptor Drive-source test): the manifest `purpose` fields are internal notes, not Lee-Ann's words, so no nav row carries a descriptor.
// Menu rows are labels only, in the existing label style, each at min-height 44; no replacement copy; group headings unchanged. The rendered side (no descriptor element, rows >= 44px, labels identical to nos-nav.ts) is gated in gate-standard (ndNavGate).
{
  const stripJs = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"])\/\/.*$/gm, '$1');
  const nav = stripJs(read('components/nos-chrome/nos-nav.ts'));
  const labelsOf = (src) => [...src.matchAll(/\blabel:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"));
  const ren = JSON.parse(readFileSync('.agent/memory/project/specs/nos-content-standard/goldens/standard.json', 'utf8')).navRenamed;
  let base = ''; try { base = execFileSync('git', ['show', 'origin/main:components/nos-chrome/nos-nav.ts'], { encoding: 'utf8' }); } catch { base = ''; }
  const want = labelsOf(stripJs(base)).map((l) => (l === ren.from ? ren.to : l)); const have = labelsOf(nav);
  check(`ND-1: no entry in nos-nav.ts has a descriptor (${(nav.match(/\bdescriptor\s*:/g) ?? []).length} left)`, !/\bdescriptor\s*:/.test(nav));
  check(`ND-1: the nav labels are unchanged from origin/main apart from the NL-2 rename, in the same order (${have.length} labels, want ${want.length})`, want.length > 0 && JSON.stringify(have) === JSON.stringify(want));
  const stripCss = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  const nosChrome = existsSync('components/nos-chrome') ? readdirSync('components/nos-chrome').filter((f) => /\.(ts|tsx|css)$/.test(f) && f !== 'nos-nav.ts') : [];
  const readers = nosChrome.filter((f) => /\bdescriptor\b|nh-desc/.test(f.endsWith('.css') ? stripCss(read(`components/nos-chrome/${f}`)) : stripJs(read(`components/nos-chrome/${f}`))));
  check(`ND-1: nothing in components/nos-chrome still reads a descriptor or styles .nh-desc (${readers.join(', ') || 'none'}; the shared SAOC type in components/chrome/nav-config.ts is out of scope)`, readers.length === 0);
  const others = ['components/nos', 'app/(nos)', 'lib'].flatMap((d) => (existsSync(d) ? readdirSync(d, { recursive: true }).map((f) => `${d}/${f}`).filter((f) => /\.(ts|tsx)$/.test(f)) : [])).filter((f) => /\bnavLeaf\b|NOS_NAV[A-Za-z]*\b/.test(read(f)) && /\.descriptor\b/.test(stripJs(read(f))));
  check(`ND-1: no sub-nav, show index, sitemap or page reads a nav descriptor (${others.join(', ') || 'none'})`, others.length === 0);
}

if (fails.length) { console.error(`nos-content-standard static FAILED:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('nos-content-standard static pass');
