#!/usr/bin/env node
// F12-A7 - R70 shared show-page template on the six ShowContentState routes plus the FAQ container: container on the NOS header's axis (R71),
// the 4fr:7fr prose grid at >=900 (stacked below), h2 in column 1, everything else and the TBC / gap notices in column 2, 60ch paragraphs.
// Also: vendors and exhibitors keep their 60ch paragraph cap (conflict a), conferences and workshops are not on the template (conflict c).
import { main, openPage, withBrowser, VP, V, near, rgbOf, rgbNear, RULE, px, trackCount } from './_lib.mjs';

const T = V.template;
// R71: the container IS the NOS header's container (F3 .nh-bar): 1320 + two gutters, gutter clamp(16px, 2.5vw, 32px), centred
const axisBox = (vw) => { const g = Math.min(Math.max(16, 0.025 * vw), 32); const max = 1320 + g + g; return { g, max, w: Math.min(vw, max) }; };

function measure(opts) {
  const cs = (e) => getComputedStyle(e);
  const rc = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top + scrollY, bottom: b.bottom + scrollY, width: b.width }; };
  const chFn = (el, n) => {
    const c = cs(el);
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;width:${n}ch;font-family:${c.fontFamily};font-size:${c.fontSize};font-weight:${c.fontWeight};font-style:${c.fontStyle};`;
    el.parentElement.appendChild(d);
    const w = d.getBoundingClientRect().width;
    d.remove();
    return w;
  };
  const hero = document.querySelector('[data-nos-hero]');
  const heroCopy = hero?.querySelector('.nos-hero-copy');
  const vw = innerWidth;
  const out = { vw, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, prose: [], paras: [] };
  if (heroCopy) { const b = rc(heroCopy); out.heroAxis = b.left + parseFloat(cs(heroCopy).paddingLeft); out.heroMinH = hero ? parseFloat(cs(hero).minHeight) : null; out.heroH = hero ? hero.getBoundingClientRect().height : null; out.heroKind = hero.getAttribute('data-nos-hero'); }
  // container: nearest ancestor of the first content element that bounds its width
  const probe = document.querySelector('.nos-show-page-prose') ?? document.querySelector('main details') ?? document.querySelector('main section:not([data-nos-hero]) [data-nos-wrap] > :first-child') ?? document.querySelector('main section:not([data-nos-hero]) > :first-child') ?? null;
  if (probe) {
    let e = probe.parentElement;
    // stop at the section wrap: ShowFaqList renders a <section> per category, so a SECTION stop would never reach [data-nos-wrap]
    while (e && e !== document.body && cs(e).maxWidth === 'none' && !e.hasAttribute('data-nos-wrap')) e = e.parentElement;
    if (e && cs(e).maxWidth !== 'none') {
      const c = cs(e), b = rc(e);
      out.container = { maxWidth: c.maxWidth, padL: parseFloat(c.paddingLeft), padR: parseFloat(c.paddingRight), left: b.left, width: b.width, centred: Math.abs(b.left - (vw - b.width) / 2) <= 1.5, contentLeft: b.left + parseFloat(c.paddingLeft) };
    } else out.container = null;
  }
  for (const p of document.querySelectorAll('.nos-show-page-prose')) {
    const c = cs(p), b = rc(p);
    const cols = c.gridTemplateColumns;
    const kids = [...p.children].filter((k) => k.getBoundingClientRect().height > 0 || k.tagName === 'H2');
    const h2 = kids.find((k) => k.tagName === 'H2') ?? null;
    out.prose.push({
      key: p.getAttribute('data-section-key'), gap: p.hasAttribute('data-nos-content-gap'),
      display: c.display, cols, colGap: c.columnGap, padT: parseFloat(c.paddingTop), btw: parseFloat(c.borderTopWidth), bts: c.borderTopStyle, btc: c.borderTopColor,
      box: b,
      h2: h2 ? { left: rc(h2).left, top: rc(h2).top, size: parseFloat(cs(h2).fontSize), mt: parseFloat(cs(h2).marginTop), mb: parseFloat(cs(h2).marginBottom) } : null,
      kids: kids.filter((k) => k !== h2).map((k) => ({ tag: k.tagName.toLowerCase(), cls: String(k.className).slice(0, 30), left: rc(k).left, top: rc(k).top, bottom: rc(k).bottom, notice: k.classList.contains('nos-show-page-notice') })),
      kidsAll: kids.map((k) => ({ top: rc(k).top, bottom: rc(k).bottom })),
      paras: [...p.querySelectorAll('p')].filter((q) => !q.closest('.nos-show-page-notice')).slice(0, 4).map((q) => ({ w: rc(q).width, cap: parseFloat(cs(q).maxWidth), ch60: chFn(q, 60) })),
    });
  }
  if (opts.paras) {
    for (const q of [...document.querySelectorAll('main p')].filter((x) => !x.closest('[data-nos-hero], header, footer, form, nav, button, a')).slice(0, 30)) out.paras.push({ w: rc(q).width, ch60: chFn(q, 60), cap: cs(q).maxWidth });
  }
  return out;
}

function checkProse(r, tag, m, wide) {
  if (!m.prose.length) { r.fail(`${tag}: no .nos-show-page-prose block`); return; }
  m.prose.forEach((p, i) => {
    const id = `${tag} block ${i}${p.key ? ` (${p.key})` : ''}${p.gap ? ' [gap]' : ''}`;
    const n = trackCount(p.cols);
    if (wide) {
      if (p.display !== 'grid' || n !== 2) { r.fail(`${id}: ${p.display} with ${n} track(s) (${p.cols}), want a 2-column grid`); return; }
      const [w1, w2] = p.cols.split(/\s+/).map(px);
      if (Math.abs(w1 / w2 - T.prose.columns[0] / T.prose.columns[1]) > 0.02) r.fail(`${id}: columns ${w1.toFixed(1)}:${w2.toFixed(1)}, want 4fr:7fr`);
      if (px(p.colGap) !== T.prose.columnGap) r.fail(`${id}: column-gap ${p.colGap}, want 64px`);
      const col2 = p.box.left + w1 + T.prose.columnGap;
      if (p.h2) {
        if (!near(p.h2.left, p.box.left, 1)) r.fail(`${id}: h2 is not in column 1 (left ${p.h2.left.toFixed(0)} vs ${p.box.left.toFixed(0)})`);
        if (p.h2.size !== T.prose.h2FontSize) r.fail(`${id}: h2 ${p.h2.size}px, want 32px`);
        if (p.h2.mt !== 0 || p.h2.mb !== 0) r.fail(`${id}: h2 margin ${p.h2.mt}/${p.h2.mb}, want 0`);
      }
      for (const k of p.kids) if (k.left < col2 - 1) r.fail(`${id}: <${k.tag}${k.notice ? '.notice' : ''}> starts at ${k.left.toFixed(0)}, before column 2 (${col2.toFixed(0)})`);
    } else {
      if (p.display === 'grid' && n > 1) { r.fail(`${id}: ${n} columns below 900, want stacked`); return; }
      for (const k of p.kids) if (!near(k.left, p.box.left, 1.5)) r.fail(`${id}: <${k.tag}> is indented (${k.left.toFixed(0)} vs ${p.box.left.toFixed(0)}) below 900`);
      const sorted = p.kidsAll;
      for (let j = 1; j < sorted.length; j++) if (sorted[j].top < sorted[j - 1].bottom - 1) r.fail(`${id}: children overlap or sit side by side below 900`);
      if (p.h2 && p.kids.length && p.kids[0].top < p.h2.top) r.fail(`${id}: content is above the h2 when stacked`);
    }
    if (p.padT !== T.prose.paddingTop || p.btw !== T.prose.borderTopWidth || p.bts !== 'solid' || !rgbNear(rgbOf(p.btc), RULE)) r.fail(`${id}: padding-top ${p.padT}px, border-top ${p.btw}px ${p.bts} ${p.btc}, want 40px and 1px solid --rule`);
    for (const q of p.paras) if (q.w > q.ch60 + 1.5 || q.cap > q.ch60 + 1.5) r.fail(`${id}: paragraph ${q.w.toFixed(0)}px / cap ${q.cap.toFixed(0)}px exceeds 60ch (${q.ch60.toFixed(0)}px)`);
  });
}

await main('F12-A7 template', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of [...T.routes, ...T.containerOnlyRoutes]) {
      const isTemplate = T.routes.includes(route);
      const { ctx, page, status } = await openPage(browser, VP.desktop, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const w of [390, 899, 900, 1024, 1280, 1920]) {
        await page.setViewportSize({ width: w, height: w >= 1024 ? 900 : 844 });
        await page.waitForTimeout(150);
        const m = await page.evaluate(measure, { paras: false });
        const tag = `${route} @${w}`;
        if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
        if (!m.container) r.fail(`${tag}: no bounded container around the content`);
        else {
          const c = m.container;
          const ax = axisBox(w);
          if (!near(px(c.maxWidth), ax.max, 1)) r.fail(`${tag}: container max-width ${c.maxWidth}, want the NOS header container ${ax.max.toFixed(0)}px (R71)`);
          if (!near(c.width, ax.w, 1)) r.fail(`${tag}: container ${c.width.toFixed(0)}px wide, want ${ax.w.toFixed(0)}px`);
          if (!near(c.padL, ax.g, 0.6) || !near(c.padR, ax.g, 0.6)) r.fail(`${tag}: container padding ${c.padL}/${c.padR}, want the header gutter ${ax.g.toFixed(1)}px`);
          if (!c.centred) r.fail(`${tag}: container is not centred`);
        }
        if (isTemplate) {
          if (w >= 1024 && m.heroKind === 'inner' && (m.heroMinH < 379.5 || m.heroH < 379.5)) r.fail(`${tag}: inner hero min-height ${m.heroMinH}px / height ${m.heroH?.toFixed(0)}px, want >= 380px at >=1024`);
          if (w === 900 || w >= 1024) checkProse(r, tag, m, true);
          else checkProse(r, tag, m, false);
        }
      }
      await ctx.close();
    }
    // conflict (a): vendors/exhibitors paragraphs stay capped at 60ch; (c) conferences/workshops keep their own 720px column (unchanged page, not on the template)
    for (const route of ['/national-show/vendors', '/national-show/exhibitors']) {
      const { ctx, page, status } = await openPage(browser, VP.desktop, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate(measure, { paras: true });
      if (!m.paras.length) r.fail(`${route}: no paragraphs measured`);
      for (const p of m.paras) if (p.w > p.ch60 + 1.5) r.fail(`${route}: a paragraph is ${p.w.toFixed(0)}px wide, over 60ch (${p.ch60.toFixed(0)}px) - r5's [&_p]:max-w-[60ch] must survive`);
      await ctx.close();
    }
    // conferences and workshops (NOS Design ruling relayed 2026-10-16): the header-axis container for alignment, 60ch for measure; not the prose grid
    for (const route of T.widenedRoutes) {
      const { ctx, page, status } = await openPage(browser, VP.desktop, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const w of [390, 1280, 1920]) {
        await page.setViewportSize({ width: w, height: w >= 1024 ? 900 : 844 });
        await page.waitForTimeout(150);
        const m = await page.evaluate(measure, { paras: true });
        const tag = `${route} @${w}`;
        if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
        if (m.prose.length) r.fail(`${tag}: has .nos-show-page-prose blocks, but it is not a prose-template page`);
        const c = m.container;
        if (!c) r.fail(`${tag}: no bounded container around the content`);
        else {
          const ax = axisBox(w);
          if (!near(px(c.maxWidth), ax.max, 1) || !near(c.width, ax.w, 1)) r.fail(`${tag}: container ${c.maxWidth} / ${c.width.toFixed(0)}px wide, want the header container ${ax.max.toFixed(0)}px`);
          if (!near(c.padL, ax.g, 0.6) || !near(c.padR, ax.g, 0.6) || !c.centred) r.fail(`${tag}: container padding ${c.padL}/${c.padR} centred ${c.centred}, want the header gutter ${ax.g.toFixed(1)}px and centred`);
        }
        for (const p of m.paras) if (p.w > p.ch60 + 1.5) r.fail(`${tag}: a paragraph is ${p.w.toFixed(0)}px wide, over 60ch (${p.ch60.toFixed(0)}px)`);
      }
      await ctx.close();
    }
    // tickets shares CategoryTicketsPage and every NosSection wrap: it sits on the same header axis (R71), not a separate 1080 column
    // Negative case: a bare-wrap FAQ (wrap max-width removed) must read as NO bounded container, so the walk-up cannot pass by luck
    {
      const { ctx, page, status } = await openPage(browser, VP.desktop, '/national-show/faq');
      if (status !== 200) r.fail(`negative case: /national-show/faq HTTP ${status}`);
      else {
        const ok = await page.evaluate(measure, { paras: false });
        if (!ok.container) r.fail('negative case: the real FAQ shows no bounded container');
        await page.evaluate(() => { for (const w of document.querySelectorAll('[data-nos-wrap]')) w.style.maxWidth = 'none'; });
        const bad = await page.evaluate(measure, { paras: false });
        if (bad.container) r.fail('negative case: a FAQ whose wrap has no max-width still reported a bounded container, the check is blind');
      }
      await ctx.close();
    }
    for (const route of T.untouchedContainerRoutes) {
      const { ctx, page, status } = await openPage(browser, VP.desktop, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate(measure, { paras: false });
      const ax = axisBox(1280);
      if (!m.container || !near(px(m.container.maxWidth), ax.max, 1)) r.fail(`${route}: container ${m.container?.maxWidth ?? 'none'}, want the header container ${ax.max}px`);
      await ctx.close();
    }
  });
});
