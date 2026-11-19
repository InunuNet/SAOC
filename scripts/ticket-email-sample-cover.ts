/**
 * ticket-email-samples (F3) — the "Questions for Lee-Ann" cover page text: a title, a line saying
 * the samples are made up and nothing was sent, then one line per open question (Q1 to Q9).
 */
export const COVER_TITLE = 'Questions for Lee-Ann';

export const COVER_INTRO = 'These are sample emails and ticket PDFs. Nothing has been sent to anyone. The names, booking references and the amount R100.00 are made up for the samples.';

export const COVER_QUESTIONS: readonly string[] = [
  'Q1. Refund policy, pending legal review: the cancellation and refund paragraph is reproduced exactly in every email, but the Terms say show tickets are non-refundable. Which applies?',
  'Q2. Sunset Cocktails: the copy has no subject line, venue or age restriction. The subject remains [To be confirmed]; the date and time are Thursday, 23 September 2027, 18:30–21:00.',
  'Q3. SAOC Symposium, WOSA Conference and Joint Ticket: the copy leaves out the venue and times on purpose. They show as [To be confirmed].',
  'Q4. Line breaks: in the VIP copy the date and the time are on separate lines, and the sign-off is on two lines (Kind regards, then The National Orchid Show). They are shown the same way here. Please confirm.',
  'Q5. Payment status: which words should appear, for example Paid?',
  'Q6. Parking: the copy says further parking and access instructions will be provided closer to the event. It is shown as written.',
  'Q7. Existing wording kept next to your copy: the emergency numbers and the link for a lost email. Keep or remove?',
  'Q8. Weekend Pass and Joint Ticket: checking the QR code once per day or per event is a door-scanning change that has not been built or tested yet.',
  'Q9. Several tickets in one booking: each ticket has its own booking reference and QR code, so the email repeats the booking details for each ticket.',
];
