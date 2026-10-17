// nos-critique-r6 f10 -- rendered check for the group sub-nav (NosSubNav, R27) at <768 (production build, next start 3010-3019).
// At 390, on /national-show/programme, /symposium and /conferences (the current item first, middle and last of the 5-item Programme group):
//   VIEW    the aria-current item is fully inside the row with a 16px lead (>=15.5px from both row edges); the page did not scroll
//   LEAD    at scrollLeft 0 the first item is not clipped; the lead is the row's own gutter var(--nos-axis-pad): padding-inline and scroll-padding-inline equal it, and a mid-scroll current item sits exactly one gutter in, at 390 (16px) and at the widest scrolling width (gutter > 16px)
//   FADE    data-fade-start / data-fade-end equal the geometry (start: scrollLeft > 1; end: more to the right), after load, after a scroll
//           and after a resize; the row's mask-image is none unless an edge is flagged, and then carries 40px stops reaching alpha 0 at the edge
//   ITEMS   every link >= 44px tall, no scrollbar (scrollbar-width none, no horizontal bar), no page-level horizontal overflow
//   MOTION  with prefers-reduced-motion the current item is in view straight after load and the row's scroll-behavior is auto
// At 720 the breakpoint decision in goldens/f10-breakpoint.json holds on four groups (767: the row scrolls; 700: it still wraps).
// At 1280 the sub-nav is pixel-identical to the pre-f10 stack (goldens/f10-pre-*.png from f10-capture-pre.mjs) and wraps with no fade.
// Run as: node f10-rendered.mjs   (NOS_CR6_ROOT selects the worktree; NOS_CR6_ORIGIN drives a running origin for a dry run)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { finish, scopeFiles, specDir } from './_lib.mjs';
import { AUTH, require } from './_server.mjs';
import { openOrigin } from './f6-f8-lib.mjs';
import { F10_SHOTS, subnavClip } from './f10-shots.mjs';

const NAME = 'f10-rendered.mjs';
const failures = [];
const ROUTES = [['start', '/national-show/programme'], ['middle', '/national-show/symposium'], ['end', '/national-show/conferences']];
const { chromium } = require('playwright');
const handle = await openOrigin(scopeFiles());
if (handle.stale) finish(NAME, handle.stale);

const read = () => {
  const nav = document.querySelector('nav.nos-subnav');
  const row = nav?.querySelector('ul');
  if (!row) return null;
  const links = [...row.querySelectorAll('a')];
  const cur = row.querySelector('[aria-current]');
  const rr = row.getBoundingClientRect();
  const cs = getComputedStyle(row);
  const items = links.map((a) => a.getBoundingClientRect());
  const first = row.querySelector('li')?.getBoundingClientRect();
  const c = cur?.getBoundingClientRect();
  return {
    n: links.length, index: links.indexOf(cur), scrollLeft: row.scrollLeft, sw: row.scrollWidth, cw: row.clientWidth,
    startFlag: nav.hasAttribute('data-fade-start') || row.hasAttribute('data-fade-start'),
    endFlag: nav.hasAttribute('data-fade-end') || row.hasAttribute('data-fade-end'),
    mask: cs.maskImage || cs.webkitMaskImage || 'none',
    overflowX: cs.overflowX, flexWrap: cs.flexWrap, padStart: cs.paddingInlineStart, scrollPadStart: cs.scrollPaddingInlineStart, scrollPadEnd: cs.scrollPaddingInlineEnd, behavior: cs.scrollBehavior, scrollbar: cs.scrollbarWidth,
    bar: row.offsetHeight - row.clientHeight,
    heights: items.map((r) => r.height),
    firstLeft: first ? first.left - rr.left : null,
    curLeft: c ? c.left - rr.left : null, curRight: c ? rr.right - c.right : null,
    pageSw: document.documentElement.scrollWidth, pageCw: document.documentElement.clientWidth, scrollY: scrollY,
  };
};
const edges = (m) => ({ start: m.scrollLeft > 1, end: m.scrollLeft + m.cw < m.sw - 1 });
const sleep = (page, ms = 250) => page.waitForTimeout(ms);

function checkFade(tag, m) {
  const e = edges(m);
  if (m.startFlag !== e.start) failures.push(`${tag}: data-fade-start is ${m.startFlag}, geometry says ${e.start} (scrollLeft ${Math.round(m.scrollLeft)})`);
  if (m.endFlag !== e.end) failures.push(`${tag}: data-fade-end is ${m.endFlag}, geometry says ${e.end}`);
  const any = e.start || e.end;
  if (!any && m.mask !== 'none') failures.push(`${tag}: mask-image is ${m.mask.slice(0, 50)} with nothing hidden; want none`);
  if (any) {
    const mk = m.mask;
    const alpha0 = /rgba\(0, 0, 0, 0\) 0(?:px)?/.test(mk);
    if (mk === 'none' || !/linear-gradient/.test(mk)) failures.push(`${tag}: an edge hides items but mask-image is "${mk.slice(0, 80)}"; want a 40px linear-gradient fade`);
    else {
      if (/24px/.test(mk)) failures.push(`${tag}: mask still has a 24px stop: ${mk.slice(0, 120)}`);
      if (!/40px/.test(mk)) failures.push(`${tag}: mask has no 40px stop: ${mk.slice(0, 120)}`);
      if (!alpha0) failures.push(`${tag}: the mask ink does not reach alpha 0 at the edge (want rgba(0, 0, 0, 0) at 0): ${mk.slice(0, 120)}`);
      if (e.end && !/to left|270deg/.test(mk)) failures.push(`${tag}: more to the right but the right-edge mask (to left) is missing: ${mk.slice(0, 120)}`);
      if (e.start && !/to right|90deg/.test(mk)) failures.push(`${tag}: scrolled past the start but the left-edge mirrored mask (to right) is missing: ${mk.slice(0, 120)}`);
    }
  }
}

let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  for (const [where, route] of ROUTES) {
    const tag = `${route} @390 (${where})`;
    const res = await page.goto(`${handle.origin}${route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
    await sleep(page);
    const m = await page.evaluate(read);
    if (!m) { failures.push(`${tag}: no nav.nos-subnav row`); continue; }
    if (m.sw <= m.cw + 1) failures.push(`${tag}: the row does not overflow at 390 (scrollWidth ${m.sw}, clientWidth ${m.cw}); the test premise needs the 5-item group to scroll`);
    if (m.index < 0) { failures.push(`${tag}: no aria-current item`); continue; }
    const wantIdx = where === 'start' ? 0 : where === 'end' ? m.n - 1 : Math.floor(m.n / 2);
    if (m.index !== wantIdx) failures.push(`${tag}: current item is #${m.index} of ${m.n}, want #${wantIdx}`);
    if (m.curLeft < 15.5 || m.curRight < 15.5) failures.push(`${tag}: current item is ${m.curLeft.toFixed(1)}px from the row's left edge and ${m.curRight.toFixed(1)}px from the right; want a gutter lead (>=16px) and fully in view`);
    if (m.scrollY !== 0) failures.push(`${tag}: the page scrolled vertically on load (${m.scrollY}px)`);
    // the gutter is var(--nos-axis-pad) (16px at 390, larger on wider phones/tablets); the GUTTER block below checks padding, scroll-padding and the lead against it
    if (m.heights.some((h) => h < 44)) failures.push(`${tag}: a sub-nav link is ${Math.min(...m.heights)}px tall, want >=44`);
    if (m.scrollbar !== 'none' || m.bar > 0) failures.push(`${tag}: a scrollbar shows (scrollbar-width ${m.scrollbar}, bar ${m.bar}px)`);
    if (m.pageSw > m.pageCw) failures.push(`${tag}: page-level horizontal overflow ${m.pageSw} > ${m.pageCw}`);
    checkFade(`${tag} on load`, m);
    if (where === 'start') {
      if (m.scrollLeft !== 0) failures.push(`${tag}: scrollLeft ${m.scrollLeft} on the first item, want 0`);
      if (m.firstLeft < 15.5) failures.push(`${tag}: the first item is clipped, ${m.firstLeft.toFixed(1)}px in at scrollLeft 0; want >=16`);
    }
    // the fade follows scrolling and resizing
    for (const [label, target] of [['middle', 0.5], ['end', 1], ['start again', 0]]) {
      await page.evaluate((t) => { const r = document.querySelector('nav.nos-subnav ul'); r.scrollLeft = (r.scrollWidth - r.clientWidth) * t; }, target);
      await sleep(page);
      checkFade(`${tag} scrolled to ${label}`, await page.evaluate(read));
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await sleep(page);
    const wide = await page.evaluate(read);
    if (wide.startFlag || wide.endFlag || wide.mask !== 'none') failures.push(`${tag}: after resizing to 1280 the fade is still on (start ${wide.startFlag}, end ${wide.endFlag}, mask ${wide.mask.slice(0, 40)})`);
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(page, 400);
    const back = await page.evaluate(read);
    checkFade(`${tag} resized back to 390`, back);
  }
  await ctx.close();

  // MOTION
  const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: { authorization: AUTH } });
  const rp = await rm.newPage();
  await rp.goto(`${handle.origin}/national-show/conferences`, { waitUntil: 'networkidle' });
  const r = await rp.evaluate(read);
  if (!r) failures.push('reduced-motion: no sub-nav row');
  else {
    if (r.curRight < 15.5 || r.curLeft < 15.5) failures.push('reduced-motion: the current item is not in view straight after load');
    if (r.behavior === 'smooth') failures.push('reduced-motion: the row computes scroll-behavior smooth');
  }
  await rm.close();

  // GUTTER (Codex P3): the lead is the row's own gutter, var(--nos-axis-pad), not a fixed 16px. Checked at 390 (16px) and at the widest scrolling width
  // (the recorded breakpoint), where clamp(16px, 2.5vw, 32px) is larger than 16px.
  {
    const decisionFile = path.join(specDir, 'goldens', 'f10-breakpoint.json');
    const wideW = existsSync(decisionFile) ? JSON.parse(readFileSync(decisionFile, 'utf8')).maxWidthPx : 767;
    const gutterOf = () => {
      const row = document.querySelector('nav.nos-subnav ul');
      if (!row) return null;
      const probe = document.createElement('div'); probe.style.width = 'var(--nos-axis-pad)'; probe.style.height = '0'; row.parentElement.appendChild(probe);
      const gutter = probe.getBoundingClientRect().width; probe.remove();
      const cs = getComputedStyle(row);
      const rr = row.getBoundingClientRect();
      const cur = row.querySelector('[aria-current]')?.getBoundingClientRect();
      const first = row.querySelector('li')?.getBoundingClientRect();
      return { gutter, pad: parseFloat(cs.paddingLeft), padR: parseFloat(cs.paddingRight), sp: parseFloat(cs.scrollPaddingInlineStart), spEnd: parseFloat(cs.scrollPaddingInlineEnd), scrollLeft: row.scrollLeft, max: row.scrollWidth - row.clientWidth, overflows: row.scrollWidth > row.clientWidth + 1, curLeft: cur ? cur.left - rr.left : null, curRight: cur ? rr.right - cur.right : null, firstLeft: first ? first.left - rr.left : null };
    };
    for (const w of [390, wideW]) {
      const gctx = await browser.newContext({ viewport: { width: w, height: 844 }, extraHTTPHeaders: { authorization: AUTH } });
      const gp = await gctx.newPage();
      for (const [where, route] of ROUTES) {
        const tag = `${route} @${w} gutter (${where})`;
        const res = await gp.goto(`${handle.origin}${route}`, { waitUntil: 'networkidle' });
        if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
        await sleep(gp);
        const g = await gp.evaluate(gutterOf);
        if (!g) { failures.push(`${tag}: no nav.nos-subnav row`); continue; }
        if (w === 390 && Math.abs(g.gutter - 16) > 0.5) failures.push(`${tag}: --nos-axis-pad is ${g.gutter.toFixed(2)}px at 390, expected 16px`);
        if (w !== 390 && g.gutter <= 16.5) failures.push(`${tag}: --nos-axis-pad is ${g.gutter.toFixed(2)}px at ${w}; the premise needs a gutter above 16px here`);
        if (Math.abs(g.pad - g.gutter) > 0.5 || Math.abs(g.padR - g.gutter) > 0.5) failures.push(`${tag}: row padding ${g.pad}/${g.padR}, want the gutter ${g.gutter.toFixed(2)}px on both sides`);
        if (Math.abs(g.sp - g.gutter) > 0.5 || Math.abs(g.spEnd - g.gutter) > 0.5) failures.push(`${tag}: scroll-padding-inline ${g.sp}/${g.spEnd}, want the gutter ${g.gutter.toFixed(2)}px`);
        if (!g.overflows) { if (w === 390) failures.push(`${tag}: the row does not overflow at 390`); continue; }
        if (where === 'start') { if (g.scrollLeft !== 0 || Math.abs(g.firstLeft - g.gutter) > 1) failures.push(`${tag}: first item ${g.firstLeft?.toFixed(1)}px in at scrollLeft ${g.scrollLeft}, want the gutter ${g.gutter.toFixed(1)}px`); }
        else if (where === 'middle') { if (g.scrollLeft <= 0 || g.scrollLeft >= g.max - 1) failures.push(`${tag}: the middle route should be mid-scroll (scrollLeft ${g.scrollLeft} of ${g.max})`); else if (Math.abs(g.curLeft - g.gutter) > 1) failures.push(`${tag}: current item is ${g.curLeft.toFixed(1)}px from the row edge, want the gutter ${g.gutter.toFixed(1)}px (not a fixed 16)`); }
        else if (g.curRight < g.gutter - 1) failures.push(`${tag}: current item ends ${g.curRight.toFixed(1)}px from the right edge, want >= the gutter ${g.gutter.toFixed(1)}px`);
      }
      await gctx.close();
    }
  }

  // BREAKPOINT at 720 (Codi): whichever case goldens/f10-breakpoint.json recorded must hold on every sub-nav group
  {
    const decisionFile = path.join(specDir, 'goldens', 'f10-breakpoint.json');
    if (!existsSync(decisionFile)) failures.push('f10-breakpoint.json is missing; run f10-capture-pre.mjs on the tree BEFORE editing for f10');
    else {
      const want = JSON.parse(readFileSync(decisionFile, 'utf8')).maxWidthPx;
      const bctx = await browser.newContext({ viewport: { width: 720, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
      const bp = await bctx.newPage();
      for (const r of ['about', 'programme', 'sa-exhibitors', 'sponsors']) {
        const route = `/national-show/${r}`;
        const res = await bp.goto(`${handle.origin}${route}`, { waitUntil: 'networkidle' });
        if (!res || res.status() !== 200) { failures.push(`${route} @720: HTTP ${res && res.status()}`); continue; }
        await sleep(bp);
        const m = await bp.evaluate(read);
        if (!m) { failures.push(`${route} @720: no sub-nav row`); continue; }
        if (m.pageSw > m.pageCw) failures.push(`${route} @720: page-level horizontal overflow`);
        if (want === 767) {
          if (m.overflowX !== 'auto' || m.flexWrap !== 'nowrap') failures.push(`${route} @720: the measured breakpoint is 767, so the row must scroll here (overflow-x ${m.overflowX}, flex-wrap ${m.flexWrap})`);
          if (m.scrollY !== 0) failures.push(`${route} @720: the page scrolled vertically on load`);
          if (m.sw > m.cw + 1) checkFade(`${route} @720`, m);
        } else {
          if (m.overflowX === 'auto' || m.flexWrap !== 'wrap') failures.push(`${route} @720: the measured breakpoint is 700 (R27), so the row must still wrap here, not scroll (overflow-x ${m.overflowX}, flex-wrap ${m.flexWrap})`);
          if (m.startFlag || m.endFlag || m.mask !== 'none') failures.push(`${route} @720: a fade is active on a wrapping row`);
        }
      }
      await bctx.close();
    }
  }

  // PIXEL: 1280 identical to the pre-f10 stack
  const wideCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
  const wp = await wideCtx.newPage();
  for (const shot of F10_SHOTS) {
    const file = path.join(specDir, 'goldens', shot.file);
    if (!existsSync(file)) { failures.push(`${shot.file} is missing; run f10-capture-pre.mjs on the tree BEFORE editing for f10`); continue; }
    const res = await wp.goto(`${handle.origin}${shot.route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${shot.route} @1280: HTTP ${res && res.status()}`); continue; }
    const clip = await subnavClip(wp);
    const now = await wp.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    if (!now.equals(readFileSync(file))) failures.push(`${shot.route} @1280: the sub-nav region is not pixel-identical to the pre-f10 capture (>=768 must not change)`);
    const w = await wp.evaluate(read);
    if (w.startFlag || w.endFlag || w.mask !== 'none') failures.push(`${shot.route} @1280: a fade is active on the wrapping row`);
  }
  await wideCtx.close();
} catch (e) {
  failures.push(`render error: ${e.message}`);
} finally {
  if (browser) await browser.close();
  handle.stop();
}
finish(NAME, failures, 'Sub-nav at 390: current item fully in view with a gutter lead (16px at 390, var(--nos-axis-pad) wider) on first/middle/last routes, first item unclipped, fade flags and 40px mask follow scroll and resize, 44px links, no scrollbar or page overflow, reduced motion honoured; 1280 pixel-identical to the pre-f10 capture.');
