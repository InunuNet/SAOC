// Header strip capture for the unchanged-header proof (NOS Design H-a 768 cut (a)): the full-width strip from the top of the hub page to the bottom of #nh,
// at each two-row viewport (767x1024@2, 390x844@3). The strip ends at floor(header bottom): the last fractional row is part header, part the hero photo below it
// (HB-3 serves a different photo variant at 390, so that blended row differs by up to 6/255 while every header pixel is identical), so it is not a header pixel. The same function captures the main baseline and the branch, so the two are compared like for like.
import { mkdirSync, writeFileSync } from 'node:fs';
import { VALUES, newContext } from './_lib.mjs';

export async function captureHeaderStrips(server, browser, outDir) {
  mkdirSync(outDir, { recursive: true });
  const files = [];
  for (const vp of VALUES.hub.header.twoRowViewports) {
    const context = await newContext(browser, vp);
    const page = await context.newPage();
    const res = await page.goto(`${server.nos}/`, { waitUntil: 'load' });
    if (res?.status() !== 200) throw new Error(`hub answered ${res?.status()} at ${vp.name}`);
    await page.waitForFunction(() => { const i = document.querySelector('#nh .nh-brand img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const box = await page.evaluate(() => { const b = document.querySelector('#nh').getBoundingClientRect(); return { width: document.documentElement.clientWidth, bottom: b.bottom + scrollY }; });
    const file = `${outDir}/header-${vp.name}.png`;
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: box.width, height: Math.floor(box.bottom) } });
    writeFileSync(`${outDir}/header-${vp.name}.json`, JSON.stringify({ viewport: vp.name, headerBottomCssPx: box.bottom, stripHeightCssPx: Math.floor(box.bottom) }));
    files.push(file);
    await context.close();
  }
  return files;
}
