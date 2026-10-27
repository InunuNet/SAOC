// P3 (NOS Design 2026-10-26) + NOS Design 2026-10-27: the draft notice on /members ("Not yet available") and /refunds ("Draft pending legal
// review") is one treatment through one shared component: a plain <p> at 15px, the bold lead-in kept, a 1px rule below, border 0 on the other
// sides, a transparent background, the text verbatim, and no filled bordered box around it (the old [data-placeholder] wrapper).
import { F2, freeze, launchChromium, newContext, withServer } from './f2-lib.mjs';

const M = F2.draftNotice;

await withServer(11, 'draft notice (saoc)', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const N of M.notices) for (const vp of M.viewports) {
      const context = await newContext(browser, { ...vp, dsf: 1 });
      const page = await context.newPage();
      const tag = `[saoc ${vp.name} ${N.route}]`;
      const res = await page.goto(`${server.saoc}${N.route}`, { waitUntil: 'load' });
      c.check(`${tag} renders (status 200)`, res?.status() === 200, String(res?.status()));
      await page.evaluate(() => document.fonts.ready);
      await freeze(page);
      const m = await page.evaluate((lead) => {
        const strong = [...document.querySelectorAll('main strong')].find((s) => s.textContent.trim() === lead);
        const p = strong?.closest('p');
        if (!p) return null;
        const side = (el) => { const s = getComputedStyle(el); return { top: s.borderTopWidth, right: s.borderRightWidth, left: s.borderLeftWidth, bottom: s.borderBottomWidth, bottomStyle: s.borderBottomStyle, bg: s.backgroundColor }; };
        const box = (el) => { const s = getComputedStyle(el); return ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(s[`border${k}Width`]) > 0) || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent'); };
        const wrappers = []; for (let el = p.parentElement; el && el.tagName !== 'MAIN'; el = el.parentElement) if (box(el)) wrappers.push(el.tagName + (el.dataset.placeholder ? '[data-placeholder]' : ''));
        return { tag: p.tagName, fontSize: getComputedStyle(p).fontSize, text: p.textContent.replace(/\s+/g, ' ').trim(), firstChild: p.firstElementChild?.tagName, strongWeight: getComputedStyle(strong).fontWeight, p: side(p), wrappers };
      }, N.leadIn);
      c.check(`${tag} the note is found as a <p> led by <strong>${N.leadIn}</strong>`, Boolean(m));
      if (!m) continue;
      c.check(`${tag} plain <p> (${m.tag}) with the <strong> lead-in first (${m.firstChild})`, m.tag === 'P' && m.firstChild === 'STRONG');
      c.check(`${tag} font-size ${m.fontSize} is ${M.fontSizePx}px`, m.fontSize === `${M.fontSizePx}px`);
      c.check(`${tag} lead-in is bold (weight ${m.strongWeight} >= 500)`, Number(m.strongWeight) >= 500);
      c.check(`${tag} text verbatim`, m.text === N.text, m.text);
      c.check(`${tag} border 0 top/left/right (${m.p.top}/${m.p.right}/${m.p.left})`, m.p.top === '0px' && m.p.right === '0px' && m.p.left === '0px');
      c.check(`${tag} a 1px solid rule below (${m.p.bottom} ${m.p.bottomStyle})`, m.p.bottom === '1px' && m.p.bottomStyle === 'solid');
      c.check(`${tag} transparent background (${m.p.bg})`, m.p.bg === 'rgba(0, 0, 0, 0)' || m.p.bg === 'transparent');
      c.check(`${tag} no filled or bordered wrapper box around the note (${m.wrappers.join(',') || 'none'})`, m.wrappers.length === 0);
      await context.close();
    }
  } finally { await browser.close(); }
});
