// nos-critique-r17 F2 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Golden: goldens/f2-logo.json (Codi's rulings FINAL 2026-10-19, after her correction). Both modes, 1280 and 390, on the golden NOS routes.
//   R1  the NOS footer brand slot holds exactly one <picture> with no media-switched <source> (the <=700 swap is dropped); every image
//       candidate is the chosen GOLD vertical file (raw or its /images/_opt/<name>.png-N.webp variant) in a density set capped at 2x; alt
//       is the existing LOCKUP_ALT; the rendered aspect is the file's; the served file hashes to the chosen sha256.
//   R2  the footer shows no "South African Orchid Council" eyebrow (an element reading exactly that) and not the SAOC paragraph.
//   R3  "REG# 1978/004040/08   NPO 043-901" still shows, exactly (three U+00A0), as the first text after the lockup, in the label-role
//       restyle: Karla 700, 12px, letter-spacing 1.68px (.14em), uppercase, rgb(243,242,214) (--nc-gold), >= 4.5:1 against its ground.
//   R4  size and placement: the image renders at the golden width for the viewport (360px at >=701, 280px at <=700), never wider than the
//       footer wrap's content box, centred in it (+-1px), on the royal ground rgb(33,26,87); the rendered emblem is >= 24px tall (logo PDF
//       p.08); the gap from the lockup's visible bottom (the location line) to the REG line is >= calc(0.25 * rendered emblem width) - 1px
//       (PDF p.08 clear space) and at most that plus the image's own transparent bottom padding + 1px; no other visible footer element
//       intrudes on that clear space around the mark.
//   R5  the .nf-base row (copyright + legal links) is unchanged from BASE; the SAOC footer (/about) still shows the REG/NPO line and
//       not the NOS logo.
import { createHash } from 'node:crypto';
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';
import { ratio, round2 } from './_color.mjs';
import { fillOf } from './_probe.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const G = goldenJson('f2-logo.json');
const WIDTHS = [1280, 390];
const GEO = G.geometry;
const GAP = G.guidance.gap;
const RW = G.guidance.renderWidth;
const RS = G.reg.restyle;
const [FW, FH] = G.chosen ? G.chosen.dims : Object.values(G.candidates)[0].dims;
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
          const img = brand.querySelector('img');
          const rect = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, w: b.width, h: b.height }; };
          const wrap = f.querySelector('.nf-wrap') ?? f;
          const ws = getComputedStyle(wrap); const wb = wrap.getBoundingClientRect();
          const content = { x: wb.left + parseFloat(ws.paddingLeft), w: wb.width - parseFloat(ws.paddingLeft) - parseFloat(ws.paddingRight) };
          const leaves = [...f.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim());
          const regEl = leaves.find((e) => e.textContent === reg) ?? null;
          const after = img ? leaves.find((e) => (img.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) && e.getBoundingClientRect().width > 0) : null;
          const cs = regEl ? getComputedStyle(regEl) : null;
          const others = [...f.querySelectorAll('a, p, span, div, li, input, button, img')].filter((e) => {
            if (e === img || e.contains(img) || img?.contains(e) || e === regEl) return false;
            if (!e.children.length || ['A', 'INPUT', 'BUTTON', 'IMG'].includes(e.tagName)) { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (e.textContent.trim() || ['INPUT', 'BUTTON', 'IMG'].includes(e.tagName)); }
            return false;
          }).map((e) => ({ t: (e.textContent || e.tagName).trim().slice(0, 40), ...rect(e) }));
          const base = f.querySelector('.nf-base');
          return {
            pictures: brand.querySelectorAll('picture').length,
            mediaSources: [...brand.querySelectorAll('picture source')].filter((x) => x.hasAttribute('media')).length,
            candidates: img ? [img.getAttribute('src'), ...[img.getAttribute('srcset'), ...[...brand.querySelectorAll('picture source')].map((x) => x.getAttribute('srcset'))].filter(Boolean).flatMap((ss) => ss.split(',').map((c) => c.trim()))].filter(Boolean) : [],
            src: img ? new URL(img.currentSrc || img.src).pathname : null, alt: img?.getAttribute('alt') ?? null,
            box: img ? rect(img) : null, content, others,
            eyebrow: leaves.some((e) => e.textContent.trim().toLowerCase() === eyebrow.toLowerCase()),
            para: f.textContent.includes(para),
            reg: regEl ? { ...rect(regEl), first: after === regEl, font: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize, ls: cs.letterSpacing, tt: cs.textTransform, color: cs.color } : null,
            legal: base ? [...base.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.textContent.trim()]) : null,
            copyright: base ? base.querySelector('span')?.textContent ?? null : null,
          };
        }, { eyebrow: G.removed.eyebrow, para: G.removed.paragraph, reg: G.reg.text });
        if (!s) { failures.push(`${at}: no footer#nf`); continue; }
        // R1
        if (s.pictures !== 1 || s.mediaSources !== 0) failures.push(`${at}: brand slot has ${s.pictures} <picture> and ${s.mediaSources} media-switched <source>, want one <picture> and no swap (R1)`);
        if (s.alt !== G.alt) failures.push(`${at}: logo alt ${JSON.stringify(s.alt)}, want ${JSON.stringify(G.alt)} (R1)`);
        if (!G.chosen) failures.push(`${at}: goldens/f2-logo.json chosen is null (R1)`);
        else {
          const name = G.chosen.path.replace(/^\/images\//, '').replace(/[.]/g, '\\.');
          const ok = (u) => u === G.chosen.path || new RegExp(`^/images/_opt/${name}-\\d+\\.webp$`).test(u);
          if (!ok(s.src ?? '')) failures.push(`${at}: logo shows ${s.src}, want ${G.chosen.path} or its _opt variant (R1)`);
          const bad = s.candidates.filter((c) => { const [u, d] = c.split(/\s+/); return !ok(new URL(u, 'http://x').pathname) || (d && !/^[12]x$/.test(d)); });
          if (bad.length) failures.push(`${at}: image candidates outside the chosen file's 1x/2x set: ${bad.slice(0, 3).join(' | ')} (R1)`);
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
        else {
          if (!s.reg.first) failures.push(`${at}: the REG/NPO line is not the first text after the lockup (R3)`);
          const want = { weight: RS.fontWeight, size: RS.fontSize, ls: RS.letterSpacing, tt: RS.textTransform, color: RS.color };
          for (const [k, v] of Object.entries(want)) if (s.reg[k] !== v) failures.push(`${at}: REG/NPO ${k} ${s.reg[k]}, want ${v} (R3)`);
          if (!new RegExp(RS.fontFamily, 'i').test(s.reg.font)) failures.push(`${at}: REG/NPO font-family ${s.reg.font}, want ${RS.fontFamily} (R3)`);
          const fr = await fillOf(page, page.locator('footer#nf').getByText(G.reg.text, { exact: true }).first());
          const cr = ratio(fr.fg, fr.ground);
          if (cr < RS.minRatio) failures.push(`${at}: REG/NPO rgb(${fr.fg}) on rgb(${fr.ground}) = ${round2(cr)}:1, want >= ${RS.minRatio} (R3)`);
        }
        // R4
        if (s.box) {
          const target = Math.min(width >= RW.breakpoint + 1 ? RW.gte701 : RW.lte700, s.content.w);
          if (Math.abs(s.box.w - target) > 1) failures.push(`${at}: logo ${s.box.w.toFixed(1)}px wide, want ${target}px (R4)`);
          const mid = s.box.x + s.box.w / 2; const cmid = s.content.x + s.content.w / 2;
          if (Math.abs(mid - cmid) > 1) failures.push(`${at}: logo centre x ${mid.toFixed(1)}, footer content centre ${cmid.toFixed(1)} (R4)`);
          const k = s.box.h / FH;
          const emblemH = (GEO.emblemBox[3] - GEO.emblemBox[1]) * k;
          if (emblemH < G.guidance.minEmblemPx) failures.push(`${at}: emblem renders ${emblemH.toFixed(1)}px tall, below the PDF minimum ${G.guidance.minEmblemPx}px (R4)`);
          const clear = (GEO.emblemBox[2] - GEO.emblemBox[0]) * (s.box.w / FW) * G.guidance.clearSpaceOfEmblemWidth;
          if (s.reg) {
            const visBottom = s.box.y + GEO.contentBox[3] * k;
            const gap = s.reg.y - visBottom;
            const pad = (FH - GEO.contentBox[3]) * k;
            if (gap < clear - GAP.tolerancePx || gap > clear + pad + GAP.tolerancePx) failures.push(`${at}: lockup-to-REG gap ${gap.toFixed(1)}px, want calc(0.25 * emblem width) = ${clear.toFixed(1)}px (up to +${pad.toFixed(1)}px image padding) (R4)`);
          }
          const c = { x0: s.box.x + GEO.contentBox[0] * k - clear, y0: s.box.y + GEO.contentBox[1] * k - clear, x1: s.box.x + GEO.contentBox[2] * k + clear, y1: s.box.y + GEO.contentBox[3] * k + clear - GAP.tolerancePx };
          const hits = s.others.filter((o) => o.x < c.x1 && o.x + o.w > c.x0 && o.y < c.y1 && o.y + o.h > c.y0);
          if (hits.length) failures.push(`${at}: ${hits.length} element(s) inside the logo's clear space (${clear.toFixed(1)}px): ${hits.slice(0, 3).map((h) => JSON.stringify(h.t)).join(', ')} (R4)`);
          const fl = await fillOf(page, page.locator('footer#nf .nf-brand img').first());
          if (`rgb(${fl.ground.join(', ')})` !== G.footerGround) failures.push(`${at}: ground under the logo rgb(${fl.ground.join(', ')}), want ${G.footerGround} (R4)`);
        }
        // R5 (NOS base row)
        if (JSON.stringify(s.legal) !== JSON.stringify(G.legal.links)) failures.push(`${at}: legal links ${JSON.stringify(s.legal)}, want ${JSON.stringify(G.legal.links)} (R5)`);
        if (!(s.copyright ?? '').endsWith(G.legal.copyrightTail)) failures.push(`${at}: copyright ${JSON.stringify(s.copyright)} changed (R5)`);
      }
      // R5 (SAOC footer)
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
finish(NAME, failures, `F2 rendered: ${checks} checks across ${MODES.join('/')} at ${WIDTHS.join('/')}: one centred gold vertical logo at 360/280, REG/NPO in the label role a clear space below it, SAOC eyebrow and paragraph gone, base row unchanged.`);
