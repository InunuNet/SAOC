// F1e lever 1 gate: on the ten routes at 390 and 1440 (cold cache each time) no font FILE (by content hash, not URL) is fetched twice and at most 4 DISTINCT font files (NOS Design ruling: SAOC cap is <=4 per route; NOS routes keep <=3 under NOS Site's TYPE-15, not asserted here) are on the critical path, each <=40 KB
// (every font requested up to network idle). Also: every font file that loaded belongs to a face that some rendered text actually uses (no shipped-but-unused weight/style).
import { createHash } from 'node:crypto';
import { withSite, openPage, check, finish, tenRoutes } from './lib.mjs';
const USED = `() => { const faces = [...document.fonts].filter((f) => f.status === 'loaded' && !/Fallback/.test(f.family)).map((f) => ({ family: f.family.replace(/['"]/g, ''), weight: f.weight, style: f.style }));
  const used = new Set(); const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (!n.textContent.trim()) continue; const e = n.parentElement; if (!e || e.getBoundingClientRect().width === 0) continue; const c = getComputedStyle(e); used.add(c.fontFamily.split(',')[0].replace(/['"\\s]/g, '') + '|' + c.fontWeight + '|' + c.fontStyle); }
  return { faces, used: [...used] }; }`;
const inRange = (spec, w) => { const [a, b] = String(spec).split(/\s+/).map(Number); return w >= a && w <= (b ?? a); };
await withSite(async (site) => {
  const { base, browser, ctxOpts } = site; const hashes = new Map();
  for (const width of [390, 1440]) for (const path of tenRoutes(site)) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 })); const page = await ctx.newPage(); const urls = [];
    page.on('request', (r) => { if (r.resourceType() === 'font') urls.push(r.url()); });
    const resp = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForTimeout(500); const w = `${path}@${width}`;
    check(resp && resp.status() === 200, `${w} status ${resp && resp.status()}`);
    // Duplicates are detected by FILE (sha256 of the response body), not by URL: the same bytes served from two URLs (a copied or re-hashed file) is a duplicate fetch too.
    const sha = async (u) => { if (!hashes.has(u)) hashes.set(u, createHash('sha256').update(await (await ctx.request.get(u)).body()).digest('hex')); return hashes.get(u); };
    const byFile = new Map(); for (const u of urls) { const h = await sha(u); byFile.set(h, [...(byFile.get(h) || []), u]); }
    const dup = [...byFile.values()].filter((us) => us.length > 1).map((us) => us[0]); check(dup.length === 0, `${w}: font file(s) fetched twice (same content, by hash, whether or not the URL differs): ${dup.map((u) => u.split('/').pop()).join(', ')}`);
    const distinct = new Set([...byFile.values()].map((us) => us[0])); check(distinct.size <= 4, `${w}: ${distinct.size} distinct font files on the critical path (${[...distinct].map((u) => u.split('/').pop()).join(', ')}), want <=4`);
    for (const u of distinct) { const b = (await ctx.request.get(u)).headers()['content-length']; const n = b ? Number(b) : (await (await ctx.request.get(u)).body()).length; check(n <= 40960, `${w}: ${u.split('/').pop()} is ${(n / 1024).toFixed(1)} KB, want <=40 KB`); }
    const r = await page.evaluate(`(${USED})()`);
    for (const f of r.faces) { const ok = r.used.some((u) => { const [fam, wt, st] = u.split('|'); return fam.replace(/_\w+$/, '') === f.family.replace(/\s/g, '').replace(/_\w+$/, '') && st === f.style && inRange(f.weight, Number(wt)); }); check(ok, `${w}: loaded face ${f.family} ${f.weight} ${f.style} is not used by any rendered text`); }
    await ctx.close();
  }
});
finish('fonts-network');
