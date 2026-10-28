// council-design-1 C1 gate (COUNCIL-1 C1, SAOC host). The footer lockup is the supplied vertical colour-on-dark file, served from a resize-only
// ladder of a byte-identical copy: rendered HEIGHT = the old lockup's baseline height +-4 at 1440 and 390 (amended: by height, not width; max-width 100%, height auto), no horizontal overflow at 390/768/1023,
// served natural width >= rendered width x DPR at DPR 1, 2 and 3, never recoloured/cropped/trimmed (served aspect = 1915/1531), accessible name unchanged, no live Lora/Mono text in the footer,
// header and mobile drawer lockups still the horizontal raster. By-eye screenshots: checks/shoot-footer.mjs.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { withSite, check, finish } from './council-lib.mjs';

const G = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-design-1/goldens/c1-footer-lockup.json', 'utf8'));
const BASE = '.agent/memory/project/specs/council-1028/council-design-1/goldens/baseline-post-wave.json'; const REG = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-design-1/goldens/footer-reg-line.json', 'utf8'));
check(existsSync(BASE), `${BASE} does not exist: @dev step 0 captures it (baseline.mjs capture) BEFORE any edit`);
const B = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : { footer: {} };
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
check(sha(G.source) === G.sourceSha256, `${G.source} differs from the golden sha256 (the supplied file was changed)`);
try { check(sha(G.servedCopy) === G.sourceSha256, `${G.servedCopy} is not a byte-identical copy of the supplied file`); } catch { check(false, `${G.servedCopy} does not exist`); }
const fl = readFileSync('components/chrome/FooterLockup.tsx', 'utf8');
check(/import\s*\{[^}]*ACCESSIBLE_LABEL[^}]*\}\s*from\s*['"][^'"]*SaocLockup['"]/.test(fl), 'FooterLockup.tsx must import ACCESSIBLE_LABEL from SaocLockup (NOS Design amendment: alt is the exported label verbatim)');
check(!/Making a difference since 1968/.test(fl) && !/export\s+(const|\{)[^\n]*ACCESSIBLE_LABEL/.test(fl), 'FooterLockup.tsx duplicates or re-exports the label string');
const header = readFileSync('components/chrome/Header.tsx', 'utf8'); const drawer = readFileSync('components/chrome/MobileMenu.tsx', 'utf8');
for (const [n, s] of [['Header.tsx', header], ['MobileMenu.tsx', drawer]]) check(s.includes('/images/saoc-lockup-horizontal-full-name.png') && !/import\s*\{[^}]*SaocLockup[^}]*\}/.test(s), `${n} must still render the horizontal raster lockup and not the live SaocLockup (ruling's drawer clause is a no-op)`);

const PROBE = `(name) => { const f = document.querySelector('footer'); const links = [...f.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '/' && a.querySelector('img'));
  const a = links[0]; if (!a) return { found: false };
  const img = a.querySelector('img'); const r = img.getBoundingClientRect(); const ar = a.getAttribute('aria-label'); const alt = img.getAttribute('alt');
  const nm = (ar || alt || '').trim(); const reg = [...f.querySelectorAll('span,p,div')].find((e) => /REG#/.test(e.textContent) && ![...e.children].some((c) => /REG#/.test(c.textContent) && c.children.length >= 0 && /REG#/.test(c.textContent) && c.tagName !== 'SPAN')); const regItems = reg ? [...reg.querySelectorAll('*')].filter((e) => e.children.length === 0 && /REG#|NPO/.test(e.textContent)).map((e) => { const c = getComputedStyle(e); const lh = parseFloat(c.lineHeight) || e.getBoundingClientRect().height; return { t: e.textContent.trim(), fam: c.fontFamily.split(',')[0].replace(/["']/g, ''), size: c.fontSize, weight: c.fontWeight, tnum: c.fontVariantNumeric, tt: c.textTransform, ls: c.letterSpacing, ws: c.whiteSpace, lines: Math.round(e.getBoundingClientRect().height / lh) }; }) : null; const lora = [...f.querySelectorAll('*')].some((e) => /lora|jetbrains/i.test(getComputedStyle(e).fontFamily.split(',')[0]));
  return { found: true, count: links.length, regItems, w: r.width, h: r.height, nat: img.naturalWidth, natH: img.naturalHeight, src: img.currentSrc, ar, alt, name: nm, both: Boolean(ar) && Boolean(alt) && ar !== alt, lora, textInside: a.textContent.trim().length }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1440, 390]) for (const dpr of G.dprs) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 }, dpr)); const page = await ctx.newPage();
    await page.goto(base + '/about', { waitUntil: 'load', timeout: 120000 });
    await page.locator('footer').scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
    const r = await page.evaluate(`(${PROBE})(${JSON.stringify(G.accessibleName)})`); const w = `@${width}x${dpr}`;
    if (!r.found) { check(false, `${w}: no footer link to / containing an img`); await ctx.close(); continue; }
    check(r.count === 1, `${w}: ${r.count} footer lockup links, want 1`);
    const was = B.footer[width]; check(Boolean(was) && Math.abs(r.h - was.h) <= G.sizing.heightTolerancePx, `${w}: lockup renders ${r.h.toFixed(1)}px high, want the old lockup's ${was ? was.h : 'MISSING baseline'} +-${G.sizing.heightTolerancePx} (sized by height, not width)`);
    check(r.nat >= Math.ceil(r.w * dpr), `${w}: served ${r.nat}px natural width < rendered ${r.w.toFixed(1)} x DPR = ${Math.ceil(r.w * dpr)} (${r.src.split('/').pop()})`);
    const ri = r.regItems; const RL = REG.regLine; check(Array.isArray(ri) && ri.length === 2, `${w}: footer registration line must render exactly two nowrap items (REG# and NPO), found ${ri ? ri.length : 'none'}`);
    for (const it of ri || []) { check(it.fam === 'Manrope' && it.size === RL.fontSizePx + 'px' && it.weight === RL.fontWeight && /tabular-nums/.test(it.tnum) && it.tt === 'none' && /^(normal|0px)$/.test(it.ls) && it.ws === 'nowrap' && it.lines === 1, `${w}: reg item "${it.t}" computes ${it.fam} ${it.size}/${it.weight} ${it.tnum} tt=${it.tt} ls=${it.ls} ws=${it.ws} lines=${it.lines}; want Manrope 13px/500 tabular-nums none normal nowrap, one line`); }
    check(Math.abs(r.nat / r.natH - G.naturalWidth / G.naturalHeight) / (G.naturalWidth / G.naturalHeight) <= G.aspectTolerance, `${w}: served ${r.nat}x${r.natH} is not the source aspect ${G.naturalWidth}/${G.naturalHeight} (cropped, trimmed or recoloured variant)`);
    check(/saoc-lockup-south-african-orchid-council-vertical-colour-on-dark/.test(r.src), `${w}: footer img is not the supplied vertical colour-on-dark file (${r.src})`);
    check(r.name === G.accessibleName, `${w}: accessible name "${r.name}" differs from "${G.accessibleName}"`);
    check(!r.both, `${w}: aria-label and alt both set with different text`);
    check(!r.lora, `${w}: the footer still renders Lora or JetBrains text`);
    check(r.textInside === 0, `${w}: the lockup link contains live text (${r.textInside} chars); the lockup must be the image only`);
    await ctx.close();
  }
  for (const width of G.sizing.noHorizontalOverflowAt) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 }, 1)); const page = await ctx.newPage(); await page.goto(base + '/about', { waitUntil: 'load', timeout: 120000 }); await page.waitForTimeout(500);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); check(o.sw <= o.cw, `@${width}: horizontal overflow (scrollWidth ${o.sw} > clientWidth ${o.cw})`); await ctx.close();
  }
});
finish('c1-footer');
