// =============================================================
// SAOC — registration-forms e2e golden (copy to e2e/registration-forms.spec.ts when @dev starts).
// Written by the architect; @dev never edits it. The real TicketPurchaseForm is rendered by the
// fixture route /ticket-fixtures/buy (TICKET_FIXTURES=1). @dev adds `?type=registration`: one static
// ticket type { slug: 'fixture-registration-ticket', requiresRegistration: true }. The default fixture
// (no query) is the non-registration control. The checkout POST is route-mocked: no payment, no Ozow.
// Contract ids the dev must provide: field ids `registration-<role>-<key>` (role primary|partner),
// society checkboxes in a group named by the society label, buttons "Add spouse/partner" and
// "Remove spouse/partner", submit "Continue to payment", summary `#checkout-error-summary`.
// =============================================================
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = '/ticket-fixtures/buy';
const SUBMIT = 'Continue to payment';
const ADD = 'Add spouse/partner';
const REMOVE = 'Remove spouse/partner';
const SOCIETY_LABEL = 'To which Society do you belong to?';

async function open(page: Page, query = '') {
  await page.goto(`${FIXTURE}${query}`);
  await expect(page.getByRole('button', { name: SUBMIT })).toBeEnabled({ timeout: 45_000 });
}

/** Captures the checkout POST body and answers with a 500 so nothing proceeds to a gateway. */
async function captureCheckout(page: Page) {
  const bodies: Array<{ lineItems: Array<Record<string, unknown>> }> = [];
  await page.route('**/api/tickets/checkout', async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'stub' }) });
  });
  return bodies;
}

async function fillPerson(page: Page, role: 'primary' | 'partner', n: string) {
  const id = (key: string) => page.locator(`#registration-${role}-${key}`);
  await id('title').selectOption('Ms');
  await id('firstName').fill(`Test${n}`);
  await id('surname').fill('Person');
  await id('preferredName').fill(`T${n}`);
  await id('mobile').fill('+27 11 000 0000');
  await id('email').fill(`person${n}@example.invalid`);
  await id('country').selectOption('South Africa');
  await id('province').selectOption('Western Cape');
  await id('dietary').selectOption('Halaal');
}

const pickSociety = (page: Page, name: string) =>
  page.getByRole('group', { name: SOCIETY_LABEL }).getByLabel(name).check();

test.describe('registration form, flagged ticket', () => {
  test.beforeEach(async ({ page }) => open(page, '?type=registration'));

  test('shows the buyer registration with no quantity stepper and no partner block', async ({ page }) => {
    await expect(page.locator('#registration-primary-firstName')).toBeVisible();
    await expect(page.getByRole('button', { name: ADD })).toBeVisible();
    await expect(page.locator('#registration-partner-firstName')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'One more' })).toHaveCount(0);
  });

  test('every sheet field is present with the corrected labels and the sheet dropdown values', async ({ page }) => {
    await expect(page.getByLabel('First Name (as per your identity document or passport)')).toBeVisible();
    await expect(page.getByLabel('Surname (as per your identity document or passport)')).toBeVisible();
    await expect(page.getByLabel('Mobile Number (include country code)')).toBeVisible();
    await expect(page.getByRole('group', { name: SOCIETY_LABEL }).getByLabel('Independent Member')).toBeVisible();
    const dietary = await page.locator('#registration-primary-dietary option').allTextContents();
    expect(dietary.filter((t) => t.trim() && !/select|choose/i.test(t))).toEqual(['None', 'Vegetarian', 'Halaal']);
  });

  test('province appears only for South Africa', async ({ page }) => {
    await expect(page.locator('#registration-primary-province')).toBeVisible();
    await page.locator('#registration-primary-country').selectOption('Australia');
    await expect(page.locator('#registration-primary-province')).toHaveCount(0);
  });

  test('Add spouse/partner reveals the partner block, Remove hides it again', async ({ page }) => {
    await page.getByRole('button', { name: ADD }).click();
    await expect(page.locator('#registration-partner-firstName')).toBeVisible();
    await expect(page.locator('#registration-partner-dietary')).toBeVisible();
    await expect(page.getByRole('group', { name: SOCIETY_LABEL })).toHaveCount(1); // buyer only
    await page.getByRole('button', { name: REMOVE }).click();
    await expect(page.locator('#registration-partner-firstName')).toHaveCount(0);
    await expect(page.getByRole('button', { name: ADD })).toBeVisible();
  });

  test('an empty submit is blocked: summary shown, no checkout POST', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeFocused();
    expect(bodies).toHaveLength(0);
  });

  test('a valid buyer posts one line item carrying a primary registration', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillPerson(page, 'primary', '1');
    await pickSociety(page, 'Cape Orchid Society');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const items = bodies[0].lineItems;
    expect(items).toHaveLength(1);
    expect(items[0].ticketType).toBe('fixture-registration-ticket');
    expect((items[0].registration as Record<string, unknown>).role).toBe('primary');
    expect(items[0].attendeeName).toBe('Test1 Person');
    expect(items[0].attendeeEmail).toBe('person1@example.invalid');
  });

  test('buyer plus partner posts two line items of the same type, primary then partner', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillPerson(page, 'primary', '1');
    await pickSociety(page, 'None');
    await page.getByRole('button', { name: ADD }).click();
    await fillPerson(page, 'partner', '2');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const items = bodies[0].lineItems;
    expect(items.map((i) => i.ticketType)).toEqual(['fixture-registration-ticket', 'fixture-registration-ticket']);
    expect(items.map((i) => (i.registration as Record<string, unknown>).role)).toEqual(['primary', 'partner']);
    expect((items[1].registration as Record<string, unknown>).societies ?? null).toBeNull();
  });

  test('a half-filled partner blocks the submit', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillPerson(page, 'primary', '1');
    await pickSociety(page, 'None');
    await page.getByRole('button', { name: ADD }).click();
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeVisible();
    expect(bodies).toHaveLength(0);
  });
});

test.describe('registration form, non-registration ticket unchanged', () => {
  test('the default fixture has no registration UI and posts no registration key', async ({ page }) => {
    await open(page);
    const bodies = await captureCheckout(page);
    // Today's UI: the quantity stepper is present (its real accessible names are "One fewer"/"One more")
    // and the single default attendee row is the only person form. No registration form, no partner control.
    await expect(page.getByRole('button', { name: 'One more' })).toBeVisible();
    await expect(page.locator('#registration-primary-firstName')).toHaveCount(0);
    await expect(page.getByRole('button', { name: ADD })).toHaveCount(0);
    await expect(page.locator('[id^="attendee-fixture-ticket-"][id$="-name"]')).toHaveCount(1);
    await page.locator('#attendee-fixture-ticket-0-name').fill('Test Person');
    await page.locator('#attendee-fixture-ticket-0-email').fill('person@example.invalid');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].lineItems).toHaveLength(1);
    expect(Object.keys(bodies[0].lineItems[0]).sort()).toEqual(['attendeeEmail', 'attendeeName', 'ticketType']);
  });
});
