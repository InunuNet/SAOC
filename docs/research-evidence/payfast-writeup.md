# PayFast — Merchant Terms Writeup

Source: `docs/research-evidence/payfast-general-terms.md` (PayFast General Terms and Conditions,
effective April 2024, updated November 2025 — click-through contract, ~22,900 words, PRIMARY
SOURCE — confirmed via `.agent/memory/scratch/reach/payfast.md` that this IS the operative
merchant contract, no separate signed document exists). Corroborating: `payfast-teardown.md`,
`npo-pricing.md`, `merchant-evidence.md`. Fetched/on-disk 2026-08-14.

---

## 1. Fees, advertised
**VERIFIED** (marketing page, not contract). Source: payfast.io/fees/, fetched 2026-08-14.
Credit/Cheque Card: **3.2% + R2.00**. Instant EFT: 2.0% (min R2.00). Capitec Pay: 2.0% (min
R2.00). Worked example on the page itself, ex-VAT: *"Transaction cost: R500.00 / You only pay:
R18.00 (ex VAT)."* On a R500 card ticket: **R18.00 ex-VAT** (page's own figure).

## 2. Fees, contractual — MOST IMPORTANT HEADING
**VERIFIED — the contract discloses no fee amount at all.** Every fee that costs money is
deferred to "the Application," an unpublished per-merchant sign-up document, not the T&Cs. Cl. 3.4,
verbatim: *"In the event the monthly volume of Payment Transactions is ZAR 20,000 or less, you
shall pay the Minimum Volume Fee stated in the Application."* Transaction Fee is only defined
(cl. 28 Definitions), never quantified: *"a percentage fee per Payment Transaction... or the lump
sum fee per Payment Transaction... or both."* Payout Fee: "as specified in your Application or
notified by us" (cl. 4.5). Fee increases: 30 days' notice (cl. 3.5). **The one fee the contract
tries to name outright — the Termination Fee (cl. 21.2(iii)) — cross-references clause "21.3(ii),"
which does not exist in the document** (cl. 21.3 has only sub-clause (i)); confirmed by full-text
search, zero other "termination fee" hits. No amount for it is disclosed anywhere.

## 3. Monthly / minimum / dormancy fees
**VERIFIED.** Minimum Volume Fee applies whenever monthly Payment Transactions ≤ ZAR 20,000 (cl.
3.4) — amount undisclosed, set in "the Application." Dashboard Service: free for first month
("Trial Period"), then a charge "stated in the Application," amendable on notice. Smart Bundle:
"a fixed lumpsum fee per month," amount not stated, contents alterable by PayFast at sole
discretion. No PCI or setup fee found as a distinct chargeable item.

## 4. Payment types
**VERIFIED.** Card (POS/online/MO-TO), EFT, BNPL (via clause 10.2, third-party BNPL settles
directly, PayFast not liable for that leg). **In-person card-machine hardware supplied** —
Equipment lease terms present (cl. 13, "Lease of equipment"), PayFast retains ownership of
software/APIs. Recurring/subscription: confirmed supported via the Dashboard's "Customer
Subscriptions" feature (pause/edit/cancel procedures documented, `payfast-teardown.md` corroborates
via KB article `managing-subscriptions-on-your-payfast-dashboard`). Donations: supported generally,
with a distinct "Cause account" product (see §13).

## 5. Refunds
**VERIFIED.** Refund-to-original-card and amount-ceiling confirmed, cl. 11.7 verbatim: *"The
value of a Refund shall not exceed the amount of the original Payment Transaction and you may
only process a Refund to the same Card which was used for the original Payment Transaction."*
Buyer-facing disclosure requirement (cl. 11.5) is stricter than a linked policy — must be on the
same screen as the checkout total. PayFast may require SAOC to fund a refund from its own bank
account before processing it, or refuse outright (cl. 11.10, sole discretion, reasons disclosed
only "where possible"). **Partial refunds: ABSENT as a named mechanism** — only inferable from
the "shall not exceed" ceiling language in cl. 11.7. **Time limits on requesting a refund: ABSENT
— not addressed.** Who bears the fee: not separately stated for ordinary refunds (exchange-rate
losses on erroneous refunds fall on the merchant, cl. 11.8).

## 6. Contract term and exit
**VERIFIED.** **36-month Initial Term, auto-renewing in further 36-month blocks** (cl. 21.1),
escaped only by written non-renewal notice **at least 3 months before expiry**. PayFast may
terminate for convenience on 60 days' notice, or immediately on 8 listed grounds (cl. 21.2(ii)).
SAOC's own voluntary termination (cl. 21.3(i)) states explicitly "without... any penalty for such
termination" — for convenience on 60 days' notice, or immediately for PayFast's uncured 30-day
breach. The only named Termination Fee in the document applies to PayFast's automatic termination
after 12 months' inactivity (cl. 21.2(iii)) and its amount is undisclosed (see §2).

## 7. Dormancy
**VERIFIED, not silent.** Cl. 21.2(i): 6 months of inactivity → PayFast **may suspend the
Services and still charge applicable Fees**. Cl. 21.2(iii): 12 months of continuous inactivity →
**automatic termination**, "a Termination Fee... may be charged... at our discretion" — amount
undisclosed (broken cross-reference, see §2). For SAOC's triennial cycle, ~30 of every 36 months
falls inside this inactive window.

## 8. Settlement
**VERIFIED.** Cl. 9.1, the entire affirmative promise: *"We shall settle the Sale Proceeds by a
credit to the Bank Account, in accordance with the funding frequency set out in the Application.
We reserve the right to change the funding frequency period upon notice to you."* No fixed
frequency in the contract text; no minimum notice period specified for a funding-frequency change
specifically. Hold/reserve mechanisms: 12-trigger discretionary hold + irrevocable lien over Sale
Proceeds (cl. 9.6); duration open-ended, "until we are satisfied that all sums due... have been
fully paid" (cl. 9.7); **540-day ceiling** (cl. 9.8), earliest of three clocks (from delivery, from
termination, or Card Scheme chargeback/refund window close); Security Collateral, cash deposit or
bank guarantee, increasable at PayFast's discretion (cl. 20.1–20.2); no interest accrues on held
funds (cl. 9.3). No liability attaches to late settlement beyond the general liability cap (§10).

## 9. Chargebacks and disputes
**VERIFIED.** 18 named Chargeback grounds (cl. 11.1(i)–(xviii)), broad and Card-Scheme-Rules
driven. Merchant bears burden of proof to dispute a Chargeback (cl. 11.2); "we shall not be under
any obligation to investigate or challenge the validity of a Chargeback." Excessive Chargeback
threshold breach → additional conditions or suspension (cl. 11.4). Forum: **South African law**,
mandatory 30-day CEO/senior-executive conciliation, then **exclusive jurisdiction of the Cape Town
courts** (cl. 26) — no arbitration clause exists anywhere (confirmed by full-text search). No
special cost-allocation clause — ordinary litigation cost rules apply by default. Indemnity (cl.
22) and liability exclusions (cl. 23) survive termination (cl. 23.5).

## 10. Liability cap
**VERIFIED.** Cl. 23.2, verbatim: *"our liability for any action or inaction, or direct Losses...
except in case of gross negligence and willful misconduct... shall not in aggregate in a calendar
year exceed the Fees earned by us from your Payment Transactions during the immediately preceding
two (2) calendar months, or the cost of reprocessing the related Transaction, whichever is
lower."* No rand figure — a formula (2 months' own fee revenue), which for a triennial-cycle
merchant will be near-zero most of the year. Indirect/consequential loss excluded entirely (cl.
23.3), including "loss of profits, loss of business, loss of good will."

## 11. Service levels
**VERIFIED absent.** Full-text search for "service level," "uptime," "SLA," "availability of the
Service" — zero hits anywhere in the ~22,900-word document. Only quality-of-service language: cl.
1.1, "using reasonable skill and care." PayFast affirmatively disclaims uninterrupted/error-free
operation (cl. 19.3). No remedy of any kind for an outage.

## 12. Customer data
**VERIFIED — no Ozow-20.8.1 equivalent found; the marketing consent is scoped to the merchant,
not the merchant's customers.** Cl. 16.4 lists purposes for which PayFast (as Responsible Party,
cl. 16.3) may process "Transaction data and/or Personal Data relating to you and the Cardholder,"
but the marketing sub-clause is scoped only to the merchant: *"(v) to contact **you** and/or
include **you** in corporate, marketing and similar reports or publications that may be made
available to third parties."* No PayFast clause authorises marketing communications to the
merchant's Cardholders/customers. Cross-border transfer consent is present and broad, cl. 16.4
preamble: *"we or any third party authorized by us... may collect, use, access, store, reproduce,
transfer... whether inside or outside the Territory."* This confirms and re-verifies the prior
session's finding (`npo-pricing.md`, `merchant-evidence.md`): PayFast has cross-border data
processing consent (broad, like Ozow's cl. 20.7) but **no direct-marketing-to-Cardholders clause**
equivalent to Ozow's cl. 20.8.1.2.

## 13. Non-profit support
**VERIFIED — a named product exists, but its rate is unpublished and its scope to ticket sales
is unconfirmed.** payfast.io/account-types/ (fetched 2026-08-14): *"A Cause account is for
registered NPOs... to aid them in fundraising by accepting donations online. This account comes
with reduced fees as well as a cause page hosted by Payfast."* KYC route documented: NPO cert
(DSD), PBO confirmation (SARS), Section 21/NPC (CIPC), or Trust (IT number/Deed) —
`support.payfast.help` KB article, fetched 2026-08-14. **The rate is not published anywhere** —
the only figure found in writing is an 8-year-old, one-day promotional rate (1.5% ex-VAT, 27 Nov
2018), explicitly not a standing rate; the current /fees/ page makes no mention of Cause pricing
at all. **Whether the discount applies to goods/ticket sales or donations only is unresolved from
public sources** — all marketing copy is donations-framed, but one KB article uses the broader
phrase "donations and/or payments." This is a real fee schedule for donations at minimum; whether
it reaches SAOC's actual revenue stream (ticket sales) is unconfirmed, not marketing fluff — it is
a genuine open question requiring a direct answer from PayFast.

## 14. Onboarding
**PARTIAL.** Self-serve, click-through acceptance at sign-up (no separate signed contract).
KYC/underwriting demands are real and can be extensive: cl. 19.5(viii)–(ix), audited financial
statements, balance sheet/P&L "for any fiscal year," beneficial-owner information, with a right
to withhold settlements if KYC/trade-license/shareholder information is not kept updated. No
onboarding-duration commitment found anywhere in the T&Cs. Advance-purchase/ticketing is not named
as a category (cl. 12, Schedule 2 names only car rental, hotel accommodation, marketplace); the
dispatch-before-payment clause (cl. 12.3, written around physical goods) has textually unclear
applicability to a Show admission ticket. **Feasibility of going live inside two weeks: NOT
ESTABLISHED** from the contract or public pages.

## 15. Open questions for the vendor
1. Does the Cause account's reduced-fee pricing apply to the sale of goods/services (e.g. event
   tickets), or only to donations?
2. If it does apply, what is the current standing percentage and flat fee for card and Instant
   EFT transactions on a verified Cause account?
3. What NPO documentation is required to open/verify a Cause account, and what is the realistic
   verification turnaround given a ~2-week deadline?
4. What is clause 21.3(ii) supposed to say, and what is the actual Termination Fee amount for
   automatic termination on 12 months' inactivity?
5. What is the standard, non-promotional funding frequency for settlement under "the Application,"
   and can it be fixed contractually rather than left to PayFast's unilateral discretion?
