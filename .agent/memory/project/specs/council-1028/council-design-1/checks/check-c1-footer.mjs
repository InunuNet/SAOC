// council-design-1 C1 gate (COUNCIL-1 C1, SAOC host). The footer lockup is the supplied vertical colour-on-dark file, served from a resize-only
// ladder of a byte-identical copy: box 280 +-4 at 1440 and 390 (same file, same box, no narrow tier), served natural width >= box x DPR at
// DPR 1, 2 and 3, never recoloured/cropped/trimmed (served aspect = 1915/1531), accessible name unchanged, no live Lora/Mono text in the footer,
// header and mobile drawer lockups still the horizontal raster. By-eye screenshots: checks/shoot-footer.mjs.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { withSite, check, finish } from './council-lib.mjs';

const G = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-design-1/goldens/c1-footer-lockup.json', 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
check(sha(G.source) === G.sourceSha256, `${G.source} differs from the golden sha256 (the supplied file was changed)`);
try { check(sha(G.servedCopy) === G.sourceSha256, `${G.servedCopy} is not a byte-identical copy of the supplied file`); } catch { check(false, `${G.servedCopy} does not exist`); }
const header = readFileSync('components/chrome/Header.tsx', 'utf8'); const drawer = readFileSync('components/chrome/MobileMenu.tsx', 'utf8');
for (const [n, s] of [['Header.tsx', header], ['MobileMenu.tsx', drawer]]) check(s.includes('/images/saoc-lockup-horizontal-full-name.png') && !/import\s*\{[^}]*SaocLockup[^}]*\}/.test(s), `${n} must still render the horizontal raster lockup and not the live SaocLockup (ruling's drawer clause is a no-op)`);

const PROBE = `(name) => { const f = document.querySelector('footer'); const links = [...f.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '/' && a.querySelector('img'));
  const a = links[0]; if (!a) return { found: false };
  const img = a.querySelector('img'); const r = img.getBoundingClientRect(); const ar = a.getAttribute('aria-label'); const alt = img.getAttribute('alt');
  const nm = (ar || alt || '').trim(); const lora = [...f.querySelectorAll('*')].some((e) => /lora|jetbrains/i.test(getComputedStyle(e).fontFamily.split(',')[0]));
  return { found: true, count: links.length, w: r.width, h: r.height, nat: img.naturalWidth, natH: img.naturalHeight, src: img.currentSrc, ar, alt, name: nm, both: Boolean(ar) && Boolean(alt) && ar !== alt, lora, textInside: a.textContent.trim().length }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1440, 390]) for (const dpr of G.dprs) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 }, dpr)); const page = await ctx.newPage();
    await page.goto(base + '/about', { waitUntil: 'load', timeout: 120000 });
    await page.locator('footer').scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
    const r = await page.evaluate(`(${PROBE})(${JSON.stringify(G.accessibleName)})`); const w = `@${width}x${dpr}`;
    if (!r.found) { check(false, `${w}: no footer link to / containing an img`); await ctx.close(); continue; }
    check(r.count === 1, `${w}: ${r.count} footer lockup links, want 1`);
    check(Math.abs(r.w - G.boxPx) <= G.boxTolerancePx, `${w}: lockup renders ${r.w.toFixed(1)}px wide, want ${G.boxPx} +-${G.boxTolerancePx} (same box below 768)`);
    check(r.nat >= Math.ceil(G.boxPx * dpr), `${w}: served ${r.nat}px natural width < box x DPR = ${G.boxPx * dpr} (${r.src.split('/').pop()})`);
    check(Math.abs(r.nat / r.natH - G.naturalWidth / G.naturalHeight) / (G.naturalWidth / G.naturalHeight) <= G.aspectTolerance, `${w}: served ${r.nat}x${r.natH} is not the source aspect ${G.naturalWidth}/${G.naturalHeight} (cropped, trimmed or recoloured variant)`);
    check(/saoc-lockup-south-african-orchid-council-vertical-colour-on-dark/.test(r.src), `${w}: footer img is not the supplied vertical colour-on-dark file (${r.src})`);
    check(r.name === G.accessibleName, `${w}: accessible name "${r.name}" differs from "${G.accessibleName}"`);
    check(!r.both, `${w}: aria-label and alt both set with different text`);
    check(!r.lora, `${w}: the footer still renders Lora or JetBrains text`);
    check(r.textInside === 0, `${w}: the lockup link contains live text (${r.textInside} chars); the lockup must be the image only`);
    await ctx.close();
  }
});
finish('c1-footer');
