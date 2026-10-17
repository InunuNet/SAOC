// nos-critique-r6 f10 -- static source check for the group sub-nav at <768 (NOS Design "Codi" ruling, critique H1, audit 2.4.7;
// approved into r6 by the lead 2026-10-17). The component is components/nos/NosSubNav.tsx (R27); ShowSectionNav is the footer grid.
//   S1  NosSubNav.tsx: on load sets the ROW's scrollLeft directly to the aria-current item's offsetLeft minus the row's computed padding-left (getComputedStyle), clamped to [0, scrollWidth - clientWidth],
//       only when the row overflows; NO scrollIntoView (Codi: it can scroll the page vertically past the hero); no smooth scrolling anywhere; scroll AND resize listeners update the fade, both removed on cleanup;
//       the two edge flags are data-fade-start / data-fade-end
//   S2  nos-structure.css: every .nos-subnav rule that is new or changed sits inside the one @media whose width is recorded in
//       goldens/f10-breakpoint.json (767px if the row genuinely overflows anywhere in 701-767, else the R27 700px, measured by f10-capture-pre.mjs); the rules OUTSIDE any
//       media query are identical to BASE (so >=768 is untouched by construction); the row has padding-inline var(--nos-axis-pad) and
//       scroll-padding-inline var(--nos-axis-pad); the fade is a mask-image linear-gradient with 40px stops (transparent at 0 on the edge, to left, mirrored to right) keyed on the two flags; the 8px
//       background-gradient fade span rule is gone; the 44px link height and the hidden scrollbar stay
//   S3  no other file changed (footprint) and docs/nos-critique-r6.md cites the sub-nav ruling
//   S4  components/show/ShowSectionNav.tsx: Brad's naming ruling, 'SAOC Symposium' -> 'National Orchid Show Symposium' and nothing else changes
//       in its copy (the component is exported but rendered by no page; NosShowIndex is the footer grid users see)
// Run as: node f10-static.mjs   (NOS_CR6_ROOT selects the worktree)
import { DOC, NS, copyStrings, finish, readRepoFile, stripComments } from './_lib.mjs';
import { readBaseFile, golden } from './f6-f8-lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const tsx = stripComments(readRepoFile('components/nos/NosSubNav.tsx') ?? '');
const cssRel = `${NS}/nos-structure.css`;
const css = stripComments(readRepoFile(cssRel) ?? '');
const baseCss = stripComments(readBaseFile(cssRel) ?? '');

// S1
if (/scrollIntoView/.test(tsx)) fail('NosSubNav.tsx must not call scrollIntoView; set the row scrollLeft directly (S1)');
if (!/scrollLeft\s*=/.test(tsx) || !/offsetLeft\s*-\s*\w+/.test(tsx)) fail('NosSubNav.tsx must set row.scrollLeft from the current item offsetLeft minus the lead (S1)');
if (!/getComputedStyle\([^)]*\)\.paddingLeft|getComputedStyle\([^)]*\)\.paddingInlineStart/.test(tsx)) fail('the lead must be read from getComputedStyle(row).paddingLeft (the row gutter), not a literal (S1)');
if (/offsetLeft\s*-\s*16\b/.test(tsx)) fail('NosSubNav.tsx still subtracts a fixed 16; the lead is the row computed padding-left (S1)');
if (!/Math\.max\([^)]*0[^)]*\)/.test(tsx.replace(/\n/g, ' ')) || !/Math\.min\(/.test(tsx) || !/scrollWidth\s*-\s*[\w.]*clientWidth/.test(tsx)) fail('the target must be clamped to [0, scrollWidth - clientWidth] with Math.max / Math.min (S1)');
if (/smooth/.test(tsx) || /scroll-behavior\s*:\s*smooth/.test(css)) fail('no smooth scrolling anywhere (prefers-reduced-motion) (S1)');
if (!/addEventListener\(\s*'scroll'/.test(tsx) || !/addEventListener\(\s*'resize'/.test(tsx)) fail("the fade must update on 'scroll' and 'resize' (S1)");
if (!/removeEventListener\(\s*'scroll'/.test(tsx) || !/removeEventListener\(\s*'resize'/.test(tsx)) fail('both listeners must be removed on cleanup (S1)');
if (!/data-fade-start/.test(tsx) || !/data-fade-end/.test(tsx)) fail('the two edge flags data-fade-start / data-fade-end are not set by NosSubNav.tsx (S1)');

// S2
function stripMedia(src) {
  let out = '';
  for (let i = 0; i < src.length; ) {
    if (src.startsWith('@media', i)) {
      let depth = 0;
      let j = src.indexOf('{', i);
      for (; j < src.length; j += 1) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') { depth -= 1; if (depth === 0) break; }
      }
      i = j + 1;
    } else { out += src[i]; i += 1; }
  }
  return out;
}
function mediaBlocks(src) {
  const out = [];
  for (let i = src.indexOf('@media'); i >= 0; i = src.indexOf('@media', i + 1)) {
    let depth = 0;
    let j = src.indexOf('{', i);
    const start = j;
    for (; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') { depth -= 1; if (depth === 0) break; }
    }
    out.push({ cond: src.slice(i + 6, start).trim(), body: src.slice(start + 1, j) });
  }
  return out;
}
const subnavRules = (src) => [...stripMedia(src).matchAll(/([^{}]*nos-subnav[^{}]*)\{([^}]*)\}/g)]
  .map((m) => [m[1].replace(/\s+/g, ' ').trim(), m[2].replace(/\s+/g, ' ').trim()])
  .filter(([sel]) => !/nos-subnav-fade/.test(sel)).map((r) => r.join(' { ')).sort();
if (subnavRules(css).join('\n') !== subnavRules(baseCss).join('\n')) fail('the .nos-subnav rules outside any @media query differ from BASE; every change belongs inside @media (max-width: 767px) so >=768 stays pixel-identical (S2)');
let decision;
try {
  decision = JSON.parse(golden('f10-breakpoint.json'));
} catch {
  decision = null;
  fail('goldens/f10-breakpoint.json is missing; run f10-capture-pre.mjs on the pre-f10 tree (it measures 701/720/767 and records 700 vs 767) (S2)');
}
const WANT = decision ? decision.maxWidthPx : 767;
const subMedia = mediaBlocks(css).filter((b) => /nos-subnav/.test(b.body));
if (subMedia.length === 0) fail('no @media block carries the .nos-subnav rules (S2)');
for (const b of subMedia) if (!new RegExp(`^\\(max-width:\\s*${WANT}px\\)$`).test(b.cond)) fail(`a .nos-subnav @media condition is "${b.cond}", want (max-width: ${WANT}px) per goldens/f10-breakpoint.json (S2)`);
const mobile = subMedia.map((b) => b.body).join('\n');
const compact = mobile.replace(/\s+/g, ' ');
if (!/padding-inline:\s*var\(--nos-axis-pad\)/.test(compact)) fail('the scroller row needs padding-inline: var(--nos-axis-pad) (S2)');
if (!/scroll-padding-inline:\s*var\(--nos-axis-pad\)/.test(compact)) fail('the scroller row needs scroll-padding-inline: var(--nos-axis-pad), equal to its padding, not a fixed 16px (S2)');
if (/scroll-padding-inline:\s*16px/.test(compact)) fail('scroll-padding-inline is still a fixed 16px (S2)');
{
  // Codi FINAL: a 40px fade whose ink reaches alpha 0 at the edge (first stop transparent at 0), right edge to left, mirrored on the left edge
  const masks = [...compact.matchAll(/(?:-webkit-)?mask-image:\s*([^;}]*)/g)].map((x) => x[1]);
  if (masks.length === 0) fail('the fade needs a mask-image linear-gradient (S2)');
  if (masks.some((v) => /24px/.test(v))) fail('a mask-image stop is still 24px; Codi ruled 40px (S2)');
  const edge = (dir) => masks.some((v) => new RegExp(`linear-gradient\\(\\s*to ${dir},\\s*transparent\\s+0(?:px)?,\\s*(?:#000(?:000)?|black|rgb\\(0,\\s*0,\\s*0\\))\\s+40px`).test(v));
  if (!edge('left')) fail('the right-edge mask must be linear-gradient(to left, transparent 0, #000 40px) (S2)');
  if (!edge('right')) fail('the left-edge mask must be the mirror: linear-gradient(to right, transparent 0, #000 40px) (S2)');
}
if (!/data-fade-start/.test(compact) || !/data-fade-end/.test(compact)) fail('the mask must be keyed on [data-fade-start] and [data-fade-end] so only an edge hiding items fades (S2)');
if (/width:\s*8px/.test(compact)) fail('the 8px edge-fade span rule is still there (S2)');
if (!/scrollbar-width:\s*none/.test(compact)) fail('the hidden scrollbar (scrollbar-width: none) was lost (S2)');
if (!/nos-subnav-link\s*\{[^}]*height:\s*44px/.test(stripMedia(css).replace(/\s+/g, ' '))) fail('.nos-subnav-link lost its 44px height (S2)');

// S3
const doc = readRepoFile(DOC);
if (doc === null) fail(`${DOC} missing`);
else if (!/sub-?nav/i.test(doc) || !/H1|2\.4\.7/.test(doc)) fail(`${DOC} must record the sub-nav ruling (critique H1 / audit 2.4.7)`);

// S4
const navRel = 'components/show/ShowSectionNav.tsx';
const navNow = readRepoFile(navRel);
const navBase = readBaseFile(navRel);
if (navNow === null || navBase === null) fail(`${navRel} missing`);
else {
  if (/SAOC Symposium/.test(navNow)) fail(`${navRel} still contains "SAOC Symposium" (S4)`);
  if (!navNow.includes('National Orchid Show Symposium')) fail(`${navRel} lacks "National Orchid Show Symposium" (S4)`);
  const want = copyStrings(navBase.replaceAll('SAOC Symposium', 'National Orchid Show Symposium')).sort().join('\n');
  if (copyStrings(navNow).sort().join('\n') !== want) fail(`${navRel}: copy differs from BASE by more than the Symposium rename (S4)`);
}

finish('f10-static.mjs', failures, 'Sub-nav: direct clamped scrollLeft (no scrollIntoView, gated, no smooth), scroll+resize listeners with cleanup, all CSS changes inside the measured breakpoint with the other rules identical to BASE, Symposium rename, 16px lead, 40px mask fade on the two edge flags, 44px items, hidden scrollbar.');
