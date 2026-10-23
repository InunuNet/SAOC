// =============================================================
// SAOC — e2e/nav-links-200.spec.ts
// Mission ticketing-complete M1/F7 — every href reachable from the site-wide NAV
// returns 200. Imports the real NAV export from components/chrome/nav-config.ts
// rather than hand-copying the route list, so this test can never silently drift
// from the actual nav the way a hand-typed list could. goldens/f7-nav-targets.json
// is an independent audit-trail cross-check (not this test's source of truth) — if
// it and the derived list here disagree, nav-config.ts changed and the golden
// should be updated in the same commit as a reviewable diff.
//
// Mission nos-site-split F3 — the show is its own site. The SAOC NAV now holds SAOC pages and one
// ABSOLUTE link to the NOS home: SAOC hrefs are fetched on the SAOC host, the absolute link is
// asserted by value (it leaves the site; the NOS home is fetched below). The show's own menu is
// NOS_NAV (components/nos-chrome/nos-nav.ts), whose internal hrefs are fetched on the NOS host at
// their clean public path. The Past shows route is withheld in a public build until Sanity holds a
// past show (r64), so it must be 200 or 404, never anything else.
//
// goldens/fixtures/f1-pending-nos-routes.json is the single source of truth for which hrefs are a
// KNOWN, LISTED exception to the 200-status check below — this file reads it directly rather than
// hand-maintaining its own skip list. Every href NOT in that list still asserts 200.
//
// collectHrefs() lives in ./utils/collect-nav-hrefs.ts, shared with
// e2e/mobile-nav-reaches-every-section.spec.ts.
import { expect, test } from '@playwright/test';

import { NAV } from '@/components/chrome/nav-config';
import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import { PAST_SHOWS_HREF } from '@/lib/data/past-shows';
import { nosUrl } from '@/lib/site-hosts';
import pendingNosRoutes from '../.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json';
import { collectHrefs } from './utils/collect-nav-hrefs';
import { isAbsolute, nosHref } from './utils/site-urls';

const PENDING_ROUTES = new Set<string>(pendingNosRoutes.pendingRoutes);

const ALL_SAOC_HREFS = collectHrefs(NAV);
const SAOC_PAGE_HREFS = ALL_SAOC_HREFS.filter((href) => !isAbsolute(href));
const SAOC_CROSS_SITE_HREFS = ALL_SAOC_HREFS.filter(isAbsolute);

const ALL_SHOW_HREFS = collectHrefs(NOS_NAV);
const SHOW_HREFS = ALL_SHOW_HREFS.filter(
  (href) => !PENDING_ROUTES.has(href) && href !== PAST_SHOWS_HREF,
);
const SKIPPED_HREFS = ALL_SHOW_HREFS.filter((href) => PENDING_ROUTES.has(href));

test.describe('nav links return 200', () => {
  test('NAV export is non-empty', () => {
    expect(ALL_SAOC_HREFS.length).toBeGreaterThan(0);
    expect(ALL_SHOW_HREFS.length).toBeGreaterThan(0);
  });

  for (const href of SAOC_PAGE_HREFS) {
    test(`SAOC ${href} returns 200`, async ({ page }) => {
      const response = await page.goto(href);
      expect(response, `no response navigating to ${href}`).not.toBeNull();
      expect(response!.status(), `${href} did not return 200`).toBe(200);
    });
  }

  // A SAOC link to the show leaves the site: assert where it points, not that it loads here.
  for (const href of SAOC_CROSS_SITE_HREFS) {
    test(`SAOC cross-site ${href} points at the NOS site`, () => {
      expect(href.startsWith(nosUrl('/')), `${href} is not a NOS URL`).toBe(true);
    });
  }

  for (const href of SHOW_HREFS) {
    test(`NOS ${href} returns 200`, async ({ page, baseURL }) => {
      const url = nosHref(baseURL!, href);
      const response = await page.goto(url);
      expect(response, `no response navigating to ${url}`).not.toBeNull();
      expect(response!.status(), `${url} did not return 200`).toBe(200);
    });
  }

  test('NOS Past shows route is 200 (preview) or withheld 404 (public), nothing else', async ({
    page,
    baseURL,
  }) => {
    const response = await page.goto(nosHref(baseURL!, PAST_SHOWS_HREF));
    expect([200, 404]).toContain(response!.status());
  });

  // KNOWN, LISTED exceptions — skipped (not silently omitted from the file, not asserted 200) so a
  // future reader sees exactly which hrefs are pending and why, per f1-pending-nos-routes.json.
  for (const href of SKIPPED_HREFS) {
    test.skip(`${href} returns 200 (pending NOS route — see f1-pending-nos-routes.json)`, async ({
      page,
      baseURL,
    }) => {
      const response = await page.goto(nosHref(baseURL!, href));
      expect(response!.status(), `${href} did not return 200`).toBe(200);
    });
  }
});
