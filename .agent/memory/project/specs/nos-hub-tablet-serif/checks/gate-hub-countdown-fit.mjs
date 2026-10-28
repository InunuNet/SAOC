// Countdown-wrap gate (NOS Design H-a countdown wrap, (a) + (b), 2026-10-27, root comms.md). Usage: node gate-hub-countdown-fit.mjs after build.sh and
// capture-main-baseline.sh. Fixture replay only. The branch build and the pinned main baseline (.tmp/sandbox/hub-main-baseline) are served side by side, in
// preview mode and in public mode. Checks, in order:
//   1. the face: whether Fraunces carries a working tnum is measured (digit advances with tnum off and on), the branch of ruling (a) is recorded in
//      evidence/tnum-branch.json, and every figure is tabular-nums on every page that has one; on the ch-min-width branch each figure's min-width is at least
//      3 (days) or 2 (others) widest-digit advances.
//   2. (b): .nos-hero-row column gap is 32 from 768 to 1023 and 48 elsewhere (640, 767, 1024, 1280, 390); the row gap is 48 everywhere.
//   3. worst case at 768, 820 and 1023: the strings "888"/"88" and the measured widest digit ("0"/"00") injected in one task, then the countdown is beside the CTA group
//      (never wrapped) with at least 8px of row slack, and the first-screen rule (facts and CTA bottoms <= viewport height - 16) still holds. Labelled shots go to
//      evidence/hub-countdown-worst-case-<mode>-<W>x<H>-<string>.png for NOS Design.
//   4. 60 consecutive ticks at 768x1024@2: the block and every figure keep their width within 0.5px, each figure's text centre equals its label's centre within 0.5px, and the row never wraps.
//   3b2. 700 and 767: below 768 the countdown always stacks under the CTA group (worst-case and live strings); the ruled final-form numbers (block 273.6 / 297.6, slack 14.8 at 768, facts at 768 not above 1005.5) are pinned in goldens CF.final.
//   3b. 1024, 1100, 1279 worst case: the countdown stays beside the CTA group (fit, slack >= 8, bottom within 1px); 3c. 320, 360, 390 on / and /tickets: no horizontal overflow.
//   5. parity with main at 390 (and 640, 767) and from 1024 up, on every page that renders .nos-figure (/, /tickets and a /tickets/<slug>): the only tolerated
//      difference is the width of the .nos-figure boxes and what it moves inside the countdown block (see parityVerdict).
import { writeFileSync } from 'node:fs';
import { EVIDENCE_DIR, ROOT, VALUES, fixtureProof, launchChromium, newContext, settleCountdown, startServer, waitReady, collector } from './_lib.mjs';
import { fitVerdict, gapVerdict, minWidthVerdict, overflowVerdict, parityVerdict, pinnedVerdict, stackedVerdict, tickVerdict, unitGapVerdict, widestDigit } from './countdown-fit-verdict.mjs';
import { firstScreenVerdict } from './hub-verdict.mjs';
import { measureDigits } from './measure-tnum.mjs';

const CF = VALUES.hub.countdownFit;
const FS = VALUES.hub.band.firstScreen;
const BASELINE_DIR = `${ROOT}/${VALUES.hub.header.baseline.dir}`;
const UNITS = ['days', 'hours', 'minutes', 'seconds'];

// Evaluated in the page, in ONE task so a tick can never interleave. arg = { inject: string[4] | null, parityStyles: string[], facts: {...} }.
const PROBE = (arg) => {
  const days = document.querySelector('[data-nos-hero-text="countdown-days-value"]');
  if (!days) return null;
  const wrapper = days.closest('[aria-label]');
  // The countdown block is the units wrapper itself: the branch wraps caption and units in an outer div (P1), main does not, so the parent is a different box on each build.
  const block = wrapper;
  if (!wrapper || !wrapper.parentElement) return null;
  const columns = [...wrapper.children];
  const figures = columns.map((c) => c.querySelector('[data-nos-hero-text$="-value"]'));
  const labels = columns.map((c) => c.querySelector('[data-nos-hero-text$="-unit"]'));
  // textContent replaces the text node React owns, so React's later tick writes to a detached node and the injected string stays on screen.
  if (arg.inject) figures.forEach((f, i) => { f.textContent = arg.inject[i]; });
  const r = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top + scrollY, right: b.right, bottom: b.bottom + scrollY, width: b.width, height: b.height }; };
  // A label element is a block as wide as its column, so the label's own size is the width of its text (a Range), not of the element.
  const textRect = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const b = rg.getBoundingClientRect(); return { left: b.left, top: b.top + scrollY, right: b.right, bottom: b.bottom + scrollY, width: b.width, height: b.height }; };
  const row = block.closest('.nos-hero-row');
  const cta = row ? row.querySelector('.nos-hero-cta-group') : null;
  const rcs = row ? getComputedStyle(row) : null;
  const num = (v) => parseFloat(v) || 0;
  const name = (e) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/)[0]}` : ''}`;
  let outsideEls;
  if (row) outsideEls = [row, ...(cta ? [cta, ...cta.querySelectorAll('*')] : [])];
  else { const scope = block.closest('section') ?? document.querySelector('main') ?? document.body; outsideEls = [...scope.querySelectorAll('*')].filter((e) => !block.contains(e) && !e.contains(block) && getComputedStyle(e).display !== 'none'); }
  const styleEls = [...(row ? [row] : []), ...(cta ? [cta, ...cta.querySelectorAll('*')] : []), wrapper, ...columns, ...figures, ...labels];
  // text-align is the one tolerated style difference, and only inside the .nos-figure boxes (NOS Design: centre each figure on the ch fallback).
  const styles = styleEls.map((e) => { const cs = getComputedStyle(e); const props = figures.includes(e) ? arg.parityStyles.filter((p) => p !== 'textAlign') : (e === wrapper ? arg.parityStyles.filter((p) => p !== 'columnGap' && p !== 'rowGap') : arg.parityStyles); return `${name(e)}|${props.map((p) => cs[p]).join('|')}`; });
  const ink = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const b = rg.getBoundingClientRect(); return b.left + b.width / 2; };
  const centreOffsets = figures.map((f, i) => ink(f) - (labels[i].getBoundingClientRect().left + labels[i].getBoundingClientRect().width / 2));
  const hero = document.querySelector('section[data-nos-hero="hub"]');
  const factsEl = hero ? hero.querySelector(arg.facts.selector) : null;
  const factRows = factsEl ? [...factsEl.children] : [];
  const bottomOf = (el) => (el ? el.getBoundingClientRect().bottom + scrollY : NaN);
  return {
    vw: document.documentElement.clientWidth, vh: innerHeight, scrollWidth: document.documentElement.scrollWidth, unitsSpan: columns[columns.length - 1].getBoundingClientRect().right - columns[0].getBoundingClientRect().left, unitGap: num(getComputedStyle(wrapper).columnGap), parentWidth: wrapper.parentElement.getBoundingClientRect().width, copyWidth: (block.closest('.nos-hero-copy') ?? wrapper.parentElement).getBoundingClientRect().width,
    row: row ? { contentWidth: row.getBoundingClientRect().width - num(rcs.paddingLeft) - num(rcs.paddingRight) - num(rcs.borderLeftWidth) - num(rcs.borderRightWidth), columnGap: num(rcs.columnGap), rowGap: num(rcs.rowGap) } : null,
    cta: cta ? r(cta) : null, cd: r(block), block: r(block), columns: columns.map(r), figures: figures.map(r), labels: labels.map(textRect),
    figureInfo: figures.map((f, i) => { const cs = getComputedStyle(f); return { unit: arg.units[i], minWidthPx: num(cs.minWidth), fvn: cs.fontVariantNumeric, textAlign: cs.textAlign, text: f.textContent }; }),
    centreOffsets, outside: outsideEls.map(r), outsideNames: outsideEls.map(name), styles, seconds: figures[3].textContent,
    factsBottom: factRows.length ? Math.max(...factRows.map(bottomOf)) : NaN, factsRows: factRows.length, factsLabels: factRows.map((x) => (x.querySelector('dt')?.textContent ?? '').trim()),
    ctaBottom: hero ? bottomOf(hero.querySelector(arg.facts.cta)) : NaN,
  };
};

const probeArg = (inject) => ({ inject, parityStyles: CF.parity.styleProps, units: UNITS, facts: { selector: FS.factsRow.selector, cta: FS.factsRow.primaryCtaSelector } });
async function probe(page, inject = null) { return page.evaluate(new Function('arg', `return (${PROBE})(arg);`), probeArg(inject)); }

async function openPage(server, browser, vp, route, c, tag) {
  const context = await newContext(browser, vp);
  const page = await context.newPage();
  const res = await page.goto(`${server.nos}${route}`, { waitUntil: 'load' });
  c.check(`${tag} responds 200`, res?.status() === 200, String(res?.status()));
  c.check(`${tag} the page hydrated and the countdown shows a value`, await settleCountdown(page, 20000));
  // Let any running transition or animation finish so a colour is never read mid-transition (the 1-channel colour tolerance in the compare is only a backstop).
  // Layout must be at rest before any box is read: web fonts loaded, every image decoded or errored (a late image or a fallback-font swap moves text by a fraction of a pixel), and finite animations done. Never longer than 4 s each.
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]));
  await page.evaluate(() => Promise.race([Promise.all([...document.images].map((im) => (im.complete ? undefined : new Promise((r) => { im.addEventListener('load', r); im.addEventListener('error', r); })))), new Promise((r) => setTimeout(r, 4000))]));
  // Finite animations only (an infinite one never finishes), and never longer than 4 s.
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((an) => an.effect && an.effect.getComputedTiming().iterations !== Infinity).map((an) => an.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 4000))]));
  await page.waitForTimeout(250);
  return { context, page };
}

async function labelledShot(page, path, text) {
  await page.evaluate(({ text: t, h }) => {
    const d = document.createElement('div');
    d.textContent = t;
    d.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${h}px;z-index:2147483647;background:#000;color:#fff;font:11px/${h}px monospace;padding:0 6px;white-space:nowrap;overflow:hidden`;
    document.body.appendChild(d);
  }, { text, h: FS.marginPx });
  await page.screenshot({ path });
}

// /tickets/<slug> does not render the countdown today (only a comment in its page mentions TicketsMasthead), so it has no parity leg. This keeps that true: every
// slug linked from /tickets that answers 200 must have no .nos-figure on the branch, and at least one must answer 200, so the check cannot go hollow either way.
async function slugPagesHaveNoCountdown(server, browser, c, tag) {
  const context = await newContext(browser, { width: 1280, height: 900, dsf: 1 });
  const page = await context.newPage();
  await page.goto(`${server.nos}/tickets`, { waitUntil: 'load' });
  const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => (a.getAttribute('href') ?? '').split('?')[0]));
  await context.close();
  const slugs = [...new Set(hrefs.filter((h) => /^\/tickets\/[a-z0-9-]+$/.test(h) && !['/tickets/cancelled', '/tickets/confirmation'].includes(h)))];
  let ok200 = 0;
  for (const route of slugs) {
    const ctx = await newContext(browser, { width: 1280, height: 900, dsf: 1 });
    const p = await ctx.newPage();
    const res = await p.goto(`${server.nos}${route}`, { waitUntil: 'load' });
    if (res?.status() === 200) {
      ok200 += 1;
      const has = await p.evaluate(() => Boolean(document.querySelector('.nos-figure, [data-nos-hero-text="countdown-days-value"]')));
      c.check(`${tag} ${route} now renders the countdown: add it to the parity pages`, !has);
    } else c.note(`note: ${tag} ${route} answered ${res?.status()} (a known-pending replay miss while its ticketType fixture is missing)`);
    await ctx.close();
  }
  c.check(`${tag} at least one /tickets/<slug> page answered 200 (${slugs.length} linked, ${ok200} answered 200)`, ok200 >= 1);
}

async function runMode(mode, preview, browser, digits, c) {
  const branchSrv = startServer(CF.portOffsets[mode], { preview });
  const baseSrv = startServer(CF.portOffsets[`baseline-${mode}`], { preview, root: BASELINE_DIR });
  try {
    await waitReady(branchSrv);
    await waitReady(baseSrv);
    const widest = digits.widestDigit;
    // 2. (b) gaps
    for (const vp of CF.gapViewports) {
      const tag = `[${mode} gap ${vp.name}]`;
      const { context, page } = await openPage(branchSrv, browser, vp, VALUES.hub.route, c, tag);
      const m = await probe(page);
      if (!m || !m.row) c.check(`${tag} the hero row and countdown are measurable`, false);
      else for (const f of gapVerdict(vp.width, m.row.columnGap, m.row.rowGap, m.unitGap)) c.check(`${tag} ${f}`, false);
      await context.close();
    }
    // 3. worst case
    for (const vp of CF.worstCase.viewports) {
      for (const s of CF.worstCase.strings) {
        const days = s.useWidestDigit ? widest.repeat(3) : s.days;
        const other = s.useWidestDigit ? widest.repeat(2) : s.other;
        const tag = `[${mode} worst case ${s.name} ${vp.name}]`;
        const { context, page } = await openPage(branchSrv, browser, vp, VALUES.hub.route, c, tag);
        const m = await probe(page, [days, other, other, other]);
        if (!m) { c.check(`${tag} measurable`, false); await context.close(); continue; }
        const fit = fitVerdict({ row: m.row, cta: m.cta, cd: m.cd, columnGap: m.row?.columnGap }, { minSlackPx: CF.worstCase.minSlackPx, topTolerancePx: CF.worstCase.topTolerancePx, bottomTolerancePx: CF.worstCase.bottomTolerancePx });
        for (const f of fit) c.check(`${tag} ${f}`, false);
        for (const f of pinnedVerdict({ ...m, columnGap: m.row?.columnGap }, vp.width, CF.final)) c.check(`${tag} ${f}`, false);
        for (const f of firstScreenVerdict({ vh: m.vh, factsBottom: m.factsBottom, factsRows: m.factsRows, factsLabels: m.factsLabels, ctaBottom: m.ctaBottom, countdownShown: true })) c.check(`${tag} first screen: ${f}`, false);
        if (!m.row || !m.cta) { c.check(`${tag} the hero row and CTA group are measurable`, false); await context.close(); continue; }
        const slack = m.row.contentWidth - m.cta.width - m.row.columnGap - m.cd.width;
        c.note(`note: ${tag} injected ${days}/${other}: countdown ${m.cd.width.toFixed(1)}px (top ${m.cd.top.toFixed(1)}, bottom ${m.cd.bottom.toFixed(1)}), CTA group ${m.cta.width.toFixed(1)}px (top ${m.cta.top.toFixed(1)}, bottom ${m.cta.bottom.toFixed(1)}), gap ${m.row.columnGap}, row ${m.row.contentWidth.toFixed(1)}px, slack ${slack.toFixed(1)}px, facts bottom ${Math.round(m.factsBottom)} of ${m.vh - FS.marginPx}`);
        await labelledShot(page, `${EVIDENCE_DIR}/hub-countdown-worst-case-${mode}-${vp.width}x${vp.height}-${s.name}.png`, `${mode} ${vp.width}x${vp.height}@${vp.dsf} worst case ${days}/${other}: slack ${slack.toFixed(1)}px, gap ${m.row.columnGap}`);
        await context.close();
      }
    }
    // 2b. the unit gap is component-level: 16 below 1024 and 24 from 1024 on /tickets too
    for (const vp of CF.gapViewports) {
      const tag = `[${mode} unit gap /tickets ${vp.name}]`;
      const { context, page } = await openPage(branchSrv, browser, vp, '/tickets', c, tag);
      const m = await probe(page);
      if (!m) c.check(`${tag} the countdown is measurable`, false);
      else for (const f of unitGapVerdict(vp.width, m.unitGap)) c.check(`${tag} ${f}`, false);
      await context.close();
    }
    // 3b. no wrap beside the CTAs from 1024 to 1279 with the worst-case strings (fit only: the first-screen rule is a 768-1023 rule)
    for (const vp of CF.worstCase.wrapViewports) {
      for (const s of CF.worstCase.strings) {
        const days = s.useWidestDigit ? widest.repeat(3) : s.days;
        const other = s.useWidestDigit ? widest.repeat(2) : s.other;
        const tag = `[${mode} wide worst case ${s.name} ${vp.name}]`;
        const { context, page } = await openPage(branchSrv, browser, vp, VALUES.hub.route, c, tag);
        const m = await probe(page, [days, other, other, other]);
        if (!m || !m.row || !m.cta) c.check(`${tag} the hero row and CTA group are measurable`, false);
        else {
          for (const f of fitVerdict({ row: m.row, cta: m.cta, cd: m.cd, columnGap: m.row.columnGap }, { minSlackPx: CF.worstCase.minSlackPx, topTolerancePx: CF.worstCase.topTolerancePx, bottomTolerancePx: CF.worstCase.bottomTolerancePx })) c.check(`${tag} ${f}`, false);
          for (const f of pinnedVerdict({ ...m, columnGap: m.row.columnGap }, vp.width, CF.final)) c.check(`${tag} ${f}`, false);
          c.note(`note: ${tag} slack ${(m.row.contentWidth - m.cta.width - m.row.columnGap - m.cd.width).toFixed(1)}px, countdown ${m.cd.width.toFixed(1)}px`);
        }
        await context.close();
      }
    }
    // 3b2. below 768 the countdown deterministically stacks under the CTA group (NOS Design option A), with worst-case and live strings
    for (const vp of CF.stack.viewports) {
      for (const s of [...CF.worstCase.strings, { name: 'live' }]) {
        const inject = s.name === 'live' ? null : [s.useWidestDigit ? widest.repeat(3) : s.days, ...Array(3).fill(s.useWidestDigit ? widest.repeat(2) : s.other)];
        const tag = `[${mode} stacked ${s.name} ${vp.name}]`;
        const { context, page } = await openPage(branchSrv, browser, vp, VALUES.hub.route, c, tag);
        const m = await probe(page, inject);
        for (const f of stackedVerdict(m)) c.check(`${tag} ${f}`, false);
        if (m && s.name !== 'live') for (const f of pinnedVerdict(m, vp.width, CF.final)) c.check(`${tag} ${f}`, false);
        if (m && m.cta) c.note(`note: ${tag} countdown top ${m.cd.top.toFixed(1)}, CTA bottom ${m.cta.bottom.toFixed(1)}, block ${m.cd.width.toFixed(1)}px`);
        await context.close();
      }
    }
    // 3c. no horizontal overflow on phones, on both pages that render the countdown
    for (const vp of CF.overflow.viewports) {
      for (const route of CF.overflow.routes) {
        for (const s of CF.worstCase.strings) {
          const days = s.useWidestDigit ? widest.repeat(3) : s.days;
          const other = s.useWidestDigit ? widest.repeat(2) : s.other;
          const tag = `[${mode} overflow ${route} ${s.name} ${vp.name}]`;
          const { context, page } = await openPage(branchSrv, browser, vp, route, c, tag);
          const m = await probe(page, [days, other, other, other]);
          for (const f of overflowVerdict(m)) c.check(`${tag} ${f}`, false);
          if (m) c.note(`note: ${tag} countdown block ${m.cd.width.toFixed(1)}px at x${m.cd.left.toFixed(1)}-${m.cd.right.toFixed(1)} of ${m.vw}, copy ${m.copyWidth.toFixed(1)}px, container ${m.parentWidth.toFixed(1)}px, unit gap ${m.unitGap}`);
          await context.close();
        }
      }
    }
    // 4. ticks, on the hub and on /tickets
    for (const tickRoute of CF.ticks.routes) {
      const vp = CF.ticks.viewport;
      const tag = `[${mode} ticks ${tickRoute} ${vp.name}]`;
      const { context, page } = await openPage(branchSrv, browser, vp, tickRoute, c, tag);
      const samples = await page.evaluate(({ src, arg, durationMs, stepMs }) => new Promise((resolve) => {
        const fn = new Function('a', `return (${src})(a);`);
        const out = [];
        const t0 = performance.now();
        const timer = setInterval(() => {
          const m = fn(arg);
          if (m) out.push({ width: m.unitsSpan, figures: m.figures.map((x) => x.width), seconds: m.seconds, centreOffsets: m.centreOffsets, wrapped: m.cta ? !(m.cd.top < m.cta.bottom - 1 && m.cd.left >= m.cta.right) : false });
          if (performance.now() - t0 >= durationMs) { clearInterval(timer); resolve(out); }
        }, stepMs);
      }), { src: PROBE.toString(), arg: probeArg(null), durationMs: CF.ticks.durationMs, stepMs: CF.ticks.stepMs });
      for (const f of tickVerdict(samples, { minTicks: CF.ticks.minTicks, tolerancePx: CF.ticks.widthTolerancePx, centreTolerancePx: CF.ticks.centreTolerancePx })) c.check(`${tag} ${f}`, false);
      c.note(`note: ${tag} ${samples.length} samples over ${CF.ticks.durationMs} ms, block width ${Math.min(...samples.map((s) => s.width)).toFixed(2)}-${Math.max(...samples.map((s) => s.width)).toFixed(2)}`);
      await context.close();
    }
    // 5. parity with main
    await slugPagesHaveNoCountdown(branchSrv, browser, c, `[${mode} slug pages]`);
    for (const pg of CF.parity.pages) {
      const route = pg.route;
      for (const vp of pg.viewports) {
        const tag = `[${mode} parity ${pg.name} ${route} ${vp.name}]`;
        const b = await openPage(branchSrv, browser, vp, route, c, `${tag} branch`);
        const inject = vp.injectWidest ? [widest.repeat(3), widest.repeat(2), widest.repeat(2), widest.repeat(2)] : CF.parity.inject;
        const mb = await probe(b.page, inject);
        await b.context.close();
        const o = await openPage(baseSrv, browser, vp, route, c, `${tag} main`);
        const mm = await probe(o.page, inject);
        await o.context.close();
        if (!mb || !mm) { c.check(`${tag} the countdown is measurable on both builds`, false); continue; }
        if (vp.width < 768 && mm.cta && mb.cta) for (const [name, m] of [['main', mm], ['branch', mb]]) for (const f of stackedVerdict(m)) c.check(`${tag} ${name}: ${f} (parity below 768 is only meaningful where both builds stack)`, false);
        for (const f of parityVerdict(mm, mb, CF.parity.tolerancePx)) c.check(`${tag} ${f}`, false);
        for (const f of minWidthVerdict(mb.figureInfo, digits.widestAdvancePx, digits.branch)) c.check(`${tag} ${f}`, false);
      }
    }
    fixtureProof(branchSrv, c);
    fixtureProof(baseSrv, c);
  } finally { branchSrv.proc.kill(); baseSrv.proc.kill(); }
}

const c = collector('hub countdown fit');
let browser;
try {
  browser = await launchChromium();
  const rec = await measureDigits(browser);
  writeFileSync(`${EVIDENCE_DIR}/tnum-branch.json`, `${JSON.stringify(rec, null, 2)}\n`);
  const [digit, advance] = widestDigit(rec.widthsOn);
  const digits = { branch: rec.branch, widestDigit: digit, widestAdvancePx: advance };
  c.note(`note: ruling (a) branch ${rec.branch}: digit advances with tnum on spread ${rec.onSpread.toFixed(2)}px (off ${rec.offSpread.toFixed(2)}px); widest digit "${digit}" ${advance.toFixed(2)}px`);
  await runMode('preview', true, browser, digits, c);
  await runMode('public', false, browser, digits, c);
} catch (e) { c.fail(e); console.error(e); } finally { if (browser) await browser.close(); }
c.finish(null);
