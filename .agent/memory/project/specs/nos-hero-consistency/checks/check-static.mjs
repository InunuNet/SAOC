#!/usr/bin/env node
// nos-hero-consistency (Brad, 25 Nov 2026): source checks, no server, no dependencies.
//   node check-static.mjs nav   a one-link nav group renders as a plain link, in the top row and the menu panel
//   node check-static.mjs css   the inner hero sizing rule: one height per breakpoint, the mirrored PageHero
//                               scrim drawn as the photo mask, and no dark ramp over the bloom side
// Exit 0 pass, 1 finding, 2 a file could not be read or an unknown mode.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEADER = join('components', 'nos-chrome', 'NosHeader.tsx');
const STRUCTURE = join('app', '(nos)', 'national-show', 'nos-structure.css');
const THEME = join('app', '(nos)', 'national-show', 'nos-theme.css');

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
  if (!/min-height:\s*max\(420px,\s*29\.3vw\)/.test(css)) fail(`${STRUCTURE}: from 1024 the inner hero is max(420px, 29.3vw) tall (PageHero)`);
  if (!/min-height:\s*320px/.test(css)) fail(`${STRUCTURE}: from 768 to 1023 the inner hero box is 320px tall`);
  if (!/min-height:\s*calc\(124px \+ 2 \* max\(3rem, 1\.8rem \+ 3\.2vw\)\)/.test(css)) fail(`${STRUCTURE}: below 768 the title block holds the crumbs and a two-line h1`);
  if (/\.nos-hero-inner\.nos-hero-photo::before/.test(css)) fail(`${STRUCTURE}: the old dark ramp over the photo (::before) must be gone`);
  for (const stop of ['0.2) var(--scrim-at)', '0.3) calc(var(--scrim-at) + 1.5cqw)', '0.48) calc(var(--scrim-at) + 4cqw)', '0.68) calc(var(--scrim-at) + 7cqw)', '0.84) calc(var(--scrim-at) + 10cqw)', '0.94) calc(var(--scrim-at) + 14cqw)', '#000 calc(var(--scrim-at) + 18cqw)']) {
    const count = css.split(stop).length - 1;
    if (count !== 2) fail(`${STRUCTURE}: mask stop "${stop}" appears ${count} times, want 2 (-webkit- and standard)`);
  }
  if (!/mask-composite:\s*intersect/.test(css)) fail(`${STRUCTURE}: the scrim mask must intersect the box's edge fade`);
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
