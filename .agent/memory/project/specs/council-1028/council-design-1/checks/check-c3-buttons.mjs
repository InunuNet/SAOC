// council-design-1 C3 gate (COUNCIL-1 C3, SAOC host): every button and button-styled link computes the ONE button style (Manrope 13/700,
// uppercase, 0.12em, line-height 1, min-height 44, one line at 390), reached by CSS text-transform only (source strings and accessible names unchanged);
// text links, nav and breadcrumbs stay sentence case. Two-way: (1) every button-LOOKING control must carry .btn-caps (candidate heuristic below, exceptions
// only via goldens/button-allowlist.json, max 12, reasons pill/toggle/tab/card/icon-only), (2) every .btn-caps computes the spec. Then the NOS-inert
// proof: inside .nos-theme the class changes nothing (the NOS button role is NOS Site's NR-8, not this feature).
import { readFileSync } from 'node:fs';
import { withSite, openPage, check, finish, tenRoutes, EXTRA_ROUTES, societyDetail, nosBaseFor } from './council-lib.mjs';

const ALLOW = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-design-1/goldens/button-allowlist.json', 'utf8'));
const OK_REASONS = /^(pill|toggle|tab|card|icon-only)\b/i;
check(ALLOW.entries.length <= ALLOW.maxEntries, `button-allowlist has ${ALLOW.entries.length} entries, max ${ALLOW.maxEntries}`);
for (const e of ALLOW.entries) check(OK_REASONS.test(e.reason ?? ''), `allowlist entry "${e.text}" has reason "${e.reason}" (must start with pill, toggle, tab, card or icon-only)`);

const SCAN = `() => {
  const a = (v) => { const m = v.match(/[\\d.]+/g) || []; return m.length > 3 ? Number(m[3]) : (/^rgb/.test(v) ? 1 : 0); };
  const rows = [];
  for (const e of document.querySelectorAll('a[href], button, [role=button], input[type=submit]')) {
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    if (r.width === 0 || r.height === 0 || c.visibility === 'hidden' || c.display === 'none') continue;
    const label = (e.tagName === 'INPUT' ? e.value : e.textContent).replace(/\\s+/g, ' ').trim(); if (!label || label.length > 40) continue;
    if (e.querySelector('h1,h2,h3,h4,p,img,ul,li,div,table')) continue; if (r.height > 80) continue;
    if (e.closest('script,style,noscript')) continue;
    const filled = a(c.backgroundColor) > 0.05; const bw = parseFloat(c.borderTopWidth) >= 1 && a(c.borderTopColor) > 0.05;
    const marked = e.classList.contains('btn-caps');
    const pill = e.matches('[aria-pressed],[role=tab],[role=option],[role=radio],[role=menuitem],[data-filter]') || Boolean(e.closest('[role=tablist],[role=radiogroup]'));
    if (!marked && !((filled || bw) && !pill)) continue;
    const rg = document.createRange(); rg.selectNodeContents(e); const tops = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 3)));
    rows.push({ tag: e.tagName.toLowerCase(), label, marked, pill, size: parseFloat(c.fontSize), weight: c.fontWeight, tt: c.textTransform, ls: parseFloat(c.letterSpacing), lh: c.lineHeight, fam: c.fontFamily.split(',')[0], mh: parseFloat(c.minHeight), h: r.height, lines: tops.size, label0: label });
  }
  return rows; }`;
const allowed = (route, r) => ALLOW.entries.some((x) => x.route === route && x.tag === r.tag && x.text === r.label);
let marked = 0;
const judge = (route, w, rows) => {
  for (const r of rows) {
    if (allowed(route, r)) continue;
    const tag = `${route}@${w} <${r.tag}> "${r.label}"`;
    check(r.marked, `${tag}: looks like a button but lacks .btn-caps (computes ${r.size}px/${r.weight}/${r.tt}); if it is a pill/toggle/card, add it to goldens/button-allowlist.json with a reason`);
    if (!r.marked) continue; marked += 1;
    check(r.size === 13 && r.weight === '700' && r.tt === 'uppercase' && Math.abs(r.ls - 1.56) <= 0.05 && r.lh === '13px' && /manrope/i.test(r.fam), `${tag}: computes ${r.size}px/${r.weight}/${r.tt}/ls ${r.ls}/lh ${r.lh}/${r.fam}, want Manrope 13/700 uppercase 1.56px lh 13px`);
    check(r.h >= 44 - 0.5, `${tag}: height ${r.h.toFixed(1)} < 44`);
    check(r.lines <= 1, `${tag}: the label wraps onto ${r.lines} lines`);
  }
};

await withSite(async (site) => {
  const { base, browser, ctxOpts } = site; const soc = await societyDetail(base);
  const routes = [...tenRoutes(site), ...EXTRA_ROUTES.filter((r) => !r.includes('does-not-exist')), ...(soc ? [soc] : [])];
  for (const width of [390, 1440]) for (const path of routes) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width, 900);
    if (status !== 200) { check(false, `${path}@${width}: status ${status}`); await ctx.close(); continue; }
    judge(path, width, await page.evaluate(`(${SCAN})()`));
    if (width === 390) { // the mobile drawer
      const menu = page.locator('[data-hd=menu]'); if (await menu.count()) { await menu.first().click(); await page.waitForTimeout(500); judge(path + '#drawer', width, await page.evaluate(`(${SCAN})()`)); }
    }
    await ctx.close();
  }
  { // the labelled MENU button exists between 781 and 1279
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', 1100, 900); const rows = await page.evaluate(`(${SCAN})()`);
    check(rows.some((r) => /^menu$/i.test(r.label) && r.marked), '/about@1100: the labelled MENU button is missing or lacks .btn-caps'); judge('/about', 1100, rows); await ctx.close();
  }
  const nos = nosBaseFor(base);
  if (nos) for (const path of ['/', '/tickets', '/vendors/apply', '/what-to-expect', '/faq']) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, nos, path, 1440, 900); if (status !== 200) { await ctx.close(); continue; }
    const diffs = await page.evaluate(() => { const props = ['fontFamily', 'fontSize', 'fontWeight', 'textTransform', 'letterSpacing', 'lineHeight']; const out = [];
      for (const e of document.querySelectorAll('.nos-theme .btn-caps, .nos-theme.btn-caps')) { const before = getComputedStyle(e); const b = props.map((p) => before[p]); e.classList.remove('btn-caps'); const after = getComputedStyle(e); const a = props.map((p) => after[p]); e.classList.add('btn-caps'); if (b.join('|') !== a.join('|')) out.push(`${e.textContent.trim().slice(0, 24)}: ${b.join(',')} vs ${a.join(',')}`); }
      return out; });
    check(diffs.length === 0, `NOS ${path}: .btn-caps is NOT inert inside .nos-theme (the NOS button role is NOS Site's NR-8): ${diffs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
});
check(marked > 0, 'no .btn-caps element found on any walked route (vacuous pass)');
finish('c3-buttons');
