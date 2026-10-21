/**
 * The only home of the newsletter strings (mission footer-newsletter-subscribe). Entries marked
 * PENDING-COMMITTEE-COPY are placeholders awaiting committee wording and are registered in
 * docs/newsletter-subscribe.md under "Pending committee copy". The existing footer blurb, label,
 * placeholder and "Subscribe" button text live in the footers and are not touched here.
 */
export const NEWSLETTER_COPY = {
  invalidEmail: 'Enter a valid email address.',
  genericError: 'Something went wrong. Please try again.',
  rateLimited: 'Too many attempts. Please try again later.',
  success: "You're subscribed.", // PENDING-COMMITTEE-COPY
  unsubscribeHeading: 'Unsubscribe',
  unsubscribeConfirm: 'Confirm unsubscribe',
  unsubscribeDone: 'You have been unsubscribed.', // PENDING-COMMITTEE-COPY
  unsubscribeInvalid: 'This unsubscribe link is not valid.',
} as const;
