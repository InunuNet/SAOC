// N12 — workshop tickets are "Coming soon" and cannot be bought (lib/workshop-sales.ts).
import { expect, test } from '@playwright/test';

import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { isTicketOnSale } from '@/lib/ticket-on-sale';
import { WORKSHOP_TICKETS_ON_SALE } from '@/lib/workshop-sales';

import { nosBase } from './utils/site-urls';

test.describe('workshop tickets coming soon', () => {
  test('the sales switch is off', () => {
    expect(WORKSHOP_TICKETS_ON_SALE).toBe(false);
  });

  test('the hub card says Coming soon and offers no stepper or buy link', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${nosBase(baseURL!)}/tickets`);
    const card = page.locator('article, section, div').filter({ hasText: 'Coming soon' }).last();
    await expect(page.getByText('Coming soon').first()).toBeVisible();
    await expect(page.locator('a[href*="/tickets/workshops"]')).toHaveCount(0);
    await expect(card).toBeVisible();
  });

  test('the on-sale predicate refuses every kind of workshop ticket as coming soon', () => {
    // Checkout answers 403 on this exact verdict (app/api/tickets/checkout/route.ts), so an
    // otherwise perfectly sellable workshop doc is the case to prove: active, sales open, in stock.
    const sellable = {
      active: true,
      price: 350,
      capacity: 20,
      showId: NATIONAL_SHOW_ID,
    } as const;
    const workshopDocs = [
      { ...sellable, slug: 'workshops' },
      { ...sellable, slug: 'any-slug', category: 'workshop' },
      { ...sellable, slug: 'any-slug', isWorkshopSession: true },
    ];
    for (const doc of workshopDocs) {
      const verdict = isTicketOnSale({
        doc,
        activeShowId: NATIONAL_SHOW_ID,
        salesOpen: true,
        soldOut: false,
        now: new Date(),
        qaFixturesAllowed: false,
      });
      expect(verdict).toEqual({ onSale: false, reason: 'coming-soon' });
    }
  });
});
