// council-design-1 C4 role gate (COUNCIL-1 C4): the five type roles are defined once in app/globals.css with the ruled values, the vendor form
// label uses t-field, and on the rendered SAOC pages (a) every element carrying a role class computes that role's spec, (b) NO uppercase
// label-like text node is anything but t-label (13px/600/0.12em) or btn-caps, so a residual 11px mono-era label cannot hide behind a missing
// class, (c) breadcrumbs compute 14/500 sentence case, (d) no rendered text is under 12px.
import { readFileSync } from 'node:fs';
import { withSite, openPage, check, finish, tenRoutes, EXTRA_ROUTES, societyDetail } from './council-lib.mjs';

const ROLES = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-design-1/goldens/type-roles.json', 'utf8')).roles;
const css = readFileSync('app/globals.css', 'utf8');
const block = (cls) => { const m = css.match(new RegExp(`\\.${cls}(?![\\w-])[^{}]*\\{([^{}]*)\\}`)); return m ? m[1].replace(/\s+/g, ' ') : null; };
const need = {
  'btn-caps': [/font-family:\s*var\(--sans\)/, /font-size:\s*13px/, /font-weight:\s*700/, /text-transform:\s*uppercase/, /letter-spacing:\s*0\.12em/, /line-height:\s*1\b/],
  't-label': [/font-family:\s*var\(--sans\)/, /font-size:\s*13px/, /font-weight:\s*600/, /text-transform:\s*uppercase/, /letter-spacing:\s*0\.12em/],
  't-crumb': [/font-family:\s*var\(--sans\)/, /font-size:\s*14px/, /font-weight:\s*500/],
  't-num': [/font-family:\s*var\(--sans\)/, /font-variant-numeric:\s*tabular-nums/],
  't-field': [/font-family:\s*var\(--sans\)/, /font-size:\s*14px/, /font-weight:\s*600/],
};
for (const [cls, pats] of Object.entries(need)) {
  const b = block(cls);
  check(b !== null, `app/globals.css has no .${cls} rule`);
  if (b) for (const p of pats) check(p.test(b), `.${cls} rule lacks ${p}: ${b.slice(0, 160)}`);
}
check(/\bt-field\b/.test(readFileSync('components/vendors/VendorFormField.tsx', 'utf8')), 'components/vendors/VendorFormField.tsx does not use t-field for its label (vendor form labels are Manrope 14/600)');

const PROBE = `(roles) => {
  const num = (v) => parseFloat(v);
  const res = { byRole: {}, uppercaseOther: [], small: [], crumbs: [] };
  for (const cls of Object.keys(roles)) res.byRole[cls] = [...document.querySelectorAll('.' + cls)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const c = getComputedStyle(e); return { text: e.textContent.trim().slice(0, 30), fam: c.fontFamily.split(',')[0], size: num(c.fontSize), weight: c.fontWeight, tt: c.textTransform, ls: num(c.letterSpacing), lh: c.lineHeight, mh: num(c.minHeight), fvn: c.fontVariantNumeric }; });
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.textContent.trim()) continue; const e = n.parentElement; if (!e || e.closest('script,style,noscript,template')) continue;
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e); if (r.width === 0 || r.height === 0 || c.visibility === 'hidden') continue;
    const size = num(c.fontSize); const ls = num(c.letterSpacing); const isRole = e.closest('.t-label,.btn-caps');
    if (size < 12) res.small.push(n.textContent.trim().slice(0, 30) + ' ' + size + 'px');
    if (c.textTransform === 'uppercase' && !isRole && !e.closest('h1,h2,h3')) res.uppercaseOther.push(n.textContent.trim().slice(0, 30) + ' ' + size + 'px/' + c.fontWeight + '/' + ls.toFixed(2) + 'px');
  }
  for (const a of document.querySelectorAll('nav[aria-label*="readcrumb" i] a, nav[aria-label*="readcrumb" i] span, nav[aria-label*="readcrumb" i] li')) { const c = getComputedStyle(a); if (a.getBoundingClientRect().width > 0 && a.children.length === 0) res.crumbs.push({ text: a.textContent.trim().slice(0, 30), size: num(c.fontSize), weight: c.fontWeight, tt: c.textTransform, fam: c.fontFamily.split(',')[0] }); }
  return res; }`;
const seen = { 'btn-caps': 0, 't-label': 0, 't-crumb': 0, 't-num': 0 };
const EM = 0.12;
await withSite(async (site) => {
  const { base, browser, ctxOpts } = site; const soc = await societyDetail(base);
  const routes = [...tenRoutes(site), ...EXTRA_ROUTES.filter((r) => !r.includes('does-not-exist')), ...(soc ? [soc] : [])];
  for (const width of [390, 1440]) for (const path of routes) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width, 900); const w = `${path}@${width}`;
    if (status !== 200) { check(false, `${w}: status ${status}`); await ctx.close(); continue; }
    const r = await page.evaluate(`(${PROBE})(${JSON.stringify(ROLES)})`);
    for (const e of r.byRole['t-label'] ?? []) { seen['t-label'] += 1; check(e.size === 13 && e.weight === '600' && e.tt === 'uppercase' && Math.abs(e.ls - 13 * EM) <= 0.05 && /manrope/i.test(e.fam), `${w}: t-label "${e.text}" computes ${e.size}px/${e.weight}/${e.tt}/${e.ls}px ${e.fam}`); }
    for (const e of r.byRole['btn-caps'] ?? []) { seen['btn-caps'] += 1; check(e.size === 13 && e.weight === '700' && e.tt === 'uppercase' && Math.abs(e.ls - 13 * EM) <= 0.05 && e.lh === '13px' && /manrope/i.test(e.fam), `${w}: btn-caps "${e.text}" computes ${e.size}px/${e.weight}/${e.tt}/${e.ls}px lh ${e.lh} ${e.fam}`); }
    for (const e of r.byRole['t-crumb'] ?? []) { seen['t-crumb'] += 1; check(e.size === 14 && e.weight === '500' && e.tt === 'none' && /manrope/i.test(e.fam), `${w}: t-crumb "${e.text}" computes ${e.size}px/${e.weight}/${e.tt} ${e.fam}`); }
    for (const e of r.byRole['t-num'] ?? []) { seen['t-num'] += 1; check(/tabular-nums/.test(e.fvn) && /manrope/i.test(e.fam), `${w}: t-num "${e.text}" computes ${e.fvn} ${e.fam}`); }
    for (const c of r.crumbs) check(c.size === 14 && c.weight === '500' && c.tt === 'none' && /manrope/i.test(c.fam), `${w}: breadcrumb "${c.text}" computes ${c.size}px/${c.weight}/${c.tt} ${c.fam} (want Manrope 14/500 sentence case)`);
    check(r.uppercaseOther.length === 0, `${w}: uppercase text outside t-label/btn-caps: ${r.uppercaseOther.slice(0, 5).join(' | ')}`);
    check(r.small.length === 0, `${w}: text under 12px: ${r.small.slice(0, 5).join(' | ')}`);
    await ctx.close();
  }
});
for (const [k, n] of Object.entries(seen)) if (k !== 't-num') check(n > 0, `no element with role class .${k} was found on any walked route (the gate would pass vacuously)`);
finish('c4-roles');
