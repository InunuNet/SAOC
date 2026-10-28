// Hub geometry gate (H-a). Usage: node gate-hub-geometry.mjs. On the production build (build.sh first):
//   768-1023  photo first as a 2/1 band, then the copy; served width >= box x DPR; shots at 768 and 1023. The fixed hero cap is retired
//             (NOS Design H-a cap ruling (c), 2026-10-27): the first-screen rule replaces it. The last hero facts row, and the primary CTA if it
//             sits below the facts, must end by viewport height - 16 (header included) at 768x1024, 820x1180 and 1023x1366, all @2, in preview
//             and public mode, with a labelled shot per viewport and mode. A viewport at 768 that fails also writes an element-by-element hero
//             height breakdown for NOS Design (evidence/hub-breakdown-<mode>-768.json and printed). Nothing is cut by the gate.
//   <768      unchanged: photo first, 300px, full width
//   >=1024    unchanged: full-bleed hero (22% inset, masked, scrim, min-height clamp, h1 clamp)
import { writeFileSync } from 'node:fs';
import { EVIDENCE_DIR, VALUES, fixtureProof, launchChromium, newContext, settleCountdown, startServer, waitReady, withServer } from './_lib.mjs';
import { bandVerdict, desktopVerdict, firstScreenVerdict, phoneVerdict } from './hub-verdict.mjs';

const HERO = 'section[data-nos-hero="hub"]';
const FS = VALUES.hub.band.firstScreen;
const PUBLIC_OFFSET = 7;

async function measure(page) {
  const factsSel = FS.factsRow.selector;
  const ctaSel = FS.factsRow.primaryCtaSelector;
  await page.waitForFunction((sel) => { const i = document.querySelector(`${sel} [data-nos-hero-media] img`); return i && i.complete && i.naturalWidth > 0; }, HERO, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(async ({ sel, factsSel, ctaSel }) => {
    const hero = document.querySelector(sel);
    const mediaEl = hero.querySelector('[data-nos-hero-media]');
    const img = mediaEl.querySelector('img');
    const copyEl = hero.querySelector('.nos-hero-copy');
    const h1El = hero.querySelector('h1');
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, width: b.width, height: b.height }; };
    const bottomOf = (el) => (el ? el.getBoundingClientRect().bottom + scrollY : NaN);
    const factsEl = hero.querySelector(factsSel);
    const factRows = factsEl ? [...factsEl.children] : [];
    const probe = new Image();
    probe.src = img.currentSrc;
    await probe.decode();
    const mcs = getComputedStyle(mediaEl);
    const scrimEl = hero.querySelector('.nos-hero-scrim');
    return {
      factsBottom: factRows.length ? Math.max(...factRows.map(bottomOf)) : NaN, factsRows: factRows.length, factsLabels: factRows.map((row) => (row.querySelector('dt')?.textContent ?? '').trim()),
      ctaBottom: bottomOf(hero.querySelector(ctaSel)),
      hero: r(hero), media: r(mediaEl), copy: r(copyEl), h1: r(h1El),
      vw: document.documentElement.clientWidth, vh: innerHeight, dpr: devicePixelRatio,
      boxW: img.getBoundingClientRect().width, natural: probe.naturalWidth, h1Size: parseFloat(getComputedStyle(h1El).fontSize),
      css: {
        position: mcs.position, aspectRatio: mcs.aspectRatio, order: mcs.order,
        mask: mcs.webkitMaskImage && mcs.webkitMaskImage !== 'none' ? mcs.webkitMaskImage : (mcs.maskImage || 'none'),
        scrim: scrimEl ? getComputedStyle(scrimEl).display : 'none',
      },
    };
  }, { sel: HERO, factsSel, ctaSel });
}

// Every block that stacks inside the hero, in document order, with its box and the vertical spacing around it, so the height reads element by element.
async function breakdown(page) {
  return page.evaluate((sel) => {
    const hero = document.querySelector(sel);
    const top0 = hero.getBoundingClientRect().top + scrollY;
    const round = (n) => Math.round(n * 10) / 10;
    const leaf = new Set(['P', 'H1', 'H2', 'DT', 'DD', 'A', 'SPAN']);
    const rows = [];
    const walk = (el, depth) => {
      for (const child of el.children) {
        const cs = getComputedStyle(child);
        if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
        const b = child.getBoundingClientRect();
        const cls = typeof child.className === 'string' && child.className.trim() ? `.${child.className.trim().split(/\s+/).join('.')}` : '';
        rows.push({ depth, el: `${child.tagName.toLowerCase()}${cls}`.slice(0, 80), y: round(b.top + scrollY - top0), h: round(b.height), marginTop: cs.marginTop, marginBottom: cs.marginBottom, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, rowGap: cs.rowGap, display: cs.display });
        if (depth < 3 && child.children.length && !leaf.has(child.tagName)) walk(child, depth + 1);
      }
    };
    const hcs = getComputedStyle(hero);
    walk(hero, 0);
    return { heroTopFromDocument: round(top0), heroHeight: round(hero.getBoundingClientRect().height), heroPaddingTop: hcs.paddingTop, heroPaddingBottom: hcs.paddingBottom, heroRowGap: hcs.rowGap, rows };
  }, HERO);
}

// The labelled first-screen shot: a fixed strip inside the reserved bottom margin names the mode, viewport and measured bottom. Drawn after measuring.
async function labelledShot(page, path, text) {
  await page.evaluate(({ text, h }) => {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${h}px;z-index:2147483647;background:#000;color:#fff;font:11px/${h}px monospace;padding:0 6px;white-space:nowrap;overflow:hidden`;
    document.body.appendChild(d);
  }, { text, h: FS.marginPx });
  await page.screenshot({ path });
}

async function firstScreen(server, mode, browser, c) {
  for (const vp of FS.viewports) {
    const context = await newContext(browser, vp);
    const page = await context.newPage();
    const res = await page.goto(`${server.nos}${VALUES.hub.route}`, { waitUntil: 'load' });
    c.check(`[first screen ${mode} ${vp.name}] hub responds 200`, res?.status() === 200, String(res?.status()));
    // P1: the shot and the measurement are taken after hydration, once the countdown shows a value (never the label alone).
    const settled = await settleCountdown(page, FS.settleTimeoutMs ?? 20000);
    c.check(`[first screen ${mode} ${vp.name}] the page hydrated and the countdown shows a value before the shot`, settled);
    const m = { ...(await measure(page)), countdownShown: settled };
    const fails = firstScreenVerdict(m);
    for (const f of fails) c.check(`[first screen ${mode} ${vp.name}] ${f}`, false);
    c.note(`note: [first screen ${mode} ${vp.name}] facts ${m.factsRows} rows (${m.factsLabels.join(', ')}) bottom ${Math.round(m.factsBottom)}, CTA bottom ${Math.round(m.ctaBottom)}, limit ${m.vh - FS.marginPx}, hero ${Math.round(m.hero.height)}px from y${Math.round(m.hero.top)}`);
    if (fails.length && vp.width === FS.breakdownViewportWidth) {
      const b = await breakdown(page);
      const out = { mode, viewport: vp.name, specHeroHeight: FS.specHeroHeightAt768, measuredHeroHeight: b.heroHeight, delta: Math.round((b.heroHeight - FS.specHeroHeightAt768) * 10) / 10, factsBottom: m.factsBottom, ctaBottom: m.ctaBottom, limit: m.vh - FS.marginPx, ...b };
      writeFileSync(`${EVIDENCE_DIR}/hub-breakdown-${mode}-${vp.width}.json`, `${JSON.stringify(out, null, 2)}\n`);
      c.note(`BREAKDOWN [${mode} ${vp.name}] hero ${out.measuredHeroHeight}px vs the spec's ${out.specHeroHeight} (delta ${out.delta}), hero top y${b.heroTopFromDocument}, padding ${b.heroPaddingTop}/${b.heroPaddingBottom}, row gap ${b.heroRowGap}`);
      for (const row of b.rows) c.note(`  ${'  '.repeat(row.depth)}${row.el} y${row.y} h${row.h} mt${row.marginTop} mb${row.marginBottom} pt${row.paddingTop} pb${row.paddingBottom} gap${row.rowGap} ${row.display}`);
    }
    await labelledShot(page, `${EVIDENCE_DIR}/hub-first-screen-${mode}-${vp.width}x${vp.height}.png`, `${mode} mode ${vp.width}x${vp.height}@${vp.dsf}: facts bottom ${Number.isFinite(m.factsBottom) ? Math.round(m.factsBottom) : 'NO FACTS ROW'} / limit ${m.vh - FS.marginPx} ${fails.length ? 'FAIL' : 'pass'}`);
    await context.close();
  }
}

await withServer(1, 'hub geometry', async (server, c) => {
  const browser = await launchChromium();
  try {
    const groups = [['band', VALUES.hub.band.viewports, bandVerdict], ['phone', VALUES.hub.phone.viewports, phoneVerdict], ['desktop', VALUES.hub.desktop.viewports, desktopVerdict]];
    for (const [kind, viewports, verdict] of groups) {
      for (const vp of viewports) {
        const context = await newContext(browser, vp);
        const page = await context.newPage();
        const res = await page.goto(`${server.nos}${VALUES.hub.route}`, { waitUntil: 'load' });
        c.check(`[${kind} ${vp.name}] hub responds 200`, res?.status() === 200, String(res?.status()));
        const m = await measure(page);
        for (const f of verdict(m, vp)) c.check(`[${kind} ${vp.name}] ${f}`, false);
        c.note(`note: [${kind} ${vp.name}] hero ${Math.round(m.hero.height)}px, photo ${Math.round(m.media.width)}x${Math.round(m.media.height)} at y${Math.round(m.media.top - m.hero.top)}, copy top y${Math.round(m.copy.top - m.hero.top)}, served ${m.natural}px for a ${Math.round(m.boxW)}px box at ${m.dpr}x`);
        if (kind === 'band' && (vp.width === 768 || vp.width === 1023)) {
          await page.locator(HERO).screenshot({ path: `${EVIDENCE_DIR}/hub-${vp.width}.png` });
        }
        await context.close();
      }
    }
    await firstScreen(server, FS.modes[0].name, browser, c);
    // Public mode: a second server with the placeholder preview off (SHOW_PLACEHOLDER_PREVIEW unset; the launch flag is never set).
    const pub = startServer(PUBLIC_OFFSET, { preview: FS.modes[1].placeholderPreview });
    try { await waitReady(pub); await firstScreen(pub, FS.modes[1].name, browser, c); fixtureProof(pub, c); } finally { pub.proc.kill(); }
  } finally { await browser.close(); }
});
