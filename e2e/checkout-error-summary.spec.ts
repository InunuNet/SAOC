// =============================================================
// SAOC — e2e/checkout-error-summary.spec.ts
// Mission checkout-error-summary (P1 a11y, design review 2026-10-28 F4 F1/F2). A failed ticket
// checkout validation must mount a focused error summary, as the vendor application does
// (components/vendors/VendorApplyForm.tsx). Written by the architect as the golden for @dev.
//
// The form under test is the real TicketPurchaseForm, rendered by the fixture route
// /ticket-fixtures/buy (needs TICKET_FIXTURES=1; ?type=day adds the day-picker product). The SAOC
// host never renders the checkout (proxy.ts 308-redirects /tickets/* to the NOS origin), so the
// SAOC leg is a redirect check. The live /tickets/<slug> route runs only when E2E_TICKET_SLUG is
// set (it needs a Sanity fixture replay). No payment is ever submitted: the checkout POST is
// mocked where it is reached at all.
// =============================================================
import { expect, test, type Page } from '@playwright/test';

import { nosBase } from './utils/site-urls';

const FIXTURE = '/ticket-fixtures/buy';
const SUMMARY = '#checkout-error-summary';
const SUMMARY_HEADING = 'Please check the highlighted fields.';
const NAME_ERROR = 'Please enter the attendee name.';
const EMAIL_ERROR = 'Please enter a valid email address.';
const DAY_ERROR = 'Choose a day';
const SUBMIT = 'Continue to payment';
const NAME_FIELD = '#attendee-fixture-ticket-0-name';
const EMAIL_FIELD = '#attendee-fixture-ticket-0-email';
const VIEWPORTS = [
  { label: '1280', width: 1280, height: 800 },
  { label: '390', width: 390, height: 844 },
];

async function open(page: Page, query = '') {
  await page.goto(`${FIXTURE}${query}`);
  const submit = page.getByRole('button', { name: SUBMIT });
  await expect(submit).toBeEnabled({ timeout: 45_000 }); // disabled until hydrated; first hit compiles the route
  return submit;
}

const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? '');

const STICKY_STACK_HEIGHT = 145; // measured on nos.saoc.co.za: 48 test bar + 97 header (review F4 F1)

/** The fixture route has no site chrome, so pin a stand-in for the NOS sticky stack. */
const pinStickyStack = (page: Page) =>
  page.evaluate((height) => {
    const bar = document.createElement('div');
    bar.setAttribute('style', `position:fixed;top:0;left:0;width:100%;height:${height}px;z-index:50;background:#fff`);
    document.body.appendChild(bar);
  }, STICKY_STACK_HEIGHT);

/** Bottom edge of everything pinned to the top of the viewport (test bar, header, sub-nav). */
const stickyBottom = (page: Page) =>
  page.evaluate(() => {
    let bottom = 0;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > window.innerWidth * 0.5 && r.top <= 1) bottom = Math.max(bottom, r.bottom);
    }
    return bottom;
  });

for (const vp of VIEWPORTS) {
  test.describe(`checkout error summary at ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('empty submit mounts the summary and focuses it', async ({ page }) => {
      const submit = await open(page);
      await expect(page.locator(SUMMARY)).toHaveCount(0);
      await submit.click();
      const summary = page.locator(SUMMARY);
      await expect(summary).toBeVisible();
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
      await expect(summary).toContainText(SUMMARY_HEADING);
      await expect(summary).toHaveAttribute('tabindex', '-1');
      expect(
        (await summary.locator('[role="alert"]').count()) > 0 || (await summary.getAttribute('aria-labelledby')) !== null,
        'summary needs role=alert or aria-labelledby',
      ).toBe(true);
      await expect(summary.getByRole('link')).toHaveText([NAME_ERROR, EMAIL_ERROR]);
      await expect(summary.getByRole('link').nth(0)).toHaveAttribute('href', '#attendee-fixture-ticket-0-name');
      await expect(summary.getByRole('link').nth(1)).toHaveAttribute('href', '#attendee-fixture-ticket-0-email');
      await expect(page.locator(NAME_FIELD)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(EMAIL_FIELD)).toHaveAttribute('aria-invalid', 'true');
      for (const [field, text] of [[NAME_FIELD, NAME_ERROR], [EMAIL_FIELD, EMAIL_ERROR]]) {
        const describedBy = await page.locator(field).getAttribute('aria-describedby');
        expect(describedBy, `${field} aria-describedby`).toBeTruthy();
        await expect(page.locator(`[id="${describedBy}"]`)).toContainText(text);
      }
    });

    test('the focused summary is not hidden under the sticky header stack', async ({ page }) => {
      const submit = await open(page);
      await pinStickyStack(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await submit.click();
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
      await expect
        .poll(async () => {
          const top = (await page.locator(SUMMARY).boundingBox())?.y ?? -1;
          return top - (await stickyBottom(page));
        })
        .toBeGreaterThanOrEqual(0);
    });

    test('a summary link moves focus to its field, clear of the sticky stack', async ({ page }) => {
      const submit = await open(page);
      await pinStickyStack(page);
      await submit.click();
      await page.locator(SUMMARY).getByRole('link', { name: NAME_ERROR }).click();
      await expect.poll(() => activeId(page)).toBe('attendee-fixture-ticket-0-name');
      await page.locator(SUMMARY).getByRole('link', { name: EMAIL_ERROR }).click().catch(() => undefined);
      await expect.poll(() => activeId(page)).toBe('attendee-fixture-ticket-0-email');
      const top = (await page.locator(EMAIL_FIELD).boundingBox())?.y ?? -1;
      expect(top).toBeGreaterThanOrEqual(await stickyBottom(page));
    });

    test('entries drop as fields are fixed, the summary goes with the last one', async ({ page }) => {
      const submit = await open(page);
      await submit.click();
      const links = page.locator(SUMMARY).getByRole('link');
      await expect(links).toHaveCount(2);
      await page.locator(NAME_FIELD).fill('Ada Orchid');
      await expect(links).toHaveText([EMAIL_ERROR]);
      await expect(page.locator(NAME_FIELD)).toHaveAttribute('aria-invalid', 'false');
      await page.locator(EMAIL_FIELD).fill('not-an-email');
      await expect(links).toHaveText([EMAIL_ERROR]);
      await page.locator(EMAIL_FIELD).fill('ada@example.org');
      await expect(page.locator(SUMMARY)).toHaveCount(0);
      await expect(page.locator(EMAIL_FIELD)).toHaveAttribute('aria-invalid', 'false');
    });

    test('a partly filled form lists only what is missing and focuses the summary', async ({ page }) => {
      const submit = await open(page);
      await page.locator(NAME_FIELD).fill('Ada Orchid');
      await submit.click();
      await expect(page.locator(SUMMARY).getByRole('link')).toHaveText([EMAIL_ERROR]);
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
      await expect(page.locator(NAME_FIELD)).toHaveAttribute('aria-invalid', 'false');
    });

    test('several attendees: every entry is distinguishable and links to its own field', async ({ page }) => {
      const submit = await open(page);
      await page.getByRole('button', { name: 'One more' }).click();
      await submit.click();
      const links = page.locator(SUMMARY).getByRole('link');
      await expect(links).toHaveCount(4);
      const texts = await links.allTextContents();
      expect(new Set(texts).size, `entry texts must be distinct: ${texts.join(' | ')}`).toBe(4);
      // NOS Design ruling: "Attendee {n}, {type}: {existing message}", comma and colon, no em dash.
      expect(texts).toEqual([
        `Attendee 1, Fixture ticket: ${NAME_ERROR}`,
        `Attendee 1, Fixture ticket: ${EMAIL_ERROR}`,
        `Attendee 2, Fixture ticket: ${NAME_ERROR}`,
        `Attendee 2, Fixture ticket: ${EMAIL_ERROR}`,
      ]);
      await links.nth(2).click();
      await expect.poll(() => activeId(page)).toBe('attendee-fixture-ticket-1-name');
    });

    test('the summary sits within the first screen after a failed submit', async ({ page }) => {
      const submit = await open(page);
      await submit.click();
      await expect(page.locator(SUMMARY)).toBeVisible();
      await expect
        .poll(async () => {
          const box = await page.locator(SUMMARY).boundingBox();
          return box !== null && box.y >= 0 && box.y + box.height <= vp.height;
        })
        .toBe(true);
    });

    test('a fixed field is gone from the summary when submit is pressed again', async ({ page }) => {
      const submit = await open(page);
      await submit.click();
      await page.locator(NAME_FIELD).fill('Ada Orchid');
      await submit.click();
      await expect(page.locator(SUMMARY).getByRole('link')).toHaveText([EMAIL_ERROR]);
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
    });

    test('day product: the day alert joins the summary, shown once, and clears on choosing', async ({ page }) => {
      const submit = await open(page, '?type=day');
      await submit.click();
      const summary = page.locator(SUMMARY);
      await expect(summary).toBeVisible();
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
      await expect(summary.getByRole('link')).toHaveText([DAY_ERROR, NAME_ERROR, EMAIL_ERROR]);
      // r45: the picker keeps its own inline alert, exactly one of it.
      await expect(page.locator('fieldset.nk-days [role="alert"]')).toHaveCount(1);
      await summary.getByRole('link', { name: DAY_ERROR }).click();
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.closest('fieldset.nk-days') !== null))
        .toBe(true);
      await page.locator('fieldset.nk-days label').first().click();
      await expect(summary.getByRole('link')).toHaveText([NAME_ERROR, EMAIL_ERROR]);
      await expect(page.locator('fieldset.nk-days [role="alert"]')).toHaveCount(0);
    });

    test('a server refusal surfaces in the same focused summary container', async ({ page }) => {
      await page.route('**/api/tickets/checkout', (route) =>
        route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Test refusal from the server.' }) }),
      );
      const submit = await open(page);
      await page.locator(NAME_FIELD).fill('Ada Orchid');
      await page.locator(EMAIL_FIELD).fill('ada@example.org');
      await submit.click();
      await expect(page.locator(SUMMARY)).toContainText('Test refusal from the server.');
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
    });

    test('axe: the failed submit adds no violation the pristine page did not have', async ({ page }) => {
      const submit = await open(page);
      await page.addScriptTag({ path: require.resolve('axe-core') });
      const scan = () =>
        page.evaluate(async (): Promise<string[]> => {
          // @ts-expect-error axe is injected by addScriptTag
          const result = await window.axe.run(document, { resultTypes: ['violations'] });
          return result.violations.flatMap((v: { id: string; nodes: { target: unknown[] }[] }) =>
            v.nodes.map((n) => `${v.id} ${JSON.stringify(n.target)}`),
          );
        });
      const before = new Set(await scan());
      await submit.click();
      await expect(page.locator(SUMMARY)).toBeVisible(); // a scan with no summary proves nothing
      const added = (await scan()).filter((key) => !before.has(key));
      expect(added, `new axe violations: ${added.join('; ')}`).toEqual([]);
    });
  });
}

test('SAOC host does not render the checkout: /tickets/* redirects to the NOS origin', async ({ request }) => {
  const res = await request.get('/tickets/weekend-pass', { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers().location ?? '').toMatch(/\/tickets\/weekend-pass$/);
});

test('buy hint: zero quantity still focuses the hint, no summary (unchanged behaviour)', async ({ page }) => {
  const submit = await open(page);
  await page.locator('#ticket-quantity').fill('0');
  await submit.click();
  await expect(page.locator('[data-buy-hint]')).toBeFocused();
  await expect(page.locator(SUMMARY)).toHaveCount(0);
});

test('live NOS /tickets/<slug>: empty submit focuses the summary', async ({ page, baseURL }) => {
  const slug = process.env.E2E_TICKET_SLUG;
  test.skip(!slug, 'needs a Sanity fixture replay with an on-sale ticket; set E2E_TICKET_SLUG');
  await page.goto(`${nosBase(baseURL!)}/tickets/${slug}`);
  const submit = page.getByRole('button', { name: SUBMIT });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
  await expect
    .poll(async () => ((await page.locator(SUMMARY).boundingBox())?.y ?? -1) - (await stickyBottom(page)))
    .toBeGreaterThanOrEqual(0);
});
