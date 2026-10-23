# Footer newsletter subscribe

Mission `footer-newsletter-subscribe` (M1/F1). Both footer sign-up forms (SAOC and NOS) store a
**single opt-in** subscriber: a submit stores the address as `subscribed` immediately, with no
confirmation email. Unsubscribe is the safety valve. The collection is Admin-SDK-only; no
Firestore client rules touch it.

## Data

Collection `newsletterSubscribers`, doc id = sha256 hex of the normalised email (no PII in the id):
`email`, `status` (`subscribed` | `unsubscribed`), `source` (`saoc-footer` | `nos-footer`, where the
address signed up), `topics`, `topicRemovals`, `restoreTopics`, `subscribedAt`, `unsubscribedAt`,
`unsubscribedVia`, `unsubscribedBy` (all three null while subscribed), `unsubscribeToken` (256-bit,
base64url, 43 chars).

- `topics` (`saoc` and/or `nos`, stored in that order) is what the address is subscribed to **now**.
  An array is honoured even when empty; only a missing or non-array value (a legacy document) is
  derived from `source`. No backfill is needed.
- `topicRemovals` is the append-only audit, one entry per removed topic:
  `{topic, removedAt, via, by}`. `via` is `link` (token page), `one-click` (RFC 8058),
  `self-service-form` (`/unsubscribe`) or `admin`; `by` is the admin's verified email for `admin`
  and null otherwise.
- When the last topic goes the document becomes `status: 'unsubscribed'`, sets `unsubscribedAt`,
  `unsubscribedVia` and `unsubscribedBy`, and `restoreTopics` records the topics it held just
  before (what "Subscribe again" puts back).
- A footer re-subscribe (or "Subscribe again") flips the same document back, clears the three
  doc-level audit fields and `restoreTopics`, keeps `topicRemovals`, and keeps the original token
  and source so links already issued keep working. A footer re-subscribe merges the ticked topics
  into the topics the address already holds.
- **Nothing is ever hard-deleted** (POPIA record): no code path calls `delete` on this collection.
- Both footers start with **no topic ticked**; ticking at least one is required to submit.

All writes of `topicRemovals` and of `status: 'unsubscribed'` go through one function,
`removeSubscriberTopics` in `lib/newsletter-store.ts`, which reads the document inside a Firestore
transaction and applies the pure patch from `lib/newsletter-preferences.ts`
(`applyTopicRemoval`). The token route, the preferences route, the by-email route and the admin
route all call it.

## Flow

- `POST /api/newsletter/subscribe` -> `handleNewsletterSubscribe` (`lib/newsletter-handler.ts`).
  New, already-subscribed and re-subscribed all return the identical `200 {success:true}`, so the
  response cannot be used to learn who is on the list. Read, decide and write run inside one
  Firestore transaction. A non-empty `_hp` honeypot field returns the same success with no store
  access.
- `GET /newsletter/unsubscribe?token=...` is the **preferences page**. It reads the subscriber and
  performs no write (a mail scanner prefetching the link cannot change anyone). It is `noindex` and
  `no-referrer` because the token is a bearer credential. It has four states: the default form
  (a checkbox per list the address holds or has held, own site first, a masked address), saved,
  all-unsubscribed (with "Subscribe again") and an invalid link. Malformed and unknown tokens show
  the same message. Changes POST to `POST /api/newsletter/preferences` `{token, topics}`: a
  selection narrows the address, `[]` unsubscribes from everything, a list the address previously
  held may be ticked again but a list it never held is refused (400, `field: 'topics'`), and
  `{token, restore: true}` is "Subscribe again".
- `POST /api/newsletter/unsubscribe` keeps its JSON `{token}` behaviour (whole address, via `link`).
  It also accepts the RFC 8058 one-click form: `Content-Type: application/x-www-form-urlencoded`,
  body exactly `List-Unsubscribe=One-Click`, token in `?token=`. Every token (malformed, unknown or
  known) answers the same `200 {success:true}`; a wrong body is 400. GET is not exported (405).
- `GET /unsubscribe` exists on **both** hosts (`app/(shared)/unsubscribe`, one `SHARED_EXACT` line in
  `proxy.ts`). It is `noindex` and **unauthenticated by design**: anyone may enter an address, and
  the worst case is an unwanted unsubscribe that the person reverses by subscribing again from the
  footer. It posts to `POST /api/newsletter/unsubscribe-email`, which removes only the topic of the
  host the page is on (taken from the request host, never the body). Subscribed, unknown,
  already-unsubscribed and honeypot submissions get the identical `200 {success:true}`, each held
  to the shared 1000 ms floor (`NEWSLETTER_MIN_SUCCESS_RESPONSE_MS`).
- `GET /api/admin/newsletter/export-csv?list=saoc|nos|all` is gated by `getAdminSession` (401
  no/invalid session, 403 every other refusal, list never read when refused). It exports
  **subscribed** rows that currently hold the chosen list (unknown value means all) as
  `email,source,subscribedAt,unsubscribeUrl,topics,listUnsubscribeHeader`, topics joined by `;`.
  The export ignores `status`: a `status` query is never honoured, because a bulletin export must
  never contain an unsubscribed address. Cells starting with `= + - @` are prefixed with `'`. `unsubscribeUrl` and
  `listUnsubscribeHeader` use the configured NOS origin for `nos-footer` and the SAOC origin for
  `saoc-footer`, never the request Host. The response is `Cache-Control: no-store`.
- `/admin/newsletter` lists subscribers with a Lists column (one neutral chip per current list, a
  struck chip per removed list), Status, Subscribed and, last, "Signed up via". The Lists and
  Status filters are `?list=&status=` in the URL and are applied on the server (unknown values
  fall back to the default). Any allowlisted admin can open the page. The row action
  "Unsubscribe..." is shown only to roles holding `export-buyer-data` (owner and manager today),
  is computed on the server, and `POST /api/admin/newsletter/unsubscribe` enforces it again
  (401 no session, 403 otherwise, before the body is read). The dialog is the shared
  `DetailDrawer`, with a checkbox per list the address currently holds.

**No bulletin is sent from the site.** The CSV is how the bulletin is sent: there is no mailing
tool. Each row carries `unsubscribeUrl` (the preferences page) for the bulletin footer, and
`listUnsubscribeHeader` (two lines, `List-Unsubscribe: <...>` and `List-Unsubscribe-Post:
List-Unsubscribe=One-Click`) for the headers of whatever tool sends the bulletin. The RFC 8058
one-click target is `POST /api/newsletter/unsubscribe?token=`. The exported file is a quoted
cell with one embedded line feed, so a spreadsheet import must keep the quotes.

## Roles

`export-buyer-data` is reused for removing a subscriber from a list: newsletter subscribers are
buyer data and the capability is held by exactly the owner and manager roles. This couples the two
meanings (a future dedicated capability would have to change `lib/admin-roles.ts`, which other
contracts pin), so it is recorded here rather than hidden.

## Rate limits

Subscribe 5 per hour per IP, `/unsubscribe` by email 5 per hour per IP, token unsubscribe, one-click
and preferences 10 per hour per IP, using the shared sliding-window
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
  are padded to a 1000 ms floor (`NEWSLETTER_MIN_SUCCESS_RESPONSE_MS`, shared with the
  `/unsubscribe` route) so the difference is not observable by timing. Residual risk: a write slower than the floor can still leak new versus existing, and
  newsletter membership is low sensitivity, so this is accepted.
- Every removal does its lookup and update in one Firestore transaction, so a racing re-subscribe
  cannot leave a 200 "unsubscribed" response while the address stays subscribed. A request that
  changes the same address twice (add one list, remove another) reads it once and layers each
  patch over that read (`NewsletterTx`), because Firestore forbids a read after a write.
- The `/unsubscribe` honeypot and rate limit are in memory per instance, and the padding is
  approximate; the same accepted limits as subscribe.

## Pending committee copy

All strings live in `components/chrome/newsletter-copy.ts`; the strings added by mission
`newsletter-topics-unsub` were supplied verbatim by Brad, SAOC and NOS Design, and no placeholder is
registered for it (`goldens/copy.json` is the machine-checked set). These two are placeholders awaiting
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
