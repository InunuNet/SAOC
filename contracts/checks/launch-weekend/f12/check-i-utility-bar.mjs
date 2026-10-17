#!/usr/bin/env node
// F12-A14 - SUPERSEDED by v4 decision #2 (nos-critique-r6 f9): NO SAOC utility bar on any /national-show route, at every width; the NOS header
// sits at y=0 and the skip link is still the first focusable element. SAOC pages keep the original pill and carry no header Tickets CTA (F13).
import { main, openPage, withBrowser, VP, V, NOS_ROUTES, near } from './_lib.mjs';

const U = V.utilityBar;
const BAR = '[role="region"][aria-label="Utility bar"]';
const STYLE_KEYS = ['display', 'position', 'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'opacity', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderTopColor', 'borderRadius', 'gap', 'justifyContent', 'alignItems', 'maxWidth', 'minHeight'];

function snap(arg) {
  const bar = document.querySelector(arg.sel);
  if (!bar) return { error: 'no utility bar' };
  const rc = (e) => { const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, width: b.width, height: b.height }; };
  const EMAIL = 'mailto:info@saoc.co.za';
  const nodes = [bar, ...bar.querySelectorAll('*')].filter((e) => !(e.tagName === 'SPAN' && e.parentElement?.getAttribute('href') === EMAIL));
  const emailA = bar.querySelector('a[href="' + EMAIL + '"]');
  let email = null;
  if (emailA) {
    const rg = document.createRange();
    let textW = 0;
    const tw = document.createTreeWalker(emailA, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.textContent.trim() || n.parentElement.closest('svg')) continue; rg.selectNodeContents(n); textW += rg.getBoundingClientRect().width; }
    email = { aria: emailA.getAttribute('aria-label'), textW, w: emailA.getBoundingClientRect().width, h: emailA.getBoundingClientRect().height };
  }
  const els = nodes.map((e) => {
    const cs = getComputedStyle(e);
    const o = { w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, top: e.getBoundingClientRect().top, tag: e.tagName.toLowerCase(), cls: String(e.getAttribute('class') ?? ''), href: e.getAttribute('href'), text: e.children.length ? '' : (e.textContent ?? '').replace(/\s+/g, ' ').trim() };
    for (const p of arg.keys) o[p] = cs[p];
    return o;
  });
  const header = document.querySelector('#nh') ?? document.querySelector('body > header');
  const focusables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')];
  const first = focusables[0];
  return {
    els, email, barBox: rc(bar), barCount: document.querySelectorAll(arg.sel).length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    barPrecedesHeader: header ? !!(bar.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
    header: header ? { top: rc(header).top, id: header.id } : null,
    firstFocusable: first ? { tag: first.tagName.toLowerCase(), href: first.getAttribute('href'), text: (first.textContent ?? '').trim() } : null,
    headerLinks: header ? [...header.querySelectorAll('a')].map((a) => ({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })) : [],
  };
}
const ARG = { sel: BAR, keys: STYLE_KEYS };
const dropBelow480 = (c) => c.split(/\s+/).filter((t) => t && !/^max-\[4[78]\d(\.\d+)?px\]:/.test(t)).join(' ');
const isPill = (e) => e.tag === 'a' && e.href === '/national-show';

// one row = every pair of links overlaps vertically (items-center rows give different tops for different heights)
const wrapsRows = (ts) => ts.some((a, i) => ts.slice(i + 1).some((b) => !(a.top < b.top + b.h && b.top < a.top + a.h)));

await main('F12-A14 utility bar', async (r) => {
  // self-test of the row rule: the real items-center tops (11/8/9, heights 24/30/28) are one row, a link pushed below the others is a wrap
  if (wrapsRows([{ top: 11, h: 24 }, { top: 8, h: 30 }, { top: 9, h: 28 }])) r.fail('self-test: an items-center row of mixed heights was read as wrapped');
  if (!wrapsRows([{ top: 8, h: 30 }, { top: 9, h: 28 }, { top: 44, h: 28 }])) r.fail('self-test: a link on a second row was not detected, the wrap check is blind');
  await withBrowser(async (browser) => {
    for (const vp of [VP.desktop, { width: 480, height: 800 }, { width: 479, height: 800 }, VP.phone, { width: 360, height: 780 }]) {
      const saoc = await openPage(browser, vp, '/about');
      const ref = await saoc.page.evaluate(snap, ARG);
      await saoc.ctx.close();
      if (ref.error) { r.fail(`/about @${vp.width}: ${ref.error}`); continue; }

      for (const saocRoute of U.saocRoutes) {
        const s = await openPage(browser, vp, saocRoute);
        const m = await s.page.evaluate(snap, ARG);
        await s.ctx.close();
        const p = m.els?.find(isPill);
        if (m.error || !p || !/National Show/.test(p.text)) r.fail(`${saocRoute} @${vp.width}: SAOC utility bar changed (${m.error ?? p?.text})`);
        if (m.headerLinks?.some((l) => l.text === 'Tickets')) r.fail(`${saocRoute} @${vp.width}: header Tickets CTA present on a SAOC page (F13 removes it)`);
      }

      for (const route of NOS_ROUTES) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        const tag = `${route} @${vp.width}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        // v4 decision #2 (nos-critique-r6 f9) supersedes F12-A14: the SAOC utility bar is left off NOS pages at every width.
        const m = await page.evaluate((barSel) => {
          const h = document.querySelector('#nh');
          const first = document.querySelector('a[href], button, input, select, textarea, [tabindex]');
          return {
            bars: document.querySelectorAll(barSel).length,
            saocLinks: [...document.querySelectorAll('a[href^="mailto:info@saoc.co.za"], a[href="/societies"]')].filter((a) => !a.closest('footer')).length,
            headerTop: h ? h.getBoundingClientRect().top : null,
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            firstHref: first ? first.getAttribute('href') : null,
          };
        }, BAR);
        if (m.bars !== 0) r.fail(`${tag}: ${m.bars} utility bar element(s), want none (v4 decision #2)`);
        if (m.saocLinks !== 0) r.fail(`${tag}: ${m.saocLinks} SAOC utility link(s) outside the footer, want none`);
        if (m.headerTop === null) r.fail(`${tag}: NOS header #nh not found`);
        else if (!near(m.headerTop, 0, 1.5)) r.fail(`${tag}: NOS header top is ${m.headerTop}px, want 0 with no bar above it`);
        if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
        if (m.firstHref !== '#main-content') r.fail(`${tag}: first focusable element is ${m.firstHref}, want the skip link`);
        await ctx.close();
      }
    }

    const k = await openPage(browser, VP.desktop, '/national-show');
    await k.page.keyboard.press('Tab');
    const active = await k.page.evaluate(() => ({ href: document.activeElement?.getAttribute('href') ?? null }));
    if (active.href !== '#main-content') r.fail(`first Tab lands on ${JSON.stringify(active)}, want the skip link`);
    const sticky = await k.page.evaluate(async () => {
      const h = document.querySelector('#nh');
      const pos = getComputedStyle(h).position;
      window.scrollTo(0, 900);
      await new Promise((res) => setTimeout(res, 250));
      return { pos, after: h.getBoundingClientRect().top };
    });
    if (sticky.pos !== 'sticky') r.fail(`NOS header position is ${sticky.pos} at 1280, want sticky`);
    else if (!near(sticky.after, 0, 1.5)) r.fail(`NOS header is sticky but sits at ${sticky.after}px after scrolling, want 0`);
    await k.ctx.close();
  });
});
