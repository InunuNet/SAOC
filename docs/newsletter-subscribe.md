# Footer newsletter subscribe

Mission `footer-newsletter-subscribe` (M1/F1). Both footer sign-up forms (SAOC and NOS) store a
**single opt-in** subscriber: a submit stores the address as `subscribed` immediately, with no
confirmation email. Unsubscribe is the safety valve. The collection is Admin-SDK-only; no
Firestore client rules touch it.

## Data

Collection `newsletterSubscribers`, doc id = sha256 hex of the normalised email (no PII in the id):
`email`, `status` (`subscribed` | `unsubscribed`), `source` (`saoc-footer` | `nos-footer`),
optional `topics` (`saoc` and/or `nos`, stored in that order),
`subscribedAt`, `unsubscribedAt` (null while subscribed), `unsubscribeToken` (256-bit,
base64url, 43 chars). Re-subscribing flips the same document back and keeps its original token and
source, so links already issued keep working. Legacy documents without `topics` are read with a
single topic derived from `source`; no backfill is needed. A subscribe request without `topics`
uses that same source default. An explicit empty list or unknown topic is rejected. Re-subscribing
merges topics into the existing list, including when the address is already subscribed.

## Flow

- `POST /api/newsletter/subscribe` -> `handleNewsletterSubscribe` (`lib/newsletter-handler.ts`).
  New, already-subscribed and re-subscribed all return the identical `200 {success:true}`, so the
  response cannot be used to learn who is on the list. Read, decide and write run inside one
  Firestore transaction. A non-empty `_hp` honeypot field returns the same success with no store
  access.
- `GET /newsletter/unsubscribe?token=...` renders a confirm button and performs no Firestore work
  (a mail scanner prefetching the link cannot unsubscribe anyone). The page is `noindex` and
  `no-referrer` because the token is a bearer credential. The button POSTs to
  `POST /api/newsletter/unsubscribe`. Unsubscribing applies to the whole address, across both
  topics; topic-level unsubscribe is outside this feature. Malformed and unknown tokens give the
  same generic 400.
- `GET /api/admin/newsletter/export-csv` is gated by `getAdminSession` (401 no/invalid session, 403
  every other refusal, list never read when refused) and exports `subscribed` rows only as
  `email,source,subscribedAt,unsubscribeUrl,topics`, with topics joined by `;`. Cells starting
  with `= + - @` are prefixed with `'`.
  `unsubscribeUrl` uses the configured NOS origin for `nos-footer` and the SAOC origin for
  `saoc-footer`, never the request Host.
  The response is `Cache-Control: no-store`.
- `/admin/newsletter` lists subscribers with counts and a Download CSV link. Any allowlisted admin
  can open it (no capability check, contract decision D3).

The CSV is how the bulletin is sent: there is no mailing tool, and each row carries its own
unsubscribe link for the bulletin footer.

## Rate limits

Subscribe 5 per hour per IP, unsubscribe 10 per hour per IP, using the shared sliding-window
`decideRateLimit`. The counter is in memory per server instance (the same known limitation as the
vendor routes). The numbers are placeholders, not committee-approved values.

- Key: `clientIpFromForwardedFor` (`lib/client-ip.ts`). Google's front end appends the client IP, so
  the header is `<client-supplied...>, <client-ip>, <lb-ip>`: one entry is used as-is, two or more
  yield the second-to-last. Never the first (spoofable) nor the last (the shared load-balancer
  address, which would let one attacker exhaust the quota for everyone). A missing header falls
  back to one shared `unknown` key. To verify on beta, compare against Cloud Run's logged remoteIp.
- Once per request: each route wraps the store per request, so a Firestore transaction retry cannot
  count one request twice.
- `lib/newsletter-rate-limit.ts` holds the shared check (`consumeRateLimit`) and imports
  `lib/resend-rate-limit.ts`, so `lib/newsletter-handler.ts` itself never names that file and the
  "sends no email" static check (A11) stays meaningful.

## Timing and races

- A new address does a transaction write; an existing one does not. Successful subscribe responses
  are padded to a 1000 ms floor (`MIN_SUCCESS_RESPONSE_MS`) so the difference is not observable by
  timing. Residual risk: a write slower than the floor can still leak new versus existing, and
  newsletter membership is low sensitivity, so this is accepted.
- Unsubscribe does the token lookup and the status update in one Firestore transaction, so a racing
  re-subscribe cannot leave a 200 "unsubscribed" response while the address stays subscribed.

## Pending committee copy

All strings live in `components/chrome/newsletter-copy.ts`. These two are placeholders awaiting
committee wording, marked `PENDING-COMMITTEE-COPY` in the source:

- `success`: "You're subscribed."
- `unsubscribeDone`: "You have been unsubscribed."

## Copy gaps

The newsletter chooser's none-selected error has no approved copy. Its preview-only text is
marked `COPY GAP — AI-generated placeholder` and is withheld by `withholdPlaceholderProse()` in
public mode. The error still blocks submission, flags the checkbox group, and focuses its first
checkbox. The chooser legend uses the existing `FOOTER_HEADINGS.touch` in visually hidden text.

These strings have no golden entry (functional form and admin chrome), so they were placed in
`NEWSLETTER_COPY` as-is and need a decision: `honeypotLabel`, `adminHeading`, `adminDownloadCsv`,
the four `adminColumn*` labels, `adminCountSubscribed`, `adminCountUnsubscribed`, `adminNavLabel`. `adminSourceSaoc` ("SAOC") and `adminSourceNos` ("National Orchid Show") are Codi's labels for the stored source slugs. The empty-state line "No one has subscribed yet." is Codi's admin microcopy ruling (see goldens/copy.md); Brad may change it.

## Follow-ups

- A welcome / confirmation email is out of scope. It needs SAOC-voice copy and a sender identity
  from the committee (owner follow-up).
- Footer wiring (`components/chrome/Footer.tsx`, `components/nos-chrome/NosFooter.tsx`) lands after
  NOS Site's r20 merges.
