// RETIRED by launch-weekend F18 (R74 #2): the hub no longer renders the Explore index, so its hub geometry has nothing to measure. The index itself is asserted by F17 check-m-index (amended) on the 16 inner routes. Runs in no gate.
#!/usr/bin/env node
// F12-A4 - R69 grouped index on the hub, measured: structure, groups, labels from nav-config, geometry at 1280/1920/1024 (3 columns) and
// 899/390 (1 column), type roles, rules, arrow hover, and "no descriptions".
import { NAV } from '../../../../components/chrome/nav-config.ts';
import { main, openPage, withBrowser, VP, V, GROUPS, HUB, RULE, ACCENT, INK, rgbOf, rgbNear, near, norm, firstFamily, px } from './_lib.mjs';

const I = V.index;
const labels = new Map();
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.href === 'string' && typeof o.label === 'string' && !labels.has(o.href)) labels.set(o.href, o.label);
  for (const v of Object.values(o)) walk(v);
})(NAV);

function measure(sel) {
  const nav = document.querySelector(sel);
  if (!nav) return { error: `no ${sel}` };
  const cs = (e) => getComputedStyle(e);
  const rc = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top + scrollY, bottom: b.bottom + scrollY, width: b.width, height: b.height }; };
  const hero = document.querySelector('[data-nos-hero]');
  const root = hero?.parentElement ?? document.querySelector('main');
  const h3s = [...nav.querySelectorAll('h3')];
  const groups = h3s.map((h) => {
    const box = h.parentElement;
    const links = [...box.querySelectorAll('li > a')];
    const hc = cs(h);
    return {
      heading: (h.textContent ?? '').replace(/\s+/g, ' ').trim(),
      h: { size: parseFloat(hc.fontSize), weight: Number(hc.fontWeight), ls: parseFloat(hc.letterSpacing), tt: hc.textTransform, color: hc.color, padB: parseFloat(hc.paddingBottom), bbw: parseFloat(hc.borderBottomWidth), bbs: hc.borderBottomStyle, bbc: hc.borderBottomColor, family: hc.fontFamily },
      box: rc(box),
      items: links.map((a) => {
        const li = a.parentElement, ac = cs(a), lc = cs(li);
        const arrow = a.querySelector('[aria-hidden="true"]');
        const textEls = [...a.querySelectorAll('*')].filter((e) => !e.closest('[aria-hidden="true"]') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
        const labelEl = textEls[0] ?? a;
        const parts = [];
        const tw = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) if (!n.parentElement.closest('[aria-hidden="true"]')) parts.push(n.textContent);
        const ownText = parts.join(' ').replace(/\s+/g, ' ').trim();
        return {
          href: a.getAttribute('href'), text: ownText, aria: a.getAttribute('aria-current'),
          display: ac.display, justify: ac.justifyContent, minH: parseFloat(ac.minHeight), h: a.getBoundingClientRect().height,
          family: cs(labelEl).fontFamily, size: parseFloat(cs(labelEl).fontSize), color: cs(labelEl).color,
          liBbw: parseFloat(lc.borderBottomWidth), liBbs: lc.borderBottomStyle, liBbc: lc.borderBottomColor,
          arrowOpacity: arrow ? Number(cs(arrow).opacity) : null, arrowText: arrow ? (arrow.textContent ?? '').trim() : null,
        };
      }),
    };
  });
  const eyebrow = nav.querySelector('p');
  const ncs = cs(nav);
  const stray = [];
  const w = document.createTreeWalker(nav, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (!t || n.parentElement.closest('[aria-hidden="true"]')) continue;
    if (n.parentElement.closest('h3, li > a') || n.parentElement === eyebrow) continue;
    stray.push(t);
  }
  return {
    vw: innerWidth, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tag: nav.tagName.toLowerCase(), aria: nav.getAttribute('aria-label'), isLastBlock: nav.parentElement === root && !nav.nextElementSibling,
    padT: parseFloat(ncs.paddingTop), padB: parseFloat(ncs.paddingBottom), btw: parseFloat(ncs.borderTopWidth), bts: ncs.borderTopStyle, btc: ncs.borderTopColor,
    eyebrow: eyebrow ? (eyebrow.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
    eyebrowBeforeGroups: eyebrow && h3s[0] ? !!(eyebrow.compareDocumentPosition(h3s[0]) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
    groups, stray, h2InNav: nav.querySelectorAll('h2').length,
  };
}

const SEL = `nav[aria-label="${I.ariaLabel}"]`;

await main('F12-A4 hub index', async (r) => {
  await withBrowser(async (browser) => {
    const { ctx, page, status } = await openPage(browser, VP.desktop, HUB);
    if (status !== 200) { r.fail(`${HUB}: HTTP ${status}`); await ctx.close(); return; }
    for (const vp of [VP.desktop, VP.wide, { width: 1024, height: 768 }, { width: 900, height: 768 }, { width: 899, height: 768 }, VP.phone]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(200);
      const m = await page.evaluate(measure, SEL);
      const tag = `@${vp.width}`;
      if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
      const wide = vp.width >= I.breakpoint;
      if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
      if (m.tag !== 'nav' || m.aria !== I.ariaLabel) r.fail(`${tag}: root is <${m.tag} aria-label="${m.aria}">, want <nav aria-label="${I.ariaLabel}">`);
      if (!m.isLastBlock) r.fail(`${tag}: the index is not the last block of the page content`);
      if (m.h2InNav) r.fail(`${tag}: the index carries an h2 (the eyebrow is a <p>)`);
      if (!near(m.padT, I.section.paddingBlock, 0.5) || !near(m.padB, I.section.paddingBlock, 0.5)) r.fail(`${tag}: section padding ${m.padT}/${m.padB}, want 88px`);
      if (m.btw !== I.section.borderTopWidth || m.bts !== 'solid' || !rgbNear(rgbOf(m.btc), RULE)) r.fail(`${tag}: section border-top ${m.btw}px ${m.bts} ${m.btc}, want 1px solid --rule`);
      if (m.eyebrow !== I.eyebrow) r.fail(`${tag}: eyebrow "${m.eyebrow}", want "${I.eyebrow}"`);
      if (!m.eyebrowBeforeGroups) r.fail(`${tag}: eyebrow does not precede the groups`);
      if (m.groups.length !== GROUPS.groups.length) { r.fail(`${tag}: ${m.groups.length} groups, want 3`); continue; }
      let total = 0;
      m.groups.forEach((g, i) => {
        const want = GROUPS.groups[i];
        const gt = `${tag} group "${want.heading}"`;
        if (g.heading !== want.heading) r.fail(`${gt}: heading is "${g.heading}"`);
        const h = g.h;
        if (h.size !== I.groupHeading.fontSize || h.weight !== I.groupHeading.fontWeight || !near(h.ls, I.groupHeading.letterSpacingEm * h.size, 0.1) || h.tt !== 'uppercase') r.fail(`${gt}: h3 type ${h.size}px/${h.weight}/ls ${h.ls}/${h.tt}, want 12px/600/.14em/uppercase`);
        if (!/karla/i.test(firstFamily(h.family))) r.fail(`${gt}: h3 family ${firstFamily(h.family)}, want Karla`);
        if (!rgbNear(rgbOf(h.color), ACCENT)) r.fail(`${gt}: h3 colour ${h.color}, want text-accent`);
        if (h.padB !== 16 || h.bbw !== 1 || h.bbs !== 'solid' || !rgbNear(rgbOf(h.bbc), RULE)) r.fail(`${gt}: h3 bottom ${h.padB}px pad, ${h.bbw}px ${h.bbs} ${h.bbc}, want 16px, 1px solid --rule`);
        if (JSON.stringify(g.items.map((x) => x.href)) !== JSON.stringify(want.hrefs)) r.fail(`${gt}: hrefs [${g.items.map((x) => x.href).join(', ')}] differ from the golden order`);
        for (const it of g.items) {
          total++;
          const it_t = `${gt} item ${it.href}`;
          const wantLabel = labels.get(it.href);
          if (!wantLabel) r.fail(`${it_t}: nav-config has no label for this href`);
          else if (it.text !== wantLabel) r.fail(`${it_t}: text "${it.text}", want nav-config label "${wantLabel}"`);
          if (it.display !== 'flex' || it.justify !== 'space-between') r.fail(`${it_t}: link ${it.display}/${it.justify}, want flex/space-between`);
          if (it.minH < I.item.minHeight || it.h < I.item.minHeight - 0.5) r.fail(`${it_t}: min-height ${it.minH}, height ${it.h}, want >= 56px`);
          if (!/fraunces/i.test(firstFamily(it.family)) || it.size !== I.item.fontSize) r.fail(`${it_t}: label ${firstFamily(it.family)} ${it.size}px, want Fraunces 20px`);
          if (it.aria === null && !rgbNear(rgbOf(it.color), INK)) r.fail(`${it_t}: label colour ${it.color}, want text-ink`);
          if (it.liBbw !== 1 || it.liBbs !== 'solid' || !rgbNear(rgbOf(it.liBbc), RULE)) r.fail(`${it_t}: li border-bottom ${it.liBbw}px ${it.liBbs} ${it.liBbc}, want 1px solid --rule`);
          if (it.arrowOpacity === null || !near(it.arrowOpacity, I.item.arrowOpacity, 0.02)) r.fail(`${it_t}: arrow opacity ${it.arrowOpacity}, want .35 (aria-hidden arrow required)`);
        }
      });
      if (total !== GROUPS.total) r.fail(`${tag}: ${total} items, want ${GROUPS.total}`);
      if (m.stray.length) r.fail(`${tag}: text beyond eyebrow, headings, labels and arrows (descriptions are dropped): ${m.stray.slice(0, 3).join(' | ')}`);
      const lefts = new Set(m.groups.map((g) => Math.round(g.box.left)));
      if (wide) {
        if (lefts.size !== 3) r.fail(`${tag}: ${lefts.size} column(s), want 3`);
        else {
          const [a, b, c] = m.groups.map((g) => g.box);
          if (!near(a.width, b.width, 1) || !near(b.width, c.width, 1)) r.fail(`${tag}: columns are not equal (${[a, b, c].map((x) => x.width.toFixed(1)).join(', ')})`);
          if (!near(b.left - a.right, I.columnGap, 1) || !near(c.left - b.right, I.columnGap, 1)) r.fail(`${tag}: column gap ${(b.left - a.right).toFixed(1)}/${(c.left - b.right).toFixed(1)}, want 56px`);
        }
      } else {
        if (lefts.size !== 1) r.fail(`${tag}: ${lefts.size} columns below 900, want one`);
        const [a, b, c] = m.groups.map((g) => g.box);
        if (!(b.top >= a.bottom - 1 && c.top >= b.bottom - 1)) r.fail(`${tag}: groups do not stack in order below 900`);
      }
    }

    // hover: arrow to full opacity and 4px right, label text-accent
    await page.setViewportSize(VP.desktop);
    await page.waitForTimeout(150);
    const link = page.locator(`${SEL} li > a`).nth(1);
    await link.scrollIntoViewIfNeeded();
    const readState = () => link.evaluate((a) => {
      const arrow = a.querySelector('[aria-hidden="true"]');
      const labelEl = [...a.querySelectorAll('*')].find((e) => !e.closest('[aria-hidden="true"]') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) ?? a;
      return { op: Number(getComputedStyle(arrow).opacity), tf: getComputedStyle(arrow).transform, color: getComputedStyle(labelEl).color };
    });
    const before = await readState();
    await link.hover();
    await page.waitForTimeout(500);
    const after = await readState();
    const tx = (t) => { const mm = /matrix\(([^)]+)\)/.exec(t); return mm ? Number(mm[1].split(',')[4]) : 0; };
    if (!near(before.op, I.item.arrowOpacity, 0.02) || Math.abs(tx(before.tf)) > 0.1) r.fail(`rest state: arrow opacity ${before.op} transform ${before.tf}, want .35 and no shift`);
    if (!near(after.op, 1, 0.02)) r.fail(`hover: arrow opacity ${after.op}, want 1`);
    if (!near(tx(after.tf), I.item.arrowHoverTranslateX, 0.3)) r.fail(`hover: arrow translateX ${tx(after.tf)}px, want 4px`);
    if (!rgbNear(rgbOf(after.color), ACCENT)) r.fail(`hover: label colour ${after.color}, want text-accent`);
    await ctx.close();
  });
});
