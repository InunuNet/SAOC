// =============================================================
// SAOC — registration-forms e2e golden (copy to e2e/registration-forms.spec.ts when @dev starts).
// Written by the architect; @dev never edits it. The real TicketPurchaseForm is rendered by the
// fixture route /ticket-fixtures/buy (TICKET_FIXTURES=1). `?type=registration` renders ONE static
// flagged ticket type { slug: 'saoc-symposium', name: 'Fixture symposium', requiresRegistration: true }
// (a real slug, so the locked Attending value resolves). The default fixture (no query) is the
// non-registration control. The checkout POST is route-mocked: no payment, no Ozow call.
//
// Contract the dev must provide:
// - quantity stepper unchanged, accessible names "One fewer" / "One more" (default quantity 1);
// - one registration form per ticket, each a role=group named "Attendee {n}", with field ids
//   `registration-{n}-{key}` (keys in goldens/registration-fields.json);
// - on forms 2 and later two checkboxes labelled "Same as above": #registration-{n}-same-contact
//   (hides mobile, country, province) and #registration-{n}-same-membership (hides societies);
//   none on form 1;
// - society checkboxes in a group named by the society label inside the attendee group;
// - Attending is shown and locked (disabled select), pre-selected from the ticket slug;
// - submit "Continue to payment", summary `#checkout-error-summary` (checkout-error-summary pattern).
// =============================================================
import { expect, test, type Locator, type Page } from '@playwright/test';

const FIXTURE = '/ticket-fixtures/buy';
const SUBMIT = 'Continue to payment';
const MORE = 'One more';
const SOCIETY_LABEL = 'To which Society do you belong to?';
const ATTENDING = 'SAOC Symposium Normal Ticket';

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

const form = (page: Page, n: number): Locator => page.getByRole('group', { name: `Attendee ${n}`, exact: true });
const field = (page: Page, n: number, key: string): Locator => page.locator(`#registration-${n}-${key}`);

async function setQuantity(page: Page, quantity: number) {
  for (let i = 1; i < quantity; i += 1) await page.getByRole('button', { name: MORE }).click();
}

interface FillOptions {
  /** do not fill mobile, country and province (the contact section was ticked or is left empty on purpose) */
  skipContact?: boolean;
  skipMembership?: boolean;
  skipJudgeDate?: boolean;
}

async function fillAttendee(page: Page, n: number, opts: FillOptions = {}) {
  await field(page, n, 'title').selectOption('Ms');
  await field(page, n, 'firstName').fill(`Test${n}`);
  await field(page, n, 'surname').fill('Person');
  await field(page, n, 'preferredName').fill(`T${n}`);
  await field(page, n, 'email').fill(`person${n}@example.invalid`);
  if (!opts.skipContact) {
    await field(page, n, 'mobile').fill('+27 11 000 0000');
    await field(page, n, 'country').selectOption('South Africa');
    await field(page, n, 'province').selectOption('Western Cape');
  }
  if (!opts.skipMembership) {
    await form(page, n).getByRole('group', { name: SOCIETY_LABEL }).getByLabel('Cape Orchid Society').check();
  }
  await field(page, n, 'judgeAccredited').selectOption('No');
  await field(page, n, 'judgeOrganisation').selectOption('Not applicable');
  await field(page, n, 'judgeAvailable').selectOption('Not applicable');
  if (!opts.skipJudgeDate) await field(page, n, 'judgeDate').selectOption('Not applicable');
  await field(page, n, 'judgeCommunication').selectOption('No');
  await field(page, n, 'judgeForum').selectOption('No');
  await field(page, n, 'dietary').selectOption('None');
}

test.describe('registration form, flagged ticket', () => {
  test.beforeEach(async ({ page }) => open(page, '?type=registration'));

  test('quantity 1 shows one full attendee form, no Same as above, no separate name and email rows', async ({ page }) => {
    await expect(form(page, 1)).toBeVisible();
    await expect(form(page, 2)).toHaveCount(0);
    await expect(page.getByLabel('Same as above')).toHaveCount(0);
    await expect(page.locator('[id^="attendee-"][id$="-name"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: MORE })).toBeVisible();
  });

  test('every sheet section and field is present with corrected labels, sheet options and the locked Attending', async ({ page }) => {
    const f = form(page, 1);
    for (const heading of [/personal information/i, /membership/i, /national show booking options/i, /judges events/i, /dietary requirements/i]) {
      await expect(f.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expect(f.getByRole('heading', { name: /traveling companion/i })).toHaveCount(0);
    for (const label of [
      'First Name (as per your identity document or passport)',
      'Surname (as per your identity document or passport)',
      'Mobile Number (include country code)',
      'Are you an accredited Orchid Judge',
      'With which Orchid Organisation',
      'Will you be available as a Show Judge at the Show',
      'Which date would you be available?',
      'Will you be attending the Judges Communication?',
      'Will you be attending the Judges Forum?',
    ]) {
      await expect(f.getByLabel(label)).toBeVisible();
    }
    await expect(f.getByRole('group', { name: SOCIETY_LABEL }).getByLabel('Independent Member')).toBeVisible();
    const options = async (key: string) =>
      (await field(page, 1, key).locator('option').allTextContents()).map((t) => t.trim()).filter((t) => t && !/^(select|choose)/i.test(t));
    expect(await options('dietary')).toEqual(['None', 'Vegetarian', 'Halaal']);
    expect(await options('judgeAccredited')).toEqual(['Yes', 'No', 'Not applicable']);
    expect(await options('judgeOrganisation')).toEqual(['SAOC', 'AOS', 'Not applicable']);
    expect(await options('judgeDate')).toEqual(['22-Sep', '23-Sep', '22 & 23 Sept', 'None', 'Not applicable']);
    await expect(field(page, 1, 'attending')).toBeDisabled();
    await expect(field(page, 1, 'attending')).toHaveValue(ATTENDING);
  });

  test('province appears only for South Africa', async ({ page }) => {
    await expect(field(page, 1, 'province')).toBeVisible();
    await field(page, 1, 'country').selectOption('Australia');
    await expect(field(page, 1, 'province')).toHaveCount(0);
  });

  test('quantity 3 gives three attendee forms; Same as above appears on forms 2 and 3 only', async ({ page }) => {
    await setQuantity(page, 3);
    for (const n of [1, 2, 3]) await expect(form(page, n)).toBeVisible();
    await expect(form(page, 4)).toHaveCount(0);
    await expect(form(page, 1).getByLabel('Same as above')).toHaveCount(0);
    for (const n of [2, 3]) {
      await expect(page.locator(`#registration-${n}-same-contact`)).toBeVisible();
      await expect(page.locator(`#registration-${n}-same-membership`)).toBeVisible();
    }
  });

  test('ticking Same as above hides the section; unticking shows it again, empty', async ({ page }) => {
    await setQuantity(page, 2);
    await field(page, 2, 'mobile').fill('+27 11 000 0001');
    await page.locator('#registration-2-same-contact').check();
    for (const key of ['mobile', 'country', 'province']) await expect(field(page, 2, key)).toBeHidden();
    await expect(field(page, 2, 'firstName')).toBeVisible(); // per-person fields never hide
    await expect(field(page, 2, 'email')).toBeVisible();
    await expect(field(page, 2, 'dietary')).toBeVisible();
    await expect(field(page, 2, 'judgeAccredited')).toBeVisible();
    await page.locator('#registration-2-same-membership').check();
    await expect(form(page, 2).getByRole('group', { name: SOCIETY_LABEL })).toBeHidden();
    await page.locator('#registration-2-same-contact').uncheck();
    await expect(field(page, 2, 'mobile')).toBeVisible();
    await expect(field(page, 2, 'mobile')).toHaveValue('');
    await expect(field(page, 2, 'country')).toHaveValue('');
  });

  test('an empty submit is blocked: summary shown, no checkout POST', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeFocused();
    expect(bodies).toHaveLength(0);
  });

  test('a missing Judges Events answer blocks the submit', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillAttendee(page, 1, { skipJudgeDate: true });
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  test('quantity 1 valid: one line item with a full registration, names derived, Attending filled', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillAttendee(page, 1);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const items = bodies[0].lineItems;
    expect(items).toHaveLength(1);
    const reg = items[0].registration as Record<string, unknown>;
    expect(items[0].ticketType).toBe('saoc-symposium');
    expect(items[0].attendeeName).toBe('Test1 Person');
    expect(items[0].attendeeEmail).toBe('person1@example.invalid');
    expect(reg.attending).toBe(ATTENDING);
    expect(reg.sameAsAttendee1).toEqual([]);
    for (const key of ['judgeAccredited', 'judgeOrganisation', 'judgeAvailable', 'judgeDate', 'judgeCommunication', 'judgeForum', 'dietary']) {
      expect(typeof reg[key]).toBe('string');
    }
  });

  test('quantity 3 with Same as above ticked posts three full registrations', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await setQuantity(page, 3);
    await fillAttendee(page, 1);
    for (const n of [2, 3]) {
      await fillAttendee(page, n, { skipContact: true, skipMembership: true });
      await page.locator(`#registration-${n}-same-contact`).check();
      await page.locator(`#registration-${n}-same-membership`).check();
    }
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const items = bodies[0].lineItems;
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.ticketType)).toEqual(['saoc-symposium', 'saoc-symposium', 'saoc-symposium']);
    expect(items.map((i) => i.attendeeEmail)).toEqual(['person1@example.invalid', 'person2@example.invalid', 'person3@example.invalid']);
    const regs = items.map((i) => i.registration as Record<string, unknown>);
    expect(regs.map((r) => r.attendeeNumber)).toEqual([1, 2, 3]);
    expect(regs[0].sameAsAttendee1).toEqual([]);
    for (const r of [regs[1], regs[2]]) {
      expect(r.sameAsAttendee1).toEqual(['contact', 'membership']);
      for (const key of ['mobile', 'country', 'province', 'societies']) expect(r[key]).toEqual(regs[0][key]);
    }
  });

  test('a section left unticked and empty on attendee 3 blocks the submit', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await setQuantity(page, 3);
    await fillAttendee(page, 1);
    await fillAttendee(page, 2, { skipContact: true, skipMembership: true });
    await page.locator('#registration-2-same-contact').check();
    await page.locator('#registration-2-same-membership').check();
    await fillAttendee(page, 3, { skipContact: true, skipMembership: true });
    await page.locator('#registration-3-same-membership').check(); // contact left unticked and empty
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeVisible();
    expect(bodies).toHaveLength(0);
  });
});

test.describe('registration form, non-registration ticket unchanged', () => {
  test('the default fixture has no registration UI and posts no registration key', async ({ page }) => {
    await open(page);
    const bodies = await captureCheckout(page);
    // Today's UI: the quantity stepper (accessible names "One fewer"/"One more") and the single default
    // attendee row are the only person form. No registration form, no Same as above.
    await expect(page.getByRole('button', { name: MORE })).toBeVisible();
    await expect(form(page, 1)).toHaveCount(0);
    await expect(page.getByLabel('Same as above')).toHaveCount(0);
    await expect(page.locator('[id^="attendee-fixture-ticket-"][id$="-name"]')).toHaveCount(1);
    await page.locator('#attendee-fixture-ticket-0-name').fill('Test Person');
    await page.locator('#attendee-fixture-ticket-0-email').fill('person@example.invalid');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].lineItems).toHaveLength(1);
    expect(Object.keys(bodies[0].lineItems[0]).sort()).toEqual(['attendeeEmail', 'attendeeName', 'ticketType']);
  });
});
