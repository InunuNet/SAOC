// Served-width gate (HM-1, HS-1). The file the browser actually serves (img.currentSrc, decoded through a bare new Image()) must be at
// least as wide in device pixels as max(box width, box height x file aspect) x DPR (cover formula, goldens requiredWidth): at 2056@2, 1440@2, 1280@2,
// 767@2 (the stacked band) and 390@3. NO native-cap exception (NOS Design ruling 3): a source narrower than its box fails. Covers every
// photographic hero route, both home carousel slides, the PhotoBand (/judging) and the home ShowBand.
import { GOLDEN, discoverPath, launchChromium, newContext, openHeroRoute, withServer } from './f2-lib.mjs';

const VIEWPORTS = GOLDEN.viewports.served;

async function measure(page, selector) {
  return page.evaluate(async (sel) => {
    const img = document.querySelector(sel);
    const rect = img.getBoundingClientRect();
    const probe = new Image();
    probe.src = img.currentSrc;
    await probe.decode();
    return { vw: window.innerWidth, box: rect.width, boxH: rect.height, dpr: window.devicePixelRatio, src: img.currentSrc, natural: probe.naturalWidth, naturalH: probe.naturalHeight };
  }, selector);
}

// NOS Design ruling (2026-10-25): required = max(boxW, boxH x fileW / fileH) x DPR, with the aspect of the served file (the derived cut
// for flips and cuts). A cover image is driven by height when the file is wider than the box.
function judge(c, tag, r) {
  judge.last = r;
  c.check(`${tag} image box ${Math.round(r.box)} css <= viewport ${r.vw} (a box wider than the viewport makes the sizes request too small)`, r.box <= r.vw + 0.5);
  const need = Math.ceil(Math.max(r.box, (r.boxH * r.natural) / r.naturalH) * r.dpr - 0.5);
  c.check(`${tag} served width ${r.natural} >= ${need} device px (box ${Math.round(r.box)}x${Math.round(r.boxH)} css, file ${r.natural}x${r.naturalH}, x${r.dpr})`, r.natural >= need, `${r.src}${r.natural < need ? ' - RULING NEEDED, not a pass and not a clamp: NOS Design extends the crop or widens the source' : ''}`);
}

// The visible object-fit: cover region of the original must not contain the cut stem stub (NOS Design G9).
async function probeStub(page, c, tag, band) {
  const v = await page.evaluate(({ sel, size }) => {
    const img = document.querySelector(sel);
    const r = img.getBoundingClientRect();
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((t) => parseFloat(t) / 100);
    const scale = Math.max(r.width / size[0], r.height / size[1]);
    const w = r.width / scale;
    const h = r.height / scale;
    return { x0: (size[0] - w) * px, x1: (size[0] - w) * px + w, y0: (size[1] - h) * py, y1: (size[1] - h) * py + h, boxW: r.width };
  }, { sel: band.selector, size: band.stubProbe.size });
  const [ox, oy] = band.stubProbe.offset;
  v.x0 += ox; v.x1 += ox; v.y0 += oy; v.y1 += oy;
  c.check(`${tag} css box ${Math.round(v.boxW)} <= ${band.cssBox.maxCssWidthCovered} (the 2400 cut covers 1200 css at @2)`, v.boxW <= band.cssBox.maxCssWidthCovered + 0.5);
  const s = band.stubProbe.stub;
  const hit = v.x0 < s.x1 && v.x1 > s.x0 && v.y0 < s.y1 && v.y1 > s.y0;
  c.check(`${tag} visible crop x${Math.round(v.x0)}-${Math.round(v.x1)} y${Math.round(v.y0)}-${Math.round(v.y1)} excludes the stem stub x${s.x0}-${s.x1} y${s.y0}-${s.y1}`, !hit);
}

// Whole-page sweep (NOS Design image-sweep.js, measured at a REAL device pixel ratio): every raster img wider than 80 and taller than 60 CSS px,
// footer emblem and NavCards included, must be served at or above the cover formula. Sim rows of the baseline are not expected values.
async function sweepPage(page, c, tag) {
  await page.evaluate(() => { document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }); });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  const rows = await page.evaluate(async () => {
    const out = [];
    const imgs = [...document.images].filter((i) => { const b = i.getBoundingClientRect(); return b.width > 80 && b.height > 60 && i.currentSrc && !/\.svg/.test(i.currentSrc); });
    for (const i of imgs) {
      const probe = new Image();
      probe.src = i.currentSrc;
      await probe.decode().catch(() => undefined);
      const b = i.getBoundingClientRect();
      const aspect = probe.naturalWidth / probe.naturalHeight;
      const cover = getComputedStyle(i).objectFit === 'cover';
      const cssNeed = cover ? Math.max(b.width, b.height * aspect) : b.width;
      out.push({ name: (i.alt || i.currentSrc.split('/').pop()).slice(0, 24), box: `${Math.round(b.width)}x${Math.round(b.height)}`, sizes: i.sizes, natural: probe.naturalWidth, need: Math.ceil(cssNeed * window.devicePixelRatio - 0.5), src: i.currentSrc.split('/').pop() });
    }
    return out;
  });
  for (const r of rows) c.check(`${tag} sweep "${r.name}" box ${r.box} served ${r.natural} >= ${r.need}`, r.natural >= r.need, `${r.src} sizes="${r.sizes}"`);
  c.check(`${tag} sweep found at least one raster image`, rows.length > 0 || tag.includes('typographic'));
}

// The tallest ShowBand photo box observed over the whole run, with its viewport (NOS Design: report it; the cut covers 875 css at @2).
const tallest = { H: 0, vp: '', required: 0 };
function tally(band, vp, r) {
  if (band.name !== 'ShowBand' || r.boxH <= tallest.H) return;
  tallest.H = r.boxH; tallest.vp = vp.name; tallest.required = Math.ceil(Math.max(r.box, (r.boxH * r.natural) / r.naturalH) * r.dpr);
}

async function loaded(page, sel) {
  return page.waitForFunction((s) => { const i = document.querySelector(s); return i && i.complete && i.naturalWidth > 0; }, sel, { timeout: 20000 }).then(() => true, () => false);
}

await withServer(1, 'served-width (saoc)', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of VIEWPORTS) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      for (const route of GOLDEN.heroRoutes) {
        const tag = `[saoc ${vp.name} ${route.path}]`;
        const path = await openHeroRoute(page, server, route, c, tag);
        if (!path) continue;
        const sel = 'section[data-page-hero] img';
        if (route.variant === 'type') { c.check(`${tag} typographic hero carries no photograph`, (await page.locator(sel).count()) === 0); continue; }
        const found = await loaded(page, sel);
        c.check(`${tag} hero image present and loaded`, found);
        if (found) judge(c, tag, await measure(page, sel));
      }
      for (const band of GOLDEN.bands) {
        for (const path of band.routes) {
          const tag = `[saoc ${vp.name} ${path} ${band.name}]`;
          const res = await page.goto(`${server.saoc}${path}`, { waitUntil: 'load' });
          if (res?.status() !== 200) { c.check(`${tag} page renders (fail fast, no 20 s image wait)`, false, `status ${res?.status()}`); continue; }
          await page.locator(band.selector).first().scrollIntoViewIfNeeded().catch(() => undefined);
          const found = await loaded(page, band.selector);
          c.check(`${tag} image present and loaded`, found);
          if (found) judge(c, tag, await measure(page, band.selector)); tally(band, vp, judge.last);
          if (found && band.stubProbe) await probeStub(page, c, tag, band);
          const want = band.perRoute?.[path]?.position;
          if (found && want) c.check(`${tag} object-position ${want} (ruled)`, (await page.locator(band.selector).first().evaluate((i) => getComputedStyle(i).objectPosition)) === want);
        }
      }
      // Home carousel: each slide in turn (pause, then its dot), because the hidden slide's image is not painted at its box.
      const homeRes = await page.goto(`${server.saoc}/`, { waitUntil: 'load' });
      for (let i = 0; i < GOLDEN.home.slides.length; i += 1) {
        const slide = GOLDEN.home.slides[i];
        const tag = `[saoc ${vp.name} / slide ${slide.key}]`;
        if (homeRes?.status() !== 200) { c.check(`${tag} home renders (fail fast, no 20 s image wait)`, false, `status ${homeRes?.status()}`); continue; }
        const pause = page.getByRole('button', { name: 'Pause' });
        if (await pause.count()) await pause.click();
        const dot = page.getByRole('button', { name: new RegExp(`^Show slide ${i + 1}`) });
        if (await dot.count()) await dot.click();
        await page.waitForTimeout(1700);
        const sel = `[data-hero-slide="${slide.key}"] img`;
        const found = await loaded(page, sel);
        c.check(`${tag} slide image present and loaded`, found);
        if (found) judge(c, tag, await measure(page, sel));
      }
      if (GOLDEN.sweep.viewports.includes(vp.name)) {
        for (const path of GOLDEN.sweep.routes) {
          const route = GOLDEN.heroRoutes.find((r) => r.path === path);
          let target = path;
          if (route?.discover) target = await discoverPath(page, server.saoc, route.discover.from, route.discover.hrefPrefix);
          if (!target) { c.check(`[saoc ${vp.name} ${path}] a link exists to sweep`, false); continue; }
          const res = await page.goto(`${server.saoc}${target}`, { waitUntil: 'load' });
          const tag = `[saoc ${vp.name} ${path}${route?.variant === 'type' ? ' typographic' : ''}]`;
          if (res?.status() !== 200 || new URL(page.url()).pathname !== target) { c.note(`NOT PROBED (stated reason): ${tag} ${target} -> ${res?.status()} ${page.url()}`); continue; }
          await sweepPage(page, c, tag);
        }
      }
      await context.close();
    }
    // The ShowBand is gated over its own wider viewport set, 1045-1099@2 included (NOS Design: no clamp exception).
    for (const vp of GOLDEN.viewports.showBand.filter((v) => !VIEWPORTS.some((s) => s.name === v.name))) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      for (const band of GOLDEN.bands.filter((b) => b.name === 'ShowBand')) {
        for (const path of band.routes) {
          const tag = `[saoc ${vp.name} ${path} ${band.name}]`;
          const res = await page.goto(`${server.saoc}${path}`, { waitUntil: 'load' });
          if (res?.status() !== 200) { c.check(`${tag} page renders (fail fast, no 20 s image wait)`, false, `status ${res?.status()}`); continue; }
          await page.locator(band.selector).first().scrollIntoViewIfNeeded().catch(() => undefined);
          const found = await loaded(page, band.selector);
          c.check(`${tag} image present and loaded`, found);
          if (found) { judge(c, tag, await measure(page, band.selector)); tally(band, vp, judge.last); await probeStub(page, c, tag, band); }
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
  const limit = GOLDEN.bands.find((b) => b.name === 'ShowBand').maxBoxHeightCss;
  c.note(`ShowBand tallest observed photo box: ${Math.round(tallest.H)} css at ${tallest.vp}, required ${tallest.required} device px (limit ${limit} css high at @2)`);
  c.check(`ShowBand tallest observed box ${Math.round(tallest.H)} css <= ${limit} css (RULING NEEDED if over, never a clamp)`, tallest.H <= limit);
});
