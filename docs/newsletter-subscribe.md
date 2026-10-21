# Footer newsletter subscribe

Mission `footer-newsletter-subscribe` (M1/F1). Both footer sign-up forms (SAOC and NOS) store a
**single opt-in** subscriber: a submit stores the address as `subscribed` immediately, with no
confirmation email. Unsubscribe is the safety valve. The collection is Admin-SDK-only; no
Firestore client rules touch it.

## Data

Collection `newsletterSubscribers`, doc id = sha256 hex of the normalised email (no PII in the id):
`email`, `status` (`subscribed` | `unsubscribed`), `source` (`saoc-footer` | `nos-footer`),
`subscribedAt`, `unsubscribedAt` (null while subscribed), `unsubscribeToken` (256-bit,
base64url, 43 chars). Re-subscribing flips the same document back and keeps its original token and
source, so links already issued keep working.

## Flow

- `POST /api/newsletter/subscribe` -> `handleNewsletterSubscribe` (`lib/newsletter-handler.ts`).
  New, already-subscribed and re-subscribed all return the identical `200 {success:true}`, so the
  response cannot be used to learn who is on the list. Read, decide and write run inside one
  Firestore transaction. A non-empty `_hp` honeypot field returns the same success with no store
  access.
- `GET /newsletter/unsubscribe?token=...` renders a confirm button and performs no Firestore work
  (a mail scanner prefetching the link cannot unsubscribe anyone). The page is `noindex` and
  `no-referrer` because the token is a bearer credential. The button POSTs to
  `POST /api/newsletter/unsubscribe`. Malformed and unknown tokens give the same generic 400.
- `GET /api/admin/newsletter/export-csv` is gated by `getAdminSession` (401 no/invalid session, 403
  every other refusal, list never read when refused) and exports `subscribed` rows only as
  `email,source,subscribedAt,unsubscribeUrl`. Cells starting with `= + - @` are prefixed with `'`.
  `unsubscribeUrl` is built from `SITE_URL` (default `https://saoc.co.za`), never the request Host.
  The response is `Cache-Control: no-store`.
- `/admin/newsletter` lists subscribers with counts and a Download CSV link. Any allowlisted admin
  can open it (no capability check, contract decision D3).

The CSV is how the bulletin is sent: there is no mailing tool, and each row carries its own
unsubscribe link for the bulletin footer.

## Rate limits

Subscribe 5 per hour per IP, unsubscribe 10 per hour per IP, using the shared sliding-window
`decideRateLimit`. The counter is in memory per server instance (the same known limitation as the
vendor routes). The numbers are placeholders, not committee-approved values.

- Key: the LAST `x-forwarded-for` hop, not the first. The first is client-supplied and spoofable;
  the last is appended by Google's front end in front of App Hosting. If more trusted proxies are
  ever added, clients share a key (over-limiting), never a bypass.
- Once per request: each route wraps the store per request, so a Firestore transaction retry cannot
  count one request twice.
- `lib/newsletter-rate-limit.ts` holds the shared check (`consumeRateLimit`) and imports
  `lib/resend-rate-limit.ts`, so `lib/newsletter-handler.ts` itself never names that file and the
  "sends no email" static check (A11) stays meaningful.

## Timing and races

- A new address does a transaction write; an existing one does not. Successful subscribe responses
  are padded to a 750 ms floor so the difference is not observable by timing. This is approximate,
  not constant-time.
- Unsubscribe does the token lookup and the status update in one Firestore transaction, so a racing
  re-subscribe cannot leave a 200 "unsubscribed" response while the address stays subscribed.

## Pending committee copy

All strings live in `components/chrome/newsletter-copy.ts`. These two are placeholders awaiting
committee wording, marked `PENDING-COMMITTEE-COPY` in the source:

- `success`: "You're subscribed."
- `unsubscribeDone`: "You have been unsubscribed."

## Copy gaps

These strings have no golden entry (functional form and admin chrome), so they were placed in
`NEWSLETTER_COPY` as-is and need a decision: `honeypotLabel`, `adminHeading`, `adminDownloadCsv`,
the four `adminColumn*` labels, `adminCountSubscribed`, `adminCountUnsubscribed`, `adminNavLabel`.

## Follow-ups

- A welcome / confirmation email is out of scope. It needs SAOC-voice copy and a sender identity
  from the committee (owner follow-up).
- Footer wiring (`components/chrome/Footer.tsx`, `components/nos-chrome/NosFooter.tsx`) lands after
  NOS Site's r20 merges.
