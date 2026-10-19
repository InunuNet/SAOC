// nos-critique-r17 F1 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Golden: goldens/f1-edits.json. Both modes, 1280 and 390, on /national-show/tickets ("Exhibiting or trading?").
//   R1  the exhibitor card (#exhibit) keeps its heading and its one CTA, named exactly "Exhibitor entry"; that CTA's href equals the
//       trader card's (#trade) CTA href, which is the golden vendor-application href.
//   R2  the exhibitor card body reads exactly the golden body (the removed sentence appears nowhere on the page), and is not empty.
//   R3  following the exhibitor CTA lands, HTTP 200, on the same URL as following the trader CTA.
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const G = goldenJson('f1-edits.json');
const WIDTHS = [1280, 390];
const failures = [];
let checks = 0;

const card = (page, id) => page.evaluate((id) => {
  const c = document.getElementById(id);
  if (!c) return null;
  const links = [...c.querySelectorAll('a[href]')];
  return {
    heading: c.querySelector('h3')?.textContent.trim() ?? null,
    body: [...c.querySelectorAll('p')].map((p) => p.textContent.trim()),
    links: links.map((a) => ({ href: a.getAttribute('href'), name: (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim() })),
  };
}, id);

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      checks += 1;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      const at = `${mode} ${G.route} @${width}`;
      const r = await page.goto(`${srv.origin}${G.route}`, { waitUntil: 'networkidle' });
      if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); await ctx.close(); continue; }
      const ex = await card(page, G.exhibit.cardId);
      const tr = await card(page, G.trade.cardId);
      if (!ex || !tr) { failures.push(`${at}: card #${G.exhibit.cardId} or #${G.trade.cardId} missing (R1)`); await ctx.close(); continue; }
      // R1
      if (ex.heading !== G.exhibit.heading) failures.push(`${at}: exhibitor heading ${JSON.stringify(ex.heading)}, want ${JSON.stringify(G.exhibit.heading)} (R1)`);
      if (ex.links.length !== 1 || ex.links[0].name !== G.exhibit.cta) failures.push(`${at}: exhibitor card links ${JSON.stringify(ex.links)}, want one named "${G.exhibit.cta}" (R1)`);
      if (tr.links.length !== 1 || tr.links[0].href !== G.trade.href) failures.push(`${at}: trader card links ${JSON.stringify(tr.links)}, want one to ${G.trade.href} (R1)`);
      if (ex.links[0]?.href !== tr.links[0]?.href) failures.push(`${at}: exhibitor CTA href ${ex.links[0]?.href}, want the trader CTA's ${tr.links[0]?.href} (R1)`);
      // R2
      if (JSON.stringify(ex.body) !== JSON.stringify([G.exhibit.body])) failures.push(`${at}: exhibitor body ${JSON.stringify(ex.body)}, want ${JSON.stringify([G.exhibit.body])} (R2)`);
      if ((await page.evaluate(() => document.body.innerText)).includes(G.exhibit.removed)) failures.push(`${at}: the page still shows "${G.exhibit.removed}" (R2)`);
      // R3
      const land = async (href) => { const p = await ctx.newPage(); const rr = await p.goto(`${srv.origin}${href}`, { waitUntil: 'domcontentloaded' }); const out = { status: rr ? rr.status() : 0, url: new URL(p.url()).pathname }; await p.close(); return out; };
      if (ex.links[0]) {
        const a = await land(ex.links[0].href);
        const b = await land(G.trade.href);
        if (a.status !== 200 || a.url !== b.url) failures.push(`${at}: exhibitor CTA lands on ${a.url} (HTTP ${a.status}), trader CTA on ${b.url} (HTTP ${b.status}) (R3)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`${mode}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}
finish(NAME, failures, `F1 rendered: ${checks} checks across ${MODES.join('/')} at ${WIDTHS.join('/')}: the exhibitor card's "Exhibitor entry" goes to the trader card's vendor application, sentence gone.`);
