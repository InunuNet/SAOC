#!/usr/bin/env node
// nos-hero-consistency (Brad, 25 Nov 2026): source checks, no server, no dependencies.
//   node check-static.mjs nav   a one-link nav group renders as a plain link, in the top row and the menu panel
//   node check-static.mjs css   the inner hero is the SAOC interior hero system (Brad, 26 Nov 2026): one locked
//                               height per breakpoint, a full-bleed photo (no mask, no split panel), PageHero's
//                               HeroPicture, and the shared scrim mirrored onto the copy column in the NOS ink
// Exit 0 pass, 1 finding, 2 a file could not be read or an unknown mode.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEADER = join('components', 'nos-chrome', 'NosHeader.tsx');
const STRUCTURE = join('app', '(nos)', 'national-show', 'nos-structure.css');
const THEME = join('app', '(nos)', 'national-show', 'nos-theme.css');
const HERO = join('components', 'nos', 'NosHero.tsx');
const SHARED = join('lib', 'interior-hero.ts');
const PAGE_HERO = join('components', 'ui', 'PageHero.tsx');

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    console.error(`INFRA: cannot read ${path} (${error.code ?? error.constructor.name})`);
    process.exit(2);
  }
}

const failures = [];
const fail = (msg) => failures.push(msg);
const mode = process.argv[2];

if (mode === 'nav') {
  const src = read(HEADER);
  if (!/function soleLink\(group: NavColumn\): NavLeaf \| null \{\s*return group\.links\.length === 1 \? group\.links\[0\] : null;/.test(src)) {
    fail(`${HEADER}: soleLink() must return a group's only link when it has exactly one`);
  }
  const uses = src.match(/const sole = soleLink\(group\);\s*if \(sole\) \{/g) ?? [];
  if (uses.length !== 2) fail(`${HEADER}: the top row and the menu panel must each render a one-link group as a link (found ${uses.length} of 2)`);
  if (!/className="nh-link"[\s\S]{0,120}href=\{nosPath\(sole\.href\)\}/.test(src)) fail(`${HEADER}: the top-row sole link must be an .nh-link to the child's page`);
  if (!/className="nd-item"[\s\S]{0,80}href=\{nosPath\(sole\.href\)\}/.test(src)) fail(`${HEADER}: the menu-panel sole link must be an .nd-item to the child's page`);
} else if (mode === 'css') {
  const css = read(STRUCTURE);
  const theme = read(THEME);
  const hero = read(HERO);
  const shared = read(SHARED);
  const pageHero = read(PAGE_HERO);
  // Locked heights (Brad, 26 Nov 2026: "lock the height"): from 1024 the PageHero box as a fixed height, not a floor.
  if (!/\.nos-hero-inner\.nos-hero-photo \{\s*height:\s*max\(420px,\s*29\.3vw\);\s*min-height:\s*max\(420px,\s*29\.3vw\)/.test(css)) fail(`${STRUCTURE}: from 1024 the photo hero is locked at height max(420px, 29.3vw) (PageHero), scoped to .nos-hero-photo`);
  if (!/\.nos-hero-inner\.nos-hero-photo \.nos-hero-head \{[^}]*height:\s*320px;\s*min-height:\s*320px/.test(css)) fail(`${STRUCTURE}: from 768 to 1023 the photo hero box is locked at 320px`);
  if (!/min-height:\s*calc\(124px \+ 2 \* max\(3rem, 1\.8rem \+ 3\.2vw\)\)/.test(css)) fail(`${STRUCTURE}: below 768 the title block holds the crumbs and a two-line h1`);
  for (const h of ['320px', 'calc(124px + 2 * max(3rem, 1.8rem + 3.2vw))']) {
    const decl = `min-height: ${h};`;
    const selectors = [];
    for (let at = css.indexOf(decl); at >= 0; at = css.indexOf(decl, at + 1)) selectors.push(css.slice(css.lastIndexOf('}', at), at));
    const heads = selectors.filter((sel) => sel.includes('.nos-hero-head'));
    if (!heads.length || !heads.every((sel) => sel.includes('.nos-hero-inner.nos-hero-photo .nos-hero-head'))) fail(`${STRUCTURE}: the title block's min-height ${h} must be scoped to .nos-hero-photo`);
  }
  if (/:not\(\.nos-hero-photo\) \.nos-hero-head/.test(css)) fail(`${STRUCTURE}: a typographic hero's title block must not be sized to the photo box`);
  if (/\.nos-hero-inner\.nos-hero-photo::before/.test(css)) fail(`${STRUCTURE}: the old dark ramp over the photo (::before) must be gone`);
  // The SAOC system (Brad, 26 Nov 2026): a full-bleed photo, no mask fading it into the ground, no split panel.
  if (/--scrim-at|mask-image|mask-composite/.test(css.slice(css.indexOf('Inner hero sizing')))) fail(`${STRUCTURE}: the inner hero must not mask the photo into the ground (no mask-image, no --scrim-at)`);
  if (!/\.nos-hero-inner\.nos-hero-photo \.nos-hero-media \{\s*inset:\s*0;\s*\}/.test(css)) fail(`${STRUCTURE}: from 1024 the photo is full bleed (inset: 0)`);
  if (/grid-template-columns:\s*minmax\(0,\s*58fr\)\s*minmax\(0,\s*42fr\)/.test(css)) fail(`${STRUCTURE}: the 768-1023 58/42 split panel must be gone (the photo is full bleed)`);
  if (!/\.nos-hero-photo \.nos-hero-media,\s*\.nos-theme \.nos-hero-inner \.nos-hero-copy-scrim \{\s*position:\s*absolute;\s*inset:\s*0;\s*grid-row:\s*1 \/ 2;\s*grid-column:\s*1 \/ -1;/.test(css)) fail(`${STRUCTURE}: from 768 to 1023 the photo and the scrim are bounded to the box row (grid-row: 1 / 2)`);
  if (!/\.nos-hero-copy-scrim \{\s*display:\s*block;\s*position:\s*absolute;\s*inset:\s*0;\s*background-image:\s*var\(--scrim-gradient\)/.test(css)) fail(`${STRUCTURE}: from 768 the copy scrim is an overlay painting --scrim-gradient`);
  if (!/--hero-copy-end:\s*48cqw/.test(css)) fail(`${STRUCTURE}: the copy column ends at 48% (PageHero's column, mirrored)`);
  // The scrim is PageHero's, from the shared module, in the NOS ink.
  if (!/const INNER_SCRIM = mirroredCopyScrimGradient\('11 10 20', 'var\(--hero-copy-end\)'\);/.test(hero)) fail(`${HERO}: the inner scrim is mirroredCopyScrimGradient in the NOS ink (11 10 20) at --hero-copy-end`);
  if (!/data-hero-scrim="copy"[\s\S]{0,120}className="nos-hero-copy-scrim"[\s\S]{0,80}'--scrim-gradient': INNER_SCRIM/.test(hero)) fail(`${HERO}: the inner photo hero renders the copy scrim overlay`);
  if (!/<HeroPicture[\s\S]{0,120}sizes=\{innerPhotoSizes\(photo\.src\)\}/.test(hero)) fail(`${HERO}: the inner photo is PageHero's HeroPicture with aspect-driven sizes`);
  if (!/const SCRIM_BACKGROUND = copyScrimGradient\('34 40 31'\);/.test(pageHero)) fail(`${PAGE_HERO}: PageHero draws its scrim from the shared module`);
  if (!/\[0, 34\],\s*\[0\.06, 38\],\s*\[0\.16, 42\],\s*\[0\.32, 45\],\s*\[0\.52, 48\],\s*\[0\.7, 50\.5\],\s*\[0\.8, 52\],/.test(shared)) fail(`${SHARED}: the SCRIM_STOPS ramp is unchanged`);
  if (/min-height:\s*clamp\(320px,\s*22vw,\s*380px\)/.test(theme)) fail(`${THEME}: the content-driven inner min-height must be gone`);
} else {
  console.error(`INFRA: unknown mode '${mode}' (nav | css)`);
  process.exit(2);
}

if (failures.length) {
  console.log(`FAIL (${mode})`);
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`nos-hero-consistency static ${mode} pass`);
