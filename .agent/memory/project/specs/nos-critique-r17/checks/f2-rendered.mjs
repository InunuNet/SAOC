// nos-critique-r17 F2 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Golden: goldens/f2-logo.json. Both modes, 1280 and 390, on the golden NOS routes.
//   R1  the NOS footer brand slot shows ONE image (no <picture> source switch), the chosen vertical file (raw path or its
//       /images/_opt/<name>.png-N.webp variant), alt exactly the existing LOCKUP_ALT, its aspect the file's; the served file hashes to the
//       chosen sha256. PENDING (FAIL) until the lead fills `chosen`.
//   R2  the footer shows no "South African Orchid Council" eyebrow (an element reading exactly that) and not the SAOC paragraph.
//   R3  "REG# 1978/004040/08   NPO 043-901" still shows, exactly, in the footer.
//   R4  legibility per the logo PDF p.08: the rendered emblem is >= 24px tall, and no other visible footer element intrudes on the clear
//       space (one quarter of the emblem width) around the mark; the ground under the logo is the royal footer rgb(33,26,87), on which the
//       golden-measured inks hold (type >= 4.5:1, emblem >= 3:1). If the golden sets renderWidth, the image renders at it (+-1px).
//   R5  the SAOC footer (/about) still shows the REG/NPO line and does not take on the NOS logo (the change is NOS-only).
import { createHash } from 'node:crypto';
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';
import { fillOf } from './_probe.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const G = goldenJson('f2-logo.json');
const WIDTHS = [1280, 390];
const GEO = G.geometry;
const [FW, FH] = Object.values(G.candidates)[0].dims;
const failures = [];
let checks = 0;

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      for (const route of G.routes) {
        checks += 1;
        const at = `${mode} ${route} @${width}`;
        const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
        if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); continue; }
        await page.locator('footer#nf').scrollIntoViewIfNeeded();
        await page.evaluate(async () => { document.querySelectorAll('footer#nf img').forEach((i) => i.setAttribute('loading', 'eager')); await Promise.all([...document.querySelectorAll('footer#nf img')].map((i) => (i.complete ? null : i.decode().catch(() => null)))); });
        const s = await page.evaluate(({ eyebrow, para, reg }) => {
          const f = document.querySelector('footer#nf');
          if (!f) return null;
          const brand = f.querySelector('.nf-brand') ?? f;
          const imgs = [...brand.querySelectorAll('img')];
          const img = imgs[0];
          const b = img?.getBoundingClientRect();
          const box = b ? { x: b.left, y: b.top + scrollY, w: b.width, h: b.height } : null;
          const others = [...f.querySelectorAll('a, p, span, div, h2, h3, li, input, button, img')].filter((e) => {
            if (e === img || e.contains(img) || img?.contains(e)) return false;
            if (!e.children.length || ['A', 'INPUT', 'BUTTON', 'IMG'].includes(e.tagName)) { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (e.textContent.trim() || ['INPUT', 'BUTTON', 'IMG'].includes(e.tagName)); }
            return false;
          }).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.tagName).trim().slice(0, 40), x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; });
          return {
            imgs: imgs.length, sources: brand.querySelectorAll('picture source').length,
            src: img ? new URL(img.currentSrc || img.src).pathname : null, alt: img?.getAttribute('alt') ?? null,
            natural: img ? [img.naturalWidth, img.naturalHeight] : null, box, others,
            eyebrow: [...f.querySelectorAll('*')].some((e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === eyebrow.toLowerCase()),
            para: f.innerText.includes(para) || f.textContent.includes(para),
            reg: [...f.querySelectorAll('*')].some((e) => e.children.length === 0 && e.textContent === reg && e.getBoundingClientRect().width > 0),
          };
        }, { eyebrow: G.removed.eyebrow, para: G.removed.paragraph, reg: G.reg.text });
        if (!s) { failures.push(`${at}: no footer#nf`); continue; }
        // R1
        if (s.imgs !== 1 || s.sources !== 0) failures.push(`${at}: brand slot has ${s.imgs} image(s) and ${s.sources} <source> switch(es), want one image and none (R1)`);
        if (s.alt !== G.alt) failures.push(`${at}: logo alt ${JSON.stringify(s.alt)}, want ${JSON.stringify(G.alt)} (R1)`);
        if (!G.chosen) failures.push(`${at}: PENDING - goldens/f2-logo.json chosen is null (Codi picks white or gold) (R1)`);
        else {
          const name = G.chosen.path.replace(/^\/images\//, '');
          if (!(s.src === G.chosen.path || new RegExp(`^/images/_opt/${name.replace(/[.]/g, '\\.')}-\\d+\\.webp$`).test(s.src ?? ''))) failures.push(`${at}: logo src ${s.src}, want ${G.chosen.path} or its _opt variant (R1)`);
          if (route === G.routes[0] && width === WIDTHS[0]) {
            const res = await ctx.request.get(`${srv.origin}${G.chosen.path}`);
            const h = res.ok() ? createHash('sha256').update(await res.body()).digest('hex') : `HTTP ${res.status()}`;
            if (h !== G.chosen.sha256) failures.push(`${mode}: ${G.chosen.path} served sha256 ${h}, want ${G.chosen.sha256} (R1)`);
          }
        }
        if (s.box && Math.abs(s.box.w / s.box.h - FW / FH) > 0.01 * (FW / FH)) failures.push(`${at}: logo renders ${s.box.w.toFixed(1)}x${s.box.h.toFixed(1)}, not the file's ${FW}:${FH} aspect (R1)`);
        // R2
        if (s.eyebrow) failures.push(`${at}: footer still shows the "${G.removed.eyebrow}" eyebrow (R2)`);
        if (s.para) failures.push(`${at}: footer still shows the SAOC paragraph (R2)`);
        // R3
        if (!s.reg) failures.push(`${at}: footer does not show "${G.reg.text}" exactly (R3)`);
        // R4
        if (s.box) {
          const k = s.box.h / FH;
          const emblemH = (GEO.emblemBox[3] - GEO.emblemBox[1]) * k;
          if (emblemH < G.guidance.minEmblemPx) failures.push(`${at}: emblem renders ${emblemH.toFixed(1)}px tall, below the PDF minimum ${G.guidance.minEmblemPx}px (R4)`);
          const clear = (GEO.emblemBox[2] - GEO.emblemBox[0]) * k * G.guidance.clearSpaceOfEmblemWidth;
          const c = { x0: s.box.x + GEO.contentBox[0] * k - clear, y0: s.box.y + GEO.contentBox[1] * k - clear, x1: s.box.x + GEO.contentBox[2] * k + clear, y1: s.box.y + GEO.contentBox[3] * k + clear };
          const hits = s.others.filter((o) => o.x < c.x1 && o.x + o.w > c.x0 && o.y < c.y1 && o.y + o.h > c.y0);
          if (hits.length) failures.push(`${at}: ${hits.length} element(s) inside the logo's clear space (${clear.toFixed(1)}px): ${hits.slice(0, 3).map((h) => JSON.stringify(h.t)).join(', ')} (R4)`);
          if (G.guidance.renderWidth && Math.abs(s.box.w - G.guidance.renderWidth) > 1) failures.push(`${at}: logo ${s.box.w.toFixed(1)}px wide, want ${G.guidance.renderWidth}px (R4)`);
          const f = await fillOf(page, page.locator('footer#nf .nf-brand img').first());
          if (`rgb(${f.ground.join(', ')})` !== G.footerGround) failures.push(`${at}: ground under the logo rgb(${f.ground.join(', ')}), want ${G.footerGround} (R4)`);
        }
      }
      // R5
      checks += 1;
      await page.goto(`${srv.origin}${G.saocRoute}`, { waitUntil: 'networkidle' });
      const saoc = await page.evaluate(() => { const f = document.querySelector('footer'); return { text: f?.textContent ?? '', imgs: f ? [...f.querySelectorAll('img')].map((i) => new URL(i.currentSrc || i.src).pathname) : [] }; });
      if (!saoc.text.includes(G.reg.text)) failures.push(`${mode} ${G.saocRoute} @${width}: the SAOC footer lost its REG/NPO line (R5)`);
      const logoName = G.chosen ? G.chosen.path.replace(/^\/images\//, '') : null;
      if (logoName && saoc.imgs.some((p) => p.includes(logoName))) failures.push(`${mode} ${G.saocRoute} @${width}: the SAOC footer shows the NOS logo (R5)`);
      await ctx.close();
    }
  } catch (e) {
    failures.push(`${mode}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}
finish(NAME, failures, `F2 rendered: ${checks} checks across ${MODES.join('/')} at ${WIDTHS.join('/')}: NOS footer shows the chosen vertical logo alone, REG/NPO kept, SAOC eyebrow and paragraph gone, legible on royal.`);
