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

// the shared layout: SAOC-owned components/ui/* (pinned API b2cff780) is consumed, never re-implemented or edited
const SHARED_BASE = 'b2cff780';
for (const f of ['components/ui/DocumentLayout.tsx', 'components/ui/DocumentIndex.tsx', 'components/ui/PageHero.tsx', 'lib/hero-facts.ts']) check(`${f} exists (the shared API is merged into the dev branch)`, existsSync(f));
check('components/ui/** and lib/hero-facts.ts are unchanged from the pinned shared API', git(['diff', '--name-only', SHARED_BASE, '--', 'components/ui', 'lib/hero-facts.ts']).trim() === '', git(['diff', '--name-only', SHARED_BASE, '--', 'components/ui', 'lib/hero-facts.ts']).trim());
check('no components/nos/NosDocument.tsx fork of DocumentLayout exists', !existsSync('components/nos/NosDocument.tsx'));
const hero = read('components/nos/NosHero.tsx');
check('NosHero renders facts via normaliseHeroFacts as dl[data-hero-facts] with data-fact-count and [data-hero-fact]', /normaliseHeroFacts/.test(hero) && /data-hero-facts/.test(hero) && /data-fact-count/.test(hero) && /data-hero-fact\b/.test(hero) && /<dl/.test(hero));
const css = `${read('app/(nos)/national-show/nos-structure.css')}\n${read('app/(nos)/national-show/nos-theme.css')}`;
check('the :focus-visible rule in nos-theme.css is wrapped in :where() (specificity fix; the h1 ring itself is #76)', !/\.nos-theme\s+:focus-visible:not\(\.group\)/.test(css) || /:where\(/.test(css));
check('focus management kept (NosRouteScroll or equivalent still focuses the h1)', /focus\(/.test(read('components/nos/NosRouteScroll.tsx')) || /focus\(/.test(hero));

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
check('FAQ, exhibitors and media-kit render no ShowJumpChips anywhere in app/(nos)', !/ShowJumpChips/.test(execFileSync('git', ['grep', '-l', 'ShowJumpChips', '--', 'app/(nos)'], { encoding: 'utf8' }).toString()), 'git grep');
const idx = read('components/show/FaqIndex.tsx');
check('FaqIndex (if it still exists) does not use <details>; the index is DocumentLayout\'s `index` prop', !/<details/.test(idx));
check('StatusMarker.tsx untouched', git(['diff', '--name-only', 'origin/main', '--', 'components/show/_shared/StatusMarker.tsx']).trim() === '');

// added CSS: the craft-floor bans and the token rule
const added = git(['diff', '-U0', 'origin/main', '--', 'app/(nos)/national-show/nos-structure.css', 'app/(nos)/national-show/nos-theme.css']).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
check('added CSS declares no custom property', !added.some((l) => /^\s*--[a-z0-9-]+\s*:/.test(l)), added.find((l) => /^\s*--[a-z0-9-]+\s*:/.test(l)));
check('added CSS has no raw hex', !added.some((l) => /#[0-9a-fA-F]{3,8}\b/.test(l)), added.find((l) => /#[0-9a-fA-F]{3,8}\b/.test(l)));
check('added CSS adds no @font-face or literal font-family', !added.some((l) => /@font-face|font-family\s*:\s*(?!var\()/.test(l)));
check('added CSS has no coloured side border above 1px', !added.some((l) => /border-(left|right|inline-start|inline-end)\s*:\s*([2-9]|[1-9]\d)/.test(l)));
check('added CSS has no box-shadow with a zero blur', !added.some((l) => /box-shadow\s*:\s*-?\d+px\s+-?\d+px\s+0(px)?\s/.test(l)));
check('added CSS has no border-radius >= 999 except on the hero eyebrow selector', !added.some((l) => /border-radius\s*:\s*(999|9999|50%|100vw|50vw)/.test(l) && !/eyebrow/.test(l)));
check('added CSS has no dashed 2px rail', !added.some((l) => /border[a-z-]*\s*:\s*[2-9]px\s+dashed/.test(l)));

if (fails.length) { console.error(`nos-content-standard static FAILED:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log('nos-content-standard static pass');
