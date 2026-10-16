#!/usr/bin/env node
// F18-A1 (R75, R78 #1): the shared long-form prose template on /national-show/about, /what-to-expect, /vendors and /sa-exhibitors, against a PUBLIC build.
//  copy      : the paragraph list (and the heading, where the page has one) equals goldens/f18/longform-copy.json word for word, in order (R7 casing, quote style ignored);
//              paragraph 1 is the lede, in [data-nos-longform-lede], 20px / 1.5 (the handoff .lede role); nothing is added, nothing is dropped
//  grid      : DOM order head, aside, body; from 900px two columns 4fr/7fr with a 64px gap, below 900px one column (aside after the lede, above the body); the aside is
//              position:sticky with a top offset of 62-120px from 900px (and really sticks when the body is tall enough), and is NOT sticky below 900px
//  body      : paragraphs 16px / 1.55, at most 60ch wide, full-ink (opaque, the --ink token, not an /80 alpha)
//  facts     : [data-nos-facts] in the aside, labels Dates / Host / Venue / Cycle, values identical to the hub's hero facts (one source)
//  pull-quote: /about carries exactly one [data-nos-pullquote], the theme line, verbatim from paragraph 2; any other page may carry one only if its text is verbatim in the body
//  image     : exactly one [data-nos-image-break] after paragraph breakAfter, inside the body column, 21:9, alt="", lazy, width and height attributes, no filter or overlay
//  closing   : the Tickets + Plan your visit pair (primary then ghost) in [data-nos-longform-cta] (vendors: its existing royal CtaBand to /national-show/vendors/apply),
//              then exactly one "Explore the show pages" index as the last block in main (about's index was missing on 41a7a08f: F17 G1 restored it, asserted again here)
//  public    : no content-gap block, no horizontal overflow at 1280, 900, 899 and 390.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-a-longform.mjs
import { main, openPage, withBrowser, readGolden, T, flat, near, fetchHtml } from './_lib.mjs';

const L = T.longform;
const COPY = readGolden('longform-copy.json').routes;

function measure({ S, K }) {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const rc = (e) => e.getBoundingClientRect();
  const cs = (e) => getComputedStyle(e);
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
  const root = q(S.root);
  const out = { roots: qa(S.root).length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, gaps: qa('[data-nos-content-gap]').length };
  if (!root) return out;
  const head = root.querySelector(S.head), lede = root.querySelector(S.lede), aside = root.querySelector(S.aside), body = root.querySelector(S.body);
  out.have = { head: !!head, lede: !!lede, aside: !!aside, body: !!body };
  if (!head || !lede || !aside || !body) return out;
  out.order = before(head, aside) && before(aside, body);
  // probes: 60ch in the body font, and the --ink token resolved to rgb.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--ink)';
  body.appendChild(probe);
  const ink = cs(probe).color;
  probe.remove();
  const bodyP = qa(`${S.body} p`).filter((p) => !p.closest(S.pullQuote) && !p.closest(S.imageBreak) && !p.closest(S.cta));
  const paras = [lede, ...bodyP.filter((p) => p !== lede)].map(t);
  const h2 = head.querySelector('h2');
  out.heading = h2 ? t(h2) : null;
  out.paras = paras;
  out.lede = { size: parseFloat(cs(lede).fontSize), lh: parseFloat(cs(lede).lineHeight) / parseFloat(cs(lede).fontSize) };
  out.body = bodyP.slice(0, 6).map((p) => {
    const probe60 = document.createElement('span');
    probe60.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;width:${K.bodyMaxCh}ch;font:${cs(p).font}`;
    p.appendChild(probe60);
    const max = rc(probe60).width;
    probe60.remove();
    const s = cs(p);
    return { size: parseFloat(s.fontSize), lh: parseFloat(s.lineHeight) / parseFloat(s.fontSize), width: rc(p).width, max, color: s.color, ink };
  });
  const a = rc(aside), b = rc(body);
  out.geo = { asideW: a.width, bodyW: b.width, gap: b.left - a.right, asideLeft: a.left, bodyLeft: b.left, asideBottom: a.bottom, bodyTop: b.top, position: cs(aside).position, top: parseFloat(cs(aside).top) };
  const fx = aside.querySelector(S.facts);
  out.facts = fx ? { labels: [...fx.querySelectorAll('dt')].map(t), values: [...fx.querySelectorAll('dd')].map(t) } : null;
  const pq = qa(S.pullQuote);
  out.pullQuotes = pq.map((e) => ({ text: t(e), inAside: !!e.closest(S.aside) }));
  const br = qa(S.imageBreak);
  out.breaks = br.map((e) => {
    const img = e.querySelector('img');
    const r = rc(e);
    const before2 = paras.length ? [lede, ...bodyP].filter((p, i, arr) => arr.indexOf(p) === i && before(p, e)).length : 0;
    return {
      w: r.width, h: r.height, left: r.left, right: r.right, paragraphsBefore: before2,
      alt: img?.getAttribute('alt') ?? null, loading: img?.getAttribute('loading') ?? null, hasWH: !!(img?.getAttribute('width') && img?.getAttribute('height')),
      filter: img ? cs(img).filter : null, wrapFilter: cs(e).filter, bg: cs(e).backgroundImage, blend: img ? cs(img).mixBlendMode : null,
      overlay: [...e.querySelectorAll('*')].filter((x) => x !== img && x.tagName !== 'PICTURE').length,
    };
  });
  out.bodyBox = { left: b.left, right: b.right };
  const cta = q(S.cta);
  out.cta = cta ? {
    after: before(body, cta),
    links: [...cta.querySelectorAll('a')].map((x) => ({ text: t(x), href: x.getAttribute('href'), bg: cs(x).backgroundColor, border: parseFloat(cs(x).borderTopWidth), h: rc(x).height })),
  } : null;
  out.royalBand = qa('main section.nos-section-royal a').map((x) => x.getAttribute('href'));
  const idx = qa(S.index);
  const mainEl = q('main');
  const blocks = mainEl ? [...mainEl.children] : [];
  out.index = { count: idx.length, inMain: idx.every((n) => !!n.closest('main')), last: blocks.length ? blocks[blocks.length - 1].matches(S.index) || !!blocks[blocks.length - 1].querySelector(S.index) : false, afterBody: idx[0] ? before(body, idx[0]) : false };
  return out;
}

async function heroFacts(browser) {
  const { ctx, page } = await openPage(browser, { width: 1280, height: 800 }, '/national-show');
  const v = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} dd`)].map((e) => e.textContent.replace(/\s+/g, ' ').trim()), L.selectors.heroFacts);
  const labels = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} dt`)].map((e) => e.textContent.replace(/\s+/g, ' ').trim()), L.selectors.heroFacts);
  await ctx.close();
  return { values: v, labels };
}

await main('F18-A1 long-form template', async (r) => {
  await withBrowser(async (browser) => {
    const hub = await heroFacts(browser);
    if (!hub.values.length) r.fail('the hub renders no .nos-hero-facts to compare the template facts against');
    for (const route of L.routes) {
      const spec = COPY[route];
      const { status } = await fetchHtml(route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); continue; }
      for (const [name, [w, h]] of [['1280', T.viewports.desktop], ['900', T.viewports.gridEdge], ['899', T.viewports.belowGridEdge], ['390', T.viewports.phone]]) {
        const { ctx, page } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${name}`;
        const m = await page.evaluate(measure, { S: L.selectors, K: L });
        if (m.roots !== 1) { r.fail(`${tag}: ${m.roots} ${L.selectors.root} roots, want exactly 1`); await ctx.close(); continue; }
        if (!m.have.head || !m.have.lede || !m.have.aside || !m.have.body) { r.fail(`${tag}: template parts missing ${JSON.stringify(m.have)}`); await ctx.close(); continue; }
        if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
        if (m.gaps) r.fail(`${tag}: ${m.gaps} content-gap block(s) in a public build`);
        if (!m.order) r.fail(`${tag}: DOM order must be head, aside, body`);
        if (name === '1280' || name === '390') {
          // copy
          const want = spec.paragraphs.map(flat);
          const got = m.paras.map(flat);
          if (JSON.stringify(got) !== JSON.stringify(want)) r.fail(`${tag}: paragraphs differ from longform-copy.json (${got.length} vs ${want.length}); first difference: ${got.findIndex((x, i) => x !== want[i])}`);
          if (flat(spec.heading ?? '') !== flat(m.heading ?? '')) r.fail(`${tag}: heading "${m.heading}", want ${JSON.stringify(spec.heading)}`);
          if (!near(m.lede.size, L.ledePx, 0.5) || !near(m.lede.lh, L.ledeLineHeight, L.lineHeightTolerance)) r.fail(`${tag}: lede is ${m.lede.size}px / ${m.lede.lh.toFixed(2)}, want ${L.ledePx}px / ${L.ledeLineHeight}`);
          for (const [i, p] of m.body.entries()) {
            if (!near(p.size, L.bodyPx, 0.5) || !near(p.lh, L.bodyLineHeight, L.lineHeightTolerance)) r.fail(`${tag}: body paragraph ${i + 1} is ${p.size}px / ${p.lh.toFixed(3)}, want ${L.bodyPx}px / ${L.bodyLineHeight}`);
            if (p.width > p.max + 1) r.fail(`${tag}: body paragraph ${i + 1} is ${p.width.toFixed(0)}px wide, max ${L.bodyMaxCh}ch = ${p.max.toFixed(0)}px`);
            if (!/^rgb\(/.test(p.color) || p.color !== p.ink) r.fail(`${tag}: body paragraph ${i + 1} colour ${p.color}, want the opaque ink ${p.ink} (no alpha)`);
          }
          // facts
          if (!m.facts) r.fail(`${tag}: no ${L.selectors.facts} in the aside`);
          else {
            if (JSON.stringify(m.facts.labels) !== JSON.stringify(L.factLabels)) r.fail(`${tag}: fact labels ${JSON.stringify(m.facts.labels)}, want ${JSON.stringify(L.factLabels)}`);
            if (JSON.stringify(m.facts.values) !== JSON.stringify(hub.values)) r.fail(`${tag}: fact values ${JSON.stringify(m.facts.values)} differ from the hub hero facts ${JSON.stringify(hub.values)}`);
          }
          // pull-quote
          const bodyText = flat(m.paras.join(' ')).replace(/["']/g, '');
          if (spec.pullQuote) {
            if (m.pullQuotes.length !== 1) r.fail(`${tag}: ${m.pullQuotes.length} pull-quotes, want exactly 1`);
            else {
              const q = flat(m.pullQuotes[0].text).replace(/["',.]/g, '').trim();
              if (q !== flat(spec.pullQuote).replace(/["',.]/g, '').trim()) r.fail(`${tag}: pull-quote "${m.pullQuotes[0].text}" is not the theme line`);
              if (!m.pullQuotes[0].inAside) r.fail(`${tag}: the pull-quote must sit in the sticky aside`);
              if (!flat(m.paras[spec.pullQuoteParagraph - 1] ?? '').replace(/["',.]/g, '').includes(q)) r.fail(`${tag}: the pull-quote is not verbatim in paragraph ${spec.pullQuoteParagraph}`);
            }
          } else for (const pq of m.pullQuotes) if (!bodyText.replace(/[,.]/g, '').includes(flat(pq.text).replace(/["',.]/g, '').trim())) r.fail(`${tag}: pull-quote "${pq.text}" is not verbatim in the body copy (invention)`);
          // image break
          if (m.breaks.length !== 1) r.fail(`${tag}: ${m.breaks.length} image breaks, want exactly 1`);
          else {
            const b = m.breaks[0];
            const ratio = b.w / b.h;
            if (!near(ratio, L.imageAspect.w / L.imageAspect.h, L.imageAspect.tolerance * (L.imageAspect.w / L.imageAspect.h))) r.fail(`${tag}: image break is ${b.w.toFixed(0)}x${b.h.toFixed(0)} (${ratio.toFixed(2)}), want 21:9`);
            if (b.paragraphsBefore !== spec.breakAfter) r.fail(`${tag}: image break follows ${b.paragraphsBefore} paragraphs, want ${spec.breakAfter}`);
            if (b.alt !== '') r.fail(`${tag}: image break alt is ${JSON.stringify(b.alt)}, want "" (decorative)`);
            if (b.loading !== 'lazy') r.fail(`${tag}: image break loading is ${b.loading}, want lazy (it is below the fold)`);
            if (!b.hasWH) r.fail(`${tag}: image break <img> has no width and height attributes`);
            if (b.filter !== 'none' || b.wrapFilter !== 'none' || b.blend !== 'normal' || b.bg !== 'none' || b.overlay) r.fail(`${tag}: image break carries a filter, blend, background or overlay (filter ${b.filter}, blend ${b.blend}, ${b.overlay} extra node(s))`);
            if (b.left < m.bodyBox.left - 1 || b.right > m.bodyBox.right + 1) r.fail(`${tag}: image break leaves the body column`);
          }
          // closing
          const pair = L.ctaPair[route];
          if (pair === 'existing-ctaband') {
            if (!m.royalBand.includes('/national-show/vendors/apply')) r.fail(`${tag}: the existing royal CtaBand to /national-show/vendors/apply is gone`);
          } else if (!m.cta) r.fail(`${tag}: no ${L.selectors.cta}`);
          else {
            if (!m.cta.after) r.fail(`${tag}: the closing CTA is not after the body`);
            if (m.cta.links.length !== 2) r.fail(`${tag}: ${m.cta.links.length} closing actions, want exactly 2`);
            m.cta.links.forEach((x, i) => {
              const want2 = pair[i];
              if (!want2) return;
              if (x.text !== want2.label || x.href !== want2.href) r.fail(`${tag}: closing action ${i + 1} is "${x.text}" -> ${x.href}, want "${want2.label}" -> ${want2.href}`);
              if (x.h < 44) r.fail(`${tag}: closing action "${x.text}" is ${x.h.toFixed(0)}px tall, want >= 44`);
              const filled = x.bg !== 'rgba(0, 0, 0, 0)';
              if (want2.variant === 'primary' && !filled) r.fail(`${tag}: "${x.text}" must be the filled primary action`);
              if (want2.variant === 'ghost' && (filled || x.border < 1)) r.fail(`${tag}: "${x.text}" must be the outline (ghost) action (bg ${x.bg}, border ${x.border}px)`);
            });
          }
          if (m.index.count !== 1 || !m.index.inMain || !m.index.afterBody) r.fail(`${tag}: the explore index renders ${m.index.count}x (inMain ${m.index.inMain}, after body ${m.index.afterBody}), want once, last`);
        }
        // grid and sticky
        const g = m.geo;
        if (w >= L.gridMinPx) {
          const ratio = g.asideW / g.bodyW;
          if (Math.abs(ratio - L.columnRatio.a / L.columnRatio.b) > L.columnRatio.tolerance) r.fail(`${tag}: aside:body widths are ${g.asideW.toFixed(0)}:${g.bodyW.toFixed(0)} (${ratio.toFixed(3)}), want 4fr:7fr (${(L.columnRatio.a / L.columnRatio.b).toFixed(3)})`);
          if (!near(g.gap, L.columnGapPx, 2)) r.fail(`${tag}: column gap ${g.gap.toFixed(0)}px, want ${L.columnGapPx}px`);
          if (g.position !== 'sticky' || g.top < L.stickyTopMinPx - 0.5 || g.top > L.stickyTopMaxPx + 0.5) r.fail(`${tag}: aside is position ${g.position} top ${g.top}px, want sticky with top ${L.stickyTopMinPx}-${L.stickyTopMaxPx}px`);
          else if (name === '1280') {
            // it really sticks: scroll the middle of a tall body to the top of the viewport.
            const stuck = await page.evaluate(({ S, lo, hi }) => {
              const aside = document.querySelector(S.aside), body = document.querySelector(S.body);
              const tallEnough = body.getBoundingClientRect().height > aside.getBoundingClientRect().height + innerHeight * 0.8;
              if (!tallEnough) return { skip: true };
              const mid = body.getBoundingClientRect().top + scrollY + (body.getBoundingClientRect().height - aside.getBoundingClientRect().height) / 2;
              scrollTo(0, mid - 40);
              return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => { const top = aside.getBoundingClientRect().top; res({ top, ok: top >= lo - 1 && top <= hi + 1 }); })));
            }, { S: L.selectors, lo: L.stickyTopMinPx, hi: L.stickyTopMaxPx });
            if (!stuck.skip && !stuck.ok) r.fail(`${tag}: the aside does not stick (top ${stuck.top?.toFixed?.(0)}px while the body is in view; an ancestor with overflow or a missing align-self:start?)`);
          }
        } else {
          if (Math.abs(g.asideLeft - g.bodyLeft) > 1 || g.asideBottom > g.bodyTop + 1) r.fail(`${tag}: below ${L.gridMinPx}px the aside and body must stack in one column (aside above the body)`);
          if (g.position === 'sticky') r.fail(`${tag}: the aside is sticky below ${L.gridMinPx}px, where it would cover the copy`);
        }
        await ctx.close();
      }
    }
  });
});
