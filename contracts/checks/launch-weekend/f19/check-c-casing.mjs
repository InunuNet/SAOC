#!/usr/bin/env node
// F19-A3 (R64 / R79 #2, design_system_README l.51 "Sentence case for headlines, section titles, buttons"): every button-like control
// (a/button in <main> or a section, padded and bordered or filled, outside header/footer/nav) on the SAOC routes is sentence case:
// no word after the first starts with a capital unless it is a proper noun from tokens.json, and none is text-transform
// uppercase/capitalize. The home hero primary reads exactly "Find your society". Casing only: the label wording is unchanged.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-c-casing.mjs
import { readFileSync } from 'node:fs';
import { launch, newPage, open, report, loadGolden, ROOT, WIDE } from './_lib.mjs';
import { SAOC_ROUTES } from './_routes.mjs';

const proper = new Set(loadGolden('tokens.json').casing.properNouns);
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, { ...WIDE, width: 1280, height: 900 });
let seen = 0;
for (const r of SAOC_ROUTES) {
  await open(page, r);
  const labels = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('main a, main button, section a, section button').forEach((el) => {
      if (el.closest('header, footer, nav')) return;
      const cs = getComputedStyle(el); const bg = cs.backgroundColor;
      const filled = !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      if (parseFloat(cs.paddingLeft) >= 14 && parseFloat(cs.paddingTop) >= 8 && (parseFloat(cs.borderTopWidth) > 0 || filled) && text.length < 40) out.push({ text, tt: cs.textTransform });
    });
    return out;
  });
  for (const { text, tt } of labels) {
    seen++;
    if (tt !== 'none') problems.push(`${r}: "${text}" is text-transform ${tt}`);
    const words = text.split(' ').slice(1);
    const bad = words.filter((w) => /^[A-Z]/.test(w.replace(/^[^A-Za-z0-9]+/, '')) && !proper.has(w.replace(/[^A-Za-z]/g, '')));
    if (bad.length) problems.push(`${r}: "${text}" is not sentence case (${bad.join(', ')})`);
  }
  if (r === '/') {
    const primary = labels.find((l) => /society/i.test(l.text) && l.text.split(' ').length <= 4);
    if (!primary || primary.text !== 'Find your society') problems.push(`/: hero primary reads "${primary ? primary.text : 'not found'}", want "Find your society"`);
  }
}
await browser.close();
if (seen < 12) problems.push(`only ${seen} button-like controls found across ${SAOC_ROUTES.length} routes: detection is vacuous`);
const hero = readFileSync(`${ROOT}components/home/Hero.tsx`, 'utf8');
if (/Find Your Society/.test(hero)) problems.push('components/home/Hero.tsx still contains "Find Your Society"');
report(problems, `${seen} button-like controls on ${SAOC_ROUTES.length} SAOC routes are sentence case; hero reads "Find your society"`);
