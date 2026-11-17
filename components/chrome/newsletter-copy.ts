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
  // No golden string exists for the keys below (functional admin and form chrome); see
  // docs/newsletter-subscribe.md "Copy gaps".
  honeypotLabel: 'Leave this field empty',
  adminHeading: 'Newsletter subscribers',
  adminDownloadCsv: 'Export subscribed',
  adminColumnEmail: 'Email',
  adminColumnSource: 'Signed up via',
  adminColumnStatus: 'Status',
  adminColumnSubscribed: 'Subscribed',
  adminCountSubscribed: 'subscribed',
  adminCountUnsubscribed: 'unsubscribed',
  adminNavLabel: 'Subscribers',
  adminSourceSaoc: 'SAOC',
  adminSourceNos: 'National Orchid Show',
  topicLabelSaoc: 'South African Orchid Council',
  topicLabelNos: 'The National Orchid Show',
  // Mission newsletter-topics-unsub: strings supplied verbatim by Brad, SAOC rulings and NOS
  // Design rulings (goldens/copy.json is the machine-checked set).
  adminColumnLists: 'Lists',
  adminFilterLists: 'Lists',
  adminStatusUnsubscribed: 'Unsubscribed',
  adminUnsubscribeRow: 'Unsubscribe…',
  adminUnsubscribeButton: 'Unsubscribe',
  adminConfirmCancel: 'Cancel',
  adminConfirmPrompt: 'Unsubscribe {email} from:',
  adminConfirmLegend: 'Lists',
  adminRowUnsubscribedStatus: 'Unsubscribed',
  adminExportHint: 'Exports include subscribed addresses only.',
  prefsHeading: 'Newsletter preferences',
  prefsSave: 'Save preferences',
  prefsSaved: 'Your preferences have been saved.',
  prefsAllUnsubscribedState: 'You are not subscribed to any lists.',
  prefsTokenError: 'This link is invalid or has expired.',
  prefsContactLink: 'Contact us',
  prefsSubscribeAgain: 'Subscribe again',
  unsubscribeAll: 'Unsubscribe from everything',
  unsubPageHeading: 'Unsubscribe',
  unsubPageIntroNos: 'Enter your email address to stop receiving The National Orchid Show newsletter.',
  unsubPageIntroSaoc: 'Enter your email address to stop receiving the South African Orchid Council newsletter.',
  unsubPageEmailLabel: 'Email address',
  unsubPageButton: 'Unsubscribe',
  unsubPageResult: 'If that address was subscribed, it has been removed.',
  unsubPageAnother: 'Unsubscribe another address',
  unsubPageFootnote: 'To choose which newsletters you receive, use the link at the bottom of any newsletter email.',
  footerUnsubscribe: 'Unsubscribe',
} as const;
