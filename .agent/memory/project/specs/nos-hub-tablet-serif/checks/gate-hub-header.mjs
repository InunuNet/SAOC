// Header gate (NOS Design H-a 768 cut (a), 2026-10-27). Usage: node gate-hub-header.mjs after build.sh and capture-main-baseline.sh. Fixture replay only.
//   768, 779, 780 and 1023: the header is ONE row (the 820 header): hero top = the 820 value +-1 and = the 820 golden, lockup box = the 820 lockup box +-1.
//   768, 820 and 1023: the 2/1 band, crop and spacing are unchanged (computed style equals the approved values).
//   767 and 390: the header strips are pixel-identical (0 differing pixels) to the main baseline, and still the two-row grid.
// Both modes (preview, and public with SHOW_PLACEHOLDER_PREVIEW unset) run the one-row and unchanged checks; the pixel diff runs in preview mode.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { EVIDENCE_DIR, ROOT, VALUES, fixtureProof, launchChromium, newContext, startServer, waitReady, withServer } from './_lib.mjs';
import { captureHeaderStrips } from './capture-header.mjs';
import { oneRowVerdict, pixelDiff, twoRowVerdict, unchangedVerdict } from './header-verdict.mjs';

const H = VALUES.hub.header;
const U = VALUES.hub.unchanged;
const PUBLIC_OFFSET = 8;
const { PNG } = createRequire(`${ROOT}/package.json`)('pngjs');

async function measureHeader(page) {
  await page.waitForFunction(() => { const i = document.querySelector('#nh .nh-brand img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, width: b.width, height: b.height }; };
    const brand = r(document.querySelector('#nh .nh-brand'));
    const px = (v) => parseFloat(v);
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    const img = cs('[data-nos-hero="hub"] [data-nos-hero-media] img');
    return {
      barDisplay: cs('#nh .nh-bar').display, brand, cta: r(document.querySelector('#nh .nh-cta')), burger: r(document.querySelector('#nh .nh-burger')),
      heroTop: r(document.querySelector('[data-nos-hero="hub"]')).top, lockup: { w: brand.width, h: brand.height },
      fit: img.objectFit, pos: img.objectPosition,
      spacing: {
        copyPaddingTopPx: px(cs('.nos-hero-copy').paddingTop), copyPaddingBottomPx: px(cs('.nos-hero-copy').paddingBottom), copyGapPx: px(cs('.nos-hero-copy').rowGap),
        bodyGapPx: px(cs('.nos-hero-body').rowGap), rowGapPx: px(cs('.nos-hero-row').rowGap), ctaGroupGapPx: px(cs('.nos-hero-cta-group').rowGap),
        factsColGapPx: px(cs('.nos-hero-facts').columnGap), factsRowGapPx: px(cs('.nos-hero-facts').rowGap),
      },
    };
  });
}

async function atViewport(server, browser, vp) {
  const context = await newContext(browser, vp);
  const page = await context.newPage();
  const res = await page.goto(`${server.nos}${VALUES.hub.route}`, { waitUntil: 'load' });
  const m = await measureHeader(page);
  await context.close();
  return { status: res?.status(), m };
}

async function checkMode(server, mode, browser, c) {
  const ref = await atViewport(server, browser, H.referenceViewport);
  c.check(`[${mode} 820@2] hub responds 200`, ref.status === 200, String(ref.status));
  c.note(`note: [${mode}] 820 reference: hero top ${ref.m.heroTop.toFixed(1)}, lockup ${ref.m.lockup.w.toFixed(1)}x${ref.m.lockup.h.toFixed(1)}, bar ${ref.m.barDisplay}`);
  for (const vp of H.oneRowViewports) {
    const { status, m } = await atViewport(server, browser, vp);
    c.check(`[${mode} ${vp.name}] hub responds 200`, status === 200, String(status));
    for (const f of oneRowVerdict(m, ref.m)) c.check(`[${mode} ${vp.name}] header: ${f}`, false);
    c.note(`note: [${mode} ${vp.name}] one-row header: hero top ${m.heroTop.toFixed(1)}, lockup ${m.lockup.w.toFixed(1)}x${m.lockup.h.toFixed(1)}, bar ${m.barDisplay}`);
  }
  for (const vp of U.viewports) {
    const { m } = await atViewport(server, browser, vp);
    for (const f of unchangedVerdict(m)) c.check(`[${mode} ${vp.name}] unchanged: ${f}`, false);
  }
  for (const vp of H.twoRowViewports) {
    const { m } = await atViewport(server, browser, vp);
    for (const f of twoRowVerdict(m)) c.check(`[${mode} ${vp.name}] header: ${f}`, false);
  }
}

function decode(file) { return PNG.sync.read(readFileSync(file)); }

await withServer(4, 'hub header', async (server, c) => {
  const browser = await launchChromium();
  try {
    await checkMode(server, 'preview', browser, c);
    const branchDir = `${EVIDENCE_DIR}/${H.baseline.branchShotsDir.replace(/^evidence\//, '')}`;
    const baseDir = `${EVIDENCE_DIR}/${H.baseline.shotsDir.replace(/^evidence\//, '')}`;
    const files = await captureHeaderStrips(server, browser, branchDir);
    for (const f of files) {
      const name = f.split('/').pop();
      const base = `${baseDir}/${name}`;
      if (!existsSync(base)) { c.check(`[pixel ${name}] a main baseline exists (run capture-main-baseline.sh)`, false, base); continue; }
      const d = pixelDiff(decode(base), decode(f));
      c.check(`[pixel ${name}] header strip is pixel-identical to main`, d.ok, d.detail);
      const metaFile = f.replace('.png', '.json');
      const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : null;
      c.note(`note: [pixel ${name}] ${d.detail}${meta ? `; header bottom ${meta.headerBottomCssPx} css px, strip ${meta.stripHeightCssPx} css px (only rows inside the header element)` : ''}`);
      if (!d.ok && d.bbox) {
        // The strip is cropped to the header element's own box, so a difference left here is INSIDE the header: a real header change. Evidence only; nothing is loosened.
        const mine = decode(f); const theirs = decode(base);
        for (let y = d.bbox.minY; y <= d.bbox.maxY; y += 1) {
          for (let x = 0; x < mine.width; x += 1) {
            const i = (y * mine.width + x) << 2;
            if (mine.data[i] !== theirs.data[i] || mine.data[i + 1] !== theirs.data[i + 1] || mine.data[i + 2] !== theirs.data[i + 2]) { mine.data[i] = 255; mine.data[i + 1] = 0; mine.data[i + 2] = 255; mine.data[i + 3] = 255; }
          }
        }
        const out = `${EVIDENCE_DIR}/header-${name.split('@')[0].replace('header-', '')}-diff.png`;
        writeFileSync(out, PNG.sync.write(mine));
        c.note(`note: [pixel ${name}] diff image (changed pixels magenta) written to ${out}`);
      }
    }
    const pub = startServer(PUBLIC_OFFSET, { preview: false });
    try { await waitReady(pub); await checkMode(pub, 'public', browser, c); fixtureProof(pub, c); } finally { pub.proc.kill(); }
  } finally { await browser.close(); }
});
