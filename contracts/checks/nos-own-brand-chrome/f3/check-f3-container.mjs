// RETIRED (launch-weekend F17, goldens/f17/supersession.json): this 1080px-container assertion is superseded by F12-A15 (R71 single axis, 1320 + 2*gutter).
// It fails by design on every NOS route since F12 (about 383 findings on 2effaec3) and is no longer part of any gate. Kept for the history of F3 only.
// F3-C1 (NOS Design Acceptance bar rev 2, C1): ONE content container across every NOS section. Content max-width 1080px (--default, I:61)
// plus a gutter of clamp(16px, 4vw, 48px) (I:91, wrap rule I:92). Today's build mixes max-w-[1280px] px-8 wraps and ad-hoc max-w-2xl wraps.
// DOM contract: the page-content root is the parent of [data-nos-hero]; every rendered child block of that root (except the hero and the
// sub-nav) contains a [data-nos-wrap] (or is one). Every [data-nos-wrap] resolves to max-width = 1080 + 2*gutter, padding-inline = gutter,
// centred, and no text-bearing element inside a block is wider than the 1080 content box (full-bleed backgrounds are [data-nos-bleed]
// or aria-hidden and carry no text). Hero copy is exempt here (the mock's hero uses --wide, I:140); the typographic hero is checked in F3-R29.
// All routes (17 + archive years + public vendor sub-routes) at 1440, 1280, 1024, 768, 390.
import { allRoutes, main, openPage, withBrowser, gutterOf, WRAP_DEFAULT } from './_f3lib.mjs';

const VPS = [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]];

function measure(WRAP) {
  const hero = document.querySelector('[data-nos-hero]');
  if (!hero) return { error: 'no [data-nos-hero]' };
  const root = hero.parentElement;
  const vw = document.documentElement.clientWidth;
  const rectOf = (e) => e.getBoundingClientRect();
  const blocks = [...root.children].filter((e) => e !== hero && !/^(SCRIPT|STYLE|TEMPLATE|LINK|NOSCRIPT)$/.test(e.tagName) && rectOf(e).height > 0.5 && !(e.tagName === 'NAV' && / pages$/.test(e.getAttribute('aria-label') ?? '')));
  const out = [];
  for (const b of blocks) {
    const wraps = b.hasAttribute('data-nos-wrap') ? [b] : [...b.querySelectorAll('[data-nos-wrap]')];
    const wrapInfo = wraps.map((w) => {
      const cs = getComputedStyle(w);
      const r = rectOf(w);
      return {
        maxWidth: cs.maxWidth,
        padL: parseFloat(cs.paddingLeft),
        padR: parseFloat(cs.paddingRight),
        padT: parseFloat(cs.paddingTop),
        padB: parseFloat(cs.paddingBottom),
        width: r.width,
        left: r.left,
        marginL: cs.marginLeft,
        marginR: cs.marginRight,
      };
    });
    const content = wraps[0] ? (() => { const r = rectOf(wraps[0]); const cs = getComputedStyle(wraps[0]); return { left: r.left + parseFloat(cs.paddingLeft), width: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }; })() : null;
    const wide = [];
    const walker = [b, ...b.querySelectorAll('*')];
    for (const e of walker) {
      if (e.tagName === 'SECTION' || e.hasAttribute('data-nos-wrap') || e.closest('[data-nos-bleed], [aria-hidden="true"]')) continue;
      if (e.querySelector('[data-nos-wrap]')) continue; // an ancestor of a wrap
      if (e.closest('[data-nos-wrap]')) continue; // bounded by the wrap, whose own width is asserted below
      const r = rectOf(e);
      const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (r.width > WRAP + 2 && (hasText || e.matches('a, button, input, img, ul, ol, dl, table'))) wide.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} ${r.width.toFixed(0)}px`);
    }
    out.push({ tag: b.tagName.toLowerCase(), cls: String(b.className).slice(0, 50), hasWrap: wraps.length > 0, wraps: wrapInfo, content, wide: wide.slice(0, 3) });
  }
  return { vw, blocks: out };
}

await main('F3-C1 container', async (r) => {
  await withBrowser(async (browser) => {
    const routes = await allRoutes(browser);
    for (const route of routes) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const [w, h] of VPS) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(120);
        const m = await page.evaluate(measure, WRAP_DEFAULT);
        const tag = `${route} @${w}`;
        if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
        if (!m.blocks.length) { r.fail(`${tag}: no content blocks after the hero`); continue; }
        const gutter = gutterOf(m.vw);
        const wantMax = WRAP_DEFAULT + 2 * gutter;
        const wantWidth = Math.min(wantMax, m.vw);
        for (const b of m.blocks) {
          const id = `${tag} <${b.tag} class="${b.cls}">`;
          if (!b.hasWrap) { r.fail(`${id}: contains no [data-nos-wrap]; every NOS block sits in the one 1080px container`); continue; }
          for (const wp of b.wraps) {
            const max = parseFloat(wp.maxWidth);
            if (!(Math.abs(max - wantMax) <= 1)) r.fail(`${id}: wrap max-width ${wp.maxWidth}, want calc(1080px + 2 * gutter) = ${wantMax.toFixed(1)}px`);
            if (!(Math.abs(wp.padL - gutter) <= 0.6 && Math.abs(wp.padR - gutter) <= 0.6)) r.fail(`${id}: wrap padding-inline ${wp.padL.toFixed(1)}/${wp.padR.toFixed(1)}, want clamp(16px, 4vw, 48px) = ${gutter.toFixed(1)}px`);
            if (!(Math.abs(wp.width - wantWidth) <= 1)) r.fail(`${id}: wrap is ${wp.width.toFixed(1)}px wide, want ${wantWidth.toFixed(1)}px (1080 content + 2 gutters, centred)`);
            if (!(Math.abs(wp.left - (m.vw - wp.width) / 2) <= 1)) r.fail(`${id}: wrap left ${wp.left.toFixed(1)}px is not centred (${((m.vw - wp.width) / 2).toFixed(1)}px)`);
            if (wp.padT > 0.5 || wp.padB > 0.5) r.fail(`${id}: wrap has vertical padding ${wp.padT}/${wp.padB}; block padding belongs on the section (F3-C2)`);
          }
          if (b.content && !(Math.abs(b.content.width - Math.min(WRAP_DEFAULT, m.vw - 2 * gutter)) <= 1)) r.fail(`${id}: content box ${b.content.width.toFixed(1)}px, want ${Math.min(WRAP_DEFAULT, m.vw - 2 * gutter).toFixed(1)}px`);
          for (const x of b.wide) r.fail(`${id}: ${x} is wider than the 1080px content box and is not inside [data-nos-wrap] (the old max-w-[1280px] wrap)`);
        }
      }
      await ctx.close();
    }
  });
});
