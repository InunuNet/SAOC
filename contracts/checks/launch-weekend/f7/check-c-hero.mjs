#!/usr/bin/env node
// F7a-A3 - R42 home hero carousel (WCAG 2.2.2, 1.4.3, 4.1.2). Static source rules plus runtime behaviour on a prod build.
import { BASE, GOLDEN_DIR, read, readJson, withBrowser, open, report } from './_lib.mjs';

const cfg = readJson(`${GOLDEN_DIR}/hero-carousel.json`);
const problems = [];
const src = read('components/home/Hero.tsx');

// ---- static ----
if (!/aria-roledescription=["']carousel["']/.test(src)) problems.push('Hero.tsx: no aria-roledescription="carousel"');
if (!/aria-roledescription=["']slide["']/.test(src)) problems.push('Hero.tsx: no aria-roledescription="slide"');
if (!/prefers-reduced-motion/.test(src)) problems.push('Hero.tsx: rotation does not consult prefers-reduced-motion');
if (/text-ivory\/\d+[^"'`]*max-w-\[52ch\]|max-w-\[52ch\][^"'`]*text-ivory\/\d+/.test(src)) problems.push('Hero.tsx: lede still uses an opacity text colour');
if (/→/.test(src)) problems.push('Hero.tsx: a literal "→" glyph remains (use an inline SVG, aria-hidden)');
const scrim = /from-primary\/(\d+)[^"'`]*via-primary\/(\d+)[^"'`]*to-primary\/(\d+)/.exec(src);
if (!scrim) problems.push('Hero.tsx: scrim gradient (from-/via-/to-primary/N) not found');
else if (Math.min(Number(scrim[1]), Number(scrim[2]), Number(scrim[3])) < cfg.scrimMinPercent) problems.push(`Hero.tsx: scrim stop below ${cfg.scrimMinPercent}% (${scrim.slice(1, 4).join('/')})`);

// ---- runtime ----
const activeIndex = (page) => page.evaluate(() => {
  const slides = [...document.querySelectorAll('[aria-roledescription="slide"]')];
  const byAria = slides.findIndex((s) => s.getAttribute('aria-hidden') !== 'true');
  return byAria;
});
const pauseButton = (page) => page.locator('section button').filter({ hasText: /pause|play/i }).or(page.locator('section button[aria-label*="ause" i], section button[aria-label*="lay" i]')).first();

await withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  await open(page, '/');
  const slideCount = await page.locator('[aria-roledescription="slide"]').count();
  if (await page.locator('[aria-roledescription="carousel"]').count() !== 1) problems.push('runtime: expected exactly one [aria-roledescription="carousel"]');
  if (slideCount < 2) { problems.push(`runtime: ${slideCount} slide(s) with aria-roledescription="slide"`); return; }
  const slideInfo = await page.evaluate(() => [...document.querySelectorAll('[aria-roledescription="slide"]')].map((s) => ({ label: s.getAttribute('aria-label') || '', alt: s.querySelector('img')?.getAttribute('alt') || '' })));
  slideInfo.forEach((s, i) => {
    if (!new RegExp(`^${i + 1} of ${slideCount}`).test(s.label)) problems.push(`runtime: slide ${i + 1} label "${s.label}" does not start "${i + 1} of ${slideCount}"`);
    if (s.alt && !s.label.includes(s.alt)) problems.push(`runtime: slide ${i + 1} label "${s.label}" does not name its subject "${s.alt}"`);
  });
  const props = await page.evaluate(() => [...document.querySelectorAll('[aria-roledescription="slide"]')].map((s) => getComputedStyle(s).transitionProperty));
  if (props.some((t) => !/^(opacity|none)$/.test(t.trim()))) problems.push(`runtime: slide transition is not opacity-only (${[...new Set(props)].join(' | ')})`);
  const dotNames = await page.evaluate(() => [...document.querySelectorAll('section [role="tab"], section button[aria-label]')].map((b) => b.getAttribute('aria-label') || ''));
  if (dotNames.some((n) => /^Image \d+$/.test(n))) problems.push('runtime: slide dots are still named "Image N"');

  // pause control: visible, >=24px (target 44), default autoplay retained, pause holds, play resumes
  const btn = pauseButton(page);
  if (!(await btn.count())) { problems.push('runtime: no visible pause/play button in the hero'); return; }
  const box = await btn.boundingBox();
  if (!box || box.width < 24 || box.height < 24) problems.push(`runtime: pause control ${box ? `${box.width}x${box.height}` : 'not visible'} (min 24x24)`);
  const start = await activeIndex(page);
  await page.waitForTimeout(cfg.advanceWithinMs);
  if (await activeIndex(page) === start) problems.push(`runtime: carousel did not auto-advance within ${cfg.advanceWithinMs}ms by default`);
  const name0 = ((await btn.getAttribute('aria-label')) || (await btn.innerText())).trim();
  await btn.click();
  const name1 = ((await btn.getAttribute('aria-label')) || (await btn.innerText())).trim();
  if (name0 === name1 || !/play/i.test(name1)) problems.push(`runtime: control name did not switch to a Play name after click ("${name0}" -> "${name1}")`);
  const held = await activeIndex(page);
  await page.waitForTimeout(cfg.pauseHoldMs);
  if (await activeIndex(page) !== held) problems.push(`runtime: carousel kept rotating ${cfg.pauseHoldMs}ms after Pause`);
  await btn.click();
  await page.waitForTimeout(cfg.advanceWithinMs);
  if (await activeIndex(page) === held) problems.push('runtime: Play did not resume rotation');

  // lede: full-opacity text, and measured contrast over the photo+scrim on every slide
  const lede = page.locator('section p').filter({ hasText: 'Uniting twenty-one affiliated societies' }).first();
  const color = await lede.evaluate((el) => getComputedStyle(el).color);
  const alpha = /rgba\(.*,\s*([\d.]+)\)$/.exec(color);
  if (alpha && Number(alpha[1]) < 1) problems.push(`runtime: lede colour has alpha ${alpha[1]} (${color})`);
  if ((await lede.evaluate((el) => getComputedStyle(el).opacity)) !== '1') problems.push('runtime: lede element opacity is below 1');
  await btn.click(); // pause so slides can be selected deterministically
  const tabs = page.locator('section [role="tab"], section button[aria-label^="Show slide"], section button[aria-label*="slide" i]');
  const tabCount = await tabs.count();
  const clip = await lede.boundingBox();
  for (let i = 0; i < Math.min(slideCount, tabCount); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(cfg.fadeSettleMs);
    await lede.evaluate((el) => { el.style.visibility = 'hidden'; });
    const png = await page.screenshot({ clip });
    await lede.evaluate((el) => { el.style.visibility = ''; });
    const p95 = await page.evaluate(async (b64) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data; const L = [];
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      for (let k = 0; k < d.length; k += 4) L.push(0.2126 * lin(d[k]) + 0.7152 * lin(d[k + 1]) + 0.0722 * lin(d[k + 2]));
      L.sort((a, b) => a - b); return L[Math.floor(L.length * 0.95)];
    }, png.toString('base64'));
    const ratio = (cfg.ivoryLuminance + 0.05) / (p95 + 0.05);
    if (ratio < cfg.ledeMinContrast) problems.push(`runtime: slide ${i + 1} lede contrast over photo+scrim is ${ratio.toFixed(2)}:1 at the 95th-percentile pixel (min ${cfg.ledeMinContrast})`);
  }
});

// reduced motion: rotation never starts
await withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  await open(page, '/');
  const start = await activeIndex(page);
  await page.waitForTimeout(cfg.reducedMotionObserveMs);
  if (await activeIndex(page) !== start) problems.push(`runtime: carousel advanced under prefers-reduced-motion within ${cfg.reducedMotionObserveMs}ms`);
}, { width: 1440, height: 900 }, { reducedMotion: 'reduce' });

report(problems, `hero carousel: pause/play, reduced motion, slide semantics, lede contrast verified at ${BASE}`);
