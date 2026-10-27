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

/**
 * Bottom edge of the whole sticky stack (test bar, header, sub-nav). It chains: start from the
 * fixed/sticky elements pinned at the top edge, then keep adding any fixed/sticky element whose top
 * is within 1px of the stack bottom so far (the NOS header is pinned at 48 under the bar, not at 0).
 */
const stickyBottom = (page: Page) =>
  page.evaluate(() => {
    const pinned = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.width > window.innerWidth * 0.5);
    let bottom = 0;
    for (let grew = true; grew; ) {
      grew = false;
      for (const r of pinned) {
        if (r.top <= bottom + 1 && r.bottom > bottom) {
          bottom = r.bottom;
          grew = true;
        }
      }
    }
    return bottom;
  });

// Measured on the live NOS /tickets/vip (dev, 2026-10-28): 1280 = bar 48 + sticky header to 145;
// 390 = bar 44, the header is position:relative and scrolls away.
const LIVE_STACK_BOTTOM: Record<string, number> = { '1280': 145, '390': 44 };

const CLEARANCE = 8; // NOS Design: the summary top sits at least 8px below the sticky stack

/** NOS Design gate: top >= sticky bottom + 8 and bottom <= viewport height. */
async function expectSummaryClear(page: Page, viewportHeight: number) {
  await expect
    .poll(async () => {
      const box = await page.locator(SUMMARY).boundingBox();
      if (box === null) return 'missing';
      const stack = await stickyBottom(page);
      if (box.y < stack + CLEARANCE) return `top ${box.y} under stack ${stack}+${CLEARANCE}`;
      if (box.y + box.height > viewportHeight) return `bottom ${box.y + box.height} past ${viewportHeight}`;
      return 'ok';
    })
    .toBe('ok');
}

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

    for (const attendees of [1, 2, 3]) {
      test(`${attendees} attendee(s): the focused summary clears the sticky stack and fits the viewport`, async ({ page }) => {
        const submit = await open(page);
        for (let i = 1; i < attendees; i += 1) await page.getByRole('button', { name: 'One more' }).click();
        await pinStickyStack(page); // after the stepper clicks: the pinned bar would cover the stepper
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await submit.click();
        await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
        await expect(page.locator(SUMMARY).getByRole('link')).toHaveCount(attendees * 2);
        await expectSummaryClear(page, vp.height);
      });
    }

    test('a re-submit with fewer errors refocuses the summary and nothing jumps above it', async ({ page }) => {
      const submit = await open(page);
      await page.getByRole('button', { name: 'One more' }).click();
      await pinStickyStack(page); // after the stepper click: the pinned bar would cover the stepper
      await submit.click();
      await expect(page.locator(SUMMARY).getByRole('link')).toHaveCount(4);
      await page.locator('#attendee-fixture-ticket-0-name').fill('Ada Orchid');
      await page.locator('#attendee-fixture-ticket-0-email').fill('ada@example.org');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await submit.click();
      await expect(page.locator(SUMMARY).getByRole('link')).toHaveCount(2);
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
      await expectSummaryClear(page, vp.height);
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

// The real NOS chrome (TESTING ONLY bar + header) is the stack that matters. Needs a Sanity replay
// containing an on-sale ticket. The measured stack height is attached to the report per viewport so
// spec.md can record it; the pinned 145px bar in the fixture tests stays as the worst-case control.
for (const vp of VIEWPORTS) {
  for (const attendees of [1, 3]) {
    test(`live NOS /tickets/<slug> at ${vp.label}, ${attendees} attendee(s): real sticky stack clearance`, async ({ page, baseURL }) => {
      const slug = process.env.E2E_TICKET_SLUG;
      test.skip(!slug, 'needs a Sanity fixture replay with an on-sale ticket; set E2E_TICKET_SLUG');
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${nosBase(baseURL!)}/tickets/${slug}`);
      const submit = page.getByRole('button', { name: SUBMIT });
      await expect(submit).toBeEnabled({ timeout: 45_000 });
      for (let i = 1; i < attendees; i += 1) await page.getByRole('button', { name: 'One more' }).click();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await submit.click();
      await expect.poll(() => activeId(page)).toBe('checkout-error-summary');
      const stack = await stickyBottom(page);
      test.info().annotations.push({ type: 'sticky-stack-bottom', description: String(stack) });
      expect(stack, 'stickyBottom() must see the whole real stack').toBeCloseTo(LIVE_STACK_BOTTOM[vp.label], 0);
      await expectSummaryClear(page, vp.height);
    });
  }
}
