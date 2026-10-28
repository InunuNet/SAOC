// Live gate: the two colour marks in the NOS footer. For each viewport (1440, 390) at 1x, 2x and 3x, the file the browser serves
// (img.currentSrc, decoded in a bare new Image()) must be at least box x DPR wide, must come from the resize-only ladder of the pinned
// source, and the boxes must hold (NOS lockup 248, SAOC credit 229 x 183 +/- 4). The credit link keeps its test id and its accessible name.
// Writes the table and footer screenshots (1x and 3x) to .tmp/sandbox/nos-footer-colour-logos-gate/ for the by-eye check at 1440 and 390.
import { mkdirSync, writeFileSync } from 'node:fs';
import { OUT, VALUES, launchChromium, newContext, requiredPx, withServer } from './_lib.mjs';

mkdirSync(OUT, { recursive: true });
const MARKS = [
  { id: 'nos-lockup', selector: '#nf .nf-lockup img', spec: VALUES.nosLockup, box: [VALUES.nosLockup.box, 1] },
  { id: 'saoc-credit', selector: `#nf [data-testid="${VALUES.credit.testId}"] img`, spec: VALUES.credit, box: [VALUES.credit.box, VALUES.credit.boxTolerance] },
];
const table = ['| viewport | dpr | mark | box WxH | source WxH | required | served | result |', '|---|---|---|---|---|---|---|---|'];

await withServer(1, 'footer colour logos served width', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of VALUES.viewports) {
      for (const dpr of VALUES.dprs) {
        const tag = `[nos ${vp.name}@${dpr}]`;
        const context = await newContext(browser, vp, dpr);
        const page = await context.newPage();
        const res = await page.goto(`${server.nos}/`, { waitUntil: 'load' });
        c.check(`${tag} responds 200`, res?.status() === 200, String(res?.status()));
        await page.evaluate(() => { for (const img of document.querySelectorAll('#nf img')) img.loading = 'eager'; document.querySelector('#nf')?.scrollIntoView(); });
        await page.waitForTimeout(1200);
        for (const mark of MARKS) {
          const r = await page.evaluate(async (sel) => {
            const img = document.querySelector(sel);
            if (!img) return null;
            const b = img.getBoundingClientRect();
            const probe = new Image(); probe.src = img.currentSrc;
            try { await probe.decode(); } catch { return { src: img.currentSrc, error: true }; }
            const link = img.closest('a');
            return { src: img.currentSrc, alt: img.alt, fit: getComputedStyle(img).objectFit, boxW: b.width, boxH: b.height, srcW: probe.naturalWidth, srcH: probe.naturalHeight, linkName: link?.getAttribute('aria-label') ?? null, linkHref: link?.getAttribute('href') ?? null };
          }, mark.selector);
          if (!r || r.error) { c.check(`${tag} ${mark.id} renders and decodes`, false, r?.src ?? 'not found'); continue; }
          const { drawn, required } = requiredPx({ fit: r.fit, boxW: r.boxW, boxH: r.boxH, srcW: r.srcW, srcH: r.srcH, dpr });
          const ok = r.srcW >= required;
          const name = r.src.split('/').pop()?.split('?')[0] ?? r.src;
          table.push(`| ${vp.name} | ${dpr} | ${mark.id} | ${Math.round(r.boxW)}x${Math.round(r.boxH)} | ${r.srcW}x${r.srcH} | ${required} | ${r.srcW} | ${ok ? 'ok' : 'SHORT'} |`);
          c.check(`${tag} ${mark.id}: served ${r.srcW} >= ${required} device px (drawn ${Math.round(drawn)} css x ${dpr})`, ok, r.src);
          const stem = mark.spec.src.split('/').pop();
          c.check(`${tag} ${mark.id} is a ladder variant of ${stem}`, r.src.includes('/images/_opt/') && r.src.includes(stem) && r.src.endsWith('.webp'), r.src);
          c.check(`${tag} ${mark.id} box ${Math.round(r.boxW)} within ${mark.box[0]} +/- ${mark.box[1]}`, Math.abs(r.boxW - mark.box[0]) <= mark.box[1], String(r.boxW));
          if (mark.id === 'saoc-credit') c.check(`${tag} credit box height ${Math.round(r.boxH)} within ${VALUES.credit.boxHeight} +/- ${VALUES.credit.boxTolerance}`, Math.abs(r.boxH - VALUES.credit.boxHeight) <= VALUES.credit.boxTolerance, String(r.boxH));
          c.check(`${tag} ${mark.id} source is ${mark.spec.width}x${mark.spec.height} aspect (box aspect within 1px)`, Math.abs(r.boxW * mark.spec.height / mark.spec.width - r.boxH) <= 1, `${r.boxW}x${r.boxH}`);
          if (mark.id === 'saoc-credit') {
            c.check(`${tag} credit alt equals SaocLockup ACCESSIBLE_LABEL`, r.alt === VALUES.credit.alt, r.alt);
            c.check(`${tag} credit link has no aria-label (named by the alt)`, r.linkName === null, String(r.linkName));
            c.check(`${tag} credit link is a same-tab link to the SAOC site`, /^https?:\/\/[^/]+\/?$/.test(r.linkHref ?? ''), String(r.linkHref));
          } else {
            c.check(`${tag} NOS lockup alt is non-empty`, r.alt.length > 0);
          }
        }
        if (dpr === 1 || dpr === 3) { await page.locator('#nf').scrollIntoViewIfNeeded(); await page.locator('#nf').screenshot({ path: `${OUT}/nos-footer-${vp.name}x${dpr}.png` }); }
        await context.close();
      }
    }
    // No footer overflow at 390, 800 and 1023 (the credit is max-width:100%, so it may shrink but never overflow).
    for (const width of VALUES.overflowWidths) {
      const tag = `[nos overflow ${width}]`;
      const context = await newContext(browser, { width, height: 900 }, 1);
      const page = await context.newPage();
      await page.goto(`${server.nos}/`, { waitUntil: 'load' });
      await page.evaluate(() => { for (const img of document.querySelectorAll('#nf img')) img.loading = 'eager'; document.querySelector('#nf')?.scrollIntoView(); });
      await page.waitForTimeout(800);
      const o = await page.evaluate((sel) => {
        const nf = document.querySelector('#nf'); const img = document.querySelector(sel);
        return { doc: document.documentElement.scrollWidth, win: window.innerWidth, nf: nf ? nf.scrollWidth : -1, nfClient: nf ? nf.clientWidth : -1, imgRight: img ? img.getBoundingClientRect().right : -1, imgW: img ? img.getBoundingClientRect().width : -1 };
      }, MARKS[1].selector);
      c.check(`${tag} document does not scroll sideways`, o.doc <= o.win, JSON.stringify(o));
      c.check(`${tag} footer has no overflow`, o.nf <= o.nfClient, JSON.stringify(o));
      c.check(`${tag} credit stays inside the viewport and at most ${VALUES.credit.box + VALUES.credit.boxTolerance} wide`, o.imgRight <= o.win && o.imgW <= VALUES.credit.box + VALUES.credit.boxTolerance, JSON.stringify(o));
      await context.close();
    }
  } finally { await browser.close(); }
  writeFileSync(`${OUT}/logos-table.md`, `${table.join('\n')}\n`);
  console.log(table.join('\n'));
});
