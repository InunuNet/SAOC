#!/usr/bin/env node
// F19-A7 (R72 #1): one shared left axis on the SAOC routes. At 390, 1280, 1920 and 2056 every left-aligned h1/h2 (text edge) and
// .eyebrow pill (box edge) in <main> starts on the header logo's x. Exempt by construction: centred elements (centred heroes and CTA
// bands), anything in the home hero carousel or the full-bleed show band, and anything inside a card (an ancestor below the
// section with a border or a fill) and a heading in the second or later column of a multi-column grid (contact's form column). globals.css carries one .saoc-container rule built from --container-max and --container-pad
// (the header's own tokens) inside an F19 comment, and at least 6 files use it. Legal pages are reported as NOTE only.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-g-axis.mjs
import { readFileSync } from 'node:fs';
import { launch, newPage, open, report, WIDE, ROOT } from './_lib.mjs';
import { SAOC_ROUTES, LEGAL_ROUTES } from './_routes.mjs';

const VPS = [{ name: '390', width: 390, height: 844, isMobile: true }, { name: '1280', width: 1280, height: 900 }, { name: '1920', width: 1920, height: 1080 }, WIDE];
const problems = [];
const notes = [];
let checked = 0;
const ONLY = process.env.F19_ROUTES ? process.env.F19_ROUTES.split(',') : null; // architect self-test only
const MEASURE = `(() => {
  const logo = document.querySelector('header a[href="/"]'); const lx = logo.getBoundingClientRect().left;
  const main = document.querySelector('main'); const rows = [];
  const cardish = (el) => { for (let n = el.parentElement; n && n !== main; n = n.parentElement) { if (n.parentElement === main) break; const cs = getComputedStyle(n); const b = ['Top','Right','Bottom','Left'].some((s) => parseFloat(cs['border' + s + 'Width']) > 0); const bg = cs.backgroundColor; if (b || !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) return true; } return false; };
  main.querySelectorAll('h1, h2, .eyebrow').forEach((el) => {
    if (el.closest('section[aria-roledescription="carousel"], [data-home-section="show-band"]') || cardish(el)) return;
    const cs = getComputedStyle(el); if (cs.textAlign === 'center') return;
    for (let n = el; n && n.parentElement && n.parentElement !== main; n = n.parentElement) { const pcs = getComputedStyle(n.parentElement); if (n.parentElement.parentElement !== main && pcs.display === 'grid' && pcs.gridTemplateColumns.split(' ').length > 1 && n !== n.parentElement.firstElementChild) return; }
    for (let n = el.parentElement; n && n !== main; n = n.parentElement) if (getComputedStyle(n).textAlign === 'center') return;
    let left; if (el.classList.contains('eyebrow')) left = el.getBoundingClientRect().left; else { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()]; if (!rs.length) return; left = Math.min(...rs.map((r) => r.left)); }
    rows.push({ tag: el.tagName.toLowerCase() + (el.classList.contains('eyebrow') ? '.eyebrow' : ''), text: el.textContent.trim().slice(0, 28), left });
  });
  return { lx, rows };
})()`;

const browser = await launch();
for (const vp of VPS) {
  const { ctx, page } = await newPage(browser, vp);
  for (const r of ONLY || [...SAOC_ROUTES, ...LEGAL_ROUTES]) {
    await open(page, r);
    const { lx, rows } = await page.evaluate(MEASURE);
    const off = rows.filter((x) => Math.abs(x.left - lx) > 1.5);
    if (LEGAL_ROUTES.includes(r)) { if (off.length) notes.push(`${vp.name} ${r}: ${off.length} element(s) off the axis (NOTE, legal reading column)`); continue; }
    checked += rows.length;
    for (const x of off) problems.push(`${vp.name} ${r}: ${x.tag} "${x.text}" starts at ${Math.round(x.left * 10) / 10}, logo at ${Math.round(lx * 10) / 10}`);
  }
  await ctx.close();
}
await browser.close();
if (!ONLY && checked < 60) problems.push(`only ${checked} left-aligned headings/eyebrows measured across all routes and viewports: detection is vacuous`);
const css = readFileSync(`${ROOT}app/globals.css`, 'utf8');
const rule = css.match(/\.saoc-container\s*\{[^}]*\}/);
if (!rule) problems.push('app/globals.css has no .saoc-container rule');
else {
  if (!/var\(--container-max\)/.test(rule[0]) || !/var\(--container-pad\)/.test(rule[0])) problems.push('.saoc-container must be built from var(--container-max) and var(--container-pad)');
  if (!/F19/.test(css.slice(Math.max(0, css.indexOf(rule[0]) - 400), css.indexOf(rule[0])))) problems.push('.saoc-container must sit under an F19 comment');
}
const { execFileSync } = await import('node:child_process');
let users = '';
try { users = execFileSync('grep', ['-rl', '--include=*.tsx', 'saoc-container', `${ROOT}app`, `${ROOT}components`], { encoding: 'utf8' }); } catch { users = ''; }
const n = users.split('\n').filter(Boolean).length;
if (n < 6) problems.push(`.saoc-container is used in ${n} file(s), expected at least 6`);
notes.forEach((x) => console.log(`NOTE ${x}`));
report(problems, `SAOC headings and eyebrows sit on the header logo's x on ${SAOC_ROUTES.length} routes at 390, 1280, 1920 and 2056 via one .saoc-container (${n} files)`);
