// I: chrome text resolves to Fraunces / Karla only (never Crimson / Manrope / JetBrains / Cormorant /
// Jost), both faces load, and no console errors / page errors / same-origin 4xx-5xx on any NOS page at
// 1280 and 390. NOS_FONTS_STRICT=1 additionally requires the page's whole loaded-font set to be
// {Fraunces, Karla} (the page bodies still use Cormorant/Jost until the R14 retarget, so off by default).
import { NOS_ROUTES, VP_DESKTOP, VP_PHONE, BASE, main, openPage, withBrowser } from './_lib.mjs';

const STRICT = process.env.NOS_FONTS_STRICT === '1';
const OK = /fraunces|karla/i;
const BAD = /crimson|manrope|jetbrains|cormorant|jost/i;

await main('I fonts-console', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [vpName, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        page.setDefaultTimeout(8000);
        const errs = [];
        page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 160)}`); });
        page.on('pageerror', (e) => errs.push(`pageerror: ${String(e.message).slice(0, 160)}`));
        page.on('response', (res) => { if (res.url().startsWith(BASE) && res.status() >= 400) errs.push(`HTTP ${res.status()} ${res.url().replace(BASE, '')}`); });
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
        const tag = `${route} @${vpName}`;
        // Open the surface that uses the display face so Fraunces actually loads.
        if (vpName === '1280') { if (await page.locator('#nh-show-trigger').count()) await page.locator('#nh-show-trigger').click(); }
        else if (await page.locator('#nh-burger').count()) { await page.locator('#nh-burger').click(); await page.locator('#nd [data-sub]').click(); }
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const res = await page.evaluate(() => {
          const fams = new Set();
          for (const root of document.querySelectorAll('#nh, #nd, #nf')) {
            const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n; n = w.nextNode()) {
              const p = n.parentElement;
              if (!n.textContent.trim() || !p || !p.getBoundingClientRect().width) continue;
              fams.add(getComputedStyle(p).fontFamily.split(',')[0].replace(/["']/g, '').trim());
            }
          }
          const loaded = new Set();
          document.fonts.forEach((f) => { if (f.status === 'loaded') loaded.add(f.family.replace(/["']/g, '')); });
          return { chrome: [...fams], loaded: [...loaded] };
        });
        for (const f of res.chrome) if (!OK.test(f) || BAD.test(f)) r.fail(`${tag}: chrome text uses font "${f}" (only Fraunces / Karla allowed)`);
        if (!res.loaded.some((f) => /fraunces/i.test(f))) r.fail(`${tag}: no Fraunces face loaded (loaded: ${res.loaded.join(', ') || 'none'})`);
        if (!res.loaded.some((f) => /karla/i.test(f))) r.fail(`${tag}: no Karla face loaded`);
        if (STRICT) for (const f of res.loaded) if (!OK.test(f)) r.fail(`${tag}: font "${f}" loaded (strict: only Fraunces / Karla)`);
        for (const e of errs) r.fail(`${tag}: ${e}`);
        await ctx.close();
      }
    }
  });
});
