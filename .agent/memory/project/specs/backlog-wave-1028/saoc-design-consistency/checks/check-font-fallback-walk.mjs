// F1e lever 2 (computed-font walk): on the ten routes at 390 and 1440, every visible text node is set in a face the site actually ships, and every character in it
// exists in that face's served file. A character the file lacks, or a first font-family that is not a shipped @font-face (a system face), is a fallback: FAIL.
// Characters are checked against each file's cmap (lib-woff2.mjs), not by eye.
import { withSite, check, finish, tenRoutes } from './lib.mjs';
import { woff2Cmap } from './lib-woff2.mjs';
const FACES = `() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r.type === CSSRule.FONT_FACE_RULE).map((r) => ({ family: r.style.getPropertyValue('font-family').replace(/['"\\s]/g, ''), weight: r.style.getPropertyValue('font-weight') || '400', style: r.style.getPropertyValue('font-style') || 'normal', base: r.parentStyleSheet.href || location.href, src: (r.style.getPropertyValue('src').match(/url\\(["']?([^"')]+)["']?\\)/) || [])[1] })).filter((f) => f.src).map((f) => ({ ...f, src: new URL(f.src, f.base).href }))`;
const TEXT = `() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.textContent.replace(/[\\s\\u200b-\\u200f\\u00ad]/g, ''); if (!t) continue; const e = n.parentElement; if (!e || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName) || e.getBoundingClientRect().width === 0) continue; const c = getComputedStyle(e); if (c.visibility === 'hidden' || c.display === 'none') continue;
  out.push({ fam: c.fontFamily.split(',')[0].replace(/['"\\s]/g, ''), wt: Number(c.fontWeight), st: c.fontStyle, text: t, tag: e.tagName }); } return out; }`;
const inRange = (spec, w) => { const [a, b] = String(spec).trim().split(/\s+/).map(Number); return w >= a && w <= (b ?? a); };
await withSite(async (site) => {
  const { base, browser, ctxOpts } = site; const cmaps = new Map();
  for (const width of [390, 1440]) for (const path of tenRoutes(site)) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 })); const page = await ctx.newPage(); const resp = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForTimeout(500);
    const w = `${path}@${width}`; check(resp && resp.status() === 200, `${w} status ${resp && resp.status()}`);
    const faces = await page.evaluate(`(${FACES})()`); const texts = await page.evaluate(`(${TEXT})()`); const bad = new Map();
    for (const t of texts) {
      const face = faces.find((f) => f.family === t.fam && f.st === t.st || f.family === t.fam && t.st !== 'normal' && f.style === 'normal' && false) ?? faces.find((f) => f.family === t.fam && f.style === t.st && inRange(f.weight, t.wt));
      const cand = faces.find((f) => f.family === t.fam && f.style === t.st && inRange(f.weight, t.wt)) ?? face;
      if (!cand) { bad.set(`${t.fam} ${t.wt} ${t.st}`, `first family "${t.fam}" is not a shipped @font-face (system fallback), e.g. <${t.tag}> "${t.text.slice(0, 20)}"`); continue; }
      if (/\.woff2(\?|$)/.test(cand.src) && !cmaps.has(cand.src)) { const res = await ctx.request.get(cand.src); cmaps.set(cand.src, woff2Cmap(await res.body())); }
      const cm = cmaps.get(cand.src); if (!cm) continue; const miss = [...new Set([...t.text])].filter((ch) => !cm.has(ch.codePointAt(0)));
      if (miss.length) bad.set(`${cand.src.split('/').pop()} ${miss.join('')}`, `<${t.tag}> "${t.text.slice(0, 24)}" has ${miss.map((c) => c + ' U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ')} missing from ${cand.src.split('/').pop()}`);
    }
    for (const m of bad.values()) check(false, `${w}: ${m}`); await ctx.close();
  }
});
finish('font-fallback-walk');
