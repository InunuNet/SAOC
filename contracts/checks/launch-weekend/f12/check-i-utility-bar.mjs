#!/usr/bin/env node
// F12-A14 - the SAOC utility bar on every /national-show route (Brad, 2026-10-16), measured at 1280 and 390: rendered above the NOS header, same
// markup and computed styles as on SAOC pages, the show pill replaced by a "saoc.co.za" pill to "/", email and "Join a society" kept, the skip link
// still the first focusable element, the NOS header still sticky and not overlapped. SAOC pages keep the original pill and carry no header Tickets CTA (F13).
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
        const m = await page.evaluate(snap, ARG);
        if (m.error) { r.fail(`${tag}: ${m.error}`); await ctx.close(); continue; }
        if (m.barCount !== 1) r.fail(`${tag}: ${m.barCount} utility bars`);
        if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
        if (m.barPrecedesHeader !== true) r.fail(`${tag}: the bar is not before the NOS header in the DOM`);
        if (m.header?.id !== 'nh') r.fail(`${tag}: NOS header #nh not found`);
        else if (m.barBox.bottom > m.header.top + 1) r.fail(`${tag}: the bar overlaps the NOS header (bar bottom ${m.barBox.bottom.toFixed(0)} > header top ${m.header.top.toFixed(0)})`);
        if (m.els.length !== ref.els.length) r.fail(`${tag}: ${m.els.length} elements in the bar, SAOC bar has ${ref.els.length}`);
        else {
          m.els.forEach((e, i) => {
            const o = ref.els[i];
            const where = `${tag}: bar element ${i} <${e.tag}>`;
            const pill = isPill(o);
            if (!pill && (e.tag !== o.tag || dropBelow480(e.cls) !== dropBelow480(o.cls))) r.fail(`${where} class differs from the SAOC bar ("${e.cls}" vs "${o.cls}")`);
            for (const k of STYLE_KEYS) if (e[k] !== o[k] && !(pill && (k === 'display' || k === 'minHeight'))) { r.fail(`${where} ${k} ${e[k]} vs SAOC ${o[k]}`); break; }
            if (pill) {
              if (e.href !== U.pill.href || e.text !== U.pill.label) r.fail(`${where} is "${e.text}" -> ${e.href}, want pill "${U.pill.label}" -> ${U.pill.href}`);
              if (e.display === 'none' || !(e.w > 0)) r.fail(`${where} the saoc.co.za pill is not visible at ${vp.width}px (ruling: visible at every width)`);
            } else if (e.href !== o.href || e.text !== o.text) r.fail(`${where} href/text "${e.href}" "${e.text}" differ from the SAOC bar`);
          });
        }
        // the one other allowed difference: below 480px the email text is visually hidden, the link keeps its icon, a mailto target and an aria-label
        const em = m.email;
        if (!em) r.fail(`${tag}: no email mailto link`);
        else if (vp.width < 480) {
          if (em.aria !== 'Email info@saoc.co.za') r.fail(`${tag}: email aria-label is "${em.aria}", want "Email info@saoc.co.za"`);
          if (em.textW > 2) r.fail(`${tag}: the email text is still visible below 480px (${em.textW.toFixed(0)}px wide)`);
          if (em.w < 24 - 0.5 || em.h < 24 - 0.5) r.fail(`${tag}: the collapsed email target is ${em.w.toFixed(0)}x${em.h.toFixed(0)}px, want at least 24px`);
        } else {
          if (em.textW < 40) r.fail(`${tag}: the email text is hidden at ${vp.width}px, it must show from 480px up`);
          if (em.aria !== null && em.aria !== 'Email info@saoc.co.za') r.fail(`${tag}: unexpected email aria-label "${em.aria}"`);
        }
        // one row, no wrap, no overflow, every target at least 24px (44px preferred)
        const targets = m.els.filter((e) => e.tag === 'a' && e.display !== 'none');
        if (targets.length !== 3) r.fail(`${tag}: ${targets.length} visible links in the bar, want 3 (email, saoc.co.za, Join a society)`);
        if (wrapsRows(targets)) r.fail(`${tag}: the bar's links wrap onto more than one row`);
        for (const t of targets) { if (t.h < 24 - 0.5 || t.w < 24 - 0.5) r.fail(`${tag}: target "${t.text}" is ${t.w.toFixed(0)}x${t.h.toFixed(0)}px, want at least 24px (44px preferred)`); if (t.h < 44) r.note(`${tag}: "${t.text}" is ${t.h.toFixed(0)}px tall (44px preferred, 24px minimum met)`); }
        if (m.barBox.height > 56) r.fail(`${tag}: the bar is ${m.barBox.height.toFixed(0)}px tall, it has wrapped`);
        if (!m.els.some((e) => e.href === U.kept.email) || !m.els.some((e) => e.href === U.kept.join.href && e.text === U.kept.join.label)) r.fail(`${tag}: email or "Join a society" missing`);
        if (m.els.some((e) => /National Show/.test(e.text))) r.fail(`${tag}: the "National Show" pill text is still in the bar`);
        if (!m.firstFocusable || m.firstFocusable.href !== '#main-content') r.fail(`${tag}: first focusable element is ${JSON.stringify(m.firstFocusable)}, want the skip link`);
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
