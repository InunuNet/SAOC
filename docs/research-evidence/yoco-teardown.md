# Yoco Teardown Against the 9-Point Comparison Framework

Structure mirrors the companion teardowns at
`/Users/vetus/ai/SAOC/.agent/memory/scratch/ozow-terms-20260814/teardown.md` and
`/Users/vetus/ai/SAOC/.agent/memory/scratch/payfast-terms-20260814/teardown.md`.

Client context: South African Orchid Council, a registered non-profit. Sells tickets to a
National Show held once every three years, concentrated into a short selling window, with entry
delivered later than payment. Volunteer committee, no finance department, limited working
capital. Yoco was previously dropped from the comparison on a reasoning error (recurring-billing
absence disqualifies it for a future memberships use case, not for ticket sales, the requirement
actually due in two weeks) and is being re-examined here as a full peer of Ozow and PayFast.

**Important limitation, stated up front and repeated in Section 2 and the verdict below: Yoco's
primary contract documents — the Merchant Agreement (`yoco.com/merchant-agreement.pdf`,
in-person/card-machine terms) and the Payment Services T&Cs (`a.storyblok.com/.../yoco-payment-
services-t-cs-28-february-2025.pdf`) — could not be retrieved as text by Alembic in any form
tried (see "Alembic Failures" immediately below). This teardown is therefore built from Yoco's
Main Terms & Conditions (fully retrieved, high confidence, dated February 2026), Yoco's public
Help Centre articles (fully retrieved, high confidence, but explicitly self-described as "not a
legal document"), the Yoco Developer Hub, and — where marked — unverified fragments visible only
in Brave Search result snippets. Every claim below states which tier of source it rests on.**

---

## ALEMBIC FAILURES — reported as instructed, before any findings

Nine distinct fetch attempts failed to produce usable text from Yoco's primary contracts. Two
failure modes, both worth fixing:

**1. PDFs are not extracted at all — `pdf-unsupported` strategy yields 0% content.**

| # | URL | Strategy | Result |
|---|---|---|---|
| 1 | `https://www.yoco.com/merchant-agreement.pdf` | `pdf-unsupported` | Quality score 0, confidence low, 40-word placeholder body ("PDF — text extraction not supported") |
| 2 | `https://core.yoco.co.za/assets/pdfs/merchant_agreement.pdf` (same document, alternate host) | `pdf-unsupported` | Identical placeholder, quality 0 |
| 3 | `https://a.storyblok.com/f/111633/x/45ec35fce0/yoco-payment-services-t-cs-28-february-2025.pdf` | `pdf-unsupported` | Identical placeholder, quality 0 |

This is a different failure class from the Ozow SPA problem (solved there via a JSON API) — here
the primary source is a binary PDF, and Alembic has no text-extraction path for PDFs at all
(no `pdftotext`-equivalent fallback), only a strategy that gives up immediately.

**2. The JS-render fallback actively fails on PDF URLs rather than degrading gracefully.**

| # | URL (with `?js=true`) | Result |
|---|---|---|
| 4 | `.../merchant-agreement.pdf?js=true` (attempted implicitly via `js=true` on the Storyblok PDF) | `502 Bad Gateway` — `Fetch error: JS rendering failed (Page.goto: Download is starting...)`. Playwright's `domcontentloaded` wait never fires because the browser treats the PDF response as a file download, not a navigable page. |
| 5 | `.../yoco-payment-services-t-cs-28-february-2025.pdf?js=true` | Same `502 Bad Gateway`, same "Download is starting" error |

Recommendation for the Alembic maintainer: detect `Content-Type: application/pdf` (or a `.pdf`
extension) before attempting the Playwright fallback, and route to a dedicated PDF-to-text step
(e.g. `pdfplumber`/`pypdf`) instead of a browser navigation, which cannot succeed on a PDF by
construction.

**3. Third-party PDF viewers are themselves JS-gated and return only their own loading chrome —
not the document — even though Alembic reports these as technically successful fetches.**

| # | URL | Strategy | Result |
|---|---|---|---|
| 6 | Google Docs Viewer wrapper around the Merchant Agreement PDF | `trafilatura` | 200 OK, but body is the viewer's own loading shell: `"Loading…" / {"id": "", "title": "merchant-agreement.pdf", ...} / "Loading…" / "Loading merchant-agreement.pdf. Page 1"` — 19 words, quality 35, confidence correctly flagged low |
| 7 | Scribd mirror of the July-2024 Payment Services T&Cs (`scribd.com/document/851502669/...`) | `trafilatura` | 200 OK, 157 words extracted from a 366,556-token source — Scribd's reader is JS-paginated; only site chrome came through, confidence correctly flagged low |
| 8 | `yoco.my.site.com/help/s/article/Yoco-Merchant-Agreement-Terms-FAQs` (Salesforce Lightning community help site), tried both static and `?js=true` | `trafilatura` | Both attempts returned only `"Loading · ×Sorry to interrupt · Refresh"` / `"Service Not Available"` — Salesforce Lightning's client-side render doesn't complete inside Alembic's wait window even with JS rendering enabled |

Items 6–8 are at least self-flagging (confidence: low) — no correction needed there. The genuine
bug is items 1–5: PDFs are given up on immediately with no extraction attempt, and the one
fallback that exists (JS rendering) fails outright rather than declining gracefully.

**4. A distinct, more dangerous failure: the `llms.txt:excerpt` strategy silently returns
site-wide navigation instead of the requested article, while reporting HIGH confidence.**

Four Yoco Help Centre articles, fetched at their canonical URLs, all returned `X-Alembic-
Confidence: high` with a plausible-looking word count, but the actual body text was a **list of
unrelated article titles and links from the site's `llms.txt` index** — not the requested
article's content:

- `support.yoco.help/en/articles/109524-yoco-terms-faqs` → returned "Introducing Yoco / Yoco
  Sign-Up" section headers with links to *other* articles, not the Terms FAQ content
- `support.yoco.help/en/articles/109595-yoco-payouts-guidelines-schedule-reports` → returned a
  "Payouts" nav list, not the payout schedule
- `support.yoco.help/en/articles/109451-core-fee-pricing-faqs` → returned a "Fees & Plans" nav
  list, not the fee table
- `support.yoco.help/en/articles/109539-refunding-my-customer-faqs` → returned a "Point of Sale"
  nav list, not the refund procedure

This is worse than the low-confidence cases above: nothing in the response signals that the
wrong content was returned. **Workaround found and used for the rest of this task:** appending
`.md` directly to the article URL (e.g. `.../109451-core-plan.md`) triggers a different Alembic
strategy (`content-negotiation`) that correctly returns the full article body at high fidelity
(confirmed against `X-Alembic-Word-Count` jumping from ~200–580 nav-list words to 1,000–2,900
real-content words per article). All Help Centre content cited below was fetched via this `.md`
suffix workaround, not the canonical URL. Recommendation: when `llms.txt:excerpt` is selected as
a strategy, Alembic should verify the extracted text's title/heading actually matches the
requested slug before reporting high confidence — or simply prefer `content-negotiation` (the
`.md` content-type) over `llms.txt:excerpt` whenever both are available for a given host.

**Net effect on this teardown:** the two binding contract PDFs (Merchant Agreement, Payment
Services T&Cs) are unverified except for a handful of fragments visible in Brave Search result
snippets (explicitly marked "SNIPPET-ONLY, UNVERIFIED" below). Everything else — Main T&Cs,
pricing, developer docs, onboarding/FICA guides, refund/payout mechanics — was fully retrieved at
high confidence once the `.md` workaround was applied.

All fetched documents are saved in this directory:
`yoco-main-terms-feb2026.md`, `yoco-pricing-page.md`, `yoco-core-plan-md.md`,
`yoco-all-plans-fees.md`, `yoco-terms-faq-full.md`, `yoco-signup-guide.md`,
`yoco-npo-fica-guide.md`, `yoco-prohibited-businesses.md`, `yoco-balance.md`,
`yoco-chargebacks-faq.md`, `yoco-refund-howto.md`, `yoco-payouts-article.md`,
`yoco-instant-payout.md`, `yoco-legal-index.md`, `yoco-dev-accepting-payment.md`,
`yoco-dev-refunds-api.md`, `yoco-dev-webhooks-verify.md`, plus the low-confidence/failed captures
(`yoco-merchant-agreement.md`, `yoco-core-merchant-agreement.md`, `yoco-payment-services-tcs.md`,
`yoco-payment-services-scribd-jul2024.md`) kept as evidence of the failures above.

---

## 1. FEES — every chargeable item found, and verification of the 2.95% headline figure

**The 2.95% figure carried into this task from June–July 2026 research is STALE and
INCOMPLETE — confirmed by a fresh fetch of Yoco's Core Plan fee table (`support.yoco.help/en/
articles/109451-core-plan.md`, fetched fresh today, quality score 98, high confidence).**

Yoco restructured its plans and rates as of "1 June" (the article's own dateline; the exact year
is not stated but the content is current as of today's fetch). The current Core Plan (the
free, no-commitment default plan — matches SAOC's use case) transaction-fee table, by tier and
channel, all ex-VAT:

| | Core, R0–R50k/month | Core, over R50k/month* |
|---|---|---|
| In-person, local debit | 2.30% | 1.35% |
| In-person, local credit | 2.30% | 2.30% |
| In-person, international | 3.20% | 2.75% |
| In-person, AMEX | 3.40% | 3.00% |
| **Online, local debit/credit** | **2.95% + R2** | **2.75% + R2** |
| Online, international/AMEX | 3.50% + R2 | 3.50% + R2 |
| Payflex/Happy Pay | 5.25% + R5 | 5.25% + R5 |

*\*Lower tier requires turnover to average over R50,000/month for a consecutive 3-month period —
not a single high-volume month.*

**Ticket sales are an online transaction (checkout page or payment link), not an in-person card-
machine swipe — the online row is the relevant one, and it carries a flat R2 per-transaction fee
on top of the percentage, which the brief's carried-over figure omitted entirely.**

**Corrected R500-ticket comparison, ex-VAT, same convention the brief used for Ozow/PayFast:**

| Gateway | Formula | Cost on R500 |
|---|---|---|
| Ozow | 2.85% + R1 | R15.25 |
| **Yoco (Core, R0–R50k tier)** | **2.95% + R2** | **R16.75** |
| PayFast | 3.2% + R2 | R18.00 |
| Yoco (Core, +R50k tier, if qualified) | 2.75% + R2 | R15.75 |

**Verdict: the R14.75 claim (flat 2.95%, no per-transaction fee) is wrong. Yoco is not the
cheapest of the three on a R500 online ticket — it sits in the middle, between Ozow and
PayFast, at R16.75 ex-VAT, unless SAOC's turnover averages over R50,000/month for three
consecutive months (unlikely for a concentrated few-week selling window around a triennial
Show), in which case it drops to R15.75 — still not below Ozow.** VAT basis: all three gateways
quote rates exclusive of VAT and add 15% VAT to the fee separately (confirmed for Yoco:
`R2.30 fee → +R0.35 VAT → R2.65 total` worked example in the same source) — this is a like-for-
like comparison, not an apples-to-oranges one.

**Other fees, all confirmed from the same high-confidence Core Plan / All Plans & Fees fetch:**

- **Subscription/monthly fee: R0 on Core Plan.** (Plus R249/month, Pro R499/month — both include
  a first-month-free trial — but neither is needed for SAOC's use case.)
- **No minimum-volume fee** — unlike PayFast's ZAR 20,000/month threshold fee (undisclosed
  amount), Yoco charges nothing extra for a R0 month; you simply pay 0% of R0.
- **No setup fee, no connectivity fee, no PCI fee** — explicitly stated: "There's no setup or
  connectivity fee for any of the Yoco Plans."
- **No termination fee** — explicitly stated in the Terms FAQ: "you can cancel our agreement
  anytime... There's no charge for cancelling, and no penalties or notice periods." (Full
  quote and context in Section 3.)
- **Payout fees (Core Plan):** Standard and Weekly Payout are free. Fast Payout: 0.75% (min
  R7.50). Instant Payout: 1.50% ex-VAT of the requested amount, minimum flat fee R15.00 incl.
  VAT for requests under R1,000 — worked example given: a R50 Instant Payout costs the R15.00
  minimum, netting R35.00.
- **Custom rates:** available on any plan if turnover exceeds R200,000/month for 3 consecutive
  months — not realistic for SAOC's cycle, noted for completeness only.

**Conclusion:** every fee amount is publicly disclosed with worked examples, in contrast to
PayFast (which discloses none, deferring everything to "the Application") and partially in
contrast to Ozow (which discloses processing-fee amounts only via Order Form/website, not the
contract text). But the specific figure carried into this task was wrong in a way that changes
the ranking: **Yoco is not the cheapest card option for SAOC's ticket-sale use case; it is the
middle option.**

---

## 2. MONEY YOU CANNOT GET AT — reserves, holds, set-off; genuinely unresolved due to the PDF gap

This is the section most affected by the Alembic PDF failures in the header above. What follows
is everything found in accessible sources, clearly separated from the one piece of SNIPPET-ONLY,
UNVERIFIED evidence about the unreachable Merchant Agreement.

**From the Main T&Cs (Feb 2026, fully verified, high confidence):**

- §5.3 (Incorrect or Mistaken Payments): Yoco may correct erroneous payments by "reversing or
  adjusting the amount... deducting the amount from future settlements, payouts, or other
  amounts payable to you; or requesting that you repay the amount directly," with notice "where
  reasonably practicable" — i.e. not always in advance.
- §9.1 (What Happens When Services are Suspended or Ended): "all amounts owed to Yoco become
  immediately due and payable; and Yoco may delay or withhold settlements to recover amounts
  owed."
- §10.2 (breach of warranty): Yoco may "delay, withhold, reverse, or recover settlements or
  payouts linked to the issue" and "require repayment of any amounts paid to you as a result of
  the breach."
- §12.2 (suspected fraud/unlawful activity): Yoco may "delay, withhold, reverse, or refund
  transactions or settlements" and "suspend, restrict, or terminate access to any Service, with
  or without notice."
- **No numeric cap, percentage, or day-count is stated anywhere in the Main T&Cs** — every hold
  power is open-ended and discretionary, similar in kind to Ozow's set-off (cl. 3.5) and
  PayFast's 9.6 lien, but with no quantified worst case (no 10%/180-day Rolling Reserve figure,
  no 540-day ceiling) *stated in this document*.

**From the Help Centre (fully verified, high confidence, but explicitly "not a legal document"):**

- Chargebacks: "we'll withhold settlement payment of the full Chargeback amount or debit its
  value, plus any legal or other costs incurred as a result, from your settlement funds
  (Payout). It may be withheld until either the payment dispute is settled one way or another,
  or the lawful window for this type of dispute has passed." (Terms FAQ)
- Chargebacks can be raised "up to 18 months after the original transaction" (Yoco Balance
  article) — this is the cardholder-dispute window, separate from and much longer than the
  90-day merchant-initiated refund window (Section 6). A chargeback wave following a Show could
  theoretically extend fund exposure up to 18 months post-transaction, though no reserve
  *percentage* is stated to correspond to this window.
- "Risky or flagged transactions are being responsibly processed for your protection. While
  these transactions are being processed, that portion of your balance won't be available for
  payout. Once cleared, the funds will be included in your next payout." (Yoco Balance article)
  — vague, discretionary, no cap or duration given.
- Payout delays FAQ: "we may need to review transactions to keep payments secure. During this
  time, payouts may be temporarily paused for up to **seven working days**." This is the only
  concrete, numbered hold duration found anywhere in accessible Yoco sources — a maximum of 7
  working days for a *transaction review* hold, explicitly distinct from a chargeback/dispute
  hold (which has no stated cap).

**SNIPPET-ONLY, UNVERIFIED — visible only in Brave Search result text for the unreachable
Merchant Agreement PDF, never independently confirmed by fetching the source:**

> "11 DISPUTES AND CHARGEBACKS. 11.1 You agree that in the event of a Chargeback, Yoco may –
> 11.1.1 withhold the full value of the Chargeback amount in the Reserve Account, subject to
> clause 11.2; 11.1.2 adjust the fees set out in the Fee Schedule; 11.1.3 delay the payment of
> any payouts into your Bank Account; 11.1.4 terminate, modify or suspend your access to the
> Services; and/or..."
>
> "8.2.2 refund a Transaction for up to 90 (ninety) days back to the Cardholder..."
>
> "10.3.2 suspend your access to the Services, on terms determined by Yoco."

This confirms a "Reserve Account" mechanism *exists* in the binding Merchant Agreement, and
that clause 11.2 presumably qualifies or caps it — but the actual cap percentage, holdback
period, and release conditions (the equivalent of Ozow's 10%/180-day figure or PayFast's
540-day ceiling) are **not visible in any source this teardown could retrieve**, and must not be
assumed to be absent — only unverified.

**Realistic worst case for SAOC, stated honestly given the gap:** the *known* mechanisms (Main
T&Cs discretionary withholding, up to 7 working days for a transaction-security review, up to
18 months of chargeback exposure with no stated reserve percentage) are structurally similar in
kind to both competitors but **cannot be shown to be better or worse in degree**, because the
one document that would state Yoco's equivalent of "10% for 180 days" or "540 days maximum" is
the Reserve Account clause in the Merchant Agreement, which Alembic could not retrieve. **This is
a genuine open question for SAOC to put to Yoco support before committing — not a resolved
"ABSENT" finding like Ozow's new-merchant probation gap, and not a confirmed number like
PayFast's 540-day ceiling.**

---

## 3. LOCK-IN — the strongest, best-verified finding in Yoco's favour

**Confirmed from three independent sources, all high confidence:**

**Main T&Cs §7.1 (Feb 2026):**
> "You may terminate your use of any Service in accordance with the applicable Service T&Cs. If
> no specific termination process applies, you may terminate a Service at any time by ceasing to
> use it, giving written notice to Yoco, or following the applicable process in the Yoco app or
> dashboard."

No fixed initial term is stated anywhere in the Main T&Cs (contrast with PayFast's explicit
36-month Initial Term, cl. 21.1). No minimum term, no auto-renewal clause exists to find.

**Terms FAQ (Help Centre, verbatim):**
> "How do I close my Yoco account? You're never locked in with Yoco — you can cancel our
> agreement anytime by contacting a member of our Support Team via our in-app chat. There's no
> charge for cancelling, and no penalties or notice periods."

And separately, on fee/term changes generally:
> "We also reserve the right to change our fees and payment terms or introduce a new fee. If we
> ever make changes which you disagree with or which means you no longer accept all the terms,
> you can cancel anytime and immediately, without any penalties or notice periods."

**All Plans & Fees article, on the plans specifically:**
> "No lock-in contracts or hidden fees." / "When can I change plans? There's no lock-in or
> contract with any of the Yoco Plans – you can switch between them as your business needs and
> goals change."

**Verdict: this is the cleanest no-lock-in position of the three gateways.** Ozow requires 30
days' written notice from either party (still lenient, but a formal step). PayFast requires 60
days' notice from either party, inside a 36-month auto-renewing term escapable only by written
notice 3 months before expiry. Yoco states, across three independent public documents, that
termination is immediate, penalty-free, and notice-free. **Caveat, stated for intellectual
honesty:** this claim rests on the Main T&Cs and Help Centre, not on the unreachable Merchant
Agreement/Payment Services T&Cs, which could in principle contain a service-specific minimum
term for payment processing specifically (the Main T&Cs explicitly say Service T&Cs take
precedence over Main T&Cs in a conflict, cl. 2.4) — but nothing in any accessible source hints at
one, and the FAQ language ("cancel our agreement anytime... no penalties or notice periods") is
unambiguous and written specifically to answer this exact question.

Yoco-initiated termination (Main T&Cs §8.1) mirrors both competitors: suspension/termination
permitted for legal/regulatory/risk reasons, "where reasonably possible" with notice, immediately
without notice for suspected fraud or legal-compliance reasons.

---

## 4. DORMANCY — the second-strongest finding in Yoco's favour, with an honest confidence caveat

SAOC's account will sit idle roughly 30 of every 36 months between Shows. PayFast suspends at 6
months and auto-terminates at 12 (with an undisclosed-amount termination fee "at our discretion").
Ozow allows either party to terminate on 30 days' notice at any time, and separately flags 9
months of inactivity as a practical account-continuity risk (per the companion Ozow teardown).

**Yoco's Terms FAQ addresses this question directly and explicitly, the only one of the three
gateways to do so in a consumer-facing document:**

> "If you've signed up with Yoco and you've already transacted, we'll settle any outstanding
> transaction into the account linked to your Yoco profile. We won't however be able to delete
> your profile as FICA regulations require that we keep this information on record for at least
> five years. **Your profile will however remain inactive over time**, and we can deactivate any
> Yoco communications."

No inactivity-triggered suspension, termination, or fee is stated anywhere in the Main T&Cs,
Terms FAQ, or any other accessible Yoco source. The only inactivity-adjacent mechanism found is
unrelated to dormancy: the mandatory FICA profile-update process (Section 7) carries a 21-day
deadline after Yoco *requests* an update, after which the profile is *disabled, not terminated*
— "You will, however, be able to access your profile and reports. Your profile will be
reactivated as soon as it has been updated." This is a compliance-refresh mechanism, not a
dormancy penalty, and it reactivates on completion rather than requiring re-onboarding from
scratch.

**Verdict: best-evidenced dormancy position of the three gateways for SAOC's exact usage
pattern** — an idle profile appears to simply sit inactive, with no fee, suspension, or
termination clock running, and FICA-driven re-verification (if triggered) disables rather than
destroys the profile. **Confidence caveat, stated honestly:** this rests on Help Centre prose
("not a legal document," per its own disclaimer) and the absence of any contrary clause in the
Main T&Cs — not on the unreachable Payment Services T&Cs, which could contain a service-specific
inactivity clause. Given the explicit, direct FAQ answer to this exact question, this is treated
as reliable evidence, but it is evidence of a different tier than a verbatim contract clause.

---

## 5. SETTLEMENT — far more granular detail than either competitor, with the same "no binding SLA" caveat

**Detailed, concrete, and fully verified from the Help Centre (Yoco Payouts article, high
confidence):**

| Payout type | Timing | Cost (Core Plan) |
|---|---|---|
| Standard (default on Core) | Reconciled at midnight; reflects in bank 1–2 business days later; Sundays/public holidays delay it | Free |
| Weekly | Reflects by 8am on a chosen day of the week, including weekends; not affected by public holidays | Free |
| Fast | Reflects by 8am the next day, 7 days a week including Sundays/holidays | 0.75%, min R7.50 |
| Instant | Paid within minutes, 365 days/year, capped at R10,000/day (1x) or R30,000/day (2x, if ≥10 Standard/Fast payouts in the last 90 days); queued automatically during 11pm–midnight bank maintenance | 1.50% ex-VAT, min R15.00 incl. VAT |

A full Standard Payout schedule table is published (e.g. a Monday transaction pays out Tuesday,
reflects in-bank Wednesday/Thursday). First payout after verification: "usually processed within
24 hours" and reflects "within 24–48 hours, excluding weekends and public holidays." Minimum
payout balance: R10 (Standard/Weekly/Fast) or R50 (Instant).

**This is dramatically more granular and numerically specific than either competitor's public
settlement language** — Ozow states no day-count for any rail except Crypto; PayFast defers
frequency entirely to "the Application." Yoco publishes an actual day-of-week schedule table.

**The caveat that must not be dropped, however:** this granularity comes entirely from the Help
Centre, which opens with "This is not a legal document" and from the Main T&Cs §5.2, which
states the reverse of a guarantee:

> "We aim to make the Services reliable and available, but we do not guarantee uninterrupted,
> timely, secure, or error-free operation. Delays, interruptions, errors, or outages may occur
> from time to time... Transactions or settlements may be delayed or temporarily unable to
> process... we are not responsible for losses caused by events outside our reasonable control."

**Verdict: Yoco's settlement promise is far more detailed and useful for operational planning
than either competitor's, but it carries exactly the same lack of contractual bindingness — a
detailed non-binding schedule, not a binding SLA with numbers attached.** This is a genuine
practical advantage (SAOC's volunteer committee can actually plan around a stated schedule) even
though it confers no additional legal recourse if missed.

---

## 6. REFUND MECHANICS — the 90-day cap and same-day debit-card restriction are both CONFIRMED

**The two specific claims the brief asked to verify are both confirmed, from the Help Centre
refund-troubleshooting content (high confidence):**

- **90-day refund cap — CONFIRMED.** Listed as a named failure reason: "The original transaction
  is older than 90 days" causes a refund request to fail.
- **Same-day-only debit-card refunds — CONFIRMED, verbatim.** "Debit card payments can only be
  refunded on the same day as the original payment." Credit cards (Visa/Mastercard/Amex),
  Samsung Pay, Apple Pay, and Google Pay do not carry this same-day restriction and can be
  refunded within the 90-day window generally.
- Processing timing nuance found alongside these: a same-day refund processed before 7pm is
  instant; after 7pm (or the next day) it takes 5–7 working days.

**Partial refunds — CONFIRMED SUPPORTED, and more explicitly documented than either competitor:**
full and partial refunds (including item-level partial refunds that restock inventory) are
available from the Yoco App, Yoco POS App, the card machine itself, and — critically for SAOC's
online-ticketing use case — the **Checkout API**, where the refund request's `amount` field is
nullable: omit it for a full refund of the remaining balance, or specify a partial amount. This
is a concrete, documented capability neither Ozow's nor PayFast's public materials establish this
clearly (PayFast's partial-refund support is only inferable from a ceiling clause; Ozow's is
unaddressed entirely).

**The funding gate — CONFIRMED, same structural constraint as both competitors:**
> "Refunds can only be successfully processed if you have sufficient funds in your Yoco balance
> (i.e. your pending payout amount) to cover them."

This mirrors Ozow's Float/aggregated-balance gate (cl. 7.3.1) and PayFast's fund-first-or-refuse
discretion (cl. 11.10). **The one point of difference favouring Yoco:** Yoco's own support
documentation proactively offers a workaround Yoco itself suggests when this gate blocks a
refund — "EFT the refund amount directly to your client – just make sure to let us know so that
we can cancel the pending refund on our side" — a level of transparency about the failure mode
that neither competitor's contract text offers (both simply state the gate exists).

**Chargeback window is separate and much longer:** up to 18 months after the original
transaction (Section 2) — this is the cardholder-initiated dispute window, not the merchant
self-service refund window, and the two must not be conflated when advising SAOC.

**API mechanics (Developer Hub, high confidence):** refund via authenticated `POST
/api/checkouts/{checkout-id}/refund`, `Idempotency-Key` header supported for safe retries, `202
Accepted` response (async — outcome delivered via a `refund.succeeded`/`refund.failed` webhook
event), matching the modern async pattern used for the payment flow itself.

---

## 7. ELIGIBILITY AND ONBOARDING — verified, and confirmed as the strongest point in Yoco's favour

**Non-profit path is real and explicitly matches SAOC's actual structure — verified, not
assumed, from the sign-up guide (high confidence):**

> "6. Non-Profit Organisation: This is a legal entity that operates for a charitable,
> educational, religious, scientific, or social purpose rather than to generate profit for
> owners or shareholders. Any revenue earned is reinvested into the organisation's mission
> rather than distributed as profits. **An NPO can be registered or unregistered.** Only a
> director, or **the chairperson, treasurer or secretary of the NPO** can sign up with Yoco."

This is distinct from, and more permissive than, "Non-Profit Company" (NPC — item 5 in the same
list), which requires CIPC registration and a director. SAOC — a national body coordinating
member societies, run by an elected committee, not necessarily incorporated as a CIPC company —
matches the NPO category precisely, and any of its chairperson, treasurer, or secretary can be
the one to sign up (not just a single designated director).

**A dedicated NPO FICA guide exists (`support.yoco.help/en/articles/111102`, verified, high
confidence) with an explicit process:**

1. Confirm business type (NPO vs. NPC vs. other — correcting a wrong initial selection is
   supported, "select the Change button").
2. Verify the identity of the person who signed up (SA ID + facial liveness match against Home
   Affairs, described as completing "within seconds"; or a photographed ID/passport with
   liveness check if the fast path fails; work permit + passport for foreign nationals).
3. Confirm trading address.
4. **Verify stakeholders** — specifically the Chairperson, Secretary, and Treasurer of the
   Management Committee (also Vice Chairperson, Vice Secretary, or "Other" for project
   leads/advisory members). Each is sent an individual emailed verification link, and must
   independently: consent to the signer's authority to act on the NPO's behalf, provide a
   residential address, upload an ID document, and complete a liveness check. **Per-person
   review turnaround is stated explicitly: "within 48 hours of submission."**

**No overall end-to-end onboarding-time SLA is stated anywhere** — only the per-stakeholder
48-hour review commitment. For a 3-person committee (Chairperson/Treasurer/Secretary) responding
promptly and in parallel, this suggests a realistic low-single-digit-day onboarding window, but
this is an inference from the stated mechanics, not a promised timeline — **this is exactly the
kind of question the framing constraint calls for putting to Yoco support directly, not one this
teardown can resolve from public documents.**

**Advance-purchase/ticketing as a named business category: ABSENT**, matching both competitors —
no clause names event ticketing or delayed-delivery goods as a category anywhere in the
Prohibited Businesses list or elsewhere. **This absence is a point in Yoco's favour relative to
PayFast specifically**: PayFast's dispatch-before-payment clause (12.3, "you undertake not to
raise a Transaction Record prior to the goods being dispatched") creates textual ambiguity for a
ticket-sale model; no equivalent clause exists in any Yoco source reviewed.

**Prohibited Businesses list (verified, high confidence):** 21 named categories plus a short
"anything else" list (no debit orders, no offline transactions, no selling electricity/airtime,
no cash withdrawals, no loan business, no charging customers the card fee). Orchid show ticket
sales do not fall into any listed category — no eligibility barrier identified.

---

## 8. SERVICE LEVELS — ABSENT, matching PayFast rather than Ozow

**Full search of the Main T&Cs and Help Centre content found no uptime percentage, response-time
commitment, or support-resolution-time target anywhere.** Yoco's marketing pricing page claims
"24 hour customer service" and "WhatsApp support" as *features*, not as a service-level
commitment with a numeric target or remedy.

**Main T&Cs §5.2 affirmatively disclaims any such standard, matching PayFast's cl. 19.3
("We do not warrant that Services will be uninterrupted or error free") almost word for word:**
> "We aim to make the Services reliable and available, but we do not guarantee uninterrupted,
> timely, secure, or error-free operation... The Services are provided on an 'as is' and 'as
> available' basis. To the maximum extent permitted by law, Yoco disclaims all express or
> implied warranties, including warranties of merchantability, fitness for a particular purpose,
> non-infringement, and availability."

**No remedy of any kind is stated for an outage or missed target** — same structural gap as
PayFast, and in fact a weaker position than Ozow, which at least states numeric targets (95% of
transactions under 5 seconds, 98% monthly availability) even though it also attaches no remedy
to them. **Verdict: ABSENT, matching PayFast's finding exactly** — no promise, no remedy, and an
explicit disclaimer of the underlying warranty a promise would otherwise imply.

---

## 9. DISPUTES — South African courts, no arbitration, and a specific low liability cap

**Main T&Cs §16.3, verbatim, in full — the entirety of the governing-law/forum clause:**
> "Governing Law and Jurisdiction - This Agreement is governed by South African law. Yoco may
> bring proceedings in any court with jurisdiction, including the Magistrates' Court, even if the
> claim exceeds its usual limits."

**No arbitration clause exists anywhere in the Main T&Cs** (confirmed by a full read of all 16
numbered sections) — unlike Ozow's mandatory binding AFSA arbitration in Johannesburg. **No
specific forum/venue is named** — unlike PayFast's exclusive Cape Town jurisdiction. **No
mandatory pre-litigation escalation or conciliation step is stated** — unlike PayFast's 30-day
CEO/senior-executive conciliation or Ozow's 14-business-day service-delivery-manager escalation.
This means Yoco could, in principle, sue SAOC (or vice versa, subject to normal standing rules)
in any court with jurisdiction, including a local Magistrate's Court — a lower-cost, lower-
formality forum than either AFSA arbitration in Johannesburg or the Cape Town High Court, and one
a volunteer committee is more likely to be able to engage with without specialist counsel. **No
cost-allocation clause is stated** — ordinary South African civil procedure cost rules would
apply by default, the same ABSENT finding as both competitors.

**Liability cap — Main T&Cs §15.2, verbatim, a specific and unusually low figure:**
> "Yoco's total aggregate liability to you for any claims arising out of or in connection with
> this Agreement or the Services... is limited to the total fees paid by you to Yoco in the six
> (6) months immediately preceding the event giving rise to the claim. **Where you have not yet
> started using the Services, or have not paid any fees to Yoco at the time the event giving
> rise to the claim occurs, Yoco's total aggregate liability to you is limited to ZAR 20,000.**"

This is a concrete number, not a formula deferred elsewhere. For a triennial-cycle non-profit
whose Yoco fee spend is concentrated into a few weeks every three years, the "six months of
fees" base will most months be close to zero — meaning the effective cap for most of SAOC's
relationship with Yoco would be the flat **ZAR 20,000** floor, not a percentage of a meaningful
transaction volume. This is comparable in spirit to PayFast's "2 months' fee revenue" cap
(also likely to be small for the same reason) and lower in absolute terms than Ozow's "12
months' Processing Fees" cap for a merchant that has been transacting steadily — but Yoco's is
the only one of the three that states an absolute rand floor rather than only a formula, which
is useful certainty even though the number itself is modest.

**No dedicated chargeback-fee amount was found** in any accessible Yoco source (Ozow charges
R350/chargeback; PayFast's fee structure is undisclosed) — whether Yoco charges a per-chargeback
administrative fee, and how much, is unknown from the sources this teardown could retrieve; this
detail likely sits in the unreachable Merchant Agreement/Payment Services T&Cs alongside the
Reserve Account mechanics from Section 2.

---

## Summary table — gaps 1–9

| # | Gap | Verdict |
|---|---|---|
| 1 | Fees | The carried-over 2.95%-flat figure is WRONG — real rate for online ticket sales (Core Plan, R0–R50k tier) is 2.95% + R2 ex-VAT, making a R500 ticket cost R16.75, not R14.75. This puts Yoco *between* Ozow (R15.25) and PayFast (R18.00), not below both. No setup/monthly-minimum/PCI/termination fee. Fully disclosed with worked examples — more transparent than PayFast, comparable to Ozow. |
| 2 | Money you cannot get at | UNRESOLVED due to Alembic PDF failure. Main T&Cs give only open-ended, unquantified discretionary hold powers. One concrete figure found: transaction-review holds capped at 7 working days. A "Reserve Account" for Card chargebacks is confirmed to exist only via unverified search snippets of the unreachable Merchant Agreement — its cap %, holdback period, and release conditions are genuinely unknown, not confirmed absent. Chargeback exposure window is 18 months. |
| 3 | Lock-in | CONFIRMED, strongest of the three: no minimum term, no notice period, cancel "anytime... without any penalties or notice periods," stated in three independent public documents. Better than Ozow's 30-day notice and PayFast's 36-month auto-renewing term. |
| 4 | Dormancy | Best-evidenced of the three for SAOC's triennial cycle: profile "remains inactive over time" with no stated suspension, termination, or fee for inactivity found anywhere. FICA-driven profile updates (if triggered) disable, not terminate, on a 21-day clock and reactivate on completion. Rests on Help Centre + absence-of-contrary-clause, not a verbatim contract clause — moderate-high confidence, not certainty. |
| 5 | Settlement | Far more granular than either competitor (full day-of-week payout schedule, four payout speed tiers with concrete timing and cost) but carries the identical "no guarantee, as-is/as-available" disclaimer as both competitors — detailed but non-binding. |
| 6 | Refund mechanics | Both specifically-asked claims CONFIRMED: 90-day cap and same-day-only debit-card refunds. Partial refunds CONFIRMED SUPPORTED at app, POS, card-machine, and Checkout-API level (nullable amount field) — more explicit than either competitor. Funding-gate constraint mirrors both competitors, but Yoco's own docs proactively suggest a manual EFT workaround. Chargeback window (18 months) is separate from and far longer than the refund window (90 days). |
| 7 | Eligibility/onboarding | STRONGEST finding in Yoco's favour, and now properly verified rather than assumed: explicit, named "Non-Profit Organisation" business type matching SAOC's actual (possibly-unregistered, committee-run) structure; chairperson/treasurer/secretary/director can sign up; dedicated NPO FICA guide with per-stakeholder identity verification and a stated 48-hour per-person review turnaround. No overall onboarding-time SLA stated — ask Yoco support directly given the 2-week deadline. Advance-purchase/ticketing is ABSENT as a named category (matching both competitors) but so is PayFast's problematic dispatch-before-payment ambiguity. |
| 8 | Service levels | ABSENT — matches PayFast exactly: no uptime %, no response-time commitment, no remedy for any missed target, and an explicit "as is/as available" disclaimer. Weaker than Ozow, which at least states numeric (unenforced) targets. |
| 9 | Disputes | South African law, any court with jurisdiction including Magistrate's Court — no arbitration (unlike Ozow), no specific forum (unlike PayFast's Cape Town), no mandatory pre-litigation escalation (unlike both). Liability cap is a concrete figure: 6 months' fees, or a flat ZAR 20,000 floor for a merchant who hasn't yet paid meaningful fees — the only one of the three gateways to state an absolute rand number rather than only a formula. No chargeback-fee amount found — likely sits in the unreachable Merchant Agreement. |

---

## Verdict: does Yoco belong back in the ticket comparison?

**Yes — but not for the reason it was reconsidered.** The exclusion reason under review
("no recurring billing") was correctly identified as irrelevant to ticket sales, and Yoco
clears every eligibility and onboarding bar checked here — the non-profit signup path is real,
documented, and matches SAOC's structure more precisely than anything found for Ozow or
PayFast. Lock-in and dormancy, the two structural risks that matter most given SAOC's 3-year
idle cycle, are also both genuinely and verifiably better than the alternatives.

**However, the single most decision-relevant number in the brief — that Yoco is the cheapest
card option at R14.75 per R500 ticket — does not hold up.** The correct, freshly-verified figure
is R16.75 ex-VAT (2.95% + R2 per transaction on the online, sub-R50k-turnover tier), which places
Yoco *between* Ozow and PayFast, not below both. Yoco should be re-added to the comparison on the
strength of its onboarding speed, its unusually clean no-lock-in terms, and its dormancy
tolerance — not on the strength of being the cheapest rail, which it is not, on the numbers that
are actually current.

**Two open questions should go to Yoco support directly before any commitment, per the framing
constraint that these are adhesion contracts, not negotiable ones:**
1. What is the Reserve Account/chargeback-hold mechanism's actual cap percentage and holdback
   period for Card transactions (the Ozow-10%/180-day, PayFast-540-day equivalent), since the
   Merchant Agreement clause that would answer this could not be retrieved from any public
   source?
2. What is the realistic end-to-end onboarding time for a 3-person NPO committee (chairperson,
   treasurer, secretary), given the stated 48-hour *per-stakeholder* review window and the
   2-week deadline SAOC is working against?
