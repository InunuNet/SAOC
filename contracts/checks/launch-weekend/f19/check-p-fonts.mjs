#!/usr/bin/env node
// F19-A26 (design-cb P1, lead-confirmed) - font load split. On every NOS route the @font-face families DECLARED (any load status) and the families
// LOADED are only Fraunces and Karla. On every SAOC route the declared set equals the golden set (goldens/f19/fonts-baseline.json, captured from untouched
// main) and the computed font-family (hash-stripped) of h1, h2, main p, .eyebrow, header a, footer a and button is identical to the golden at 390 and 1280:
// SAOC type rendering does not move. F19_CAPTURE=1 rewrites the golden from the running build (used once, against main).
// The NOS UtilityBar and chrome files are off limits, so a NOS element that today resolves to Manrope or JetBrains Mono (the utility bar) must resolve to
// Karla or a system fallback once the faces are gone: the check also fails if any NOS-route element computes a first family outside Fraunces, Karla, serif/sans/monospace generics.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-p-fonts.mjs
import { writeFileSync } from 'node:fs';
import { launch, newPage, open, report, loadGolden, GOLDEN_DIR, VIEWPORTS } from './_lib.mjs';
import { NOS_ROUTES } from './_nos.mjs';
import { SAOC_ROUTES } from './_routes.mjs';

const T = loadGolden('tokens.json').fonts;
const CAPTURE = process.env.F19_CAPTURE === '1';
const SELS = ['h1', 'h2', 'main p', '.eyebrow', 'header a', 'footer a', 'button'];
const problems = [];
const browser = await launch();
const strip = (s) => s.replace(/ Fallback/g, '').replace(/__([A-Za-z_]+?)_[0-9a-f]{6,}/g, (_, n) => n.replace(/_/g, ' '));
async function probe(route, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, route);
  const r = await page.evaluate(async (sels) => {
    await document.fonts.ready;
    const faces = [...document.fonts];
    return {
      declared: [...new Set(faces.map((f) => f.family))].sort(),
      loaded: [...new Set(faces.filter((f) => f.status === 'loaded').map((f) => f.family))].sort(),
      stacks: sels.map((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : null; }),
      firsts: [...new Set([...document.querySelectorAll('body *')].slice(0, 4000).map((e) => getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')))].sort(),
    };
  }, SELS);
  await ctx.close();
  const u = (a) => [...new Set(a.map(strip))].sort();
  return { declared: u(r.declared), loaded: u(r.loaded), stacks: r.stacks.map((s) => (s === null ? null : strip(s))), firsts: u(r.firsts) };
}
if (CAPTURE) {
  const out = { routes: {} };
  for (const r of SAOC_ROUTES) { out.routes[r] = { declared: (await probe(r, VIEWPORTS[1])).declared }; for (const vp of VIEWPORTS) out.routes[r][vp.name] = (await probe(r, vp)).stacks; }
  writeFileSync(`${GOLDEN_DIR}/fonts-baseline.json`, JSON.stringify(out, null, 1));
  await browser.close(); console.log('captured fonts-baseline.json'); process.exit(0);
}
const gold = loadGolden('fonts-baseline.json');
const nosOk = [...T.nos, 'serif', 'sans-serif', 'monospace', 'system-ui', 'ui-monospace', 'ui-sans-serif', 'ui-serif', 'Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New'];
for (const r of NOS_ROUTES) {
  const f = await probe(r, VIEWPORTS[1]);
  const d = f.declared.filter((x) => !T.nos.includes(x)), l = f.loaded.filter((x) => !T.nos.includes(x));
  if (d.length) problems.push(`${r}: NOS route declares ${d.join(', ')} (allowed: ${T.nos.join(', ')})`);
  if (l.length) problems.push(`${r}: NOS route loads ${l.join(', ')}`);
  const stray = f.firsts.filter((x) => x && !nosOk.some((o) => x === o || x.startsWith(o)));
  if (stray.length) problems.push(`${r}: NOS elements compute a first family outside Fraunces/Karla/generics: ${stray.join(', ')}`);
}
for (const r of SAOC_ROUTES) {
  for (const vp of VIEWPORTS) {
    const f = await probe(r, vp);
    if (vp.name === '1280' && JSON.stringify(f.declared) !== JSON.stringify(gold.routes[r].declared)) problems.push(`${r}: SAOC declared faces ${f.declared.join(', ')} != golden ${gold.routes[r].declared.join(', ')}`);
    SELS.forEach((s, i) => { if (f.stacks[i] !== gold.routes[r][vp.name][i]) problems.push(`${r} @${vp.name} ${s}: font-family "${f.stacks[i]}" != golden "${gold.routes[r][vp.name][i]}"`); });
  }
}
await browser.close();
report(problems, 'NOS routes declare and load only Fraunces and Karla; SAOC computed font families identical to main');
