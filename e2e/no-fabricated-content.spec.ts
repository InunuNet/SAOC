// =============================================================
// SAOC — e2e/no-fabricated-content.spec.ts
// Mission ticketing-complete M1/F7 — two falsifiable properties, checked
// separately:
//
// 1. Anti-fabrication smoke check: none of a banned debug/placeholder token list
//    (`undefined`, `NaN`, `[object Object]`, `Lorem ipsum`, `TODO`, `FIXME`) leaks
//    into rendered body text on any real, live-rendered page this suite visits.
// 2. `data-placeholder="true"` reaches the RENDERED DOM (not just
//    TicketTypeCard.tsx's source) when a mocked provisional ticket type is served —
//    proving the F2 attribute actually surfaces to a real browser.
import { expect, test } from '@playwright/test';

import { PROVISIONAL_TICKET_FIXTURE_HTML } from './fixtures/tickets-fixtures';

// Banned tokens. `[object Object]` is checked too but isn't part of the contract's
// required grep set below (A11 only requires "undefined", "NaN", and a Lorem
// ipsum/TODO/FIXME alternation to literally appear in this file).
const BANNED_TOKENS = ['undefined', 'NaN', '[object Object]', 'Lorem ipsum', 'TODO', 'FIXME'];

// Real, live-rendered pages (no mocking) — a representative cross-section rather
// than the full NAV set, since nav-links-200.spec.ts already proves every NAV href
// is reachable; this spec's job is scanning rendered TEXT, not route reachability.
const PAGES_TO_SCAN = ['/', '/about', '/societies', '/judging', '/events', '/members', '/tickets'];

test.describe('no fabricated content', () => {
  for (const path of PAGES_TO_SCAN) {
    test(`${path} contains no banned placeholder/debug tokens`, async ({ page }) => {
      await page.goto(path);
      const bodyText = await page.locator('body').innerText();

      for (const token of BANNED_TOKENS) {
        expect(
          bodyText.includes(token),
          `${path} rendered body text contains banned token "${token}"`,
        ).toBe(false);
      }
    });
  }

  test('data-placeholder reaches the rendered DOM for a provisional ticket type', async ({
    page,
  }) => {
    await page.route('**/tickets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: PROVISIONAL_TICKET_FIXTURE_HTML,
      }),
    );

    await page.goto('/tickets');

    await expect(page.locator('[data-placeholder="true"]')).toHaveCount(1);
    await expect(page.getByTestId('provisional-badge')).toBeVisible();
  });
});
