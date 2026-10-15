// B: no SAOC logo / lockup src anywhere on /national-show, /national-show/vendors, /national-show/tickets
// (HTML outside <script>, every img/source/preload/background in the DOM, at both viewports with the
// mega-menu / menu panel open). The NOS lockups are present, shipped unprocessed (plain /images/nos/
// path, bytes identical to the handoff files).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BASE, GOLDEN_DIR, NOS_LOGO_FILES, SAOC_LOGO_RE, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_lib.mjs';

const ROUTES = ['/national-show', '/national-show/vendors', '/national-show/tickets'];
const sha = (b) => createHash('sha256').update(b).digest('hex');

await main('B logos', async (r) => {
  for (const route of ROUTES) {
    const html = (await (await fetch(`${BASE}${route}`)).text()).replace(/<script[\s\S]*?<\/script>/gi, '');
    const hit = html.match(SAOC_LOGO_RE);
    if (hit) r.fail(`${route}: SSR HTML (outside scripts) contains SAOC logo reference "${hit[0]}" near "${html.slice(Math.max(0, html.indexOf(hit[0]) - 60), html.indexOf(hit[0]) + 60)}"`);
  }
  await withBrowser(async (browser) => {
    for (const [vpName, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
      for (const route of ROUTES) {
        const { ctx, page } = await openPage(browser, vp, route);
        const open = vpName === '1280' ? '#nh-show-trigger' : '#nh-burger';
        if (await page.locator(open).count()) await page.locator(open).click();
        const refs = await page.evaluate(() => {
          const dec = (v) => { try { return decodeURIComponent(v); } catch { return v; } };
          const out = [];
          for (const el of document.querySelectorAll('img, source, link[rel="preload"], use, image')) {
            for (const a of ['src', 'srcset', 'href', 'imagesrcset', 'xlink:href']) if (el.getAttribute(a)) out.push(dec(el.getAttribute(a)));
            if (el.currentSrc) out.push(dec(el.currentSrc));
          }
          for (const el of document.querySelectorAll('*')) {
            const bg = getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') out.push(dec(bg));
          }
          return out;
        });
        for (const ref of refs) if (SAOC_LOGO_RE.test(ref)) r.fail(`${route} @${vpName}: DOM references SAOC logo "${ref.slice(0, 120)}"`);
        const chrome = await page.evaluate(() => ({
          h: document.querySelector('#nh .nh-brand img')?.getAttribute('src') ?? null,
          fh: document.querySelector('#nf .nf-lockup .nf-h')?.getAttribute('src') ?? null,
          fv: document.querySelector('#nf .nf-lockup .nf-v')?.getAttribute('src') ?? null,
          fhLoad: document.querySelector('#nf .nf-lockup .nf-h')?.getAttribute('loading') ?? null,
          fvLoad: document.querySelector('#nf .nf-lockup .nf-v')?.getAttribute('loading') ?? null,
          picture: !!document.querySelector('#nf .nf-lockup picture'),
        }));
        const want = { h: NOS_LOGO_FILES.header, fh: NOS_LOGO_FILES.footerH, fv: NOS_LOGO_FILES.footerV };
        for (const k of Object.keys(want)) {
          if (chrome[k] !== `/images/nos/${want[k]}`) r.fail(`${route} @${vpName}: ${k} src is ${JSON.stringify(chrome[k])}, want "/images/nos/${want[k]}" (plain path, no /_next/image)`);
        }
        if (chrome.fhLoad === 'lazy' || chrome.fvLoad === 'lazy') r.fail(`${route} @${vpName}: footer lockups must load eagerly`);
        if (chrome.picture) r.fail(`${route} @${vpName}: footer lockup uses <picture>; the handoff requires two <img> + CSS`);
        await ctx.close();
      }
    }
  });
  const hashes = {};
  for (const f of Object.values(NOS_LOGO_FILES)) hashes[f] = sha(readFileSync(`${GOLDEN_DIR}/img/${f}`));
  for (const [f, want] of Object.entries(hashes)) {
    const res = await fetch(`${BASE}/images/nos/${f}`);
    const got = res.ok ? sha(Buffer.from(await res.arrayBuffer())) : `HTTP ${res.status}`;
    if (got !== want) r.fail(`/images/nos/${f} served ${got}, want ${want} (ship the handoff file unaltered)`);
  }
});
