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
// Mission ticketing-complete M3/F6 — the National Show nav now wires five hrefs
// (/national-show/about, /national-show/exhibitors/international,
// /national-show/symposium, /national-show/wosa-conference,
// /national-show/programme) that don't exist as real routes yet — that session is
// building them, and the routing agreement between the two sessions is final
// regardless. goldens/fixtures/f6-pending-nos-routes.json is the single source of
// truth for which hrefs are a KNOWN, LISTED exception to the 200-status check
// below — this file must read it directly rather than hand-maintain its own skip
// list, which could silently drift from nav-config.ts's real pending set. Every
// href NOT in that list still asserts 200 exactly as before.
import { expect, test } from '@playwright/test';

import { NAV, type NavItem } from '@/components/chrome/nav-config';
import pendingNosRoutes from '../.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f6-pending-nos-routes.json';

function collectHrefs(items: readonly NavItem[]): string[] {
  const hrefs: string[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      hrefs.push(item.href);
    } else {
      hrefs.push(item.href);
      for (const column of item.columns) {
        for (const link of column.links) {
          hrefs.push(link.href);
        }
      }
    }
  }
  // De-duplicate — a href could in principle appear as both a mega item's own
  // href and a column link (it doesn't today, but the test shouldn't assume that).
  return Array.from(new Set(hrefs));
}

const PENDING_ROUTES = new Set<string>(pendingNosRoutes.pendingRoutes);

const ALL_NAV_HREFS = collectHrefs(NAV);
const NAV_HREFS = ALL_NAV_HREFS.filter((href) => !PENDING_ROUTES.has(href));
const SKIPPED_HREFS = ALL_NAV_HREFS.filter((href) => PENDING_ROUTES.has(href));

test.describe('nav links return 200', () => {
  test('NAV export is non-empty', () => {
    expect(ALL_NAV_HREFS.length).toBeGreaterThan(0);
  });

  for (const href of NAV_HREFS) {
    test(`${href} returns 200`, async ({ page }) => {
      const response = await page.goto(href);
      expect(response, `no response navigating to ${href}`).not.toBeNull();
      expect(response!.status(), `${href} did not return 200`).toBe(200);
    });
  }

  // KNOWN, LISTED exceptions — the NOS session is building these routes. Skipped
  // (not silently omitted from the file, not asserted 200) so a future reader sees
  // exactly which hrefs are pending and why, per f6-pending-nos-routes.json.
  for (const href of SKIPPED_HREFS) {
    test.skip(`${href} returns 200 (pending NOS route — see f6-pending-nos-routes.json)`, async ({
      page,
    }) => {
      const response = await page.goto(href);
      expect(response, `no response navigating to ${href}`).not.toBeNull();
      expect(response!.status(), `${href} did not return 200`).toBe(200);
    });
  }
});
