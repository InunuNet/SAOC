// Public-endpoint hardening F6 (part): every public form that sends an acknowledgement accepts
// exactly one email address. Lists, separators, angle brackets and line breaks are refused with
// each form's existing invalid-email response; ordinary addresses still pass.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/public-endpoint-hardening/check-single-email-address.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateContactInput } from '../../../lib/contact-input.ts';
import { normaliseNewsletterEmail } from '../../../lib/newsletter.ts';
import { validateSponsorEnquiry } from '../../../lib/sponsor-enquiry.ts';
import { validateSupporterRegistrationInput } from '../../../lib/supporter-registrations.ts';
import { validateVendorApplyFormClientSide } from '../../../lib/vendor-apply-form-validation.ts';
import { EMAIL_PATTERN as VENDOR_SUBMISSION_EMAIL_PATTERN } from '../../../lib/vendor-submissions.ts';

const ATTACKS = [
  'a@b.co,c@d.co',
  'a@b.co;c@d.co',
  'a@b.co c@d.co',
  'Ann <a@b.co>',
  '<a@b.co>',
  'a@b.co\r\nBcc: c@d.co',
  'a@b.co\nc@d.co',
  '"a,b"@c.co',
  'a,b@c.co',
];
const LEGITIMATE = ['ann@example.co.za', 'first.last+orchids@sub.example.org', "o'brien@example.com"];

const contact = (email) => validateContactInput({ name: 'Ann', email, subject: 'Hi', message: 'Hello' });

test('contact: attack addresses are refused with the existing "Invalid email address." error', () => {
  for (const email of ATTACKS) {
    assert.deepEqual(contact(email), { ok: false, error: 'Invalid email address.' }, email);
  }
});

test('contact: ordinary addresses pass, and name/subject length caps still apply', () => {
  for (const email of LEGITIMATE) assert.equal(contact(email).ok, true, email);
  const longName = validateContactInput({ name: 'n'.repeat(101), email: LEGITIMATE[0], subject: 's', message: 'm' });
  assert.equal(longName.ok, false);
  const longSubject = validateContactInput({ name: 'n', email: LEGITIMATE[0], subject: 's'.repeat(201), message: 'm' });
  assert.equal(longSubject.ok, false);
});

test('newsletter: attack addresses normalise to null, ordinary ones survive', () => {
  for (const email of ATTACKS) assert.equal(normaliseNewsletterEmail(email), null, email);
  assert.equal(normaliseNewsletterEmail(' Ann@Example.co.za '), 'ann@example.co.za');
});

test('sponsors: attack addresses are refused on the email field, ordinary ones pass', () => {
  const base = { contactName: 'Ann', message: 'Hello there', consent: true };
  for (const email of ATTACKS) {
    const result = validateSponsorEnquiry({ ...base, email });
    assert.equal(result.ok, false, email);
    assert.ok(result.fieldErrors.email, email);
  }
  assert.equal(validateSponsorEnquiry({ ...base, email: LEGITIMATE[0] }).ok, true);
});

test('supporter registration: attack addresses are refused, ordinary ones pass', () => {
  const base = { firstName: 'Ann', consentMarketing: true };
  for (const email of ATTACKS) {
    const result = validateSupporterRegistrationInput({ ...base, email });
    assert.equal(result.valid, false, email);
  }
  assert.equal(validateSupporterRegistrationInput({ ...base, email: LEGITIMATE[0] }).valid, true);
});

test('vendor apply form and vendor submissions share the single-address shape', () => {
  const base = {
    businessName: 'Orchids by Ann',
    tradingName: '',
    contactPersonName: 'Ann',
    contactCellPhone: '0821234567',
    vendorCategory: [],
    indicativeBoothCount: '1',
  };
  for (const email of ATTACKS) {
    assert.equal(VENDOR_SUBMISSION_EMAIL_PATTERN.test(email), false, email);
    const errors = validateVendorApplyFormClientSide({ ...base, contactEmail: email });
    assert.ok(errors.includes('contactEmail must be a valid email address'), email);
  }
  for (const email of LEGITIMATE) assert.equal(VENDOR_SUBMISSION_EMAIL_PATTERN.test(email), true, email);
});
