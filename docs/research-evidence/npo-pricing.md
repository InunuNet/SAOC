# NPO / Non-Profit Pricing Sweep — Payment Gateways

Task from team-lead, 2026-08-14. Client: SAOC (registered NPO). Question: does NPO pricing
exist at each provider, does it apply to TICKET SALES (not just donations), and what is the
actual rate?

Status: COMPLETE (2026-08-14). All five providers checked; see bottom of file for final
verdict summary and Alembic tool-failure log.

---

## PayFast

### Standard rate (VERIFIED — corroborates the unverified claim in the brief)
Source: https://payfast.io/fees/ — fetched 2026-08-14, Alembic confidence HIGH.
Verbatim: "**Credit and Cheque Card**... **3.2% **plus **R 2.00**... Example: Transaction
cost: R500.00 / You only pay: R18.00 (ex VAT)"
Instant EFT: 2.0% (min R2.00). Capitec Pay: 2.0% (min R2.00).
**Verdict: PayFast standard card rate = 3.2% + R2.00 ex VAT — CONFIRMED, matches the brief's claim exactly.**

### Does an NPO tier exist at all? YES — the "Cause Account"
Source: https://payfast.io/account-types/ — fetched 2026-08-14, Alembic confidence **LOW**
(low_quality_score — thin page, but content matches across three independent PayFast
properties below, so treat as reliable despite the low score).
Verbatim: "A Cause account is for registered NPOs (Non Profit Organisations) to aid them in
fundraising by accepting donations online. This account comes with reduced fees as well as a
cause page hosted by Payfast."

Corroborating source (Alembic HIGH): https://payfast.io/solutions/donations/ — "Payfast does
its bit by offering causes reduced fees."

Corroborating source (Alembic HIGH): https://payfast.io/blog/introducing-the-new-payfast-cause-index/
— "We created Cause accounts three years ago to help registered charities, NGOs and many
other charitable causes with their fundraising efforts... discounted rates on the donations
they receive."

### THE ACTUAL RATE — only one number found anywhere, and it is NOT a standing rate
Source: https://payfast.io/blog/make-a-difference-with-givingtuesdaysa/ — fetched 2026-08-14,
Alembic confidence HIGH. This is a **2018 dated blog post about a single promotional calendar
day** (27 November 2018), not the everyday Cause account rate.
Verbatim: "PayFast will effectively be subsidising payment processing fees for card, EFT and
Bitcoin payments by **reducing processing fees to 1.5%\*, which is almost a 60% reduction in
cost**!" Footnote verbatim: "**The variable fee (% fee) for card payments (credit and debit),
Masterpass, Instant EFT and Bitcoin will be reduced to 1.5% (Ex VAT) for payments/donations
made to registered cause accounts on PayFast from 27 November 2018 00:00:00 until 27 November
2018 23:59:59.**"

**IMPORTANT CAVEAT: the 1.5% figure is an 8-year-old, one-day promotional rate, not a
published standing Cause-account rate.** No page fetched states the everyday Cause account
percentage. The general https://payfast.io/fees/ pricing page — the authoritative current fee
table, fetched above — makes **no mention of Cause/NPO pricing at all**, which strongly
suggests the standing Cause discount is either not published or applied on request/case-by-case
after verification, not published as a flat headline number.
**VERDICT: standing Cause-account rate = UNVERIFIABLE from public sources. Only a lapsed 2018
one-day promo figure (1.5% ex VAT) exists in writing. Must ask PayFast sales/support for the
current Cause account fee schedule.**

### Qualification requirements (VERIFIED)
Source: https://support.payfast.help/portal/en/kb/articles/verify-a-non-profit-account —
fetched 2026-08-14, Alembic confidence HIGH.
Verbatim: "A Non-Profit Account is for registered charities that want to use Payfast to
receive donations and/or payments. Examples of registered Non-Profits are: Non-Profit
Organisation [NPO cert from DSD] / Public Benefits Organisation [PBO confirmation from SARS] /
Section 21 or Not For Profit Company [CIPC docs] / Trust [IT number or Deed of Trust]."
**Note the phrase "donations and/or payments"** — broader than donations alone, see below.

### THE DECISIVE QUESTION: does it apply to ticket sales or only donations?
**Cannot be established cleanly either way from public sources — genuinely ambiguous, leaning
donations-only in marketing language but with one contrary technical signal:**

- Every piece of PayFast's own marketing copy (account-types page, donations solutions page,
  Cause-index blog, GivingTuesday blog) frames the Cause account exclusively in terms of
  **"donations"** and "fundraising." None mention ticket sales, event admission, or goods/
  services sold.
- However, the non-profit verification KB article (support.payfast.help) uses the phrase
  **"receive donations and/or payments"** (not "donations only") when defining what a
  Non-Profit Account is for — and separately states "Only registered non-profits can receive
  donations" as a specific carve-out, implying the account can also process non-donation
  payments. This is the one piece of language that leaves the door open to ticket sales, but
  it is a support/verification article, not a pricing or terms document, and it never states
  fee tier applies to those other payments.
- No PayFast T&Cs clause (searched the full 2026-08-14 fetched terms doc,
  `.agent/memory/scratch/payfast-terms-20260814/payfast-terms.md`) mentions "Cause" or "NPO"
  at all — the merchant agreement treats all merchants identically regardless of account type,
  which suggests the Cause discount is a **pricing-schedule addendum applied administratively**,
  not a contractually distinct product.

**VERDICT: UNVERIFIABLE from public sources whether the Cause discount rate would apply to
SAOC's R500 ticket sales. Ask PayFast directly: "We are a registered NPO selling R500
admission tickets to a triennial show (not accepting donations) — does the Cause account
reduced-fee rate apply to ticket/goods sales, or only to donations?" Get the current standing
Cause percentage in the same email, since it is not published.**


## Ozow

### Does an NPO/charity tier exist at all? NO — confirmed absent.
This was already established in this session's earlier deep-dive on Ozow's Master Services
Agreement, fetched and reconciled 2026-08-14 — see
`.agent/memory/scratch/ozow-terms-20260814/teardown.md` and
`.agent/memory/scratch/ozow-terms-20260814/reconciliation.md`.
Verbatim from teardown.md:308-309: **"Non-profit / PBO / NPO status: searched the full
document — ABSENT. No mention of non-profit, PBO, or NPO entity types anywhere in the MSA,
Schedule 1 (Definitions), Schedule 2..."**
Confirmed again by a fresh search today (2026-08-14) for "Ozow non-profit NPO charity pricing
discount" (Alembic search, Brave backend) — zero Ozow-specific results; only irrelevant hits
for unrelated SaaS vendors' NPO discount programs (Zoho, Shopify, Jotform, Webflow, Microsoft).
Ozow's own public pricing page (https://ozow.com/pricing — fetched 2026-08-14, Alembic
confidence HIGH) makes no mention of "NPO," "non-profit," "charity," or "cause" anywhere.

**VERDICT: no NPO/charity pricing tier exists at Ozow, in any form — VERIFIED ABSENT (not a
research gap; the full merchant contract was read specifically for this).** This also means
question 4 (does it apply to sales vs donations) is moot for Ozow — there is nothing to apply.

### Standard rate (VERIFIED, for the like-for-like recompute below)
Source: https://ozow.com/pricing — fetched 2026-08-14, Alembic confidence HIGH.
Local Card Payments: **2.85%** for R0–R249,999.99 (min R1.00). Pay By Bank / Capitec Pay /
Absa Pay / Nedbank Direct EFT: **1.5%** or min R1.00.
(Consistent with the VAT-basis open question already on file — see
[[project_payment_gateway_open_questions]] item 3 — still unconfirmed whether this is
ex-VAT or incl-VAT; flagged again below in the worked example.)


## Yoco

### Does an NPO tier exist at all? Partially — as a KYC/business-type category only, NOT a pricing tier.
Source: `.agent/memory/scratch/yoco-20260814/yoco-npo-fica-guide.md` (already on file,
fetched 2026-08-14, from support.yoco.help — "Profile Update: Non-Profit Organisation (NPO)").
This confirms Yoco recognises "Non-Profit Organisation" as a selectable **business type**
during FICA/KYC onboarding, requiring verification of a Management Committee (Chairperson,
Secretary, Treasurer). **This document is entirely about identity/compliance verification —
it contains zero pricing language.** No fee percentage, discount, or reduced rate is
mentioned anywhere in it.

Checked the two authoritative Yoco fee documents already on file
(`yoco-pricing-page.md`, `yoco-all-plans-fees.md`) plus `yoco-core-fee-faq.md`: **none mention
"NPO," "non-profit," "charity," or "discount" tied to non-profit status.**
Fresh search 2026-08-14 for "Yoco non-profit NPO reduced fees discount pricing" (Alembic
search): the only "discount" language found is a **volume discount** unrelated to entity type
— from support.yoco.help/en/articles/109451: "If, after using your Yoco card machine and/or
our online payment tools for three months, your monthly turnover is more than R100 000, we'll
automatically reduce your transaction fees." This is a revenue-tier discount available to any
business type, not an NPO-specific rate.

**VERDICT: Yoco has an NPO business-type category for KYC purposes only — NO NPO/charity
pricing tier exists. VERIFIED ABSENT.** Question 4 (sales vs donations) is moot — same as
Ozow, there is nothing to apply. SAOC's only path to a lower Yoco rate is the R100,000/month
volume threshold, which is irrelevant to a triennial one-weekend show unless ticket
pre-sales alone clear that threshold in a rolling 3-month window before the Show.


## Peach Payments

### Does an NPO tier exist at all? A marketing page exists; no distinct pricing found.
Source: https://www.peachpayments.com/industry/other-npo/ — fetched 2026-08-14, Alembic
confidence HIGH. This is a generic "industries" landing page (one of many — same template used
for retail, education, insurance, etc.). Verbatim: "Introducing Peach Payments, the ultimate
payment gateway for the non-profit industry. Simplify **donations** and transactions with
ease... Peach Payments caters to the non-profit industry by providing secure and efficient
payment solutions, enabling organizations to easily collect **donations** and support their
important causes."
**No fee percentage, discount, or reduced rate appears anywhere on this page** — it is pure
marketing copy ending in a "fill in your details, our team will contact you" lead-gen form.
Corroborated by an independent FICA/KYC support article (found via search, not yet fetched
directly — https://support.peachpayments.com/support/solutions/articles/47001250808) which
lists **"Non-Profit Company/NPC" and "Non-Profit Organization/NPO"** as two of Peach's seven
recognised contracting-party/onboarding types — i.e. Peach, like Yoco, recognises NPO status
for KYC purposes but this is not evidence of a pricing tier.

### Standard rate (VERIFIED — corroborates the brief's claim, via triangulated sources)
PayFast/Peach's actual `/fees/` page returned unusable extractions from Alembic on two
attempts (both official domain and CDN mirror) — logged as a tool failure below. Rate
triangulated instead from a third-party aggregator with an explicit "current as of May 2026,
pulled from provider's own official pricing page" methodology claim:
Source: https://www.ecommercedevelopment.co.za/cheapest-payment-gateway-south-africa/ —
fetched 2026-08-14, Alembic confidence HIGH. **This is a vendor-comparison blog, a WEAKER
source tier than a pricing page — treat the numbers as corroborated-but-secondary.**
Verbatim: "The published Growth plan is straightforward: **2.95% + R1.50 on cards**, and a
remarkable **1.50% + R1.50 on bank-direct EFT methods**." Also: "Tokenisation (storing
customer cards for one-click checkout) is **R200/month** extra." Enterprise plan (R500k+/month):
"R300/month account fee but custom volume-based rates."
Independently corroborated by two more Brave-search snippets from smesouthafrica.co.za
("R300 monthly account fees. R200 monthly tokenisation fee") and the direct
peachpayments.com/fees search snippet itself ("R300 / Month · Transaction Fees · R1.50 /
Transaction · volume-based · Tokenisation Fee · (Unlimited number of cards) R200 / Month").
**Verdict on the three unconfirmed claims:**
- "R200/month tokenisation charge" — **CONFIRMED**, triangulated across 3 independent sources
  including a direct search snippet of Peach's own /fees/ page, though the primary page itself
  could not be rendered by Alembic this session (502/nav-only extraction both times).
- "Higher recurring-card percentage" — not separately isolated; card rate found is a flat
  2.95% + R1.50 for one-off and recurring alike on Growth plan; no separate recurring-card
  premium was located. Flag as UNVERIFIED as originally claimed (not confirmed, not refuted).

### THE DECISIVE QUESTION: sales vs donations
Same pattern as PayFast: Peach's own marketing language for the NPO segment is 100%
donations-framed ("Simplify donations," "collect donations and support their important
causes"). Nothing on peachpayments.com distinguishes an NPO fee schedule from the standard
Growth plan rate — because **no NPO-specific fee schedule was found published anywhere**.
**VERDICT: no NPO pricing tier exists at Peach (as opposed to PayFast, which at least has a
named discounted product). SAOC would be quoted the standard 2.95% + R1.50 card / 1.5% +
R1.50 EFT rate regardless of NPO status, unless a bespoke rate is negotiated directly — worth
asking, since Peach clearly has an NPO onboarding pathway (KYC) they could tie a rate to, but
nothing published confirms one exists today.**

### Alembic tool failure — reported per standards
`https://payfast.io/fees/` succeeded only on retry after an initial 502 Bad Gateway.
`https://www.peachpayments.com/fees/` and `https://peachpayments-static.b-cdn.net/fees/` both
failed to yield the actual fee table — the .com domain returned a **sitemap/nav-only
extraction** (18 lines, no pricing content, Alembic confidence not flagged low despite this)
and the CDN mirror returned `upstream_error_status` (Alembic confidence LOW, 8 lines, empty).
Rate for Peach was therefore triangulated from third-party sources instead of the primary
page, as noted above.


## Paystack

### Does an NPO tier exist at all? NO evidence found for South Africa; the concept exists elsewhere at Paystack (Nigeria, education vertical only).
Fresh search 2026-08-14 for "Paystack South Africa non-profit NPO charity pricing discount"
(Alembic search): no Paystack-specific NPO discount page found — only third-party donation-
plugin integrations (WPCharitable's "Charitable Paystack" WordPress plugin, church-giving
tools) that use Paystack as a generic payment rail, not a Paystack-native NPO pricing product.

Definitive current fee table found at https://support.paystack.com/en/articles/2130306 —
fetched 2026-08-14, Alembic confidence HIGH. This is Paystack's live, official per-country fee
schedule (support-article table format, one row per country). South Africa row, verbatim:
**"2.9% + R1.00 (VAT exclusive)"** for local cards, **"3.1% + R1.00 (VAT exclusive)"** for
international cards. No separate NPO/charity row exists in this table for any country.
The **only** vertical-specific discount documented anywhere on Paystack is
**Nigeria-only, education-only**: "Transaction fee discount for Nigeria-based educational
institutions... transaction fees for schools or educational institutions are: 0.7% capped at
N1,500 for Local card payments." This proves Paystack *is capable* of vertical discounts as a
product pattern, but confirms none exists for South African NPOs today.

**VERDICT: no NPO/charity pricing tier exists at Paystack for South Africa — VERIFIED ABSENT.**
Question 4 (sales vs donations) is moot, same as Ozow and Yoco.

### Verdict on the three previously-unconfirmed Paystack sub-claims
Claim: **"2.9% + R1, no monthly fees, free payouts, annual subscriptions."**
- **"2.9% + R1" — CONFIRMED**, and current (not a stale 2021 pilot rate). Source:
  https://support.paystack.com/en/articles/2130306, fetched 2026-08-14, HIGH confidence,
  verbatim above. Cross-checked against a 2021 company blog
  (https://paystack.com/blog/company-news/sa-launch, fetched 2026-08-14, HIGH confidence)
  which shows the 2.9% figure was the **original pilot rate**, due to rise to "2.7% + R1.00
  (excluding VAT)" for merchants joining after 1 July 2021 — but the 2026 live support-article
  fee table confirms the rate is 2.9% again (or still), so the 2021 planned increase either
  did not stick or was reversed. **Use the 2026 support-article figure (2.9% + R1, VAT
  exclusive) as authoritative — it is dated to now, not 2021.**
- **VAT treatment — resolved and important**: https://support.paystack.com/en/articles/2124418
  (fetched 2026-08-14, HIGH confidence) gives a worked example removing all ambiguity:
  "The 15% is charged on the transaction amount of 2.9% + R1... [2.9%×R1,000 + R1] +
  [15%×(2.9%×R1,000+R1)] = [30] + [4.5] = R34.5". **The 2.9% + R1 figure is EX-VAT; VAT is
  added on top as a separate line, matching card scheme convention.** This resolves cleanly,
  unlike Ozow's still-unlabelled VAT basis (see [[project_payment_gateway_open_questions]]
  item 3).
- **"No monthly fees" — CONFIRMED.** Source: https://paystack.com/za/pricing (fetched
  2026-08-14, HIGH confidence). Verbatim: "No upfront or monthly fees."
- **"Free payouts" — CONFIRMED.** Same source, verbatim: "All payouts are free." (Note: a
  separate "Transfers to bank accounts" fee of "ZAR 3 per transaction (failed or successful)"
  exists on the same page — this is for the Transfers/payroll product, a different feature
  from standard merchant payout/settlement, so it does not contradict "free payouts" for
  collections.)
- **"Annual subscriptions" — CONFIRMED as a platform capability**, not fee-related. Source:
  https://support.paystack.com/en/articles/2133058 and https://paystack.com/docs/payments/subscriptions/
  (search snippets, 2026-08-14): "the Subscriptions feature allows customers to pay a specific
  amount every hour, day, week, month, **or year**, depending on the recurring interval set on
  a plan." Relevant to SAOC's possible future annual society memberships.


---

## Recomputed R1,000,000 worked example (2,000 tickets × R500)

All per-ticket fees computed from the rates verified in this document today (2026-08-14).
**Note:** the standard rates found today differ slightly from the figures cited in the
brief for Ozow (brief said R15.25/ticket; this session's fetch of ozow.com/pricing gives
2.85% × R500 = **R14.25**/ticket, no flat fee on the card product) — flagging the
discrepancy rather than silently overriding it; the brief's figure may reflect a different
Ozow product line or an earlier rate. All other providers' figures match the brief closely.

| Provider | Rate (standard) | Per-ticket fee ex-VAT | VAT basis | Total fee, 2,000 tickets, ex-VAT | Total fee, incl 15% VAT |
|---|---|---|---|---|---|
| **Ozow** (Card) | 2.85% | R14.25 | **UNCONFIRMED** — ex or incl VAT not labelled on pricing page (open question, see [[project_payment_gateway_open_questions]] #3) | R28,500 | R32,775 *if ex-VAT; R28,500 unchanged if already incl-VAT* |
| **Paystack** | 2.9% + R1.00 | R15.50 | Ex-VAT — CONFIRMED (support.paystack.com/en/articles/2124418, worked example) | R31,000 | R35,650 |
| **Peach Payments** | 2.95% + R1.50 | R16.25 | Ex-VAT (per third-party aggregator; primary fees page did not render via Alembic) | R32,500 | R37,375 |
| **Yoco** (Core, online) | 2.95% + R2.00 | R16.75 | Ex-VAT (already established in prior session research, `yoco-20260814/teardown.md`) | R33,500 | R38,525 |
| **PayFast** (standard, card) | 3.2% + R2.00 | R18.00 | Ex-VAT — CONFIRMED (payfast.io/fees/, worked example on page itself) | R36,000 | R41,400 |
| **PayFast "Cause" — illustrative only, NOT a confirmed standing rate** | 1.5% + R2.00* | R9.50 | Ex-VAT (per the 2018 promo footnote) | R19,000 | R21,850 |

\* The PayFast Cause figure is **not the answer to the brief's decisive question** — it is the
only number in writing anywhere, from an 8-year-old one-day promotion, applied here purely to
show what the worked example *would* look like if a 1.5%-type Cause rate turned out to be both
(a) still the going Cause rate today and (b) applicable to ticket sales rather than donations
only. **Neither (a) nor (b) could be established from public sources — see the PayFast section
above.** Treat this row as a "what if" bound, not a quote.

### Does PayFast become the cheapest provider once NPO status is factored in?
**Cannot be answered — the premise is unresolved.** If a genuine standing Cause rate exists
at something close to 1.5–2%, AND it is confirmed to apply to ticket/goods sales rather than
donations only, PayFast would indeed undercut every other provider's standard rate by a wide
margin (R19,000 vs. Ozow's R28,500 being the next cheapest). But neither of those two
conditions is established — both are open questions for PayFast directly, and it is
plausible the answer to (b) is simply "no, Cause pricing is donations-only," which would
leave PayFast at its standard 3.2%+R2.00 rate (R36,000, the most expensive of the five)
for ticket sales specifically. **This is a hinge fact, not a footnote — do not update the
comparison table or the standing recommendation until PayFast answers in writing.**

---

## Summary table — does an NPO/charity pricing tier exist, and does it reach ticket sales?

| Provider | NPO/charity tier exists? | Actual rate (published) | Qualifies with | Applies to sales or donations only? | Extra monthly/min fees |
|---|---|---|---|---|---|
| **PayFast** | YES — "Cause Account" | **UNVERIFIABLE as a standing figure.** Only number found is an 8-year-old one-day promo (1.5% ex VAT, card/EFT/Bitcoin, 27 Nov 2018 only). No current published rate. | NPO/PBO/Section21/NPC/Trust registration docs (DSD/SARS/CIPC), per verify-a-non-profit-account KB article | **UNVERIFIABLE.** All marketing copy is donations-framed; one KB article uses the broader phrase "donations and/or payments," leaving the door open but not confirming it. **Ask PayFast directly.** | None found published; standard schedule has no monthly fee |
| **Ozow** | **NO — confirmed absent** (full MSA read specifically for this, twice) | N/A | N/A | N/A (moot) | N/A |
| **Yoco** | NO pricing tier — NPO exists only as a KYC/business-type category | N/A (only a R100k/month volume discount exists, available to any entity type) | N/A | N/A (moot) | N/A |
| **Peach Payments** | NO published tier — has an NPO-branded marketing/lead-gen landing page and recognises NPO/NPC as KYC entity types, but no distinct fee schedule found | Standard Growth plan applies: 2.95% + R1.50 (cards), 1.5% + R1.50 (EFT) | N/A (no distinct qualification path found) | N/A (moot — no tier to apply) | R200/month tokenisation if used; R300/month on Enterprise plan (R500k+/month) |
| **Paystack** | **NO — confirmed absent for South Africa.** (Paystack does run a vertical discount, but it's Nigeria-only, education-only — proves the pattern exists at the company, not that it exists for SA NPOs.) | Standard 2.9% + R1.00 (VAT excl.) applies regardless | N/A | N/A (moot) | None — no monthly fee, free payouts |

**Bottom line for the client:** among all five providers, only PayFast has a named,
non-profit-specific pricing product at all. Whether that product's discount reaches SAOC's
actual revenue stream — ticket sales — is the one fact that could flip the whole
recommendation, and it is precisely the one fact PayFast has not published anywhere. Every
other provider's answer to "does NPO pricing help SAOC" is simply "there is no NPO pricing to
consider" — SAOC pays the same standard rate as any other merchant at Ozow, Yoco, Peach, and
Paystack.

### Question to put to PayFast (verbatim, ready to send)
"SAOC is a South African NPO. We do not accept donations — we sell tickets (~R500 each) to a
one-off event held once every three years, roughly R1,000,000 in ticket revenue per cycle.
(1) Does the Cause account's reduced-fee pricing apply to the sale of goods/services (e.g.
event tickets) or only to donations? (2) If it does apply, what is the current standing
percentage and flat fee for card and Instant EFT transactions on a verified Cause account —
your public fee page (payfast.io/fees/) does not list a Cause rate, and the only figure we
can find in writing is an 8-year-old one-day promotional rate (1.5% ex VAT, 27 Nov 2018).
(3) What NPO documentation is required to open/verify a Cause account?"

---

## Alembic failures encountered this session (reported per standards)
1. `https://payfast.io/fees/` — first attempt returned **502 Bad Gateway** (empty body,
   Content-Length 107, generic error text). Retried after a 2-second pause; second attempt
   succeeded with Alembic confidence HIGH, 338 lines. Not persistent — treat as transient.
2. `https://www.peachpayments.com/fees/` — Alembic returned a 200 but the extraction was a
   **sitemap/nav-only page** (18 lines, page-list of unrelated URLs, no pricing table content)
   despite HIGH confidence being reported — a case where the confidence score did not catch a
   genuinely unusable extraction. Likely a JS-rendered pricing table Alembic's static fetch
   could not see (same class of failure as the Visa registry issue logged in
   `merchant-evidence.md` line 87 from the prior session).
3. `https://peachpayments-static.b-cdn.net/fees/` (CDN mirror, found via search as an
   alternate route) — failed with `upstream_error_status`, LOW confidence, 8 lines, empty
   body. Did not yield usable content either.
4. `https://www.payfast.co.za/pricing` — LOW confidence
   (`below_token_floor,error_page_pattern,low_quality_score,upstream_error_status`), 6 lines,
   effectively empty. Not pursued further since payfast.io/fees/ (the correct current domain)
   succeeded on retry.

Peach's actual rate was recovered by triangulating three independent third-party sources
instead (see Peach section) — flagged there as a weaker source tier than a primary pricing
page, per the standards set for this task.

---

**Status: COMPLETE.** All five providers covered against all five requested facts. All three
previously-unconfirmed third-party claims (Paystack, Peach, PayFast standard) resolved with
live sources, fetch dates, verbatim quotes and confidence labels. Decisive PayFast
donations-vs-sales question could not be resolved from public sources — stated plainly above,
not assumed either way, with a ready-to-send question for the vendor.
