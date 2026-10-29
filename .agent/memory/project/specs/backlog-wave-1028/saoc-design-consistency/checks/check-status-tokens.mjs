// F1a: the three status tokens exist on the SAOC base (:root), with the ruled values.
import { withSite, openPage, check, finish } from './lib.mjs';
const WANT = { '--status-error': '#8f2834', '--status-success': '#2f5d3a', '--status-warning': '#7a5a12' };
// Home (/) needs live Sanity events, so it is probed only on a deployed origin.
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  for (const path of deployed ? ['/', '/about'] : ['/about']) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, 1440);
    check(status === 200, `${path} status ${status}`);
    const got = await page.evaluate((names) => Object.fromEntries(names.map((n) => [n, getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase()])), Object.keys(WANT));
    for (const [k, v] of Object.entries(WANT)) check(got[k] === v, `${path}: ${k} is "${got[k]}", want ${v}`);
    await ctx.close();
  }
});
finish('status-tokens');
