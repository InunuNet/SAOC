# User-facing strings -- golden (no invention)

All new strings live in components/chrome/newsletter-copy.ts as `NEWSLETTER_COPY`. Existing footer copy (blurb, label, placeholder,
"Subscribe") is NOT touched. Two classes only:

| key | string | class |
|---|---|---|
| invalidEmail | Enter a valid email address. | functional |
| genericError | Something went wrong. Please try again. | functional |
| rateLimited | Too many attempts. Please try again later. | functional |
| success | You're subscribed. | PENDING-COMMITTEE-COPY |
| unsubscribeHeading | Unsubscribe | functional |
| unsubscribeConfirm | Confirm unsubscribe | functional |
| unsubscribeDone | You have been unsubscribed. | PENDING-COMMITTEE-COPY |
| unsubscribeInvalid | This unsubscribe link is not valid. | functional |

Functional UI labels (honeypot and internal admin page; not institutional voice; orchestrator ruling, values exactly as implemented):

| key | string | class |
|---|---|---|
| honeypotLabel | Leave this field empty | functional |
| adminHeading | Newsletter subscribers | functional |
| adminDownloadCsv | Download CSV | functional |
| adminColumnEmail | Email | functional |
| adminColumnSource | Source | functional |
| adminColumnStatus | Status | functional |
| adminColumnSubscribed | Subscribed | functional |
| adminCountSubscribed | subscribed | functional |
| adminCountUnsubscribed | unsubscribed | functional |
| adminNavLabel | Subscribers | functional |

Each PENDING-COMMITTEE-COPY entry carries the literal comment marker `PENDING-COMMITTEE-COPY` on its line and is listed in
docs/newsletter-subscribe.md under "Pending committee copy". The existing StatusMarker/R11 placeholder mechanism renders
badges on page content and does not apply to a single inline status line; the code comment plus doc entry is the register.
No marketing language. Submitting state: button disabled + `aria-busy`, label unchanged.
