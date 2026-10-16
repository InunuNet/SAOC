// F3-R27 inner sub-nav (NOS Design ruling R27). Directly under the inner hero, one row of the current page's group siblings
// (Visit / Programme / Exhibit & Trade / The Show), labels and hrefs verbatim from components/chrome/nav-config.ts.
//   <nav aria-label="{Group} pages"> on the nav itself: Karla 700 14.5px royal links, item height 44px, gap 24px, 1px --line bottom rule on a
//   gold-100 ground (#FBFAF0), not sticky. Current item aria-current="page" (or "true" on a sub-route such as /vendors/apply or /archive/2024,
//   where the parent leaf is the current location) with a 2px green-1 underline. At <=700px: ONE horizontally scrollable row (overflow-x auto,
//   scroll-snap, hidden scrollbar), an 8px right-edge fade shown only while the row overflows, current item scrolled into view.
//   No sub-nav on the hub or on tickets. Fade element: [data-nos-subnav-fade], or the nav / scroller ::before / ::after.
// Routes: every NOS route except the hub and tickets, every archive year, the public vendor sub-routes. Widths 1280, 701, 700, 390.
import { allRoutes, groupFor, NO_SUBNAV_ROUTES, main, openPage, withBrowser, rgbOf, rgbNear, ROYAL_RGB, GOLD_100_RGB, LINE_RGB, GREEN_1_RGB, firstFamily } from './_f3lib.mjs';

const VPS = [['1280', 1280, 800], ['701', 701, 800], ['700', 700, 800], ['390', 390, 844]];
const NARROW_MAX = 700;

function measure(label) {
  const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
  const all = [...document.querySelectorAll('nav')].filter((n) => !n.closest('#nh, #nd, #nf'));
  const pagesNavs = all.filter((n) => / pages$/.test(n.getAttribute('aria-label') ?? ''));
  const nav = label ? pagesNavs.find((n) => n.getAttribute('aria-label') === label) ?? null : null;
  const hero = document.querySelector('[data-nos-hero]');
  const R = (e) => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, width: r.width, height: r.height }; };
  if (!nav) return { labels: pagesNavs.map((n) => n.getAttribute('aria-label')), found: false };
  const cs = getComputedStyle(nav);
  const scroller = [nav, ...nav.querySelectorAll('ul, ol, div')].find((e) => /^(auto|scroll)$/.test(getComputedStyle(e).overflowX)) ?? null;
  const items = [...nav.querySelectorAll('a')];
  const underlines = (a) => {
    const out = [];
    for (const e of [a, ...a.querySelectorAll('*')]) {
      const s = getComputedStyle(e);
      if (s.textDecorationLine.includes('underline')) out.push({ w: parseFloat(s.textDecorationThickness), c: s.textDecorationColor });
      if (parseFloat(s.borderBottomWidth) > 0 && s.borderBottomStyle !== 'none') out.push({ w: parseFloat(s.borderBottomWidth), c: s.borderBottomColor });
      for (const p of ['::before', '::after']) {
        const ps = getComputedStyle(e, p);
        if (ps.content !== 'none' && ps.content !== 'normal' && parseFloat(ps.height) > 0 && ps.backgroundColor !== 'rgba(0, 0, 0, 0)') out.push({ w: parseFloat(ps.height), c: ps.backgroundColor });
      }
    }
    return out;
  };
  const fadeFrom = (e, pseudo) => {
    const s = getComputedStyle(e, pseudo);
    if (pseudo && (s.content === 'none' || s.content === 'normal')) return null;
    return { width: parseFloat(s.width), position: s.position, gradient: /gradient/.test(s.backgroundImage), opacity: Number(s.opacity), display: s.display, visibility: s.visibility, right: s.right };
  };
  const fadeEl = nav.querySelector('[data-nos-subnav-fade]');
  const fades = [fadeEl && fadeFrom(fadeEl), fadeFrom(nav, '::after'), fadeFrom(nav, '::before'), scroller && scroller !== nav ? fadeFrom(scroller, '::after') : null].filter(Boolean);
  const sticky = [];
  for (let e = nav; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'sticky' || p === 'fixed') sticky.push(`${e.tagName.toLowerCase()}:${p}`); }
  const sRect = scroller ? R(scroller) : R(nav);
  return {
    found: true,
    labels: pagesNavs.map((n) => n.getAttribute('aria-label')),
    inMain: !!nav.closest('main'),
    hero: hero ? R(hero) : null,
    nav: R(nav),
    bg: cs.backgroundColor,
    ruleW: parseFloat(cs.borderBottomWidth), ruleStyle: cs.borderBottomStyle, ruleColor: cs.borderBottomColor,
    sticky,
    scroller: scroller ? { overflowX: getComputedStyle(scroller).overflowX, snapType: getComputedStyle(scroller).scrollSnapType, sbWidth: getComputedStyle(scroller).scrollbarWidth, sbWebkit: getComputedStyle(scroller, '::-webkit-scrollbar').display, scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth } : null,
    overflowing: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false,
    fades,
    scrollRect: { left: sRect.left, right: sRect.right },
    items: items.map((a) => {
      const s = getComputedStyle(a);
      const li = a.closest('li');
      return {
        text: norm(a.textContent), href: a.getAttribute('href'), current: a.getAttribute('aria-current'),
        family: s.fontFamily, weight: Number(s.fontWeight), size: parseFloat(s.fontSize), color: s.color,
        snap: s.scrollSnapAlign !== 'none' ? s.scrollSnapAlign : (li ? getComputedStyle(li).scrollSnapAlign : 'none'),
        rect: R(a), underlines: underlines(a),
      };
    }),
  };
}

await main('F3-R27 subnav', async (r) => {
  await withBrowser(async (browser) => {
    const routes = await allRoutes(browser);
    for (const route of routes) {
      const hit = groupFor(route);
      const none = NO_SUBNAV_ROUTES.includes(route);
      for (const [name, w, h] of VPS) {
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        await page.waitForTimeout(350); // a client effect may scroll the current item into view
        if (none) {
          const m = await page.evaluate(measure, null);
          if (m.labels.length) r.fail(`${tag}: ${route} must have no sub-nav, found nav[aria-label="${m.labels.join('", "')}"]`);
          await ctx.close();
          continue;
        }
        if (!hit) { r.fail(`${tag}: route is in no nav-config group`); await ctx.close(); continue; }
        const m = await page.evaluate(measure, hit.group.label);
        if (!m.found) { r.fail(`${tag}: no <nav aria-label="${hit.group.label}"> (found: ${m.labels.join(', ') || 'none'})`); await ctx.close(); continue; }
        if (m.labels.filter((l) => l === hit.group.label).length !== 1) r.fail(`${tag}: want exactly one nav[aria-label="${hit.group.label}"]`);
        if (!m.inMain) r.fail(`${tag}: sub-nav is outside <main>`);
        if (m.hero && Math.abs(m.nav.top - m.hero.bottom) > 1) r.fail(`${tag}: sub-nav top ${m.nav.top.toFixed(1)} is not directly under the hero bottom ${m.hero.bottom.toFixed(1)}`);
        const want = hit.group.links;
        if (JSON.stringify(m.items.map((i) => [i.text, i.href])) !== JSON.stringify(want.map((l) => [l.label, l.href]))) r.fail(`${tag}: items ${JSON.stringify(m.items.map((i) => i.text))} are not the ${hit.group.heading} group from nav-config ${JSON.stringify(want.map((l) => l.label))} (labels and hrefs verbatim, in order)`);
        if (!rgbNear(rgbOf(m.bg), GOLD_100_RGB, 1.5)) r.fail(`${tag}: ground ${m.bg}, want gold-100 rgb(251, 250, 240)`);
        if (!(Math.abs(m.ruleW - 1) <= 0.1 && m.ruleStyle === 'solid' && rgbNear(rgbOf(m.ruleColor), LINE_RGB, 1.5))) r.fail(`${tag}: bottom rule ${m.ruleW}px ${m.ruleStyle} ${m.ruleColor}, want 1px solid --line rgb(218, 215, 200)`);
        if (m.sticky.length) r.fail(`${tag}: sub-nav is ${m.sticky.join(', ')}; it is not sticky`);
        let currents = 0;
        m.items.forEach((it, i) => {
          const id = `${tag} item "${it.text}"`;
          if (!/karla/i.test(firstFamily(it.family)) || it.weight !== 700) r.fail(`${id}: ${firstFamily(it.family)} ${it.weight}, want Karla 700`);
          if (!(Math.abs(it.size - 14.5) <= 0.1)) r.fail(`${id}: ${it.size}px, want 14.5px`);
          if (!rgbNear(rgbOf(it.color), ROYAL_RGB)) r.fail(`${id}: colour ${it.color}, want royal rgb(33, 26, 87)`);
          if (!(Math.abs(it.rect.height - 44) <= 0.6)) r.fail(`${id}: height ${it.rect.height.toFixed(1)}px, want 44px`);
          const prev = m.items[i - 1];
          if (prev && Math.abs(it.rect.top - prev.rect.top) < 2) { const gap = it.rect.left - prev.rect.right; if (!(Math.abs(gap - 24) <= 1)) r.fail(`${id}: gap to the previous item ${gap.toFixed(1)}px, want 24px`); } // above 700px a long group may wrap; the gap is judged within a row
          const isCur = it.href === hit.leaf.href;
          const wantCur = hit.exact ? 'page' : 'true';
          if (isCur) {
            currents++;
            if (it.current !== wantCur) r.fail(`${id}: aria-current="${it.current}", want "${wantCur}"`);
            if (!it.underlines.some((u) => Math.abs(u.w - 2) <= 0.2 && rgbNear(rgbOf(u.c), GREEN_1_RGB, 2))) r.fail(`${id}: current item has no 2px green-1 underline (found ${JSON.stringify(it.underlines)})`);
          } else {
            if (it.current) r.fail(`${id}: aria-current="${it.current}" on a non-current item`);
            if (it.underlines.some((u) => Math.abs(u.w - 2) <= 0.2 && rgbNear(rgbOf(u.c), GREEN_1_RGB, 2))) r.fail(`${id}: non-current item carries the current underline`);
          }
        });
        if (currents !== 1) r.fail(`${tag}: ${currents} current items, want exactly 1`);
        if (w > NARROW_MAX) {
          if (m.overflowing) r.fail(`${tag}: row overflows at ${w}px; only <=700px scrolls`);
          if (m.fades.some((f) => f.opacity > 0 && f.display !== 'none' && f.visibility !== 'hidden' && f.width > 0.5)) r.fail(`${tag}: edge fade is visible while the row does not overflow`);
        } else {
          const s = m.scroller;
          if (!s || !/^(auto|scroll)$/.test(s.overflowX)) r.fail(`${tag}: no overflow-x auto scroller at <=700px`);
          else {
            if (!/x/.test(s.snapType) || /none/.test(s.snapType)) r.fail(`${tag}: scroll-snap-type "${s.snapType}", want an x axis snap`);
            if (!(s.sbWidth === 'none' || m.scroller.sbWebkit === 'none')) r.fail(`${tag}: scrollbar not hidden (scrollbar-width ${s.sbWidth}, ::-webkit-scrollbar ${s.sbWebkit})`);
            if (!m.items.every((i) => i.snap !== 'none')) r.fail(`${tag}: items have no scroll-snap-align`);
          }
          const fadeOn = m.fades.filter((f) => f.gradient && Math.abs(f.width - 8) <= 0.6 && f.opacity > 0 && f.display !== 'none' && f.visibility !== 'hidden');
          if (m.overflowing && !fadeOn.length) r.fail(`${tag}: row overflows but no 8px gradient edge fade is visible (fades: ${JSON.stringify(m.fades)})`);
          if (!m.overflowing && m.fades.some((f) => f.opacity > 0 && f.display !== 'none' && f.visibility !== 'hidden' && f.width > 0.5)) r.fail(`${tag}: edge fade is visible while the row does not overflow`);
          const cur = m.items.find((i) => i.href === hit.leaf.href);
          if (cur && (cur.rect.left < m.scrollRect.left - 1 || cur.rect.right > m.scrollRect.right + 1)) r.fail(`${tag}: current item (${cur.rect.left.toFixed(0)}..${cur.rect.right.toFixed(0)}) is not scrolled into view (${m.scrollRect.left.toFixed(0)}..${m.scrollRect.right.toFixed(0)})`);
        }
        if (name === '1280') {
          const before = await page.evaluate(() => { const n = [...document.querySelectorAll('nav')].find((x) => / pages$/.test(x.getAttribute('aria-label') ?? '') && !x.closest('#nh, #nd, #nf')); return n.getBoundingClientRect().top + scrollY; });
          const room = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
          if (room > 400) {
            await page.evaluate(() => window.scrollTo(0, 300));
            await page.waitForTimeout(80);
            const top = await page.evaluate(() => { const n = [...document.querySelectorAll('nav')].find((x) => / pages$/.test(x.getAttribute('aria-label') ?? '') && !x.closest('#nh, #nd, #nf')); return n.getBoundingClientRect().top; });
            if (Math.abs(top - (before - 300)) > 2) r.fail(`${tag}: sub-nav moved with the viewport (top ${top.toFixed(0)} at scrollY 300, document top ${before.toFixed(0)}); it must scroll away, not stick`);
          }
        }
        await ctx.close();
      }
    }
  });
});
