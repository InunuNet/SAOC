// F8 rendered on the env-gated fixture /media-kit-fixtures at 390@3, 768@1, 1280@1 and 1440@2.
//   - flagless server: the fixture is a 404
//   - page height at 390 is at most 10,500px (NOS Design round 2; 9,000 withdrawn; the gated page measured 21,157px)
//   - "Lockups" (NOS Design round 2): Full colour and Greyscale are one section: a family radiogroup (Full colour | Greyscale)
//     and a variant radiogroup (4 labels), one visible preview card that follows both, its download buttons naming file and
//     format, the selected chips distinct without colour (weight and ring), both family zips inside the section with the
//     family in their accessible name, every lockup download still in the DOM, and the old #full-colour / #greyscale jump
//     anchors deep-linking with that family preselected
//   - every visible preview image, once scrolled into view, has naturalWidth > 0 (Mark-only, the Quick start card, the four
//     Do/Don't illustrations, the National Show picker preview, the Disa emblem)
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
// The five labels below come from the NOS Design ruling and are NOT existing strings in the media kit data
// (existing: lockup_label "Horizontal — dark type on light" ...); see goldens/README.md. One place to swap.
const LOCKUPS_HEADING = 'Lockups';
const FAMILIES = [
  { id: 'full-colour', label: 'Full colour', rendition: 'colour', zip: 'full-colour' },
  { id: 'greyscale', label: 'Greyscale', rendition: 'greyscale', zip: 'greyscale' },
];
const VARIANTS = [
  { id: 'horizontal-on-light', label: 'Horizontal dark on light', orientation: 'horizontal', ground: 'light' },
  { id: 'horizontal-on-dark', label: 'Horizontal light on dark', orientation: 'horizontal', ground: 'dark' },
  { id: 'vertical-on-light', label: 'Vertical dark on light', orientation: 'vertical', ground: 'light' },
  { id: 'vertical-on-dark', label: 'Vertical light on dark', orientation: 'vertical', ground: 'dark' },
];
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
      if (height > 10500) failures.push(`${tag}: page is ${height}px tall, want <=10,500`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) failures.push(`${tag}: horizontal overflow of ${overflow}px`);

    // ---- Lockups picker
    const lk = page.locator('#lockups');
    if ((await lk.count()) !== 1) failures.push(`${tag}: no #lockups section`);
    else {
      const heading = await lk.locator('h2').first().textContent();
      if ((heading ?? '').trim() !== LOCKUPS_HEADING) failures.push(`${tag} #lockups: heading is "${(heading ?? '').trim()}", want "${LOCKUPS_HEADING}"`);
      if ((await page.locator('#full-colour, #greyscale').count()) !== 2 || (await page.locator('section#full-colour, section#greyscale').count()) !== 0) failures.push(`${tag}: the #full-colour and #greyscale jump anchors must exist as anchors inside #lockups, not as sections`);
      const groups = lk.locator('[role="radiogroup"]');
      if ((await groups.count()) !== 2) failures.push(`${tag} #lockups: ${await groups.count()} radio groups, want 2 (family, variant)`);
      else {
        const family = groups.nth(0);
        const variant = groups.nth(1);
        const names = await Promise.all([family, variant].map((gr) => gr.evaluate((el) => (el.getAttribute('aria-label') ?? el.closest('fieldset')?.querySelector('legend')?.textContent ?? '').trim())));
        if (names.some((n) => !n)) failures.push(`${tag} #lockups: a radiogroup has no accessible name`);
        const famLabels = await family.locator('label').evaluateAll((ls) => ls.map((l) => (l.textContent ?? '').replace(/\s+/g, ' ').trim()));
        if (famLabels.join('|') !== FAMILIES.map((f) => f.label).join('|')) failures.push(`${tag} #lockups: family toggle is [${famLabels.join(' | ')}], want [${FAMILIES.map((f) => f.label).join(' | ')}]`);
        const varLabels = await variant.locator('label').evaluateAll((ls) => ls.map((l) => (l.textContent ?? '').replace(/\s+/g, ' ').trim()));
        if (varLabels.join('|') !== VARIANTS.map((v) => v.label).join('|')) failures.push(`${tag} #lockups: variants are [${varLabels.join(' | ')}], want [${VARIANTS.map((v) => v.label).join(' | ')}]`);
        for (const gr of [family, variant]) {
          const hs = await gr.locator('label > span').evaluateAll((s) => s.map((e) => e.getBoundingClientRect().height));
          hs.forEach((h) => { if (h < 44) failures.push(`${tag} #lockups: a chip is ${h.toFixed(1)}px tall, want >=44`); });
          const look = await gr.locator('label > span').evaluateAll((s) => s.map((e) => ({ w: Number(getComputedStyle(e).fontWeight), ring: getComputedStyle(e).boxShadow })));
          if (look.length >= 2 && !(look[0].w >= 600 && look[1].w < look[0].w && look[0].ring !== 'none' && look[1].ring === 'none')) failures.push(`${tag} #lockups: the selected chip is not distinct without colour (weight ${look[0].w}/${look[1].w}, ring ${look[0].ring}/${look[1].ring})`);
        }
        for (const [fi, f] of FAMILIES.entries()) {
          await family.locator('label').nth(fi).click();
          for (const [vi, v] of VARIANTS.entries()) {
            await variant.locator('label').nth(vi).click();
            const cards = await page.$$eval('#lockups [data-kit-card]', (cs) => cs.filter((c) => c.offsetParent !== null).map((c) => ({
              src: decodeURIComponent(c.querySelector('img')?.getAttribute('src') ?? ''),
              title: (c.querySelector('h3')?.textContent ?? '').trim(),
              links: [...c.querySelectorAll('a[download]')].map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim()),
            })));
            const where = `${tag} #lockups ${f.label} / ${v.label}`;
            if (cards.length !== 1) failures.push(`${where}: ${cards.length} preview cards visible, want 1`);
            else {
              const c = cards[0];
              if (!new RegExp(`orchid-council-${v.orientation}-${f.rendition}-on-${v.ground}`).test(c.src)) failures.push(`${where}: the preview shows ${c.src}`);
              if (c.links.length === 0 || !c.links.every((t) => /^Download [A-Z]+ — /.test(t) && t.endsWith(c.title))) failures.push(`${where}: download buttons [${c.links.join(' | ')}] do not name format and file "${c.title}"`);
            }
            const hash = await page.evaluate(() => window.location.hash);
            if (hash !== `#lockups-${f.id}-${v.id}`) failures.push(`${where}: hash is "${hash}", want "#lockups-${f.id}-${v.id}"`);
          }
        }
        // Both family zips live in the section, each named for its family; every lockup download is still in the DOM.
        const zipLinks = await page.$$eval('#lockups a[href$=".zip"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), name: (a.textContent ?? '').replace(/\s+/g, ' ').trim() })));
        for (const f of FAMILIES) {
          const want = hrefs(f.zip).find((h) => h.endsWith('.zip'));
          const z = zipLinks.find((l) => l.href === want);
          if (!z) failures.push(`${tag} #lockups: the ${f.label} zip (${want}) is not in the section`);
          else if (!z.name.includes(f.label)) failures.push(`${tag} #lockups: the ${f.label} zip link reads "${z.name}", it must name its family`);
        }
        const present = new Set(await page.$$eval('#lockups a[href]', (as) => as.map((a) => a.getAttribute('href'))));
        for (const f of FAMILIES) for (const h of hrefs(f.zip)) if (!present.has(h)) failures.push(`${tag} #lockups: manifest download ${h} is not in the DOM`);
      }
    }

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

    // The "On this page" anchors deep-link into the picker with that family preselected (after hydration).
    for (const f of FAMILIES) {
      const lp = await ctx.newPage();
      await lp.goto(url(`#${f.id}`), { waitUntil: 'load', timeout: 30000 });
      await lp.waitForFunction((label) => (document.querySelector('#lockups [role="radiogroup"] input:checked')?.closest('label')?.textContent ?? '').trim() === label, f.label, { timeout: 15000 }).catch(() => {});
      const got = await lp.evaluate(() => (document.querySelector('#lockups [role="radiogroup"] input:checked')?.closest('label')?.textContent ?? '').trim());
      if (got !== f.label) failures.push(`${tag}: #${f.id} preselected "${got}", want "${f.label}"`);
      await lp.close();
    }

    // Every visible preview image renders once scrolled into view (not a lazy blank).
    await page.goto(url(), { waitUntil: 'load', timeout: 30000 });
    const imgs = await page.evaluate(async () => {
      const out = [];
      for (const img of [...document.querySelectorAll('main img, img')].filter((i) => i.offsetParent !== null)) {
        img.scrollIntoView({ block: 'center' });
        await new Promise((res) => { if (img.complete) res(); else { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); setTimeout(res, 8000); } });
        out.push({ section: img.closest('section[id]')?.id ?? '', src: img.getAttribute('src') ?? '', w: img.naturalWidth });
      }
      return out;
    });
    for (const i of imgs) if (!(i.w > 0)) failures.push(`${tag}: preview image ${i.src} (section ${i.section || 'none'}) did not render (naturalWidth ${i.w})`);
    const countIn = (id) => imgs.filter((i) => i.section === id).length;
    for (const [id, min] of [['quick-start', 1], ['lockups', 1], ['mark-only', 1], ['usage', 4], ['national-show', 2]]) if (countIn(id) < min) failures.push(`${tag}: ${countIn(id)} visible images in #${id}, want >=${min}`);

    // A deep link restores the choice.
    const deep = await ctx.newPage();
    await deep.goto(url('#mark-only-plum'), { waitUntil: 'load', timeout: 30000 });
    // The hash is read after hydration (useSyncExternalStore's server snapshot is empty): wait for the radio, never sleep.
    await deep.waitForFunction(() => /06 Plum/.test(document.querySelector('#mark-only input[type="radio"]:checked')?.closest('label')?.textContent ?? ''), undefined, { timeout: 15000 }).catch(() => {});
    const checked = await deep.evaluate(() => document.querySelector('#mark-only input[type="radio"]:checked')?.closest('label')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
    if (checked !== '06 Plum') failures.push(`${tag}: #mark-only-plum selected "${checked}", want "06 Plum"`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f8-kit-rendered', failures);
