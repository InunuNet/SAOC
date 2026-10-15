// F2-T1 (R14): Cormorant and Jost never load on a /national-show page; no monospace anywhere; every visible text
// element (and form control) computes to Fraunces or Karla; the only faces that load are Fraunces and Karla (the
// root layout still DECLARES Crimson/Manrope/JetBrains for SAOC pages, so only `loaded` is judged for those, but
// Cormorant/Jost must not even be declared); italic Fraunces, when used, is a real face (mapping "Italic: Fraunces
// italic", LOAD "Fraunces (ital, opsz 9..144, wght 300..500)"). All 17 NOS routes at 1280 and 390.
import { NOS_ROUTES, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser, snapshotText, describe, firstFamily, FAMILY_OK, FAMILY_BAD } from './_f2lib.mjs';

const LOADED_OK = /^(__)?(fraunces|karla)/i;

await main('F2-T1 fonts', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [vpName, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        const tag = `${route} @${vpName}`;
        if (status !== 200) r.fail(`${tag}: HTTP ${status}`);
        await page.evaluate(() => document.fonts.ready);
        const faces = await page.evaluate(() => {
          const all = [];
          document.fonts.forEach((f) => all.push({ family: f.family.replace(/["']/g, ''), status: f.status, style: f.style }));
          return all;
        });
        for (const f of faces) {
          if (/cormorant|jost/i.test(f.family)) r.fail(`${tag}: font face "${f.family}" is declared (${f.status}); Cormorant/Jost must not exist on a NOS page`);
          else if (f.status === 'loaded' && !LOADED_OK.test(f.family)) r.fail(`${tag}: font face "${f.family}" loaded; only Fraunces and Karla may load`);
        }
        const texts = await page.evaluate(snapshotText);
        const bad = new Map();
        for (const t of texts) {
          const first = firstFamily(t.family);
          if (!FAMILY_OK.test(first) || FAMILY_BAD.test(t.family)) {
            const k = `${first} <- ${t.family.slice(0, 60)}`;
            bad.set(k, [...(bad.get(k) ?? []), describe(t)]);
          }
        }
        for (const [k, els] of bad) r.fail(`${tag}: ${els.length} element(s) set in "${k}", e.g. ${els.slice(0, 3).join(' | ')}`);
        const italicFraunces = texts.some((t) => /fraunces/i.test(firstFamily(t.family)) && t.style === 'italic');
        if (italicFraunces && !faces.some((f) => /^(__)?fraunces/i.test(f.family) && f.style === 'italic' && f.status === 'loaded')) {
          r.fail(`${tag}: Fraunces italic text is on screen but no italic Fraunces face loaded (synthetic oblique); declare style: ['normal','italic'] in both font configs`);
        }
        if (!faces.some((f) => /^(__)?fraunces/i.test(f.family) && f.status === 'loaded')) r.fail(`${tag}: no Fraunces face loaded`);
        if (!faces.some((f) => /^(__)?karla/i.test(f.family) && f.status === 'loaded')) r.fail(`${tag}: no Karla face loaded`);
        await ctx.close();
      }
    }
  });
});
