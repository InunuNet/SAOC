#!/usr/bin/env node
// A8: states and contrast of the new controls. Index chips and row actions: hover changes the background, every transition-duration is
// 150ms or shorter and includes 150ms, a real keyboard Tab shows a >=2px outline at >=3:1 against its ground; chip border >=3:1 and chip
// text >=4.5:1; all text in the Visit group >=4.5:1 (3:1 at >=24px); reduced motion leaves no transform on hover or focus.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-h-states.mjs
import { HUB, SEL, SETTLE_MS, durationsMs, launch, newPage, openPath, report } from './_lib.mjs';

const problems = [];
const COLOR = `
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const norm = (css) => { cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return { r: d[0], g: d[1], b: d[2], a: d[3]/255 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const lum = (c) => 0.2126*lin(c.r)+0.7152*lin(c.g)+0.0722*lin(c.b);
  const over = (t,b) => ({ r: t.r*t.a+b.r*(1-t.a), g: t.g*t.a+b.g*(1-t.a), b: t.b*t.a+b.b*(1-t.a), a: 1 });
  const ratio = (a,b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const bgOf = (el) => { const st = []; for (let n = el; n; n = n.parentElement) { const c = norm(getComputedStyle(n).backgroundColor); if (c.a > 0) { st.push(c); if (c.a >= 0.99) break; } } let acc = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length-1; i >= 0; i--) acc = over(st[i], acc); return acc; };
`;
const browser = await launch();
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 900 });
  await openPath(page, HUB);
  const targets = [['chip', `${SEL.index} a`], ['action', SEL.action]];
  for (const [name, sel] of targets) {
    const n = await page.locator(sel).count();
    if (!n) { problems.push(`${name}: no ${sel}`); continue; }
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0); await page.waitForTimeout(SETTLE_MS);
    const read = () => el.evaluate((e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, dur: s.transitionDuration, ow: parseFloat(s.outlineWidth), os: s.outlineStyle, oc: s.outlineColor }; });
    const rest = await read();
    await el.hover(); await page.waitForTimeout(SETTLE_MS);
    const hov = await read();
    if (rest.bg === hov.bg) problems.push(`${name}: hover does not change the background (${rest.bg})`);
    const ds = durationsMs(rest.dur);
    if (!ds.includes(150) || ds.some((d) => d > 150)) problems.push(`${name}: transition-duration "${rest.dur}", want 150ms and nothing longer`);
    await page.mouse.move(0, 0);
    await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
    let focused = false;
    for (let i = 0; i < 80 && !focused; i++) { await page.keyboard.press('Tab'); focused = await el.evaluate((e) => e === document.activeElement); }
    await page.waitForTimeout(SETTLE_MS);
    if (!focused) { problems.push(`${name}: never reached by keyboard Tab`); continue; }
    const f = await read();
    if (!(f.ow >= 2 && f.os !== 'none')) problems.push(`${name}: keyboard focus outline is ${f.ow}px ${f.os}, want >=2px`);
    else {
      const ratio = await el.evaluate((e, src) => new Function('e', src + 'return ratio(norm(getComputedStyle(e).outlineColor), bgOf(e.parentElement));')(e), COLOR);
      if (ratio < 3) problems.push(`${name}: focus ring is ${ratio.toFixed(2)}:1 against its ground, want >=3`);
    }
  }
  const text = await page.evaluate((src) => {
    const fn = new Function(src + `
      const out = [];
      const root = document.getElementById('visit');
      if (!root) return { out: [{ t: 'no #visit group', ratio: 0, need: 99 }], chips: [] };
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (!n.textContent.trim() || p.closest('.sr-only')) continue; const s = getComputedStyle(p); const r = p.getBoundingClientRect(); if (r.width < 2) continue; const fg = over(norm(s.color), bgOf(p)); const big = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700); out.push({ t: n.textContent.trim().slice(0, 30), ratio: ratio(fg, bgOf(p)), need: big ? 3 : 4.5 }); }
      const chips = [...document.querySelectorAll('[data-ticket-index] a')].map((a) => { const s = getComputedStyle(a); return { t: a.textContent.trim(), text: ratio(over(norm(s.color), bgOf(a)), bgOf(a)), border: ratio(norm(s.borderTopColor), bgOf(a)) }; });
      return { out, chips };`);
    return fn();
  }, COLOR);
  for (const x of text.out) if (x.ratio < x.need) problems.push(`Visit text "${x.t}" is ${x.ratio.toFixed(2)}:1, want >=${x.need}`);
  for (const c of text.chips) { if (c.text < 4.5) problems.push(`chip "${c.t}" text ${c.text.toFixed(2)}:1`); if (c.border < 3) problems.push(`chip "${c.t}" border ${c.border.toFixed(2)}:1, want >=3`); }
  await ctx.close();
}
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 900 }, { reducedMotion: 'reduce' });
  await openPath(page, HUB);
  for (const sel of [`${SEL.index} a`, SEL.action]) {
    if (!(await page.locator(sel).count())) continue;
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded(); await el.hover(); await page.waitForTimeout(SETTLE_MS);
    const t = await el.evaluate((e) => { const s = getComputedStyle(e); return [s.transform, s.translate, s.scale]; });
    if (t.some((v) => v && v !== 'none' && v !== 'matrix(1, 0, 0, 1, 0, 0)' && v !== '1')) problems.push(`reduced motion: ${sel} transforms on hover (${t.join(' | ')})`);
  }
  await ctx.close();
}
await browser.close();
report(problems, 'chips and row actions: 150ms hover, 2px >=3:1 keyboard focus, text and borders at contrast, no motion under reduced-motion');
