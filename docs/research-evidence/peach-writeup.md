# Peach Payments — Fact Sheet

Facts only. No scoring, ranking, or comparison to other providers. Primary source is the
Master Terms of Service (MSA) — "Peach-MSA-Automated-Onboarding-Updated-on-22-July-2025.pdf",
35 pages, retrieved via Alembic → r.jina.ai fallback from
`https://www.peachpayments.com/legal-doc/merchant-service-agreement/` on 2026-08-14 (see
`.agent/memory/scratch/reach/peach.md` and `gaps.md` for reachability history). Clause numbers
below refer to this document unless stated otherwise. This is a click-through agreement
presented at onboarding — no separately negotiated "signed" copy exists apart from the
published MSA.

---

## 1. Fees, advertised — VERIFIED (primary source: the MSA's own fee schedule, Annexure A)

All fees "are net and are stated in ZAR. V.A.T. will be added where applicable" — i.e.
**ex-VAT** (Annexure A preamble).

- **Processing Fee**: ZAR 1.50 per transaction, applies to all payment methods, charged on
  every attempted transaction whether successful or declined (Annexure A §II; cl. 4.3).
- **Merchant Acceptance Fee — Card (e-commerce)**: Local SA card with 3DS **2.95%**; Local SA
  card without 3DS 3.5%; international cards 3.5% (Annexure A §IV).
- **PayByBank (instant EFT equivalent)**: 1.50%, no additional per-transaction fee
  (Annexure A §IV).
- Other named rails in the same table: Mobicred 3.50%; ZeroPay 4.75% + R2.00/txn; PayFlex
  (BNPL) 5.25% + R4.00/txn; PayPal (volume-based, per Merchant/PayPal agreement); RCS 3.50% +
  R1.50/txn; Happy Pay 4.99% + R4.00/txn; Float 6.50% + R24.00/txn; MoneyBadger 1.50% +
  R1.50/txn.
- **Card ticket at R500 ex-VAT**: Processing Fee R1.50 + Merchant Acceptance Fee 2.95% ×
  R500 = R14.75 → **total R16.25 ex-VAT** per ticket.

## 2. Fees, contractual — VERIFIED, and the fee schedule IS binding, not deferred

The MSA does not defer pricing to a separate undisclosed application — the rates are printed
in Annexure A of the signed agreement itself (quoted above). Verbatim on adjustment:

> "4.5. Peach Payments may adjust the fees from time to time by **mutual agreement** with
> Merchant."

Verbatim on invoicing/payment: "4.1. Merchant will pay the Fees for using the Services as per
the Services Schedule. 4.2. Peach Payments will invoice on a monthly basis... Fees are due
within 3 business days of receipt of the invoice." Overdue interest: "4.6. ...interest against
all overdue amounts at 2% above the prevailing prime interest rate."

## 3. Monthly / minimum / dormancy fees — VERIFIED absent, quoted

Annexure A §I states explicitly:

> "Peach Payments Merchant Setup... **ZAR 0.00 · Monthly Fixed Fee ZAR 0.00**"

No minimum-volume charge is stated anywhere in the MSA or Annexure A. Tokenisation carries its
own optional monthly fee — Annexure A §V: "Monthly Subscription Billing / Tokenisation ZAR
200.00 per month" — but this only applies if the Merchant uses card-storage/tokenisation; it
is not a baseline account fee. No inactivity/dormancy fee is mentioned anywhere in the
document (see item 7).

## 4. Payment types — VERIFIED

- **Once-off card**: yes (Annexure A §IV card table).
- **Recurring/subscriptions**: yes, via card tokenisation — Annexure A §V "Card Tokenisation
  and Risk Management," "Registration (RG)* ... This Transaction type will create a token on
  the Peach Payments platform," R200/month if used. Marketing copy on the NPO page corroborates:
  "Set up automatic charges for subscription services and memberships."
- **Donations**: explicitly named — cl. 1.7 defines Customer as owing payment "including
  charitable donations," and Annexure A §IX (Payment Links) says the portal can "collect
  invoice or bill payments, **donations**, or other payments."
- **In-person / card machines**: contract references a device fee category but defers pricing
  — Annexure A §XII: "POINT OF SALE DEVICE AND TRANSACTION FEES — **To be agreed separately.**"
  Whether Peach supplies hardware itself is not stated in the MSA.
- **EFT**: PayByBank, 1.50% (Annexure A §IV). **BNPL**: PayFlex, Happy Pay etc. listed in the
  fee table (Annexure A §IV).
- All of the above are generally available per the fee schedule — the MSA does not gate any
  behind a merchant category, though Peach can "disable any Payment Method at its discretion,
  including for risk, compliance, or operational reasons" (cl. 2.6).

## 5. Refunds — VERIFIED

> "6.4.9. Peach Payments will take reasonable steps to process requested refunds to Payers...
> the Merchant must not refund the customer directly, but should request a refund from Peach
> Payments in writing... Peach Payments will deduct the refund amount from the next
> settlement."

Fees are **not** returned on a refund: "4.4. Processing and Merchant Acceptance Fees are
payable irrespective of whether a successful Transaction is subsequently reversed, Disputed,
or refunded." Refunds/reversals are themselves billed: Annexure A §III lists "Chargeback /
Credit / Refund, Reversal / Scheduling (CB, CD, RV, RF, SD) — ZAR 3.00" per transaction. No
time limit on requesting a refund is stated anywhere in the MSA.

## 6. Contract term and exit — VERIFIED

> "8.1. This Agreement shall commence... and will endure **indefinitely** until terminated...
> 8.2. The Merchant may terminate this Agreement **at any time** on written notice to Peach
> Payments... 8.4. Outside of the circumstances in 8.3, Peach Payments may... terminate this
> Agreement by giving **45 days' written notice** to Merchant."

No minimum term, no auto-renewal clause (nothing to renew — term is indefinite by default),
and no cancellation penalty is stated anywhere. Immediate termination for cause requires "14
days' written notice" to remedy a breach first (cl. 8.3.1), except a list of no-cure grounds
(risk, fraud suspicion, Payment Scheme requirement — cl. 8.3.2–8.3.7).

## 7. Dormancy — NOT ESTABLISHED (confirmed silent)

The word "dormant"/"inactive"/"inactivity" does not appear anywhere in the 35-page MSA
(keyword-searched across the full extracted text). No clause describes what happens to an
account unused for an extended period — no suspension trigger, no fee, no automatic closure
tied to inactivity. The only relevant general power is Peach's no-cause termination right on
45 days' notice (cl. 8.4), not inactivity-specific. **A genuine contractual gap** — the
document is silent.

## 8. Settlement — VERIFIED

> "6.4.5. Peach Payments will credit the Merchant's nominated bank account with the total
> Proceeds... less any applicable amounts placed on hold... on a daily basis (**T plus 1**)...
> Transactions from any given day (T) will be settled and funds transferred to the Merchant on
> the subsequent business day (T+1)... settlement will be in **ZAR only**."

Corroborated by the NPO marketing page: "funds will reach your South African bank account the
very next business day, automatically, and free of charge."

**Hold/reserve clause** — no fixed percentage or fixed duration reserve exists; the hold is
open-ended and discretionary:

> "6.4.8. Peach Payments may **delay settlement** until it has resolved any uncertainty of the
> final amount... This may occur where there has been any actual or suspected Dispute, fraud,
> or compliance violation... or due to there being outstanding, incomplete, or incorrect KYC
> documentation... or the occurrence of any insolvency event."

No cap is stated on how long such a delay may last.

## 9. Chargebacks and disputes — VERIFIED

> "6.4.6. The Merchant is liable for any loss caused to Peach Payments related to a Disputed
> Transaction. This includes the Transaction amount that was charged back, but also any
> potential fees, fines or penalties imposed by any Payment Scheme... Peach Payments may levy
> an **administration fee** per Dispute received."

The admin fee is quantified in Annexure A §IV: "Admin Fee per Disputed Transaction – **350.00
ZAR**", separate from the general ZAR 3.00 chargeback/refund/reversal processing fee in
Annexure A §III. Liability for chargeback loss falls entirely on the Merchant (cl. 6.4.6,
6.4.10). **Governing forum**: South African law governs (cl. 17.1, item 10 below); the MSA
does **not** contain an arbitration clause — no mention of arbitration anywhere in the
document. A chargeback pattern can trigger listing on the "MasterCard Alert to Control
High-risk Merchants (MATCH) list" (cl. 8.7).

## 10. Liability cap — VERIFIED

> "11.6. Each party's liability to the other is limited to a maximum amount equal to the total
> amount of all Fees (excluding any pass-through fees...) paid by the Merchant to Peach
> Payments within the **3-month period** preceding the date on which the incident giving rise
> to the liability first occurred."

No fixed rand figure is stated — the cap is formulaic (three months' trailing fees), not a
named sum. Also excluded entirely: "indirect, extrinsic, special, or consequential loss or
damage of any kind whatsoever... including any loss of commercial opportunities or loss of
profits" (cl. 11.2).

## 11. Service levels — VERIFIED, present (Annexure B)

Unlike a silent-on-SLA contract, Peach's MSA has a full Annexure B ("Service Levels for Card
Processing") with a quantified uptime target and support-response commitments:

> "3. Contractual Target Availability... Should the availability... fall short of **99.0%**
> during one calendar month, the provisions of C.5 [Service Credits] shall apply."

Error-resolution targets are tiered: Category 1 (full outage) — 6 hours; Category 2 — 12
hours; Category 3 — 2 business days; Category 4 — "in a timely manner within the regular
software release cycles" (Annexure B §4). Breach triggers **service credits** against the next
invoice (10%–100% of that month's transaction fees, scaled to the shortfall), as liquidated
damages discharging further claims absent wilful misconduct or gross negligence (Annexure B
§5). "Office hours" support is committed contractually (Annexure B §7); 365-day phone/email
support is marketing-page-only, not in the MSA.

## 12. Customer data — VERIFIED, no marketing-rights clause; POPIA-standard transfer language only

No clause grants Peach rights to market to the Merchant's customers. The one adjacent
provision permits use of **anonymised** data only:

> (Annexure C, Schedule 1) "Peach Payments may take steps to derive anonymised data from
> Customer Personal Data and may use and disclose anonymised Customer Data for any purpose,
> **including market research and trend analysis**."

This is anonymised-data research language, not consent to market to identifiable customers.
On cross-border processing, Annexure C §7 is standard POPIA-adequacy language, not a blanket
consent grab:

> "To the extent that Peach Payments processes Personal Information outside of South Africa,
> such transfer shall be effected in terms of applicable Data Protection Laws and
> Regulations... by reference to the destination of the transfer... or by the use of standard
> data protection clauses in a contract or otherwise."

Merchant is the Controller/Responsible Party, Peach is the Processor/Operator (Annexure C §2).
Breach notification to the Merchant is committed at "within no more than seventy-two (72)
hours" (Annexure C §6).

## 13. Non-profit support — PARTIAL (real KYC route confirmed; no fee schedule found)

**KYC/onboarding route is real and documented.** Peach's FICA support article
(`support.peachpayments.com`, "Merchant FICA Requirements", fetched 2026-08-14) lists
**"Non-Profit Company/NPC" (reg. ending /08) and "Non-Profit Organization/NPO" (reg.
000-000NPO)** as 2 of 7 recognised contracting-party types, each with its own documented
FICA/KYC checklist (IDs of directors/office-bearers, proof of address, NPO Certificate,
authorisation resolution, proof of business bank account).

**No NPO-specific fee schedule exists.** The MSA's Annexure A (the binding fee schedule)
contains no NPO carve-out or discounted rate — one fee schedule applies to all merchants. The
marketing page `https://www.peachpayments.com/industry/other-npo/` (fetched 2026-08-14,
Alembic confidence HIGH) is a template "industries" lead-gen page (same layout as retail,
education, insurance, etc.): "Introducing Peach Payments, the ultimate payment gateway for the
non-profit industry. Simplify donations and transactions with ease" — ends in a "fill in your
details and our team... will get in touch" form, no pricing anywhere on or linked from it.
**VERDICT: real NPO KYC pathway confirmed (VERIFIED); no distinct NPO pricing tier found (NOT
ESTABLISHED) — SAOC would be quoted the standard rate in item 1 unless negotiated.**

## 14. Onboarding — PARTIAL

**Process, per the MSA**: "3.1. To use the Services, the Merchant will have to register and
complete the customer onboarding process. 3.2. The Merchant onboarding process includes a
commercial approval and verification process, as well as the Merchant's technical integration
to access the Services" (cl. 3.1–3.2). No verification timeframe is stated in the MSA.

**Self-serve vs sales-led**: mixed signal. The FICA article documents a self-service-style
checklist per entity type (a merchant could gather documents without a salesperson). But the
NPO-specific marketing page is explicitly lead-gen ("our team of payments experts will get in
touch and walk you through getting set up") — for an NPO the confirmed path is sales-assisted.
**No page or clause states a specific number of days to go live.**

**Feasibility of being live within two weeks**: NOT ESTABLISHED from public sources — no
verification-timeframe commitment exists to check this against. This should be asked directly
of Peach (see item 15).

## 15. Open questions for the vendor

1. Actual FICA/KYC turnaround for an NPO applicant, document submission to first live
   transaction — is going live within 2 weeks (by end of August 2026) realistic?
2. Is a bespoke/negotiated rate available for a registered NPO, given the KYC pathway exists
   but no discounted fee schedule is published?
3. What triggers, and how long can, a settlement hold (cl. 6.4.8) last in practice — is there
   any effective cap, given the MSA states no percentage or maximum duration?
4. Given the MSA is silent on dormancy (item 7), what happens in practice to an account with
   no transactions for ~36 months — re-KYC required, suspension, or simply idle at ZAR 0.00/mo?
5. Does Peach supply point-of-sale hardware directly, and on what terms, given Annexure A
   §XII defers POS pricing to a separate agreement?
6. Is the 2.95% + R1.50 (3DS) rate and R200/month tokenisation fee current, given Annexure A
   fees "may [be] adjust[ed]... by mutual agreement" — can current rates be confirmed in
   writing before signing?

---

*Compiled 2026-08-14. Primary source: Peach MSA PDF (35 pp.) via r.jina.ai fallback. Secondary
sources: Peach FICA support article, Peach NPO industry page — both via Alembic, cited inline.*
