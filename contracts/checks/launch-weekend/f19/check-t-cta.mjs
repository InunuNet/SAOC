#!/usr/bin/env node
// F19-A26 (design-cb ruling, hero CTA on the veil): on all 4 carousel slides at 390 and 1280 the PRIMARY CTA inverts - an ivory/bone fill with primary-colour text -
// and the SECONDARY is an ivory outline. Measured on rendered pixels (hero photographed with glyphs hidden):
//   primary fill vs the pixels in a 6px ring just outside the button >= cta.fillVsVeilMin (3:1, non-text UI), fill is ivory/bone (cta.ivory, tolerance cta.ivoryTol),
//   primary label vs its fill >= cta.labelMin (4.5:1); secondary border ivory (alpha >= .85, width >= 1px) and >= cta.borderVsVeilMin (4.5:1) against the pixels in the 6px ring outside it, secondary text ivory and >= cta.secondaryTextMin on the pixels inside it;
//   both the same height and border-radius; both sentence case (no label with two capitalised words).
// Selectors: [data-hero-cta="primary|secondary"] (R5 hooks); falls back to the first two hero anchors so main can be measured.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-t-cta.mjs   (F19_SIMULATE=1 = architect self-test)
import { VIEWPORTS, launch, newPage, open, report, loadGolden, COLOR_SRC } from './_lib.mjs';

const TK = loadGolden('tokens.json'); const T = TK.cta; const PROPER = new Set(TK.casing.properNouns);
const notSentence = (t) => t.split(/\s+/).slice(1).some((w) => /^[A-Z][a-z]/.test(w) && !PROPER.has(w.replace(/[^A-Za-z]/g, '')));
const problems = [];
const browser = await launch();
const HIDE = 'section[aria-roledescription="carousel"] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } section[aria-roledescription="carousel"] svg { visibility: hidden !important; }';
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const slideCount = await page.locator('section[aria-roledescription="carousel"] [role="group"][aria-roledescription="slide"]').count();
  if (slideCount < T.slides) problems.push(`${vp.name}: expected ${T.slides} slides, found ${slideCount}`);
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.count()) await pause.first().click();
  for (let i = 0; i < slideCount; i++) {
    await page.locator('section[aria-roledescription="carousel"] button[aria-label^="Show slide"]').nth(i).click();
    await page.waitForTimeout(1900);
    await page.evaluate(() => window.scrollTo(0, 0));
    const spec = await page.evaluate(`(() => {
      ${COLOR_SRC}
      const hero = document.querySelector('section[aria-roledescription="carousel"]');
      const hr = hero.getBoundingClientRect(); const sy = window.scrollY, sx = window.scrollX;
      const pick = (k, idx) => hero.querySelector('[data-hero-cta="' + k + '"]') || hero.querySelectorAll('a[href]')[idx];
      const info = (el) => { if (!el) return null; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), bg: norm(cs.backgroundColor), colour: norm(cs.color), border: norm(cs.borderTopColor), bw: parseFloat(cs.borderTopWidth), radius: cs.borderTopLeftRadius, h: Math.round(r.height), rect: { x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height } }; };
      return { clip: { x: hr.left + sx, y: hr.top + sy, width: hr.width, height: hr.height }, p: info(pick('primary', 0)), s: info(pick('secondary', 1)) };
    })()`);
    const tag = `${vp.name} slide ${i + 1}`;
    if (!spec.p || !spec.s) { problems.push(`${tag}: primary or secondary CTA not found`); continue; }
    await page.addStyleTag({ content: HIDE });
    const png = await page.screenshot({ clip: spec.clip, fullPage: true });
    await page.evaluate((h) => { document.querySelectorAll('style').forEach((s) => { if (s.textContent === h) s.remove(); }); }, HIDE);
    const m = await page.evaluate(`(async () => {
      ${COLOR_SRC}
      const spec = ${JSON.stringify(spec)};
      const img = new Image(); img.src = 'data:image/png;base64,${png.toString('base64')}'; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
      const k = img.width / spec.clip.width;
      const px = (x, y) => { const d = cx.getImageData(Math.min(img.width - 1, Math.max(0, Math.round(x * k))), Math.min(img.height - 1, Math.max(0, Math.round(y * k))), 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: 1 }; };
      const pct = (a, q) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length * q)]; };
      const ring = (r) => { const out = []; const o = 6;
        for (let x = r.x - o; x <= r.x + r.w + o; x += 3) { out.push(px(x, r.y - o), px(x, r.y + r.h + o)); }
        for (let y = r.y - o; y <= r.y + r.h + o; y += 3) { out.push(px(r.x - o, y), px(r.x + r.w + o, y)); }
        return out; };
      const inside = (r) => { const out = []; for (let x = r.x + 6; x <= r.x + r.w - 6; x += 4) for (let y = r.y + 6; y <= r.y + r.h - 6; y += 4) out.push(px(x, y)); return out; };
      const med = (cs) => ({ r: pct(cs.map((c) => c.r), .5), g: pct(cs.map((c) => c.g), .5), b: pct(cs.map((c) => c.b), .5), a: 1 });
      const pr = spec.p, se = spec.s;
      const ringP = ring(pr.rect); const fill = pr.bg.a >= .99 ? pr.bg : over(pr.bg, med(ringP));
      const fillVsRing = pct(ringP.map((c) => ratio(fill, c)), .1);
      const ringS = ring(se.rect); const bcol = se.border.a >= .99 ? se.border : over(se.border, med(ringS)); const borderVsRing = pct(ringS.map((c) => ratio(bcol, c)), .1);
      const secPix = inside(se.rect); const secText = pct(secPix.map((c) => ratio(over(se.colour, c), c)), .05);
      return { borderVsRing: Math.round(borderVsRing * 100) / 100, fill, fillVsRing: Math.round(fillVsRing * 100) / 100, labelOnFill: Math.round(ratio(pr.colour, fill) * 100) / 100, secText: Math.round(secText * 100) / 100 };
    })()`);
    const ivory = (c) => T.ivory.some((v) => Math.abs(c.r - v[0]) <= T.ivoryTol && Math.abs(c.g - v[1]) <= T.ivoryTol && Math.abs(c.b - v[2]) <= T.ivoryTol);
    if (!ivory(m.fill)) problems.push(`${tag}: primary fill rgb(${m.fill.r},${m.fill.g},${m.fill.b}) is not ivory/bone`);
    if (m.fillVsRing < T.fillVsVeilMin) problems.push(`${tag}: primary fill vs veil ${m.fillVsRing}:1 < ${T.fillVsVeilMin}:1`);
    if (m.labelOnFill < T.labelMin) problems.push(`${tag}: primary label on fill ${m.labelOnFill}:1 < ${T.labelMin}:1`);
    if (!ivory(spec.s.border) || spec.s.border.a < 0.85 || spec.s.bw < 1) problems.push(`${tag}: secondary border is not an ivory outline (rgb ${spec.s.border.r},${spec.s.border.g},${spec.s.border.b} a${spec.s.border.a} w${spec.s.bw})`);
    if (m.borderVsRing < T.borderVsVeilMin) problems.push(`${tag}: secondary border vs veil ${m.borderVsRing}:1 < ${T.borderVsVeilMin}:1`);
    if (!ivory(spec.s.colour)) problems.push(`${tag}: secondary text is not ivory`);
    if (m.secText < T.secondaryTextMin) problems.push(`${tag}: secondary text on its pixels ${m.secText}:1 < ${T.secondaryTextMin}:1`);
    if (spec.p.h !== spec.s.h || spec.p.radius !== spec.s.radius) problems.push(`${tag}: primary and secondary differ in height (${spec.p.h}/${spec.s.h}) or radius (${spec.p.radius}/${spec.s.radius})`);
    for (const b of [spec.p, spec.s]) if (notSentence(b.text)) problems.push(`${tag}: CTA "${b.text}" is not sentence case`);
    if (process.env.F19_VERBOSE) console.log(tag, JSON.stringify(m));
  }
  await ctx.close();
}
await browser.close();
report(problems, 'hero primary CTA is an ivory fill (>=3:1 on the veil, label >=4.5:1) and the secondary an ivory outline (text >=4.5:1) on all slides at 390 and 1280');
