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
  const dirs = ['app/(marketing)/national-show/international-guests', 'app/(nos)/national-show/international-guests', 'app/(nos)/international-guests'];
  const files = [];
  const walkIg = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const p = `${d}/${e}`; if (statSync(p).isDirectory()) walkIg(p); else if (/\.tsx?$/.test(e)) files.push(p); } };
  for (const d of dirs) walkIg(d);
  for (const d of ['components/show/nos', 'components/nos']) { if (existsSync(d)) for (const e of readdirSync(d)) if (/guest|presenter|profile/i.test(e) && /\.tsx?$/.test(e)) files.push(`${d}/${e}`); }
  const src = files.map((f) => read(f)).join('\n');
  check('IG-G1: the international-guests page and its profile component exist', files.length > 0);
  check('IG-G1: no ABSENCE_STATEMENT or RealEmptyListing on /international-guests (zero guests = hero and sub-nav only)', !/ABSENCE_STATEMENT|RealEmptyListing/.test(src));
  check('IG-G1: no demo values from the design shots (Ten Shin Gardens, The Exotic Plant Company, data-demo)', !/Ten Shin Gardens|The Exotic Plant Company|data-demo/.test(src));
  for (const f of ['country', 'organisation']) {
    check(`IG-G1: "${f}" has no fallback string (no ?? or || after it)`, !new RegExp(`\\b${f}\\s*(\\?\\?|\\|\\|)`).test(src));
    check(`IG-G1: "${f}" renders conditionally (&& or ternary guard)`, new RegExp(`\\b${f}\\s*(&&|\\?[^?.])`).test(src) || new RegExp(`(&&|\\?)\\s*[\\w.]*\\b${f}\\b`).test(src));
  }
  check('IG-G1: the listing rule filters on a country that is set and is not South Africa', /South Africa/.test(src) && /country/.test(src));
}

// SY-G1: /symposium shows no placeholder sections, and its date, time and venue come from the CMS ticket, never hard-coded in the page
{
  const sy = read('app/(marketing)/national-show/symposium/page.tsx') + '\n' + read('app/(nos)/national-show/symposium/page.tsx');
  const syJson = read('content/show-pages/06-saoc-symposium.json');
  check('SY-G1: neither the symposium page nor content/show-pages/06-saoc-symposium.json has an "About the Symposium" / "Attending" section or PLACEHOLDER COPY chip', !/About the Symposium|>\s*Attending\s*<|"heading": "Attending"|PLACEHOLDER COPY/.test(sy + syJson));
  check('SY-G1: the symposium page does not hard-code its date or hours (24 September, 9.00 to 17.00)', !/24 September|9\.00 to 17\.00|9h00/.test(sy));
}

// WO-G1 + the Crous name rule: no placeholder sections on /wosa-conference, and no literal Crous spelling anywhere in the source (the name renders from the CMS record; her documents outrank it, so the record is fixed, never mapped in code)
{
  const wo = read('app/(marketing)/national-show/wosa-conference/page.tsx') + '\n' + read('app/(nos)/national-show/wosa-conference/page.tsx') + '\n' + read('content/show-pages/07-wosa-conference.json');
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
  const pages = ['symposium', 'wosa-conference'].map((s) => read(`app/(marketing)/national-show/${s}/page.tsx`) + read(`app/(nos)/national-show/${s}/page.tsx`)).join('\n');
  check('SY-G1/WO-G1: no venue string is hard-coded in the symposium or wosa-conference page (Hangar, Orca Aero, Flying Club, "same venue as")', !/Hangar|Orca Aero|Flying Club|same venue as/i.test(pages));
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
