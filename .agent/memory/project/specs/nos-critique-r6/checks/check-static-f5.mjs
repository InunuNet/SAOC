// nos-critique-r6 F5 — static source check for R80 #1 (hub and inner photo heroes below 768px; lead saoc-2b 2026-10-17).
//   S1  nos-theme.css has a `max-width: 767px` media block that puts BOTH `.nos-hero-hub .nos-hero-media` and
//       `.nos-hero-inner .nos-hero-media` first (`order: -1`) at a fixed `height` of 220-300px with the 4/3 aspect released.
//   S1b the same 767px block sets `.nos-hero-lede` (NosHero's one lede class, hub and inner) to 18px / 1.5 with max-width 60ch (Codi, final).
//   S2  the >=768 stacked rules survive from BASE: `order: 2` and `aspect-ratio: 4 / 3` remain in the 1023px block.
//   S3  hero-photos.ts gives every inner photo route a measured `objectPosition` ("N% N%") and keeps the hub's 68% 50%;
//       NosHero.tsx consumes photo.objectPosition.
//   S4  the hub page.tsx keeps every data, JSON-LD and offers line from BASE (sanityFetch, JsonLd, nationalShowEventJsonLd,
//       buildAdmissionOffers, resolveEffectivePrice, heroMeta).
//   S5  docs cite R80 and the bloom measurement (bloom-marginals / measure-bloom).
// Run as: node check-static-f5.mjs   (NOS_CR6_ROOT selects the worktree)
import { DOC, NOS_THEME, NS, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f5.mjs';
const failures = [];
const fail = (m) => failures.push(m);

const css = stripComments(readRepoFile(NOS_THEME) ?? '');
function out767(src) {
  const parts = [];
  for (const m of src.matchAll(/@media\s*\(max-width:\s*767(?:\.98)?px\)\s*\{/g)) {
    let depth = 1; let i = m.index + m[0].length;
    while (i < src.length && depth > 0) { if (src[i] === '{') depth += 1; else if (src[i] === '}') depth -= 1; i += 1; }
    parts.push(src.slice(m.index, i));
  }
  return parts.join('\n');
}
const mq = [...css.matchAll(/@media\s*\(max-width:\s*767(?:\.98)?px\)\s*\{/g)];
if (mq.length === 0) fail('nos-theme.css needs an @media (max-width: 767px) block for the stacked hero (S1)');
else {
  const out = [];
  for (const m of mq) {
    let depth = 1; let i = m.index + m[0].length;
    while (i < css.length && depth > 0) { if (css[i] === '{') depth += 1; else if (css[i] === '}') depth -= 1; i += 1; }
    out.push(css.slice(m.index, i));
  }
  const text = out.join('\n');
  for (const sel of ['.nos-hero-hub .nos-hero-media', '.nos-hero-inner .nos-hero-media']) {
    const rule = text.match(new RegExp(`[^{}]*${sel.replace(/\./g, '\\.')}[^{}]*\\{([^}]*)\\}`));
    if (!rule) { fail(`the 767px block lacks a rule for ${sel} (S1)`); continue; }
    if (!/order:\s*-1;/.test(rule[1])) fail(`${sel}: needs order: -1 below 768px (S1)`);
    if (sel.includes('hub') && !/height:\s*(?:2[2-9]\d|300)px;/.test(rule[1])) fail(`${sel}: needs a fixed height of 220-300px below 768px (S1)`);
    if (!sel.includes('hub') && !/height:\s*220px;/.test(rule[1])) fail(`${sel}: the inner photo heroes take exactly 220px below 768px (Codi, 2026-10-17) (S1)`);
    if (!/aspect-ratio:\s*auto;/.test(rule[1])) fail(`${sel}: must release the 4 / 3 aspect-ratio (aspect-ratio: auto) below 768px (S1)`);
  }
}
{
  const text = out767(css);
  const rule = text.match(/[^{}]*\.nos-hero-lede[^{}]*\{([^}]*)\}/);
  if (!rule) fail('the 767px block needs a .nos-hero-lede rule (S1b)');
  else {
    if (!/font-size:\s*18px;/.test(rule[1])) fail('.nos-hero-lede below 768px needs font-size: 18px (S1b)');
    if (!/line-height:\s*1\.5;/.test(rule[1])) fail('.nos-hero-lede below 768px needs line-height: 1.5 (S1b)');
    if (!/max-width:\s*60ch;/.test(rule[1])) fail('.nos-hero-lede below 768px keeps max-width: 60ch (S1b)');
  }
}
const stackedBase = (readBaseFile(NOS_THEME) ?? '').match(/@media \(max-width: 1023px\) \{[\s\S]*?\n\}\n@media/)?.[0] ?? '';
const stackedNow = css.match(/@media \(max-width: 1023px\) \{[\s\S]*?\n\}\n@media/)?.[0] ?? '';
if (!/order:\s*2;/.test(stackedNow) || !/aspect-ratio:\s*4 \/ 3;/.test(stackedNow)) fail('the max-width: 1023px stacked rules (order: 2, aspect-ratio: 4 / 3) must survive for 768-1023px (S2)');
if (stackedBase === '') fail('could not find the BASE 1023px block; re-read the contract (S2)');

const photos = stripComments(readRepoFile('components/nos/hero-photos.ts') ?? '');
for (const route of ['plan-your-visit', 'symposium', 'programme', 'what-to-expect']) {
  const m = photos.match(new RegExp(`'/national-show/${route}':\\s*\\{([^}]*)\\}`));
  if (!m || !/objectPosition:\s*'\d{1,3}% \d{1,3}%'/.test(m[1])) fail(`hero-photos.ts: ${route} needs a measured objectPosition 'N% N%' (S3)`);
}
if (!/'\/national-show':\s*\{[^}]*objectPosition:\s*'68% 50%'/.test(photos)) fail("hero-photos.ts: the hub keeps objectPosition '68% 50%' (S3)");
if (!/objectPosition/.test(stripComments(readRepoFile('components/nos/NosHero.tsx') ?? ''))) fail('NosHero.tsx must apply photo.objectPosition (S3)');

const hubBase = (readBaseFile(`${NS}/page.tsx`) ?? '').split('\n').filter((l) => /sanityFetch|JsonLd|nationalShowEventJsonLd|buildAdmissionOffers|resolveEffectivePrice|heroMeta/.test(l));
const hubNow = readRepoFile(`${NS}/page.tsx`) ?? '';
for (const l of hubBase) if (!hubNow.includes(l)) fail(`hub page.tsx lost or changed a data/JSON-LD line: ${l.trim().slice(0, 90)} (S4)`);

const doc = readRepoFile(DOC) ?? '';
if (!/R80/.test(doc) || !/(bloom-marginals|measure-bloom)/.test(doc)) fail(`${DOC} must cite R80 and the bloom measurement (S5)`);

finish(NAME, failures, 'R80: <768 media first at 300px for hub and inner photo heroes, 768-1023 stacking kept, measured objectPositions in hero-photos.ts, hub data lines intact, docs cite R80.');
