# footer-newsletter-subscribe -- golden spec (M1/F1)

Decision (Brad 2026-10-22, final): SINGLE opt-in. A footer submit stores the subscriber as `subscribed`
immediately. No confirmation email, no double opt-in. Unsubscribe is the safety valve.

## Module interfaces dev must implement (checks import these paths and names)

### lib/newsletter.ts  (pure; no firebase-admin import)
- `NEWSLETTER_EMAIL_MAX_LENGTH = 254`
- `NEWSLETTER_SOURCES = ['saoc-footer', 'nos-footer'] as const`
- `normaliseNewsletterEmail(raw: unknown): string | null` -- non-string, empty, >254 chars, bad shape
  (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) or first char in `= + - @` (CSV formula guard) => null. Else trim+lowercase.
- `newsletterDocId(normalisedEmail: string): string` -- sha256 hex (64 chars). Deterministic, no `@`/`/`, no PII in the id.
- `generateUnsubscribeToken(): string` -- `crypto.randomBytes(32).toString('base64url')` (43 chars, `[A-Za-z0-9_-]`). Never Math.random.
- `isWellFormedUnsubscribeToken(t: unknown): boolean` -- string matching `^[A-Za-z0-9_-]{43}$`.
- `maskEmail(email: string): string` -- e.g. `j***@example.com`; must not contain the full local part when it is >1 char.
- `type NewsletterSubscriberDoc = { email, status: 'subscribed'|'unsubscribed', source: 'saoc-footer'|'nos-footer', subscribedAt: Date, unsubscribedAt: Date|null, unsubscribeToken: string }`
- `applySubscribe(existing: NewsletterSubscriberDoc | null, input: { email, source, now: Date, token: string }): NewsletterSubscriberDoc | null`
  - existing null => new doc (status subscribed, subscribedAt=now, unsubscribedAt null, token=input.token)
  - existing subscribed => `null` (no write; keeps original subscribedAt, token, source)
  - existing unsubscribed => doc with status subscribed, subscribedAt=now, unsubscribedAt=null, token and source KEPT from existing
  - output never has an own property whose value is `undefined`
- `buildSubscribersCsv(rows: { email: string; source: string; subscribedAt: Date | null; unsubscribeToken: string }[], origin: string): string` -- header exactly
  `email,source,subscribedAt,unsubscribeUrl` (see csv-header.txt); `unsubscribeUrl` = `${origin}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, RFC4180 quoting, ISO timestamps, any field starting with `= + - @ \t \r`
  is prefixed with `'` (defence in depth).

### lib/newsletter-handler.ts  (pure orchestrator, fully injectable, no firebase-admin/resend import)
`handleNewsletterSubscribe(input: { body: unknown; rateLimitKey: string }, deps)`
deps: `now: Date; getPriorAttempts(key): {key,at}[]; recordAttempt(key, at): void; getSubscriber(id): Promise<NewsletterSubscriberDoc|null>; writeSubscriber(id, doc): Promise<void>; generateToken(): string; logError(message: string, context: Record<string,string>): void`
Order: rate-limit (record attempt, `decideRateLimit` from lib/resend-rate-limit.ts, 5 per hour per key, exported constants
`NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS`/`..._WINDOW_MS`) -> honeypot (`_hp` non-empty => 200 `{success:true}`, zero store calls)
-> validate (email via normaliseNewsletterEmail, source in NEWSLETTER_SOURCES) -> getSubscriber -> applySubscribe -> write only if non-null.
Returns `{ status, body, retryAfterSeconds? }`. Shapes in response-shapes.json. New, already-subscribed and re-subscribed
all return the IDENTICAL status and body (enumeration-safe). Write failure => 500 + logError with `maskEmail` only.

`handleNewsletterUnsubscribe(input: { body: unknown; rateLimitKey: string }, deps)`
deps: `now; getPriorAttempts; recordAttempt; findByToken(token): Promise<{ id: string; status: 'subscribed'|'unsubscribed' } | null>; markUnsubscribed(id, now): Promise<void>; logError`
Malformed OR unknown token => identical 400 generic body. Valid + subscribed => markUnsubscribed, 200. Valid + already unsubscribed => 200, no write.

`handleNewsletterExport(deps: { getSession(): Promise<AdminAuthResult>; origin: string; listSubscribers(): Promise<{email, source, status, subscribedAt: Date|null, unsubscribeToken: string}[]> })`
=> `{ status, body: string, headers: Record<string,string> }`. Session not ok => 401 (`no-session`,`invalid-session`) or 403 (all other
reasons), body `Unauthorized`/`Forbidden`, and `listSubscribers` called ZERO times. ok => CSV of rows with status `subscribed` only,
headers `Content-Type: text/csv`, `Content-Disposition: attachment; filename="newsletter-subscribers.csv"`, `Cache-Control: no-store`.

## Routes and files
- app/api/newsletter/subscribe/route.ts  POST -> handler; Admin SDK adapter (Firestore transaction around get+applySubscribe+set); rate-limit key from `clientIpFromForwardedFor(request.headers.get('x-forwarded-for'))` (lib/client-ip.ts), plus a response-time floor (below).
- app/api/newsletter/unsubscribe/route.ts  POST -> handler; `findByToken` = `where('unsubscribeToken','==',token).limit(1)`.
- app/(marketing)/newsletter/unsubscribe/page.tsx  Server Component, reads `searchParams.token`. GET performs NO Firestore read/write.
  Renders a client confirm component whose button POSTs the token. `robots: noindex`, `referrer: no-referrer` metadata.
- app/api/admin/newsletter/export-csv/route.ts  GET -> handleNewsletterExport with getAdminSession.
- app/admin/newsletter/page.tsx + layout.tsx  list (email, source, status, subscribedAt, counts) + Download link; layout redirects to /admin/login when `!session.ok`
  exactly like app/admin/vendors/layout.tsx, with NO capability check (any allowlisted admin; see contract decision D3). Add a link in components/admin/AdminNav.
- components/newsletter/NewsletterSignup.tsx  'use client', shared by both footers; props `{ source: 'saoc-footer'|'nos-footer'; emailLabel: string; placeholder: string; submitLabel: string; className hooks }`
  so each footer keeps its own markup/classes (SAOC Tailwind, NOS `nf-*`). Wiring follows components/contact/ContactForm.tsx: `aria-invalid`, `aria-describedby`
  to the error id, honeypot `_hp` (hidden, aria-hidden, tabIndex -1), status in a `role="status" aria-live="polite"` region, `role="alert"` on error.
- components/chrome/newsletter-copy.ts  the only home of the new strings (copy.md).
- types/index.ts: `NewsletterSubscriber` type. firestore.indexes.json: none needed (single-field equality queries). Collection is Admin-SDK-only.
- docs/newsletter-subscribe.md; CLAUDE.md Collections table gains a `newsletterSubscribers` row (contract enforcement_edits).

## Ordering constraint (footer wiring)
NOS Site is changing components/chrome/Footer.tsx and components/nos-chrome/NosFooter.tsx in r20 (F1 sign-up a11y, F3 grid) on
fix/nos-critique-r20. The footer-wiring step is implemented ONLY after r20 merges, rebased on top of it. Dev builds lib, routes,
unsubscribe page and admin first, and must not touch either footer file before then. Assertion A24 fails while an unmerged
origin/fix/nos-critique-r20 exists. Keep every r20 visual/a11y change; only swap the form for `<NewsletterSignup>`.

## Out of scope / follow-ups
- No welcome or confirmation email. Needs SAOC-voice copy we do not have. Owner follow-up: committee supplies welcome copy + bulletin sender identity.
- No mailing tool; the CSV export is how the bulletin is sent. Each row carries its own `unsubscribeUrl` so every bulletin can include a working unsubscribe link (Brad). The export stays admin-gated and `Cache-Control: no-store`; the origin comes from the site origin env/config, never from the request Host header.
- Rate limiter is in-memory per instance (same known limitation as the vendor routes).

## Rate-limit constants
Subscribe: `NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS = 5` per hour per key. Unsubscribe: 10 per hour per key (a real user may retry).
Placeholders, not committee-approved values.

## Client IP (orchestrator ruling)
`lib/client-ip.ts` exports `clientIpFromForwardedFor(header: string | null | undefined): string | null`. Google's front end appends the client IP,
so XFF is `<client-supplied...>, <client-ip>, <lb-ip>`. Split on `,`, trim, drop empties: 1 entry => that entry; 2 or more => the SECOND-TO-LAST
entry; empty/missing header => null (route falls back to a single shared `unknown` key, never to a spoofable value). Never the first hop (spoofable) and
never the last (the shared LB address would let one attacker exhaust the quota for everyone). Used by both newsletter routes.
Verification on beta after deploy (orchestrator): compare against Cloud Run's logged remoteIp.

## Subscribe timing floor (orchestrator ruling)
Successful subscribe responses are padded to `MIN_SUCCESS_RESPONSE_MS = 1000` (a new address costs a transaction write, an existing one does not).
Handler contract unchanged. Residual risk, recorded in docs/newsletter-subscribe.md: a write slower than the floor can still leak
new-vs-existing, and newsletter membership is low-sensitivity, so this is accepted.
