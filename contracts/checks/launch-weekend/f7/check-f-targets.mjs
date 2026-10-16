#!/usr/bin/env node
// F7a-A6 - WCAG 2.5.8: the named stand-alone links from the audit are at least 24x24 CSS px at 390 and 1440.
import { BASE, withBrowser, open, firstSocietyHref, report } from './_lib.mjs';

const MIN = 24;
const problems = [];
const targets = [
  { route: '/media-kit', find: (p) => p.getByRole('link', { name: /Download/ }), what: 'media-kit Download link' },
  { route: '/national-show/plan-your-visit', find: (p) => p.getByRole('link', { name: /Open in a map/ }), what: 'VenueCard "Open in a map"' },
  { route: '/national-show/exhibitors', find: (p) => p.getByRole('link', { name: /Show overview/ }), what: 'exhibitors back link' },
];
for (const [name, vp, opts] of [['desktop', { width: 1440, height: 900 }, {}], ['mobile', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }]]) {
  await withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    const measure = async (route, locator, what, optional = false) => {
      const n = await locator.count();
      if (!n) { if (!optional) problems.push(`${name} ${route}: ${what} not found`); return; }
      for (let i = 0; i < n; i++) {
        const box = await locator.nth(i).boundingBox();
        if (box && (box.width < MIN || box.height < MIN)) problems.push(`${name} ${route}: ${what} is ${Math.round(box.width)}x${Math.round(box.height)} (min ${MIN}x${MIN})`);
      }
    };
    const slug = await firstSocietyHref(page);
    if (slug) { await open(page, slug); await measure(slug, page.getByRole('link', { name: /All societies/ }), 'society back link'); }
    else problems.push(`${name}: no society detail link found on /societies`);
    // NOS-page targets are optional: a link absent at a viewport is not a target-size failure, a link present must be >= 24px
    for (const t of targets) { await open(page, t.route); await measure(t.route, t.find(page), t.what, true); }
    await open(page, '/');
    await measure('/', page.locator('footer a'), 'footer link');
  }, vp, opts);
}
report(problems, `named links meet the ${MIN}px minimum target at ${BASE}`);
