// F8 rendered on the env-gated fixture /media-kit-fixtures at 390@3, 768@1, 1280@1 and 1440@2.
//   - flagless server: the fixture is a 404
//   - page height at 390 is under 9000px (backlog target; the gated page measured 21,157px)
//   - "Mark only": a radio group of exactly 8, labelled with existing wording (Full colour, Greyscale, 01 Indigo ...
//     06 Plum), one checked (the first), each radio >=44px; choosing one shows only its panel: 3 cards, or 4 for
//     Greyscale (mark, reversed mark, light chip, dark chip)
//   - "National Show 2027": a radio group of exactly 8 (the existing variant labels); choosing one shows 2 cards in
//     the picker (Horizontal, Vertical) plus the emblem card outside it
//   - every download href of the mark-only and national-show manifest sections is still in the DOM (hidden panels
//     included), so nothing became unreachable
//   - NOS Design ruling 2026-10-25: each group is a real radiogroup with an accessible name (the section's own words);
//     choosing an option updates the preview AND every download button (each visible preview image is that option's
//     file; each visible download button's accessible name is "Download <FORMAT> - <that card's title>", naming the
//     file and format); the selected chip differs from the others without colour alone (heavier weight plus a ring);
//     focus order is radios, then downloads (previews are not focus stops), none in a hidden panel
//   - #mark-only-plum on load selects Plum; choosing a radio writes #<section>-<id>; no horizontal overflow
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f8-kit-rendered.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { finish, repoRoot } from './_lib.mjs';
import { buildProblem, get, require, startServer } from './_server.mjs';
import { VIEWPORTS } from './_viewports.mjs';

const failures = [];
const stale = buildProblem(['app/(marketing)/media-kit/MediaKitPageBody.tsx', 'components/media-kit/OptionPicker.tsx']);
if (stale.length) finish('f8-kit-rendered', stale);

const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'lib/data/media-kit-manifest.json'), 'utf8'));
const hrefs = (section) => manifest.items.filter((i) => i.section === section).map((i) => i.href);
const MARK = {
  section: 'mark-only',
  labels: ['Full colour', 'Greyscale', '01 Indigo', '02 Prussian', '03 Viridian', '04 Violet', '05 Teal', '06 Plum'],
  ids: ['colour', 'greyscale', 'indigo', 'prussian', 'viridian', 'violet', 'teal', 'plum'],
  cards: (label) => (label === 'Greyscale' ? 4 : 3),
  fixedCards: 0,
  groupName: 'Mark only',
  srcToken: (id) => new RegExp(`saoc-mark-${id === 'colour' ? 'colour' : id === 'greyscale' ? 'greyscale' : `duotone-${id}`}[-.]`),
};
const NOS = {
  section: 'national-show',
  labels: ['Full colour', 'Full colour reversed', 'Grayscale', 'Ink olive', 'Ink purple', 'Ink violet', 'Reversed gold', 'Reversed white'],
  ids: ['full-colour', 'full-colour-reversed', 'grayscale', 'ink-olive', 'ink-purple', 'ink-violet', 'reversed-gold', 'reversed-white'],
  cards: () => 2,
  fixedCards: 1,
  groupName: 'National Show 2027',
  srcToken: (id) => new RegExp(`logo-${id}-(horizontal|vertical)`),
};

const flagless = await startServer();
try {
  const r = await get(flagless.port, '/media-kit-fixtures', 'localhost');
  if (r.status !== 404) failures.push(`flagless server: /media-kit-fixtures returned ${r.status}, want 404`);
} finally {
  flagless.stop();
}

const { chromium } = require('playwright');
const srv = await startServer({ env: { MEDIA_KIT_FIXTURES: '1' } });
const browser = await chromium.launch();
const url = (hash = '') => `http://localhost:${srv.port}/media-kit-fixtures${hash}`;
const visibleCards = (page, section) => page.evaluate((id) => [...document.querySelectorAll(`#${id} [data-kit-card]`)].filter((c) => c.offsetParent !== null).length, section);
try {
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    await page.goto(url(), { waitUntil: 'load', timeout: 30000 });

    if (vp.width === 390) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      if (height >= 9000) failures.push(`${tag}: page is ${height}px tall, want <9000`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) failures.push(`${tag}: horizontal overflow of ${overflow}px`);

    for (const g of [MARK, NOS]) {
      const group = page.locator(`#${g.section} [role="radiogroup"]`);
      if ((await group.count()) !== 1) { failures.push(`${tag} #${g.section}: ${await group.count()} radio groups, want 1`); continue; }
      const radios = group.locator('input[type="radio"]');
      const n = await radios.count();
      if (n !== 8) { failures.push(`${tag} #${g.section}: ${n} radios, want 8`); continue; }
      const labels = await group.locator('label').evaluateAll((ls) => ls.map((l) => (l.textContent ?? '').replace(/\s+/g, ' ').trim()));
      labels.forEach((text, i) => { if (text !== g.labels[i]) failures.push(`${tag} #${g.section}: radio ${i + 1} is "${text}", want "${g.labels[i]}"`); });
      const heights = await group.locator('label > span').evaluateAll((s) => s.map((e) => e.getBoundingClientRect().height));
      heights.forEach((h, i) => { if (h < 44) failures.push(`${tag} #${g.section}: chip "${g.labels[i]}" is ${h.toFixed(1)}px tall, want >=44`); });
      if ((await radios.nth(0).isChecked()) !== true) failures.push(`${tag} #${g.section}: the first radio is not the default`);
      const name = await group.evaluate((el) => (el.getAttribute('aria-label') ?? el.closest('fieldset')?.querySelector('legend')?.textContent ?? '').trim());
      if (name !== g.groupName) failures.push(`${tag} #${g.section}: radiogroup is named "${name}", want "${g.groupName}"`);
      const weights = await group.locator('label > span').evaluateAll((s) => s.map((e) => ({ w: Number(getComputedStyle(e).fontWeight) || Number(getComputedStyle(e.firstElementChild ?? e).fontWeight), ring: getComputedStyle(e).boxShadow })));
      if (!(weights[0].w >= 600 && weights[1].w < weights[0].w && weights[0].ring !== 'none' && weights[1].ring === 'none')) failures.push(`${tag} #${g.section}: the selected chip is not distinct without colour (selected weight ${weights[0].w} ring ${weights[0].ring}; other weight ${weights[1].w} ring ${weights[1].ring})`);

      // Every choice shows exactly its own panel's cards (plus any fixed card outside the picker).
      for (let i = 0; i < 8; i += 1) {
        await group.locator('label').nth(i).click();
        const shown = await visibleCards(page, g.section);
        const want = g.cards(g.labels[i]) + g.fixedCards;
        if (shown !== want) failures.push(`${tag} #${g.section} "${g.labels[i]}": ${shown} cards visible, want ${want}`);
        // Previews and downloads follow the selection: every visible card is this option's file, its download buttons name file and format.
        const cards = await page.$$eval(`#${g.section} [data-kit-card]`, (cs) => cs.filter((c) => c.offsetParent !== null).map((c) => ({
          src: decodeURIComponent(c.querySelector('img')?.getAttribute('src') ?? ''),
          title: (c.querySelector('h3')?.textContent ?? '').trim(),
          links: [...c.querySelectorAll('a[download]')].map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim()),
        })));
        if (g.fixedCards) cards.pop(); // the emblem card is outside the picker
        for (const c of cards) {
          if (!g.srcToken(g.ids[i]).test(c.src)) failures.push(`${tag} #${g.section} "${g.labels[i]}": a visible preview shows ${c.src}, not this option`);
          if (c.links.length === 0 || !c.links.every((t) => t.startsWith('Download ') && t.endsWith(c.title) && /^Download [A-Z]+ — /.test(t))) failures.push(`${tag} #${g.section} "${g.labels[i]}": download buttons [${c.links.join(' | ')}] do not name format and file "${c.title}"`);
        }
        // Focus order: from the chosen radio, Tab visits the visible downloads in DOM order and nothing hidden.
        if (i === 0 || i === 1) {
          await radios.nth(i).focus();
          const want = await page.$$eval(`#${g.section} [data-kit-card] a[download]`, (as) => as.filter((a) => a.offsetParent !== null).map((a) => a.getAttribute('href')));
          const got = [];
          for (let k = 0; k < want.length; k += 1) {
            await page.keyboard.press('Tab');
            got.push(await page.evaluate(() => document.activeElement?.getAttribute('href') ?? document.activeElement?.tagName));
          }
          if (got.join('|') !== want.join('|')) failures.push(`${tag} #${g.section} "${g.labels[i]}": Tab order after the radios is [${got.join(' | ')}], want the visible downloads [${want.join(' | ')}]`);
        }
        const hash = await page.evaluate(() => window.location.hash);
        if (hash !== `#${g.section}-${g.ids[i]}`) failures.push(`${tag} #${g.section} "${g.labels[i]}": hash is "${hash}", want "#${g.section}-${g.ids[i]}"`);
      }

      // No download became unreachable: every manifest href of this section is still in the DOM.
      const present = new Set(await page.$$eval(`#${g.section} a[href]`, (as) => as.map((a) => a.getAttribute('href'))));
      for (const h of hrefs(g.section)) if (!present.has(h)) failures.push(`${tag} #${g.section}: manifest download ${h} is not in the DOM`);
    }

    // A deep link restores the choice.
    const deep = await ctx.newPage();
    await deep.goto(url('#mark-only-plum'), { waitUntil: 'load', timeout: 30000 });
    const checked = await deep.evaluate(() => document.querySelector('#mark-only input[type="radio"]:checked')?.closest('label')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
    if (checked !== '06 Plum') failures.push(`${tag}: #mark-only-plum selected "${checked}", want "06 Plum"`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f8-kit-rendered', failures);
