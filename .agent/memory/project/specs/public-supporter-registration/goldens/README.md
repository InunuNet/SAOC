# public-supporter-registration — F1 decision record

Mission `public-supporter-registration`. F1 is the data model, validation, double-opt-in
submission handler, and confirmation email for a new public surface: a place for general
members of the public (not SAOC/society members, not vendors, not admins) to register their
name and email for early access to promos, events, and newsletters. Brad's instruction: be
honest about POPIA, and never share or sell the data.

Full mission roadmap (F1 is the only feature contracted here):

- **F1 (this contract)** — data model, pure validate/build, purpose-scoped tokens, IP rate
  limit + per-email send cooldown, the pure orchestrator handler, and the confirmation email.
- **F2** — `GET /api/supporters/confirm` — token verify, flips `pending` → `confirmed`.
- **F3** — `/supporters/manage` self-serve page + `POST /api/supporters/manage` — unsubscribe
  (suppress) and erase (delete), both token-gated, no login.
- **F4** — admin visibility: a new `view-supporter-registrations` capability, an
  `/admin/supporters` list/export page, wired through the existing capability system in
  `lib/admin-roles.ts` / `lib/admin-auth.ts` — never a new ad-hoc gate.
- **F5** — public registration form UI (component + page, e.g. a footer/`/join` surface).
- **F6** — `/privacy` copy: a new "Supporter registration" data category, matching the pattern
  already used there for contact/ticket/vendor data, naming Firestore and Resend as processors
  (already disclosed generically) and describing the double opt-in, the unsubscribe/erase
  rights, and that this is not SAOC/society membership.

## Auth-account vs. subscriber-record — decision: plain Firestore record, NO Firebase Auth account

**Decision: no Firebase Auth account is created for a public registrant.** A registration is
a Firestore document only, referenced by a purpose-scoped signed token (same HMAC pattern as
`lib/recovery-token.ts` and `lib/vendor-registration-token.ts`), never by a password or session.

Reasoning weighed:

- **Every public registrant sharing Firebase Auth's user pool with `/admin` is a security
  posture change, not a neutral one.** `docs/admin-access.md` already documents that
  self-signup (`createUserWithEmailAndPassword`) is open — anyone can mint an Auth account
  today; the admin gate holds only because `lib/admin-auth.ts` also requires the `admin`
  custom claim AND allowlist membership. Deliberately routing thousands of public registrants
  through the *same* Auth user pool as `/admin` widens that pool for no reason this feature
  needs — every registrant becomes one more row an operator has to eyeball when auditing who
  holds the `admin` claim, and one more identity the allowlist/claim logic has to keep
  correctly excluding forever. A subscriber-record design removes that surface entirely: there
  is no account to ever be mistakenly granted a claim.
- **Nothing in the ask needs a login.** "Early access to promos/events/newsletters" today
  means "receives email" — see "What early access means" below. A password, session, or
  "forgot password" flow would be pure overhead with no feature behind it.
- **Matches this codebase's own precedent.** The contact form and vendor applications are
  both plain Firestore documents with no Auth account, gated instead by a signed one-time
  token where a party (vendor) needs a scoped, revisitable link. This feature is that same
  shape, one step simpler (no admin review gate in the middle).
- **Rejected alternative — an Auth account per registrant with a magic-link sign-in.** Would
  let a registrant "log in" to see/manage their own data, but the same right is served here by
  a token-gated `/supporters/manage` page (F3) with no password to forget, no account to leak
  a claim onto, and no new sign-in provider config. If the council later wants a real members'
  portal (see backlog: `membersPage`/`judge` schemas, "Members Portal" flagged as future,
  unpriced work in spec V3), that is a different, larger feature — not this one, and not
  something this data model should be contorted to pre-empt.

## Fields collected, and the justification for each (minimality)

| Field | Required? | Justification |
|---|---|---|
| `email` | Yes | The entire mechanism — confirmation, unsubscribe/erase, and the "early access" emails themselves — is delivered to this address. No purpose is served without it. |
| `firstName` | No | Personalises the email greeting only ("Dear {firstName}," matching `emails/VendorRegistrationConfirmation.tsx`'s existing pattern). Optional because the purpose (sending email) is fully served by `email` alone; a registrant who doesn't want to give a name still gets every stated benefit. |
| `consentMarketing` | Yes, literal `true` | This is not a bureaucratic extra field — it **is** the record. A document that exists without it would have no lawful basis to send anything to. See "Consent design" below. |

**Fields deliberately NOT collected:** postal address, phone number, province/society
affiliation, date of birth, or any segmentation field. None is justified by "send early
access to promos/events/newsletters" — a plain email list needs only an email. If the council
later wants segmented sends (e.g. "only Western Cape members"), that is a new, separately
justified purpose requiring its own consent, not a field bolted onto this one under today's
single stated purpose.

## Consent design — the substance of "be honest about POPIA"

- **One purpose, one consent, not a bundle.** The whole point of registering IS receiving
  early access to promos/events/newsletters — there is no separate "create the account" step
  to bundle consent into, so a single explicit, unticked checkbox at submission time (F5 will
  render it; this contract fixes what the *data* must prove) **is** the lawful basis, not an
  afterthought next to it.
- **`consentMarketing` must be the literal boolean `true`** — not `"true"`, not `1`, not any
  other truthy value, and never defaulted. `validateSupporterRegistrationInput` rejects
  anything else with a field error naming `consentMarketing` (see A3). This is what makes "no
  pre-ticked box" a property of the *data model*, not just a UI convention F5 could quietly
  regress — a UI change that starts submitting `consentMarketing: undefined` defaulted to
  `true` server-side would defeat the promise; this contract makes that specific regression a
  400, not a silent accept.
- **`consentTimestamp` is recorded** (server `now`, never client-supplied) — proof of *when*
  consent was given, needed to answer a future "did we have consent" question honestly.
- **Re-consent on re-opt-in.** A previously **unsubscribed** email registering again is
  treated as a brand-new consent event (fresh `consentTimestamp`), never a silent revival of
  the old one — `deps.findByEmail`'s real Firestore implementation must exclude
  `status: 'unsubscribed'` documents, so the handler always treats that case as "no existing
  record" (see the handler's doc comment and A8's fixture, which includes this branch).

## The no-share/no-sell promise, made true of the implementation

Only two third parties ever see this data, matching what `/privacy` already discloses
generically for other collections: **Firestore** (storage) and **Resend** (sends the
confirmation and, later, the newsletter/promo emails). Nothing else is called anywhere in
this feature's code path — no analytics, no ad pixel, no third-party list/CRM sync. F6 updates
`/privacy` to name this collection explicitly under "Data we collect" and "Who we share it
with" (both sections already exist and already name Firestore/Resend for other collections —
see `app/(marketing)/privacy/page.tsx`), so the page's existing promise ("We do not sell
personal information") extends to this data truthfully, not by omission.

`sendSupporterRegistrationConfirmationEmail` and every function in
`lib/supporter-registration-handler.ts` are checked (A10) to import neither
`lib/admin-auth.ts` nor `lib/admin-roles.ts` — this surface has zero authorization meaning and
must stay fully separated from the admin/vendor gates, per the dispatch brief's boundary.

## Abuse protection — two independent throttles, not one

The vendor-apply route (F5, `vendor-registration-form-rebuild` mission) shipped without any
rate limiting or confirmation email, logged as follow-up F12 — not repeated here. Two
throttles, because they defend against two different abuses:

1. **Per-IP rate limit** (`decideSupporterRegistrationRateLimit`, wraps the real
   `decideRateLimit()` from `lib/resend-rate-limit.ts`, same delegation pattern as
   `lib/vendor-registration-rate-limit.ts`) — defends the endpoint itself against being
   hammered. `SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 5` /
   `SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS = 1 hour` — looser than the vendor route's 3/hour
   (a public list signup is a lower-stakes, more casual action than a vendor application) but
   real and independently tuned, not a shared/aliased constant (checked the same way vendor
   F5's A5 checked its constants weren't aliased to the resend-my-tickets limit).
2. **Per-email send cooldown** (`decideConfirmationEmailCooldown`,
   `SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS = 5 minutes`) — defends a **third party** against
   being email-bombed. An IP-only limit does nothing to stop someone submitting *the same
   victim's address* repeatedly from different IPs (or a botnet) to flood that inbox with
   confirmation emails; the cooldown is keyed on the submitted email itself and suppresses the
   resend regardless of who's asking or from where (A7).

Both throttles fail toward the same generic success response (see "No email enumeration"
below) — a suppressed resend is never visible to the caller as a distinct outcome, only as
"no new email will have arrived."

## No email enumeration

`handleSupporterRegistration`'s response body is byte-identical across all of: brand-new
email, already-`pending` email within cooldown, already-`pending` email past cooldown
(genuine resend), and already-`confirmed` email. A caller cannot use this endpoint to test
whether an arbitrary address is already registered (A8). This matters here specifically
because the address being probed could belong to someone who never asked to be probed.

## Purpose-scoped tokens — why `confirm` and `erase` cannot be the same token

`lib/supporter-registration-token.ts` mints a token carrying `registrationId` + `purpose`
(`'confirm' | 'unsubscribe' | 'erase'`) + expiry, HMAC-signed, same wire shape as
`lib/recovery-token.ts`. Verification takes an `expectedPurpose` and refuses on mismatch
(`reason: 'wrong-purpose'`) **after** the signature check, mirroring `lib/recovery-token.ts`'s
signature-then-semantics ordering. This matters concretely: the confirm link is the one token
that, by definition, gets forwarded, previewed by mail clients, and sometimes crawled by
corporate link-scanners — it must not double as a delete-my-data link if it leaks. `confirm`
tokens default to a 24-hour TTL (double opt-in should be prompt); `unsubscribe`/`erase`
tokens default to 400 days (minted fresh into every sent marketing email's footer, generous
enough that an old newsletter's unsubscribe link keeps working) — both overridable per call,
same pattern as `RECOVERY_TOKEN_DEFAULT_TTL_MS`.

## What early access mechanically means

As of this contract: **a mailing list, nothing more.** A confirmed `supporterRegistrations`
document is a target for future email sends (promos/events/newsletters) — there is no
entitlement engine, no early-window ticket-purchase gate, no discount code tied to this
record. If the council later wants registration to *mechanically* unlock (e.g.) an early
ticket-sale window, that is new, separately scoped work against the ticketing system
(`lib/payfast.ts`, `orders`/`tickets` — see `docs/f4-admission-products.md`) — not something
this contract should speculatively wire in now.

## Needs Lee-Ann / council confirmation before F6 ships

- The POPIA Information Officer named on `/privacy` is still the placeholder decision (Lee-Ann
  McCleland, not yet formally applied to the page per the open P1 backlog item) — F6 should
  either wait for that to land or explicitly flag it's inheriting the same placeholder, not
  introduce a second, possibly-different attribution.
- Whether the council wants this list kept fully separate from any future paid-membership /
  Members Portal record (per spec V3's open Members Portal question) — this contract assumes
  yes (separate collection, separate purpose, explicitly not membership), which should be
  confirmed rather than assumed permanent.

## What this contract does NOT prove

Same category of gap `contract-vendor-f5-register-route.yaml` names for its own route: a live
Firestore write, a live Resend delivery, and cross-instance rate-limit/cooldown consistency
(the in-memory stores survive a warm invocation only, not a cold start or multiple Firebase
App Hosting instances) are not proven here — only the pure, fully-injected orchestration logic
is. A live HTTP round-trip check against a real running server (the vendor F5 contract's A9
pattern) is deliberately deferred out of this feature's assertion set — the wiring in
`app/api/supporters/register/route.ts` follows the same well-established thin-route pattern
already proven live for `/api/vendors/register`, and every load-bearing behavioural property
(consent literalness, no parallel validation, purpose-scoped tokens, both throttles, no
enumeration, no admin-authorization meaning) is already proven offline against the real
exported functions the route wires together.
