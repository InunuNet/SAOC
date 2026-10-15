// Captures the SAOC header / footer / mobile-menu markup of the four SAOC regression routes.
// Used (a) once, against base c0e48c39, to write goldens/f1/saoc-base/, and (b) by check-a to
// re-capture the candidate for a byte-for-byte compare.
//   node --import tsx/esm .../capture-saoc-base.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { BASE, SAOC_ROUTES, VP_PHONE, main, withBrowser } from './_lib.mjs';

export function slice(html, open, close) {
  const s = html.indexOf(open);
  if (s === -1) return null;
  const e = html.indexOf(close, s);
  return e === -1 ? null : html.slice(s, e + close.length);
}

export async function captureAll() {
  const out = {};
  await withBrowser(async (browser) => {
    for (const route of SAOC_ROUTES) {
      const key = route === '/' ? 'home' : route.slice(1);
      const html = await (await fetch(`${BASE}${route}`)).text();
      out[`${key}.header.html`] = slice(html, '<header', '</header>');
      out[`${key}.footer.html`] = slice(html, '<footer', '</footer>');
      const ctx = await browser.newContext({ viewport: VP_PHONE });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /open menu/i }).click();
      await page.locator('[role="dialog"]').waitFor();
      out[`${key}.mobile-menu.html`] = await page.locator('[role="dialog"]').evaluate((el) => el.outerHTML);
      await ctx.close();
    }
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: capture-saoc-base.mjs <outDir>');
  await main('capture-saoc-base', async () => {
    const files = await captureAll();
    mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      if (!body) throw new Error(`empty capture ${name}`);
      writeFileSync(`${dir}/${name}`, body);
    }
    console.log(`wrote ${Object.keys(files).length} files to ${dir}`);
  });
}
