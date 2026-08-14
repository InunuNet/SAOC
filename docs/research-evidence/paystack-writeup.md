# Paystack South Africa — Facts Only

Client context: SA NPO, ~2,000 tickets at ~R500 for a 3-day event once every 3 years (~R1m per
cycle), account then idle ~36 months. Must be live by end of August 2026. All fetches via
Alembic, 2026-08-14, `?no_cache=true`. Primary contract source:
`https://paystack.com/za/terms` (31,261-word page containing the Merchant Services Agreement
("MSA") and the Data Processing Agreement ("DPA")). No separately signed contract exists for this
merchant class — clicking through registration is acceptance of this published MSA (MSA cl.
A.6.5: consent given "by selecting the checkbox feature at the point of creating your Paystack
Account"). Clause refs below are Section-letter + clause-number as printed (e.g. "MSA A.8.1").

## 1. Fees, advertised

Sources: `paystack.com/za/pricing` and `support.paystack.com/en/articles/2130306` ("Transactions
pricing", SA row). Card: **2.9% + R1.00, VAT exclusive**; international card **3.1% + R1.00, VAT
exclusive**. **Capitec Pay and Ozow EFT: 2% with no flat fee** (pricing page, verbatim). ZAR 1
flat fee waived under ZAR 10; no upfront/monthly fees; all payouts free; ZAR 3/bank transfer
(failed or successful). VAT basis, worked example (`.../articles/2124418`): "The 15% is charged
on the transaction amount of 2.9% + R1... for a R1,000 transaction: [2.9%*(R1,000)+R1] +
[15%*(2.9%*(R1,000)+R1] = R34.5" — VAT computed on top of the 2.9%+R1 base.

**R500 card ticket, ex-VAT:** 2.9%×500 = R14.50 + R1 = **R15.50**. **R500 via Capitec Pay/Ozow
EFT, ex-VAT:** 2%×500 = **R10.00**, no flat fee. No eligibility condition was found attached to
the 2% EFT rate — it's on the general public page. STATUS: VERIFIED.

## 2. Fees, contractual

**Central finding: the MSA sets no rate itself.** It defers to the website:

> "Paystack will provide the Services to you at the rates and for the fees ('Fees') described on
> the Paystack Pricing Page, linked here and incorporated into this Agreement as updated from
> time to time, unless agreed otherwise in an addendum... We may revise the Fees at any time.
> However, we will provide you with at least 30 days' advance Notice before revisions become
> applicable to you or such shorter Notice as is reasonably possible if the change to the Fees is
> required to comply with a new Law or regulatory directive." — MSA D.1

`"Paystack Pricing Page"` is defined as `https://paystack.com/[countrycode]/pricing` (Exhibit A)
— a live, unilaterally-revisable webpage, not a schedule annexed to the agreement. The only firm
contractual commitment is procedural: **30 days' notice of a fee change** (shorter if law forces
it). STATUS: VERIFIED — the advertised 2.9%+R1 / 2% figures are not locked by the MSA, they're
current pricing-page content, changeable on 30 days' notice.

## 3. Monthly / minimum / dormancy fees

No monthly, upfront, or minimum-volume fee anywhere in the MSA or pricing page ("No upfront or
monthly fees... Zero maintenance fee"). No inactivity/dormancy fee clause found (full-text search
of MSA + DPA for "dormant"/"inactiv" — zero matches). STATUS: VERIFIED (no monthly/minimum fee).
NOT ESTABLISHED for dormancy fee — silent, not confirmed absent.

## 4. Payment types

Confirmed (MSA Section B; pricing page): **Card** (Visa/Mastercard/Apple Pay), **EFT**, **Capitec
Pay**, **Ozow EFT**, **QR** (SnapScan, Masterpass), **donations** — MSA defines "Customer" as "a
consumer or company that purchases products or services from the Merchant, **or a donor**", and
Section A.2 refers to merchants who "accept donations." **Recurring/subscription billing** —
"Payment Processing Services" is defined to "enable Merchant to accept payments, **manage
subscriptions**, and perform Transaction reporting" (Exhibit A); no statement confirms
annual-interval billing specifically — NOT ESTABLISHED. **In-person/card machines** — no evidence
Paystack supplies POS hardware in South Africa; the material describes an
API/Dashboard/online-checkout model throughout, no terminal/hardware product named — NOT
ESTABLISHED. STATUS: VERIFIED for card, EFT, Capitec Pay/Ozow EFT, QR, donations. PARTIAL for
recurring billing. NOT ESTABLISHED for card-machine hardware.

## 5. Refunds

No dedicated "Refunds" clause with a time limit or fee-bearer rule was found. What is established:
refunds to the Merchant's customers are the **Merchant's sole responsibility** — Paystack "will
not be a party to any Claim or actions between you the Merchant and your Customers" and the
Merchant is "solely responsible for... delivery, support, refunds, returns" (MSA A.2). When
processed, Paystack **deducts the Refund amount from the Merchant's payout** (MSA D.3, "Payout
Amount": "we may deduct any amount which you owe to us... (including our Fees, any Reversals,
invalidated payments, Chargebacks, **Refunds**...)") — no clause confirms or denies whether
Paystack's own transaction fee is returned on a refunded transaction. Excessive/anticipated
Refunds are a listed ground for Paystack to suspend settlement (MSA D.3, "Payout Schedule"). No
numeric time limit on issuing a refund was found. STATUS: PARTIAL.

## 6. Contract term and exit

**No minimum term.** "This Agreement is effective upon the date you first access or use the
Services... and continues until terminated by you or Paystack. You may terminate this Agreement
by closing your Paystack Account at any time and ceasing to use the Services." (MSA A.8.1) — no
notice period required from the merchant. **Paystack may terminate for any reason on 24 hours'
notice**, or immediately without notice for cause: fraud/credit risk, breach, regulatory
requirement, acquirer/scheme requirement, regulatory directive, insolvency, or excessive Disputes
(MSA A.8.1). No auto-renewal — the contract is open-ended/at-will. No cancellation penalty found;
surviving obligations are financial (outstanding Fees, Fines, Disputes) plus IP/branding removal,
not an exit fee (MSA A.8.2). Governing law: **South Africa**; disputes to arbitration under
**AFSA**, seated in **Johannesburg**, in English (MSA A.19). STATUS: VERIFIED.

## 7. Dormancy

The MSA never uses "dormant" or "inactive" (confirmed by full-text search of MSA + DPA). No
suspension/fee/termination trigger is framed around elapsed inactivity — the only closure
triggers found (MSA A.8.1) are fraud/credit risk, breach, regulatory directive, insolvency, and
excessive Disputes; none reference time-without-use. STATUS: SILENT — not a guarantee nothing
happens to an idle account, just no clause to quote.

## 8. Settlement

Payout Schedule (contractual): "we will work with our partner banks or Payment Method Acquirer to
settle your Payout Account not later than 2 (two) Business Day from the Transaction date (T+2).
While international transactions will be settled 7 (seven) Business Days..." (MSA D.3) — matches
the pricing page: "It takes 2 working days after a customer pays for you to receive your
payout." Both agree: **T+2 business days domestic**. Paystack may change the Payout Schedule or suspend settlement, non-exhaustively for: pending/
excessive Disputes, Refunds, or Reversals; suspected suspicious activity; legal/court order. On
termination it may withhold settlement if it "reasonably determine[s]... losses resulting from
credit, fraud, or other legal risks" (MSA D.3). **Reserve clause** (rolling hold, "also referred to as a 'balance'"): "Where applicable, Paystack
will set up a Reserve... to account for the risk exposure of Merchant's Transactions. The Reserve
is set based on Paystack's reasonably assessed and then-current estimate of (i) the total amount
of Merchant's Transactions at any point in time (ii) Refund rates; (iii) Chargeback rates; (iv)
potential Fine exposure; and (v) any other relevant liabilities... **Generally, a Reserve will be
fully released to Merchant approximately six (6) months following the effective date of
termination** of the Agreement or the date Paystack stops processing for Merchant... unless
specific potential liabilities of Merchant remain at that point in time" (MSA D.3, "Reserve").
Unlike some competitors, **no fixed percentage or duration is stated while the account is
active** — it is set "in Paystack's sole discretion"; the only fixed figure is the ~6-month
post-termination release window. STATUS: VERIFIED (T+2 settlement; Reserve mechanism and 6-month
release figure, both quoted). In-life Reserve % and duration are discretionary, not numerically
fixed.

## 9. Chargebacks and disputes

"A Dispute (also known as a chargeback) is a reversal request of a credit card transaction
initiated by the cardholder... Where a dispute occurs, you are immediately liable for all claims,
expenses, fines and liability we incur arising out of that dispute and you agree that we may
recover these amounts by deducting such sums from the amounts which we would otherwise settle to
you... or by debiting your Payout Account." (MSA D.3) Response deadlines: liable for the
Transaction "where you fail to respond within the stipulated period for resolution (**48 hours
for chargeback disputes and 24 hours for fraud disputes**)..." (MSA B.1). High dispute-rate
consequence: rates "typically... exceeding **1%** total payment volume) may result in your
inability to accept Card Payments..." (MSA B.1). Survives termination: "we retain the right to
recover chargebacks, fraud claims, dispute fees, and related fines... pertaining to all
chargebacks that occur in relation to transactions processed during the term of this Agreement.
This obligation remains in force despite the conclusion of the contractual relationship." (MSA
D.3) Forum: contractual disputes (not chargebacks) go to AFSA arbitration, Johannesburg, English,
sole arbitrator, target 21 business days (MSA A.19). No specific chargeback fee amount (rand
figure) was found — the clause covers "claims, expenses, fines and liability... we incur," not a
published flat fee. STATUS: VERIFIED for process/deadlines/1% threshold. NOT ESTABLISHED for a
specific chargeback fee amount.

## 10. Liability cap

> "You agree to limit any additional liability not disclaimed or denied by the Paystack Entities
> under this Agreement to your direct and documented damages; and you further agree that under
> no circumstances will any such liability exceed in the aggregate **the amount of Fees paid by
> you to Paystack during the three-month period immediately preceding the event that gave rise to
> your claim for damages**." — MSA A.17

No fixed rand figure — the cap is relative to fees paid. Indirect, punitive, incidental, special,
consequential and exemplary damages are excluded entirely, "even if such damages are
foreseeable." STATUS: VERIFIED.

## 11. Service levels

No uptime percentage, response-time commitment, or SLA was found for the merchant Services. The
contract explicitly disclaims availability: "The Paystack Entities disclaim any knowledge of, and
do not guarantee:... (c) that the Services will be available at any particular time or location,
or will function in an uninterrupted manner or be secure..." (MSA A.16, "No Warranties"). The
same document does use "SLA" language elsewhere — a clause titled "Exclusion from Service Level
Agreements (SLAs)" exists for AI features specifically — but not for core payment processing.
STATUS: VERIFIED — absent for core Services.

## 12. Customer data

**No marketing-rights clause found.** The DPA casts Paystack as "Operator" and the Merchant as
"Responsible Party" under POPIA, restricting Paystack to processing "only... in accordance with
the Approved Purpose or on written instructions from the Merchant... for the purposes of
performing the Services." No language granting Paystack rights to market to or otherwise use the
Merchant's customer data was found. **Cross-border/trans-border processing — confirmed present:**

> "Paystack will provide some or all of the Services from systems located within South Africa and
> other countries outside of South Africa, and by entering into this Agreement, you acknowledge
> that Paystack may transfer Data to third countries in compliance with POPIA. As such, it is
> **your obligation to disclose to your Customers that Payment Data and Personal Information may
> be transferred, processed and stored outside of South Africa**... and to obtain from your
> Customers all necessary consents..." — MSA, Section E

The DPA formalises this with "**Restricted Transfer**" (transfer to a "**Third Country**" — one
outside a list in "Part B of the Schedule" to the DPA; that schedule's country list was not
recoverable in this pass). Transfers must comply with Data Protection Laws; Paystack is
restricted from disclosing data from a Third Country "other than for the performance of the
Services... or on written instructions of the Merchant." The consent burden sits with the
**Merchant**, not Paystack. Paystack South Africa (Pty) Ltd is the contracting entity
(PASA-licensed); the wider group is Stripe-owned with a Nigeria/multi-jurisdiction footprint,
consistent with Third-Country processing existing, but specific countries were not identified.
STATUS: VERIFIED for the cross-border clause and absence of a marketing clause. PARTIAL — actual
Third-Country list not recovered.

## 13. Non-profit support

MSA A.1.1 explicitly names charities as eligible: "Only businesses (including sole proprietors),
**bona fide charitable organizations**, and other entities or persons located in South Africa are
eligible to create a Paystack Account." No discounted/NPO-specific pricing tier exists:
`paystack.com/za/nonprofit` and `paystack.com/za/charity` both 404 ("404! Page not found"), and no
SA NPO/charity pricing page is indexed anywhere (confirmed by prior search sweep). The only
discount tier found anywhere is for **Nigerian** educational institutions (0.7% capped, or flat
NGN 300) — not applicable in South Africa. STATUS: VERIFIED.

## 14. Onboarding

**Self-serve, click-through** — no sales-led process found; account creation and agreement
acceptance both happen via a signup checkbox (MSA A.6.5). **KYC documents** for South Africa
(`support.paystack.com/en/articles/2124418`): Starter Business (general) — personal bank account
number, bank confirmation letter, valid government-issued ID, contact/business-owner information
("all the information you provide must belong to the same person"). Starter — Sole
Proprietorship — personal or business bank account, bank confirmation letter (≤6 months old),
business-owner contact info, valid ID, proof of address (≤6 months old). Registered Business —
bank confirmation letter (≤6 months old), CIPC Certificate of registration, CIPC Enterprise
Number, details of at least one director.

An NPO of this kind would fall under "Registered Businesses" — CIPC registration, a director's
details, and a bank confirmation letter. **No stated verification turnaround time** was found
anywhere in the fetched material. **No Nigerian connection required** — the contracting entity is
Paystack South Africa (Pty) Ltd, PASA-licensed, with its own ZA terms, KYC set and pricing page;
nothing requires a Nigerian bank account, address, or affiliate relationship. **Two-week
feasibility** cannot be established from public material — no published review-turnaround SLA.
STATUS: VERIFIED for mechanism, KYC lists, no-Nigeria-required. NOT ESTABLISHED for turnaround
time / two-week feasibility.

## 15. Open questions for the vendor

1. Actual KYC turnaround time for a Registered Business (NPO) in South Africa — can it be
   expedited to be live before end of August 2026?
2. Would the Reserve (MSA D.3) typically apply to a low-chargeback-risk, one-off ticketing NPO
   event, and at what indicative %/duration, given the contract leaves this to discretion?
3. What happens to an account with zero activity for ~36 months between National Show cycles —
   suspension, re-verification, or does it remain live? The contract is silent.
4. Is Paystack's own transaction fee refunded to the merchant when a customer transaction is
   refunded, or retained regardless?
5. Which "Third Countries" (DPA Schedule Part B) does Paystack process/store SA data in?
6. Is there a published, numeric chargeback fee (rand amount), separate from the general
   "claims, expenses, fines and liability" language in MSA D.3?
7. Does Paystack support annual-interval recurring billing, or only shorter cycles?
8. Does Paystack offer in-person/card-machine hardware in South Africa, or is it online/API-only?

## Summary table

| # | Heading | One-line answer | Status |
|---|---|---|---|
| 1 | Fees, advertised | Card 2.9%+R1 ex-VAT (R15.50 on R500); Capitec Pay/Ozow EFT 2% flat (R10.00 on R500) | VERIFIED |
| 2 | Fees, contractual | MSA sets no rate — defers wholly to the live Pricing Page, revisable on 30 days' notice | VERIFIED |
| 3 | Monthly/minimum/dormancy fees | No monthly/upfront/minimum fee; no dormancy fee found | VERIFIED / NOT ESTABLISHED (dormancy) |
| 4 | Payment types | Card, EFT, Capitec Pay, QR, donations, subscriptions confirmed; annual-interval & card-machine hardware unconfirmed | VERIFIED/PARTIAL |
| 5 | Refunds | No time limit or fee-bearer clause; refunds deducted from merchant payout, customer relationship is merchant's | PARTIAL |
| 6 | Contract term and exit | No minimum term, merchant exits any time no notice; Paystack exits on 24hrs (or immediate for cause); AFSA arbitration, JHB | VERIFIED |
| 7 | Dormancy | Contract silent — no clause found either way | SILENT |
| 8 | Settlement | T+2 business days domestic (contractual, matches marketing); Reserve discretionary, ~6-month release after termination | VERIFIED |
| 9 | Chargebacks/disputes | 48hr chargeback / 24hr fraud response; 1% dispute-rate threshold; survives termination; no fixed fee figure | VERIFIED/PARTIAL |
| 10 | Liability cap | Capped at Fees paid in the 3 months preceding the claim; no fixed rand figure | VERIFIED |
| 11 | Service levels | None — contract explicitly disclaims any uptime/availability guarantee for core Services | VERIFIED (absent) |
| 12 | Customer data | No marketing-rights clause; cross-border transfer to "Third Countries" explicitly permitted, consent burden on merchant | VERIFIED/PARTIAL |
| 13 | Non-profit support | Charities explicitly eligible to register; no NPO pricing discount exists for South Africa (confirmed 404s) | VERIFIED |
| 14 | Onboarding | Self-serve, no Nigeria connection required; KYC docs listed for Registered Business; no stated turnaround time | VERIFIED/NOT ESTABLISHED |
| 15 | Open questions | 8 questions listed above, ready to send to vendor | — |
