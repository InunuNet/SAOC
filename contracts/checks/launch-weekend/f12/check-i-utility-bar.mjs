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
  const nodes = [bar, ...bar.querySelectorAll('*')];
  const els = nodes.map((e) => {
    const cs = getComputedStyle(e);
    const o = { tag: e.tagName.toLowerCase(), cls: String(e.getAttribute('class') ?? ''), href: e.getAttribute('href'), text: e.children.length ? '' : (e.textContent ?? '').replace(/\s+/g, ' ').trim() };
    for (const p of arg.keys) o[p] = cs[p];
    return o;
  });
  const header = document.querySelector('#nh') ?? document.querySelector('body > header');
  const focusables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')];
  const first = focusables[0];
  return {
    els, barBox: rc(bar), barCount: document.querySelectorAll(arg.sel).length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    barPrecedesHeader: header ? !!(bar.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
    header: header ? { top: rc(header).top, id: header.id } : null,
    firstFocusable: first ? { tag: first.tagName.toLowerCase(), href: first.getAttribute('href'), text: (first.textContent ?? '').trim() } : null,
    headerLinks: header ? [...header.querySelectorAll('a')].map((a) => ({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })) : [],
  };
}
const ARG = { sel: BAR, keys: STYLE_KEYS };
const isPill = (e) => e.tag === 'a' && e.href === '/national-show';

await main('F12-A14 utility bar', async (r) => {
  await withBrowser(async (browser) => {
    for (const vp of [VP.desktop, VP.phone]) {
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
            if (e.tag !== o.tag || e.cls !== o.cls) r.fail(`${where} class differs from the SAOC bar ("${e.cls}" vs "${o.cls}")`);
            for (const k of STYLE_KEYS) if (e[k] !== o[k]) { r.fail(`${where} ${k} ${e[k]} vs SAOC ${o[k]}`); break; }
            if (isPill(o)) {
              if (e.href !== U.pill.href || e.text !== U.pill.label) r.fail(`${where} is "${e.text}" -> ${e.href}, want pill "${U.pill.label}" -> ${U.pill.href}`);
              if ((e.display === 'none') !== (o.display === 'none')) r.fail(`${where} pill visibility differs from the SAOC bar at this width`);
            } else if (e.href !== o.href || e.text !== o.text) r.fail(`${where} href/text "${e.href}" "${e.text}" differ from the SAOC bar`);
          });
        }
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
