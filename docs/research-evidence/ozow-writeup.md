# Ozow — Merchant Terms Writeup

Source: `docs/research-evidence/ozow-merchant-terms-v1.2026.md` (Ozow Merchant Terms & Conditions,
V1.2026, effective 1 April 2026 — full Master Service Agreement, 26 clauses + Annexures +
Schedules, PRIMARY SOURCE). Corroborating: `ozow-teardown.md`, `npo-pricing.md`,
`merchant-evidence.md`, `.agent/memory/scratch/reach/ozow.md`. Fetched/on-disk 2026-08-14.

---

## 1. Fees, advertised
**VERIFIED** (marketing page, not contract). Source: ozow.com/pricing, fetched 2026-08-14.
Local Card Payments: **2.85%** for R0–R249,999.99, min R1.00. Pay By Bank / Capitec Pay / Absa
Pay / Nedbank Direct EFT: **1.5%**, min R1.00. VAT basis **UNCONFIRMED** — pricing page does not
label ex- or incl-VAT. On a R500 card ticket: **R14.25** (2.85% × R500), VAT treatment unstated.

## 2. Fees, contractual — MOST IMPORTANT HEADING
**VERIFIED.** The contract does not commit to a rate — it defers to Order Form or website,
verbatim (cl. 6.1.1): *"The Merchant shall pay to Ozow the Processing Fees for the Services as
set out in the Order Form or, where no pricing is specified in the Order Form for a particular
Service, as published on Ozow's website at www.ozow.com."* Pricing hierarchy (cl. 6.2.1): Legacy
Merchant terms > Order Form > standard website pricing. Fee increases: 14 days' written notice
(cl. 6.4.1.2), automatic for website-tier merchants (cl. 6.4.2). VAT: exclusive, added per invoice
(cl. 6.3.2). One quantified fee is fixed in the contract text itself: Card Chargeback Fee, Annexure
3 §9.3, **R350.00 excl. VAT per Chargeback**, "subject to change... to reflect changes... imposed
by the Acquirer and... Card Schemes."

## 3. Monthly / minimum / dormancy fees
**VERIFIED absent.** No monthly, minimum-volume, setup, or PCI fee found anywhere in the MSA,
Annexures, or Schedules (confirmed by targeted search in `ozow-teardown.md`). All fees are
per-transaction or product-specific (SMS, AVS, Voucher — all Order-Form/website-priced, no
contract-fixed amount).

## 4. Payment types
**VERIFIED.** Pay by Bank (screen-scraping + API/real-time), PayShap, Card (Annexure 3), Buy
Now Pay Later (4.99% + R4.00, ozow.com/pricing), crypto. **No dedicated recurring/subscription
product identified** in the MSA or Annexures reviewed. **No in-person card-machine hardware** —
Ozow is online/redirect-based; no Annexure describes physical POS hardware supply.

## 5. Refunds
**VERIFIED, with real gaps.** Refund-to-original-method confirmed across rails: Pay by Bank
(Annexure 1 §6.1, "same payment method used for the original transaction"); Card (Annexure 3
§13.1, credit to originating Card only). Refund is funding-gated (cl. 7.3.1): *"subject to there
being sufficient funds in the Merchant's Float or aggregated balance held by Ozow, Ozow shall
process Refunds as instructed by the Merchant."* **Partial refunds: ABSENT — not addressed.**
**Time limits on requesting a refund: ABSENT — not addressed.** Who bears the fee: not stated for
Refunds generically (Chargeback Fee, R350, is separately itemised — see §2 above).

## 6. Contract term and exit
**VERIFIED.** No fixed initial term — indefinite duration (cl. 4.1.1). Either party may terminate
for any reason on **30 days' written notice** (cl. 4.3.1). No auto-renewal (none exists to trigger,
contract is indefinite). No early-termination penalty found anywhere (targeted search for
"termination fee" / "penalty" — zero hits tied to voluntary exit). Product-level opt-out: 30 days'
notice, no penalty (cl. 15.4.1).

## 7. Dormancy
**VERIFIED, not silent.** Cl. 4.5.1: *"Ozow may suspend or terminate this Agreement immediately
upon written notice to the Merchant if the Merchant has not processed any Transactions or the
Merchant's account has been dormant for a continuous period of **nine (9) months**."* No fee is
attached to dormancy termination — it is account-continuity risk, not a charge.

## 8. Settlement
**VERIFIED.** No day-count stated for Pay by Bank or PayShap — settlement "in accordance with
reasonable endeavours" (cl. 7.1.1) and rail-dependent timelines (Annexure 1 §5.1). No
settlement-day clause found anywhere in Annexure 3 (Card). Only Crypto (Annexure 4 §2.2.3) states
a number: 2–5 Business Days. Ozow may settle gross or net of deductions at its sole discretion
(cl. 7.1.3). Reserve/hold: Rolling Reserve (Card only, Annexure 3 §9.5–9.10) — **up to 10% of
monthly Card turnover, held 180 days**, extendable at Ozow's discretion (§9.7), trigger not gated
on formal High-Risk classification ("or where otherwise deemed applicable by Ozow in its
discretion"). Float (cl. 7.2) required for refund-capable products, amount set unilaterally by
Ozow, uncapped in the contract. Liability for settlement delay is excluded (cl. 8.2.1.3–.4).

## 9. Chargebacks and disputes
**VERIFIED.** Card Chargeback Fee: R350 excl. VAT (Annexure 3 §9.3). Penalty Handling Fee: 1.05%
of invoiced penalty, on top of the fine (Annexure 3 §9.4). Process: Merchant must place disputed
Transaction on hold and provide documents within 48 hours of Ozow's request (cl. 14.3.1). Forum:
mandatory **binding arbitration**, AFSA Commercial Arbitration Rules, seated in **Johannesburg**,
after 14-Business-Day service-delivery-manager escalation (cl. 23.1–23.2). Urgent interim relief
only may go to the Gauteng Local Division High Court (cl. 23.3). Costs: ordinary
**party-and-party** scale (cl. 25.7.1) — not the elevated attorney-and-own-client scale reserved
for indemnity claims.

## 10. Liability cap
**VERIFIED.** Cl. 9.3.1, verbatim: *"Ozow's aggregate liability in respect of all claims relating
to this Agreement... shall not exceed the Processing Fees paid by the Merchant to Ozow in the
twelve (12) month period immediately preceding the date on which the claim arose."* No rand figure
stated — the cap is a formula (12 months' own fee spend), not an absolute number. Indirect/
consequential damages excluded entirely (cl. 9.2.1), except for death/personal injury, fraud,
wilful misconduct (cl. 9.4).

## 11. Service levels
**VERIFIED, present but toothless.** Schedule 4: System Interface Response Time — 95% of
Transactions under 5 seconds, 99.5% under 10 seconds (cl. 2.1). Service Availability — 98%
monthly, "reasonable endeavours" (cl. 4.1.1). Incident response tiers: Critical 30-min initial
response/2-hr restoration/24-hr resolution; Severe 1-hr/4-hr/48-hr; Routine 24-hr/N-A/5 Business
Days. **No remedy, service credit, or rebate of any kind is stated anywhere in Schedule 4** for a
missed target — confirmed by direct search of the full Schedule.

## 12. Customer data
**VERIFIED — Ozow's contract does claim both rights.** Cl. 20.8.1, verbatim, in full:
> *"The Merchant expressly consents and agrees that: 20.8.1.1 Ozow, its Affiliates, and service
> providers may contact the Merchant and its Customers using written, electronic, or verbal
> communication methods... 20.8.1.2 Ozow may send advertising and marketing communications
> (including direct marketing, electronic marketing, or telemarketing) in relation to Ozow's
> Services and products, subject to the Merchant's or Customer's right to opt out; 20.8.1.3 Ozow
> may Process and store Personal Information of the Merchant and Customers trans-border in
> accordance with clause 20.7; and 20.8.1.4 Ozow may use the Merchant's logo and name on Ozow's
> website, in marketing materials, and in communications with third parties..."*
Cross-border transfer is separately conditioned on an adequacy assessment (cl. 20.7.1–20.7.3,
POPIA/GDPR-equivalent standard, suspension if inadequate). This is the clause the task brief
flagged as known — confirmed verbatim, unchanged from prior findings.

## 13. Non-profit support
**VERIFIED absent.** No mention of "non-profit," "NPO," "PBO," or "charity" anywhere in the MSA,
Definitions, Schedule 2 (High-Risk), or any Annexure (`npo-pricing.md`, confirmed by fresh
2026-08-14 search of the full contract text and ozow.com/pricing). No NPO onboarding path, no
NPO KYC route, no fee schedule of any kind tied to non-profit status. **This is a genuine absence,
not marketing-vs-contract ambiguity** — there is no marketing claim to distinguish from a contract
term, because neither exists.

## 14. Onboarding
**PARTIAL.** Onboarding is self-serve, one-click acceptance at sign-up (confirmed via
`.agent/memory/scratch/reach/ozow.md` — merchants accept the published MSA directly, no bilateral
signature). KYC/FICA-type documentation required per cl. 11.4.1.3, 18.5.1.2 (bank integrations)
but no stated verification timeframe anywhere in the MSA. No advance-purchase/event-ticketing
business category is named (absent from Schedule 2 High-Risk list or elsewhere) — SAOC's industry
is not enumerated as High-Risk, but Ozow's open-ended discretionary High-Risk reclassification
power (cl. 13.3.2) could still apply to a volume/velocity spike. **Feasibility of going live inside
two weeks: NOT ESTABLISHED** — no onboarding-duration commitment found in the contract or public
pages; would need direct confirmation from Ozow.

## 15. Open questions for the vendor
1. What is the standard Processing Fee rate that will apply to SAOC under the "Order Form" or
   default website pricing, and is the 2.85% card / 1.5% Pay by Bank rate on ozow.com/pricing
   ex-VAT or incl-VAT?
2. Is SAOC's ticket-sales business model (advance-purchase, event-ticketing, concentrated
   triennial volume spike) likely to trigger discretionary High-Risk reclassification (cl. 13.3.2)
   or the Rolling Reserve (Annexure 3 §9.5, "or where otherwise deemed applicable by Ozow in its
   discretion")?
3. What Float amount would Ozow require for refund-capable Pay by Bank/PayShap products for a
   projected R1,000,000 ticket-sales cycle, and how is that amount set/notified (cl. 7.2.1)?
4. What is the realistic end-to-end onboarding and KYC verification timeframe for a South African
   non-profit committee, given SAOC's ~2-week deadline?
5. Is there any non-profit/NPO onboarding pathway or fee consideration, even if undocumented
   publicly?
