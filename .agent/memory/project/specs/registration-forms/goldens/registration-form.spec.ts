// =============================================================
// SAOC - registration-forms e2e golden, REWORKED 16 Nov 2026 after Brad's review of PR #195
// (copy to e2e/registration-forms.spec.ts when @dev starts). Written by the architect; @dev never edits it.
// The real TicketPurchaseForm is rendered by the fixture route /ticket-fixtures/buy (TICKET_FIXTURES=1).
// `?type=registration` renders ONE static flagged ticket type
// { slug: 'saoc-symposium', name: 'Fixture symposium', requiresRegistration: true } (already in the PR).
// The default fixture (no query) is the non-registration control. The checkout POST is route-mocked:
// no payment, no Ozow call.
//
// Contract the dev must provide (all ids are `registration-{n}-{key}`):
// - quantity stepper unchanged ("One fewer" / "One more", default 1); one role=group "Attendee {n}" per ticket;
// - "Same as above" on forms 2 and later: #registration-{n}-same-contact (mobile, country, province) and
//   #registration-{n}-same-membership (the membership control); none on form 1;
// - Attending is NOT rendered at all (no element, no heading); the POST still carries registration.attending;
// - country is a select that defaults to South Africa, so province shows by default; another country hides and clears it;
// - membership is ONE disclosure button #registration-{n}-societies (aria-expanded + aria-controls) whose text is
//   "Select all that apply" when empty, the option name when one is chosen, "N selected" when more. Opening it shows a
//   role=group named "To which Society do you belong to?" of native checkboxes (all 25 options); Escape closes it and
//   returns focus to the button; None excludes every other choice;
// - judge accreditation is ONE select #registration-{n}-judgeAccreditation (No preselected, then one "Yes, with <org>");
//   there is NO judgeOrganisation select and NO judgeDate select any more;
// - for EVERYONE, whatever the accreditation answer (no gating, lead ruling 16 Nov): checkbox
//   #registration-{n}-judgeAvailable "Available as a show judge" (unticked), selects #registration-{n}-judgeCommunication
//   and #registration-{n}-judgeForum (Yes/No, No preselected);
// - only when availability is ticked: role=group "Which date would you be available?" with checkboxes
//   #registration-{n}-judgeDate-22-sep ("22-Sep") and #registration-{n}-judgeDate-23-sep ("23-Sep"); at least one required;
// - dietary select defaults to "None" and has "Other"; the text input #registration-{n}-dietaryOther (label "Other") exists
//   only while Other is selected and is then required;
// - every select has right padding for its chevron (computed padding-right >= 36px, appearance none);
// - validation errors per field as `#registration-{n}-{key}-error` plus the `#checkout-error-summary` pattern;
// - submit "Continue to payment".
// =============================================================
import { expect, test, type Locator, type Page } from '@playwright/test';

const FIXTURE = '/ticket-fixtures/buy';
const SUBMIT = 'Continue to payment';
const MORE = 'One more';
const SOCIETY_LABEL = 'To which Society do you belong to?';
const SOCIETY_PLACEHOLDER = 'Select all that apply';
const DATE_LABEL = 'Which date would you be available?';
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
const societyPanel = (page: Page, n: number): Locator => form(page, n).getByRole('group', { name: SOCIETY_LABEL });

async function setQuantity(page: Page, quantity: number) {
  for (let i = 1; i < quantity; i += 1) await page.getByRole('button', { name: MORE }).click();
}

/** Opens the membership dropdown, ticks the options, closes it with Escape. */
async function chooseSocieties(page: Page, n: number, options: string[]) {
  await field(page, n, 'societies').click();
  for (const option of options) await societyPanel(page, n).getByLabel(option, { exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(societyPanel(page, n)).toBeHidden();
}

async function optionsOf(page: Page, n: number, key: string) {
  return (await field(page, n, key).locator('option').allTextContents()).map((t) => t.trim()).filter((t) => t && !/^(select|choose)/i.test(t));
}

interface FillOptions {
  /** do not fill mobile and province (the contact section was ticked or is left empty on purpose) */
  skipContact?: boolean;
  skipMembership?: boolean;
  email?: string;
  mobile?: string;
}

/** Fills one attendee as a non-judge with every default kept (country South Africa, judge No, dietary None). */
async function fillAttendee(page: Page, n: number, opts: FillOptions = {}) {
  await field(page, n, 'title').selectOption('Ms');
  await field(page, n, 'firstName').fill(`Test${n}`);
  await field(page, n, 'surname').fill('Person');
  await field(page, n, 'preferredName').fill(`T${n}`);
  await field(page, n, 'email').fill(opts.email ?? `person${n}@example.invalid`);
  if (!opts.skipContact) {
    await field(page, n, 'mobile').fill(opts.mobile ?? '+27 11 000 0000');
    await field(page, n, 'province').selectOption('Western Cape');
  }
  if (!opts.skipMembership) await chooseSocieties(page, n, ['Cape Orchid Society']);
}

test.describe('registration form, flagged ticket', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.beforeEach(async ({ page }) => open(page, '?type=registration'));

  test('quantity 1 shows one attendee form, no Same as above, no separate name and email rows', async ({ page }) => {
    await expect(form(page, 1)).toBeVisible();
    await expect(form(page, 2)).toHaveCount(0);
    await expect(page.getByLabel('Same as above')).toHaveCount(0);
    await expect(page.locator('[id^="attendee-"][id$="-name"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: MORE })).toBeVisible();
  });

  test('sections and labels: no booking options field at all, no traveling companion, merged judge controls', async ({ page }) => {
    const f = form(page, 1);
    for (const heading of [/personal information/i, /membership/i, /judges events/i, /dietary requirements/i]) {
      await expect(f.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expect(f.getByRole('heading', { name: /national show booking options/i })).toHaveCount(0);
    await expect(f.getByRole('heading', { name: /traveling companion/i })).toHaveCount(0);
    await expect(field(page, 1, 'attending')).toHaveCount(0); // hidden entirely, not a greyed control
    await expect(f.getByLabel('Please select from the dropdown')).toHaveCount(0);
    for (const label of [
      'First Name (as per your identity document or passport)',
      'Surname (as per your identity document or passport)',
      'Mobile Number (include country code)',
      'Are you an accredited Orchid Judge',
    ]) {
      await expect(f.getByLabel(label)).toBeVisible();
    }
    for (const gone of ['judgeOrganisation', 'judgeDate']) await expect(field(page, 1, gone)).toHaveCount(0);
    await expect(f.getByLabel('With which Orchid Organisation')).toHaveCount(0);
    await expect(f.getByLabel('Will you be available as a Show Judge at the Show')).toHaveCount(0);
  });

  test('country defaults to South Africa with province shown; another country hides and clears province', async ({ page }) => {
    await expect(field(page, 1, 'country')).toHaveValue('South Africa');
    await expect(field(page, 1, 'province')).toBeVisible();
    await expect(field(page, 1, 'province')).toHaveValue('');
    await field(page, 1, 'province').selectOption('Gauteng');
    await field(page, 1, 'country').selectOption('Australia');
    await expect(field(page, 1, 'province')).toHaveCount(0);
    await field(page, 1, 'country').selectOption('South Africa');
    await expect(field(page, 1, 'province')).toHaveValue('');
  });

  test('membership is one compact multi-select dropdown, keyboard operable, None excludes the rest', async ({ page }) => {
    const button = field(page, 1, 'societies');
    await expect(button).toHaveText(new RegExp(SOCIETY_PLACEHOLDER, 'i'));
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(societyPanel(page, 1)).toBeHidden(); // closed: the 25 checkboxes take no space
    await expect(form(page, 1).getByRole('checkbox', { name: 'Cape Orchid Society' })).toHaveCount(0);

    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(societyPanel(page, 1)).toBeVisible();
    await expect(societyPanel(page, 1).getByRole('checkbox')).toHaveCount(25);
    await page.keyboard.press('Tab'); // into the panel: first option is None
    await expect(societyPanel(page, 1).getByRole('checkbox', { name: 'None', exact: true })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(societyPanel(page, 1).getByRole('checkbox', { name: 'None', exact: true })).toBeChecked();

    await societyPanel(page, 1).getByLabel('Cape Orchid Society', { exact: true }).check();
    await expect(societyPanel(page, 1).getByRole('checkbox', { name: 'None', exact: true })).not.toBeChecked();
    await societyPanel(page, 1).getByLabel('Overseas visitor', { exact: true }).check(); // no other rule: this mix is allowed
    await expect(societyPanel(page, 1).getByLabel('Cape Orchid Society', { exact: true })).toBeChecked();
    await societyPanel(page, 1).getByRole('checkbox', { name: 'None', exact: true }).check();
    await expect(societyPanel(page, 1).getByLabel('Cape Orchid Society', { exact: true })).not.toBeChecked();
    await expect(societyPanel(page, 1).getByLabel('Overseas visitor', { exact: true })).not.toBeChecked();

    await page.keyboard.press('Escape');
    await expect(societyPanel(page, 1)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveText(/None/);
    await chooseSocieties(page, 1, ['Cape Orchid Society']);
    await expect(button).toHaveText(/Cape Orchid Society/);
    await chooseSocieties(page, 1, ['Natal Orchid Society']);
    await expect(button).toHaveText(/2 selected/);
  });

  test('every select leaves room for its chevron on the right', async ({ page }) => {
    await setQuantity(page, 2);
    const selects = form(page, 1).locator('select');
    expect(await selects.count()).toBeGreaterThanOrEqual(4);
    for (const select of await selects.all()) {
      const style = await select.evaluate((el) => {
        const s = getComputedStyle(el);
        return { padding: parseFloat(s.paddingRight), appearance: s.appearance };
      });
      expect(style.padding).toBeGreaterThanOrEqual(36);
      expect(style.appearance).toBe('none');
    }
  });

  test('compact layout at desktop width: related fields share a row', async ({ page }) => {
    const y = async (loc: Locator) => (await loc.boundingBox())!.y;
    const near = (a: number, b: number) => Math.abs(a - b) <= 6;
    expect(near(await y(field(page, 1, 'title')), await y(field(page, 1, 'firstName')))).toBe(true);
    expect(near(await y(field(page, 1, 'firstName')), await y(field(page, 1, 'surname')))).toBe(true);
    expect(near(await y(field(page, 1, 'preferredName')), await y(field(page, 1, 'email')))).toBe(true);
    expect(near(await y(field(page, 1, 'country')), await y(field(page, 1, 'province')))).toBe(true);
    expect(near(await y(field(page, 1, 'judgeCommunication')), await y(field(page, 1, 'judgeForum')))).toBe(true);
  });

  test('judges: one accreditation dropdown; availability and attendance asked of everyone; dates only when available', async ({ page }) => {
    const accreditation = field(page, 1, 'judgeAccreditation');
    expect(await optionsOf(page, 1, 'judgeAccreditation')).toEqual(['No', 'Yes, with SAOC', 'Yes, with AOS']);
    await expect(accreditation).toHaveValue('No'); // None/No preselected
    // not gated on accreditation: shown while the answer is No
    await expect(field(page, 1, 'judgeAvailable')).toBeVisible();
    await expect(form(page, 1).getByLabel('Available as a show judge')).not.toBeChecked();
    expect(await optionsOf(page, 1, 'judgeCommunication')).toEqual(['Yes', 'No']);
    expect(await optionsOf(page, 1, 'judgeForum')).toEqual(['Yes', 'No']);
    await expect(field(page, 1, 'judgeCommunication')).toHaveValue('No');
    await expect(field(page, 1, 'judgeForum')).toHaveValue('No');
    await expect(form(page, 1).getByRole('group', { name: DATE_LABEL })).toHaveCount(0);

    await accreditation.selectOption('Yes, with AOS');
    for (const key of ['judgeAvailable', 'judgeCommunication', 'judgeForum']) await expect(field(page, 1, key)).toBeVisible();

    await field(page, 1, 'judgeAvailable').check();
    const dates = form(page, 1).getByRole('group', { name: DATE_LABEL });
    await expect(dates).toBeVisible();
    await expect(dates.getByRole('checkbox')).toHaveCount(2);
    await dates.getByLabel('22-Sep', { exact: true }).check();
    await field(page, 1, 'judgeAvailable').uncheck();
    await expect(dates).toHaveCount(0); // hidden when unticked
    await field(page, 1, 'judgeAvailable').check();
    await expect(dates.getByLabel('22-Sep', { exact: true })).not.toBeChecked(); // and cleared

    await accreditation.selectOption('No'); // changing accreditation never touches availability or attendance
    await expect(field(page, 1, 'judgeAvailable')).toBeChecked();
    await field(page, 1, 'judgeForum').selectOption('Yes');
    await accreditation.selectOption('Yes, with SAOC');
    await expect(field(page, 1, 'judgeForum')).toHaveValue('Yes');
  });

  test('dietary: None preselected, free text only when Other is chosen and then required', async ({ page }) => {
    await expect(field(page, 1, 'dietary')).toHaveValue('None');
    expect(await optionsOf(page, 1, 'dietary')).toEqual(['None', 'Vegetarian', 'Halaal', 'Other']);
    await expect(field(page, 1, 'dietaryOther')).toHaveCount(0);
    await field(page, 1, 'dietary').selectOption('Other');
    await expect(field(page, 1, 'dietaryOther')).toBeVisible();
    await expect(form(page, 1).getByLabel('Other', { exact: true })).toBeVisible();
    await expect(field(page, 1, 'dietaryOther')).toHaveAttribute('maxlength', '100');
    await field(page, 1, 'dietaryOther').fill('No shellfish');
    await field(page, 1, 'dietary').selectOption('Vegetarian');
    await expect(field(page, 1, 'dietaryOther')).toHaveCount(0);
    await field(page, 1, 'dietary').selectOption('Other');
    await expect(field(page, 1, 'dietaryOther')).toHaveValue(''); // cleared when hidden
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

  test('ticking Same as above hides the section; unticking shows it again with defaults', async ({ page }) => {
    await setQuantity(page, 2);
    await field(page, 2, 'mobile').fill('+27 11 000 0001');
    await page.locator('#registration-2-same-contact').check();
    for (const key of ['mobile', 'country', 'province']) await expect(field(page, 2, key)).toBeHidden();
    await expect(field(page, 2, 'firstName')).toBeVisible(); // per-person fields never hide
    await expect(field(page, 2, 'email')).toBeVisible();
    await expect(field(page, 2, 'dietary')).toBeVisible();
    await expect(field(page, 2, 'judgeAccreditation')).toBeVisible();
    await page.locator('#registration-2-same-membership').check();
    await expect(field(page, 2, 'societies')).toBeHidden();
    await page.locator('#registration-2-same-contact').uncheck();
    await expect(field(page, 2, 'mobile')).toBeVisible();
    await expect(field(page, 2, 'mobile')).toHaveValue('');
    await expect(field(page, 2, 'country')).toHaveValue('South Africa');
    await expect(field(page, 2, 'province')).toHaveValue('');
  });

  test('an empty submit is blocked: summary shown and focused, no checkout POST', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeFocused();
    expect(bodies).toHaveLength(0);
  });

  test('email and mobile formats are validated in the browser before any POST', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillAttendee(page, 1, { email: 'not-an-email', mobile: '0820000' });
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeVisible();
    await expect(page.locator('#registration-1-email-error')).toContainText(/valid email/i);
    await expect(page.locator('#registration-1-mobile-error')).toBeVisible();
    expect(bodies).toHaveLength(0);
    await field(page, 1, 'email').fill('a@b.c'); // one-letter top level domain
    await field(page, 1, 'mobile').fill('27820000000'); // no plus or 00
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#registration-1-email-error')).toBeVisible();
    await expect(page.locator('#registration-1-mobile-error')).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  test('accredited and available with no date ticked blocks the submit; Other with no text blocks it', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillAttendee(page, 1);
    await field(page, 1, 'judgeAccreditation').selectOption('Yes, with SAOC');
    await field(page, 1, 'judgeAvailable').check();
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#checkout-error-summary')).toBeVisible();
    expect(bodies).toHaveLength(0);
    await field(page, 1, 'judgeAvailable').uncheck();
    await field(page, 1, 'dietary').selectOption('Other');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect(page.locator('#registration-1-dietaryOther-error')).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  test('quantity 1 valid with every default kept: judge answers No, Not applicable, No, None, No, No, Attending derived and posted', async ({ page }) => {
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
    expect(reg.country).toBe('South Africa');
    expect(reg.sameAsAttendee1).toEqual([]);
    expect(reg).toMatchObject({
      judgeAccredited: 'No',
      judgeOrganisation: 'Not applicable',
      judgeAvailable: 'No',
      judgeDate: 'None',
      judgeCommunication: 'No',
      judgeForum: 'No',
      dietary: 'None',
      dietaryOther: null,
    });
  });

  test('an accredited judge available on both dates and an Other dietary are posted in the stored shape', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillAttendee(page, 1, { mobile: '082 000 0000' });
    await field(page, 1, 'judgeAccreditation').selectOption('Yes, with AOS');
    await field(page, 1, 'judgeAvailable').check();
    const dates = form(page, 1).getByRole('group', { name: DATE_LABEL });
    await dates.getByLabel('22-Sep', { exact: true }).check();
    await dates.getByLabel('23-Sep', { exact: true }).check();
    await field(page, 1, 'judgeForum').selectOption('Yes');
    await field(page, 1, 'dietary').selectOption('Other');
    await field(page, 1, 'dietaryOther').fill('  No shellfish  ');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const reg = bodies[0].lineItems[0].registration as Record<string, unknown>;
    expect(reg).toMatchObject({
      judgeAccredited: 'Yes',
      judgeOrganisation: 'AOS',
      judgeAvailable: 'Yes',
      judgeDate: '22 & 23 Sept',
      judgeCommunication: 'No',
      judgeForum: 'Yes',
      dietary: 'Other',
      mobile: '082 000 0000',
    });
    expect((reg.dietaryOther as string).trim()).toBe('No shellfish');
  });

  test('a person who is not an accredited judge can still be available and attend the Forum', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillAttendee(page, 1);
    await field(page, 1, 'judgeAvailable').check();
    await form(page, 1).getByRole('group', { name: DATE_LABEL }).getByLabel('23-Sep', { exact: true }).check();
    await field(page, 1, 'judgeForum').selectOption('Yes');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const reg = bodies[0].lineItems[0].registration as Record<string, unknown>;
    expect(reg).toMatchObject({ judgeAccredited: 'No', judgeOrganisation: 'Not applicable', judgeAvailable: 'Yes', judgeDate: '23-Sep', judgeCommunication: 'No', judgeForum: 'Yes' });
  });

  test('an accredited judge not available is posted with availability No and date None; a single date is posted as is', async ({ page }) => {
    const bodies = await captureCheckout(page);
    await fillAttendee(page, 1, { mobile: '+44 20 7946 0000' });
    await field(page, 1, 'country').selectOption('United Kingdom');
    await field(page, 1, 'judgeAccreditation').selectOption('Yes, with SAOC');
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(1);
    let reg = bodies[0].lineItems[0].registration as Record<string, unknown>;
    expect(reg).toMatchObject({ judgeAccredited: 'Yes', judgeOrganisation: 'SAOC', judgeAvailable: 'No', judgeDate: 'None', country: 'United Kingdom', province: null });
    await expect(page.getByRole('button', { name: SUBMIT })).toBeEnabled();
    await field(page, 1, 'judgeAvailable').check();
    await form(page, 1).getByRole('group', { name: DATE_LABEL }).getByLabel('23-Sep', { exact: true }).check();
    await page.getByRole('button', { name: SUBMIT }).click();
    await expect.poll(() => bodies.length).toBe(2);
    reg = bodies[1].lineItems[0].registration as Record<string, unknown>;
    expect(reg).toMatchObject({ judgeAvailable: 'Yes', judgeDate: '23-Sep' });
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
      expect(r.attending).toBe(ATTENDING);
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
