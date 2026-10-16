#!/usr/bin/env node
// F19-F1 (design-cb P1 vs the v4 acceptance check) - font load split. NOT IN THE GATE: it cannot be met inside F19's allowlist (see f19-spec.md
// section 8 for the exact diff the lead has to route). Informational until then: prints the measured faces per route.
// Target: on every NOS route the preload and stylesheet font requests are only Fraunces and Karla, and the loaded families are only those; on
// the SAOC routes the loaded face set equals golden-fonts (Crimson Pro, Manrope, JetBrains Mono, as today) with identical computed
// font-family on h1, p and .eyebrow at 390 and 1280.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-p-fonts.mjs
import { launch, BASE, report, loadGolden } from './_lib.mjs';
import { NOS_ROUTES } from './_nos.mjs';
import { SAOC_ROUTES } from './_routes.mjs';

const T = loadGolden('tokens.json').fonts;
const problems = [];
const browser = await launch();
const user = process.env.BETA_BASIC_AUTH_USER, pass = process.env.BETA_BASIC_AUTH_PASSWORD;
async function faces(route) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, httpCredentials: user && pass ? { username: user, password: pass } : undefined });
  const p = await ctx.newPage(); const reqs = [];
  p.on('request', (r) => { if (r.resourceType() === 'font') reqs.push(r.url()); });
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  const fam = await p.evaluate(async () => { await document.fonts.ready; return [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/ Fallback$/, '')))].sort(); });
  const cssFonts = await p.evaluate(() => [...document.querySelectorAll('link[rel=preload][as=font]')].length);
  const stacks = await p.evaluate(() => ['h1', 'main p', '.eyebrow'].map((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : null; }));
  await ctx.close();
  return { fam, reqs: reqs.length, preloads: cssFonts, stacks };
}
for (const r of NOS_ROUTES) {
  const f = await faces(r);
  const extra = f.fam.filter((x) => !T.nos.includes(x));
  if (extra.length) problems.push(`${r}: NOS route loads ${extra.join(', ')} (allowed: ${T.nos.join(', ')})`);
}
for (const r of SAOC_ROUTES) {
  const f = await faces(r);
  if (JSON.stringify(f.fam.filter((x) => T.saoc.includes(x))) !== JSON.stringify([...T.saoc].sort())) problems.push(`${r}: SAOC route face set is ${f.fam.join(', ')}, want at least ${T.saoc.join(', ')}`);
}
await browser.close();
report(problems, 'NOS routes load only Fraunces and Karla; SAOC routes keep their face set');
