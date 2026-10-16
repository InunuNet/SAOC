#!/usr/bin/env node
// F17-A17 (scope F, Brad 2026-10-16 "Hide the members link"): no link to /members and no "Members" nav item in any header, mobile menu or footer, on SAOC and NOS pages at 390 and 1280.
//  STATIC  nav-config.ts and footer-data.ts hold no members entry (removed from the config, not hidden by CSS), no stylesheet hides a members link, the /members route and its page stay.
//  RUNTIME for every page in goldens/f17/tokens.json members.pages at 390 and 1280: no a[href="/members"] (with or without trailing slash or query) anywhere inside #nh (SAOC or NOS header), the mobile menu (#nd, opened by a real click at 390),
//          the footer (#nf / footer), and no nav item or footer link whose text matches members( portal)?; /members itself still answers 200.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-l-members.mjs
import { existsSync, readFileSync } from 'node:fs';
import { main, openPage, withBrowser, T } from './_lib.mjs';
import { NAV } from '../../../../components/chrome/nav-config.ts';
import { FOOTER_NAV } from '../../../../components/chrome/footer-data.ts';

const M = T.members;
const LABEL = new RegExp(M.labelPattern, 'i');
const MEMBERS_HREF = /^\/members(?:[/?#]|$)/;

function scan() {
  const hits = [];
  const roots = [...document.querySelectorAll('header, #nh, nav, #nd, footer, #nf, [role="dialog"]')];
  for (const root of roots) {
    for (const a of root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (/^\/members(?:[/?#]|$)/.test(href) || /^members( portal)?$/i.test(text)) hits.push(`${href} "${text}"`);
    }
  }
  return [...new Set(hits)];
}

await main('F17-A17 members link hidden', async (r) => {
  // ---- static
  const flat = (n) => [n, ...(n.columns ?? []).flatMap((c) => c.links ?? []), ...(n.lead?.theShow?.links ?? [])];
  for (const n of NAV.flatMap(flat)) if (n.id === 'members' || n.href === M.route || LABEL.test(n.label ?? '')) r.fail(`nav-config still carries ${JSON.stringify({ id: n.id, label: n.label, href: n.href })}`);
  for (const l of FOOTER_NAV) if (l.id === 'members' || l.href === M.route || LABEL.test(l.label)) r.fail(`footer-data FOOTER_NAV still carries ${JSON.stringify(l)}`);
  if (/members/i.test(readFileSync('components/chrome/footer-data.ts', 'utf8').replace(/\/\/.*$/gm, ''))) r.fail('footer-data.ts still mentions members outside a comment');
  if (!existsSync('app/(marketing)/members/page.tsx')) r.fail('the /members route was deleted; only the link goes');
  for (const css of ['app/globals.css', 'app/(marketing)/national-show/nos-structure.css', 'app/(marketing)/national-show/nos-theme.css']) {
    if (existsSync(css) && /href=["']?\/members|\[href\*?=["']?\/members/.test(readFileSync(css, 'utf8'))) r.fail(`${css} hides a members link by CSS; remove it from the config instead`);
  }
  // ---- runtime
  await withBrowser(async (browser) => {
    for (const [w, h] of M.viewports) {
      for (const route of M.pages) {
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${w}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        let hits = await page.evaluate(scan);
        if (w < 700) {
          const trigger = page.locator('button[aria-controls="nd"], button[aria-label="Open menu"]').first();
          if (await trigger.count()) { await trigger.click(); await page.waitForTimeout(350); hits = [...new Set([...hits, ...(await page.evaluate(scan))])]; }
          else r.note(`${tag}: no mobile menu trigger found, only the static header and footer were scanned`);
        }
        if (hits.length) r.fail(`${tag}: members link still rendered: ${hits.join('; ')}`);
        await ctx.close();
      }
    }
    const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, M.route);
    if (status !== 200) r.fail(`${M.route}: HTTP ${status}, the route must stay in place`);
    await ctx.close();
  });
});
