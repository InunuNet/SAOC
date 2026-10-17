#!/usr/bin/env node
// F19-A1 (R79 #1 / R64): the home hero scrim is the handoff's (design_system_README l.125), not a uniform 75-85% sage.
// Three aria-hidden layers inside the carousel section, between the slides and the content, hooks data-hero-scrim:
//   diagonal - linear-gradient, top-left origin (to bottom right / 120-150deg), sage (--primary or --primary-800), first stop
//              alpha .60, last stop alpha .25, alpha never rises along the gradient;
//   veil     - radial-gradient (the text-zone protection the uniform scrim used to provide; transparent at its rim);
//   bone     - linear-gradient to top, bone (--bone) at the bottom edge fading to transparent, short enough that no text, CTA,
//              pause button or dot sits under it (it lives inside the section's bottom padding).
// The legacy scrim (a gradient/solid-alpha layer that is none of the three) is gone. The carousel is VISIBLE: the effective
// overlay alpha, solved from pixels (scrims on vs off, glyphs hidden), is .50-.72 in the top-left corner and .18-.40 in the
// bottom-right corner above the bone pull (6% boxes at the very corners, where the text-zone veil has faded out), at 1280 (at 390 the copy spans the whole width, so the veil legitimately reaches the
// corners: there only the layer structure above and the contrast check A2 apply).
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-a-scrim.mjs
import { VIEWPORTS, COLOR_SRC, launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').scrim;
const problems = [];
const browser = await launch();

const PARSE_SRC = `
  const topSplit = (s) => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  const parseGradient = (bg) => { const m = bg.match(/^(linear|radial)-gradient\\((.*)\\)$/s); if (!m) return null;
    const args = topSplit(m[2]); let config = null;
    if (/^(to |[-0-9.]+deg|ellipse|circle|closest|farthest|[0-9.]+(px|%) )/.test(args[0]) || /\\bat\\b/.test(args[0])) config = args.shift();
    const stops = args.map((a) => { const mm = a.match(/^(rgba?\\([^)]*\\)|color\\([^)]*\\)|oklab\\([^)]*\\)|oklch\\([^)]*\\)|color-mix\\(.*\\)|#[0-9a-f]+|[a-z]+)\\s*(.*)$/i); return { color: norm(mm[1]), pos: mm[2] || null }; });
    return { kind: m[1], config, stops }; };
`;

for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.count()) await pause.first().click();
  await page.waitForTimeout(1900); // let any crossfade in flight finish so the two screenshots below show one slide
  const info = await page.evaluate(`(() => {
    ${COLOR_SRC} ${PARSE_SRC}
    const hero = document.querySelector('section[aria-roledescription="carousel"]'); const hr = hero.getBoundingClientRect();
    const kids = [...hero.children]; const content = kids[kids.length - 1];
    const layers = {}; const dup = [];
    hero.querySelectorAll('[data-hero-scrim]').forEach((el) => { const k = el.getAttribute('data-hero-scrim'); if (layers[k]) dup.push(k); const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      layers[k] = { ariaHidden: el.getAttribute('aria-hidden'), position: cs.position, idx: kids.indexOf(el), direct: el.parentElement === hero, fills: Math.abs(r.width - hr.width) <= 1 && Math.abs(r.height - hr.height) <= 1, grad: parseGradient(cs.backgroundImage) }; });
    const slideIdx = kids.map((k, i) => (k.getAttribute('role') === 'group' ? i : -1)).filter((i) => i >= 0);
    const legacy = kids.filter((k) => k !== content && k.getAttribute('role') !== 'group' && !k.hasAttribute('data-hero-scrim')).map((k) => { const cs = getComputedStyle(k); return { cls: k.className.toString().slice(0, 60), img: cs.backgroundImage, bg: norm(cs.backgroundColor).a }; }).filter((k) => k.img !== 'none' || k.bg > 0.02);
    let lowest = 0; content.querySelectorAll('*').forEach((el) => { const r = el.getBoundingClientRect(); if (r.height && r.width) lowest = Math.max(lowest, r.bottom); });
    return { dup, layers, slideMax: Math.max(...slideIdx), contentIdx: kids.indexOf(content), legacy, heroH: hr.height, heroBottom: hr.bottom, clearance: hr.bottom - lowest };
  })()`);
  const tag = vp.name;
  for (const k of ['diagonal', 'veil', 'bone']) if (!info.layers[k]) problems.push(`${tag}: missing [data-hero-scrim="${k}"] layer`);
  if (info.dup.length) problems.push(`${tag}: duplicate scrim layers ${info.dup}`);
  if (info.legacy.length) problems.push(`${tag}: legacy scrim layer still present ${JSON.stringify(info.legacy)}`);
  for (const [k, L] of Object.entries(info.layers)) {
    if (L.ariaHidden !== 'true') problems.push(`${tag} ${k}: must be aria-hidden`);
    if (!L.direct || L.position !== 'absolute' || !L.fills) problems.push(`${tag} ${k}: must be an absolutely positioned inset-0 direct child of the carousel section`);
    if (L.idx <= info.slideMax || L.idx >= info.contentIdx) problems.push(`${tag} ${k}: must sit after the slides and before the content (idx ${L.idx}, slides to ${info.slideMax}, content ${info.contentIdx})`);
    if (!L.grad) problems.push(`${tag} ${k}: background-image is not a CSS gradient`);
  }
  const near = (a, b, t) => Math.abs(a - b) <= t;
  const sage = (c) => T.sageHex.some((h) => { const n = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return near(c.r, n[0], 3) && near(c.g, n[1], 3) && near(c.b, n[2], 3); });
  const D = info.layers.diagonal?.grad;
  if (D) {
    const cfg = D.config || '';
    const deg = parseFloat((cfg.match(/^([-0-9.]+)deg/) || [])[1]);
    const okDir = D.kind === 'linear' && (/^to bottom right$/.test(cfg) || (deg >= T.diagonalDeg[0] && deg <= T.diagonalDeg[1]));
    if (!okDir) problems.push(`${tag} diagonal: direction "${cfg || 'default (to bottom)'}" is not top-left to bottom-right (to bottom right or ${T.diagonalDeg.join('-')}deg)`);
    const s = D.stops; const first = s[0].color, last = s[s.length - 1].color;
    if (!near(first.a, T.diagonalStartAlpha, 0.02)) problems.push(`${tag} diagonal: first stop alpha ${first.a}, brief is ${T.diagonalStartAlpha}`);
    if (!near(last.a, T.diagonalEndAlpha, 0.02)) problems.push(`${tag} diagonal: last stop alpha ${last.a}, brief is ${T.diagonalEndAlpha}`);
    if (!s.every((x) => sage(x.color))) problems.push(`${tag} diagonal: every stop must be the --primary or --primary-800 sage`);
    for (let i = 1; i < s.length; i++) if (s[i].color.a > s[i - 1].color.a + 0.01) problems.push(`${tag} diagonal: alpha rises at stop ${i + 1}`);
  }
  const V = info.layers.veil?.grad;
  if (V) {
    if (V.kind !== 'radial') problems.push(`${tag} veil: must be a radial-gradient`);
    if (!V.stops.every((x) => x.color.a === 0 || sage(x.color))) problems.push(`${tag} veil: opaque stops must be sage`);
    if (V.stops[V.stops.length - 1].color.a > 0.01) problems.push(`${tag} veil: must be fully transparent at its rim`);
  }
  const B = info.layers.bone?.grad;
  if (B) {
    const cfg = B.config || '';
    if (!(/^to top$/.test(cfg) || parseFloat(cfg) === 0)) problems.push(`${tag} bone: must pull from the bottom edge (to top / 0deg), got "${cfg || 'default'}"`);
    const f = B.stops[0].color, l = B.stops[B.stops.length - 1].color;
    if (!(near(f.r, 232, 3) && near(f.g, 230, 3) && near(f.b, 220, 3) && f.a >= T.boneMinAlpha)) problems.push(`${tag} bone: bottom stop must be --bone (#e8e6dc) at alpha >= ${T.boneMinAlpha}, got rgba(${f.r},${f.g},${f.b},${f.a})`);
    if (l.a > 0.01) problems.push(`${tag} bone: must fade to transparent`);
    const lastPos = B.stops[B.stops.length - 1].pos || '';
    const px = lastPos.endsWith('px') ? parseFloat(lastPos) : lastPos.endsWith('%') ? parseFloat(lastPos) / 100 * info.heroH : NaN;
    if (Number.isNaN(px)) problems.push(`${tag} bone: the fade-out stop needs an explicit px or % position`);
    else {
      if (px < T.boneHeightPx[0]) problems.push(`${tag} bone: pull is only ${Math.round(px)}px tall (min ${T.boneHeightPx[0]})`);
      if (px > info.clearance - 4) problems.push(`${tag} bone: pull is ${Math.round(px)}px tall but only ${Math.round(info.clearance)}px sit below the lowest content, so it would sit under text or controls`);
    }
  }

  // Effective overlay alpha at two corners, solved from pixels with glyphs hidden: on = (1-a)*off + a*S.
  if (!problems.length && vp.width >= 768) {
    const hideText = 'section[aria-roledescription="carousel"] * { color: transparent !important; -webkit-text-fill-color: transparent !important; } section[aria-roledescription="carousel"] svg, section[aria-roledescription="carousel"] button, section[aria-roledescription="carousel"] a { visibility: hidden !important; }';
    const clip = await page.evaluate(() => { const r = document.querySelector('section[aria-roledescription="carousel"]').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; });
    const tagEl = await page.addStyleTag({ content: hideText });
    const on = await page.screenshot({ clip, fullPage: true });
    const off1 = await page.addStyleTag({ content: '[data-hero-scrim] { display: none !important; }' });
    const off = await page.screenshot({ clip, fullPage: true });
    await off1.evaluate((n) => n.remove()); await tagEl.evaluate((n) => n.remove());
    const sageS = T.sageHex[0];
    const res = await page.evaluate(`(async () => {
      const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x; };
      const a = await load('${on.toString('base64')}'), b = await load('${off.toString('base64')}');
      const W = a.canvas.width, H = a.canvas.height; const S = [1, 3, 5].map((i) => parseInt('${sageS}'.slice(i, i + 2), 16));
      const box = (fx, fy) => { const w = Math.round(W * 0.06), h = Math.round(H * 0.06); const x0 = Math.round(W * fx), y0 = Math.round(H * fy); const don = a.getImageData(x0, y0, w, h).data, doff = b.getImageData(x0, y0, w, h).data; let num = 0, den = 0; for (let p = 0; p < don.length; p += 4) for (let c = 0; c < 3; c++) { const o = doff[p + c] - S[c]; num += o * (doff[p + c] - don[p + c]); den += o * o; } return den < 20000 ? null : Math.round(num / den * 100) / 100; };
      return { tl: box(0.0, 0.0), br: box(0.94, 0.80) };
    })()`);
    if (res.tl === null || res.br === null) console.log(`NOTE ${tag}: corner pixels too close to the sage to solve alpha (tl ${res.tl}, br ${res.br})`);
    else {
      if (res.tl < T.cornerAlpha.tl[0] || res.tl > T.cornerAlpha.tl[1]) problems.push(`${tag}: top-left effective overlay alpha ${res.tl} outside ${T.cornerAlpha.tl.join('-')}`);
      if (res.br < T.cornerAlpha.br[0] || res.br > T.cornerAlpha.br[1]) problems.push(`${tag}: bottom-right effective overlay alpha ${res.br} outside ${T.cornerAlpha.br.join('-')}`);
    }
  }
  await ctx.close();
}
await browser.close();
report(problems, 'diagonal 60-to-25 sage, text-zone veil and short bone pull in place, legacy uniform scrim gone, carousel visible in the corners at 1280 and 390');
