/**
 * Sponsor enquiry copy gaps (mission sponsor-enquiry-form, spec.md section 3). Every string here
 * has no Council source yet and is a placeholder: committee wording is owed (docs/rules/no-invention.md,
 * docs/sponsor-enquiry-form.md "Copy gaps"). Functional labels render in both modes; unsourced prose
 * renders on the beta preview only, marked.
 */

// PENDING-COMMITTEE-COPY (G1): the section heading. A functional label, rendered always.
export const ENQUIRY_HEADING = 'Sponsorship enquiry';

// PENDING-COMMITTEE-COPY (G2): the introduction under the heading. No wording exists, so the
// beta preview shows this bracketed stand-in, marked, and a public build omits the line entirely.
export const ENQUIRY_INTRO_PLACEHOLDER = '[Introduction to be supplied by the committee]';

// PENDING-COMMITTEE-COPY (G3): the POPIA consent label and its privacy link text. Functional,
// so rendered in both modes; the beta preview adds the marker. Needs committee approval.
export const ENQUIRY_CONSENT_LABEL =
  'I agree to SAOC using these details to respond to my enquiry.';
export const ENQUIRY_PRIVACY_LINK_TEXT = 'Privacy policy';

// PENDING-COMMITTEE-COPY (G4): labels with no existing equivalent on the site. Functional.
export const ENQUIRY_LABELS = {
  organisation: 'Organisation or company (optional)',
  phone: 'Phone number (optional)',
  level: 'Sponsorship level (optional)',
} as const;

// Reused verbatim from existing site copy: ContactForm, VendorContactFieldset, SubmitEventForm (the empty level option, 'Select type…', is literal in the form).
export const ENQUIRY_REUSED = {
  name: 'Name',
  email: 'Email address',
  website: 'Website (optional)',
  message: 'Message',
  submit: 'Send enquiry',
  submitting: 'Sending…',
  successHeading: 'Thank you',
  successBody: "Your message has reached the SAOC secretariat. We'll be in touch soon.",
  genericError: 'Something went wrong. Please try again.',
  networkError: 'Network error. Please check your connection and try again.',
  honeypotLabel: 'Leave this field empty',
} as const;

// PENDING-COMMITTEE-COPY (G5): the acknowledgement and admin email wording. An email cannot be
// beta-only, so these are always sent. The two fixed subjects live in the senders and carry no user text.
export const ENQUIRY_ACK_HEADING = 'Sponsorship enquiry received';
export const ENQUIRY_ACK_BODY = 'Thank you for your interest in sponsoring. We have received your enquiry.';
export const ENQUIRY_ACK_FOLLOW_UP = 'Our team will review it and be in touch.';
export const ENQUIRY_ADMIN_HEADING = 'New Sponsorship Enquiry';
