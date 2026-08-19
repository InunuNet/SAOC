# Policy pages — requirements & placement decisions

## Why this exists

Ozow's trial-application reply (confirmed by Brad, 2026-08-19) requires the
LIVE SITE to have three findable pages before a merchant account is approved:
Terms & Conditions, Privacy/POPIA policy, Refund/Cancellation policy. Most SA
gateways require the same set. No merchant account = no ticket sales — this
is a hard blocker, and it is provider-neutral (not Ozow-specific) work.

## Audited current state (2026-08-19)

- `app/(marketing)/privacy/page.tsx` — falsely claims data "is not shared
  with third parties" and only names the contact form as a data source. In
  reality: PayFast/Ozow-class payment gateway sees buyer PII at checkout,
  Firestore stores orders/vendor applications, Resend sends mail, Firebase
  Auth/Google Cloud host the admin surface. No Information Officer named, no
  retention periods, no Information Regulator complaint route.
- `app/(marketing)/terms/page.tsx` — site-use terms only. Nothing about
  buying anything: no conditions of sale, no ticket/admission terms, no 18+
  restriction for Sunset Cocktails, no capacity caveat for workshops/field
  trips.
- No `/refunds` page exists.
- `components/chrome/Footer.tsx` bottom bar (~line 128) links Privacy,
  Constitution, Media kit. `/terms` exists in the app but is linked from
  NOWHERE — a gateway reviewer following the footer would never find it.

## Decisions (architect)

### 1. Route for the new page: `/refunds`

Chosen over `/refund-policy` or `/cancellation-policy` to match this
project's existing single-word top-level route idiom (`/privacy`, `/terms`,
`/contact`, `/events`, `/societies`) rather than introducing a new
multi-word pattern. Content covers both refunds and cancellations — the
route name doesn't need to enumerate both; the page heading does.

### 2. Mandatory legal-draft notice — wording and placement

Every one of the three pages (`/privacy`, `/terms`, `/refunds`) MUST carry a
notice, in the page body (not just metadata/comments), stating plainly that
the page is an AI-generated draft pending professional legal review and does
not constitute legal advice. Recommended placement: directly under the
`PageHero`, above the first content section, in a visually distinct callout
(e.g. a bordered/tinted box using existing Tailwind tokens — no new colours
per project CLAUDE.md's "no invented brand assets" rule). It must be real
rendered text, not hidden via `sr-only`, `hidden`, or `aria-hidden="true"` —
`check-legal-draft-notice.mjs` verifies this structurally.

Suggested copy (dev may adjust wording, must preserve the two required
facts — "draft pending legal review" and "not legal advice"):

> **Draft pending legal review.** This page has been drafted with AI
> assistance and has not yet been reviewed by a qualified legal
> professional. It does not constitute legal advice and should not be
> relied upon as SAOC's final policy until formal review is complete.

### 3. `/privacy` rewrite — required facts (not exhaustive prose)

Must state, as facts (not just section headings):
- What is collected: contact-form submissions, ticket-checkout buyer details
  (name, email, phone), vendor applications.
- Who it's shared with and why: the payment gateway (to process payment),
  Resend (to send confirmation email), Firebase/Google Cloud (Firestore
  storage, Auth for admin). Name them explicitly — do not describe them only
  as "our providers".
- Retention: state that data is retained (a duration/criterion is fine even
  if generic, e.g. "for as long as needed to fulfil the purpose collected
  and to meet legal/accounting requirements") — the contract does not
  require a specific number of days here (retention policy specifics are
  not part of the fabrication ban that applies to refund windows; a
  reasonable general statement is acceptable and expected).
- An Information Officer contact (can reuse `secretary@saoc.co.za` or a
  dedicated address — dev's call, note it if inventing a new address).
- A route to lodge a complaint with the Information Regulator.
- The false "not shared with third parties" sentence must be deleted, not
  merely supplemented.

### 4. `/terms` rewrite — add, don't replace

Keep the existing site-use sections (Use of this site / Content ownership /
Disclaimer / Contact) and ADD a conditions-of-sale / ticket-terms section
covering: general condition-of-sale language for ticket purchases, the 18+
restriction naming Sunset Cocktails specifically, and a limited-capacity
caveat naming workshops and field trips specifically (both are real facts
from the council's spec, not invented).

### 5. `/refunds` — structurally complete, honestly incomplete on numbers

**Do not invent refund windows, cooling-off periods, or percentages/amounts
— the council has not supplied them; Lee-Ann has been asked.** The page
must still be a real, structurally complete refund/cancellation policy: it
needs sections addressing refunds and cancellations, and a plain-language
statement that the specific windows/amounts are pending confirmation from
the council (not silently omitted — a gateway reviewer or a buyer must be
able to see that this is a known, disclosed gap, not a missing page).
`check-refunds-no-fabrication.mjs` fails on any digit-plus-unit figure
(days/hours/weeks/%) appearing anywhere on the page, and separately fails if
no "pending council confirmation" language is present — both conditions
must hold.

### 6. Footer — additive only

`components/chrome/Footer.tsx` bottom bar (~line 128-155) currently has
three `<Link>`s (Privacy, Constitution, Media kit) inside a
`flex items-center gap-4` div. Add `Terms` and `Refunds` links to that same
group — do not restructure the footer or the four-column grid above it.
