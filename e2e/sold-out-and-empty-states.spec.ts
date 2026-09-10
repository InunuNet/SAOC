// =============================================================
// SAOC — e2e/sold-out-and-empty-states.spec.ts
// Mission ticketing-complete M1/F7 — sold-out and empty (sales-closed) states
// render, constructed via page.route() network mocking rather than depending on
// live Sanity/Firestore data. See e2e/fixtures/tickets-fixtures.ts for why this
// mocks the whole /tickets document response rather than a narrower data call:
// /tickets fetches ticket-type and sold-count data entirely server-side (Sanity +
// Firebase Admin SDK during SSR), so there is no client-side fetch boundary to
// intercept the way ContactForm's /api/contact POST has. Fulfilling the top-level
// navigation request means the request never reaches the real server at all — no
// Sanity query, no Firestore read, no live-data dependency, and no Sanity client
// of any kind — mutating or otherwise — imported in this file.
import { expect, test } from '@playwright/test';

import {
  EMPTY_SALES_CLOSED_FIXTURE_HTML,
  SOLD_OUT_FIXTURE_HTML,
} from './fixtures/tickets-fixtures';

test.describe('sold-out and empty states', () => {
  test('renders the sold-out state', async ({ page }) => {
    await page.route('**/tickets', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: SOLD_OUT_FIXTURE_HTML }),
    );

    await page.goto('/tickets');

    await expect(page.getByRole('status')).toContainText('Sold out');
  });

  test('renders the empty (sales-closed) state', async ({ page }) => {
    await page.route('**/tickets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: EMPTY_SALES_CLOSED_FIXTURE_HTML,
      }),
    );

    await page.goto('/tickets');

    await expect(page.getByRole('status')).toContainText('Sales closed');
    await expect(page.getByRole('status')).toContainText(
      'Ticket sales are not yet open — check back soon.',
    );
  });
});
