# Ozow Merchant Terms V1.2026 — Teardown Against the 9-Point Comparison Framework

Source: `ozow-terms.md` (Ozow Merchant Terms and Conditions V1.2026, effective 1 April 2026). All
quotes verbatim with clause numbers as they appear in the source. This document (a) verifies the
key claims in `reconciliation.md` rather than trusting them, and (b) answers the 9 gaps in the
comparison framework shared with the parallel PayFast teardown. Tone: facts as written, not
sharpened or softened because Ozow is the challenger.

---

## 1. FEES — every chargeable item found

Confirmed by direct re-read of Part 2, clause 6, and the Annexures. No additional fee categories
found beyond what `reconciliation.md` already listed.

**Specifically asked about:**

- **Termination fee** — **ABSENT.** Searched the full document (`grep -n "[Tt]ermination [Ff]ee"`)
  — zero hits. Clause 4.6 (Effect of Termination) requires only payment of "all Processing Fees
  and other amounts payable to Ozow up to and including the date of termination" (4.6.1.3). No
  separate penalty for terminating is imposed anywhere in the MSA, Annexures, or Schedules.
- **Monthly / minimum fee** — **ABSENT.** Clause 6 (Processing Fees and Pricing) ties all fees to
  Processing Fees per transaction, Pass-Through Fees, Chargeback Fees, Penalty Handling Fees, and
  product-specific fees (SMS, AVS, Voucher). No clause imposes a flat monthly or minimum-volume
  fee independent of transaction activity.
- **Setup fee** — **ABSENT.** No onboarding or setup fee clause found anywhere in the MSA or
  Annexures.
- **PCI fee** — **ABSENT as a chargeable item.** PCI DSS appears only as a *compliance
  obligation* on the Merchant (Annexure 3, cl. 14.3–14.4: "The Merchant shall comply with all
  applicable PCI DSS requirements... shall provide Ozow with evidence of PCI DSS compliance upon
  request"), not as a fee Ozow charges. No PCI compliance fee, non-compliance fee, or scan fee is
  itemised anywhere.

**Full fee inventory confirmed present** (matches `reconciliation.md` — no additions found on
this pass):

| Fee | Clause | Amount | Notes |
|---|---|---|---|
| Processing Fees | 6.1.1, 6.2 | Order Form, else website-published | Pricing hierarchy — see LOCK-IN section, not a fee amount itself |
| VAT | 6.3.2 | "exclusive of VAT... added to each invoice" | Confirmed ex-VAT convention |
| Late payment interest | 6.6.1 | prime + 2% p.a., daily, compounded monthly | |
| Debit order rejection recovery | 6.5.2 | bank/admin charges recovered | |
| Pass-Through Fees | 6.7.1–6.7.2 | uncapped, third-party cost pass-through | Notice can be after the fact (invoice line item) |
| Chargeback Fee (Card) | Annexure 3, 9.3 | R350.00 excl. VAT per Chargeback | "subject to change... to reflect changes... imposed by the Acquirer and... Card Schemes" |
| Penalty Handling Fee (Card) | Annexure 3, 9.4 | 1.05% of invoiced penalty, on top of the fine | |
| Refund fees (Pay by Bank) | Annexure 1, 6.4 | Order Form, else website-published | No fixed number in contract |
| Voucher Fees | Annexure 6, §7.1 | % of face value + VAT | Not read in full this pass; number not material to SAOC's use case |
| SMS Payment Request fee | 15.5.2 | Order Form, else website-published | Prepaid (15.5.3) |
| Account Verification Service (AVS) fee | 15.7.5 | Order Form, else website-published | Compulsory for High-Risk merchants on PayShap Request (15.7.4) |

**Conclusion:** no termination fee, no monthly/minimum fee, no setup fee, no PCI fee. This is a
materially simpler and lower fixed-cost fee structure than a gateway with a monthly minimum —
directly relevant to a low-volume, triennial-cycle non-profit. The trade-off is that several fee
*amounts* (standard Processing Fee rate, Pay by Bank refund fee, Chargeback Fee's future value)
are externally referenced rather than fixed in the contract, so the absence of a minimum fee does
not mean the effective cost is fixed or predictable.

---

## 2. MONEY YOU CANNOT GET AT — every hold/reserve/set-off mechanism, and realistic worst case

Re-verified against the source text directly (not just the reconciliation's summary). All four
mechanisms cited in the brief are confirmed present and quoted correctly:

**(a) Set-off, clause 3.5 — no prior notice required:**
> 3.5.1 Ozow may, without prior notice, set off any amounts owed by the Merchant to Ozow (whether
> arising under this Agreement, in relation to chargebacks, Refunds, fines, penalties, or
> otherwise, or amounts owed by the Merchant to a Customer in terms of clause 14) against any
> aggregated funds held by Ozow on behalf of the Merchant, any funds payable by Ozow to the
> Merchant, or the Merchant's Float (if applicable).

**(b) Deduction before settlement, clause 7.1.3 — Ozow's sole discretion whether to net or gross up:**
> 7.1.3 Ozow may, in its sole discretion, settle Transaction proceeds to the Merchant's Nominated
> Account either: (a) as the full Transaction amount, without deduction of any fees or other
> amounts owed by the Merchant to Ozow; or (b) after first deducting all applicable amounts, as
> determined by Ozow from time to time.

**(c) Float, clause 7.2 — required for refund-capable products, amount set unilaterally:**
> 7.2.1 Where required by Ozow for specific Services (including Services involving Payouts,
> Refunds, chargebacks, or reversals), the Merchant shall maintain a Float in an amount determined
> by Ozow from time to time and notified to the Merchant.

This is directly relevant to SAOC: if SAOC wants Ozow-processed refund capability (e.g., a
cancelled Show), Ozow can require SAOC to pre-fund a Float of an amount Ozow sets, with no cap
stated in the contract, and can demand top-ups (7.2.2) with no minimum notice period specified.

**(d) Rolling Reserve, Annexure 3 §9.5–9.10 (Card only) — confirmed verbatim, exactly as
`reconciliation.md` quoted it:**
> 9.5 For Merchants engaged in Card High Risk Activities, or where otherwise deemed applicable by
> Ozow in its discretion, Ozow may require the Merchant to provide a Rolling Reserve of up to ten
> percent (10%) of the Merchant's monthly Card Transaction turnover, to be held for a period of
> one hundred and eighty (180) days (the "Holdback Period")... The Rolling Reserve shall be
> released to the Merchant's Nominated Account on the first Business Day following the expiry of
> the one hundred and eighty (180) day period from the date on which the relevant funds were
> withheld, provided that no outstanding Chargebacks, fines, penalties, or other liabilities
> remain unresolved at such date.

> 9.7 During the Holdback Period, Ozow shall not be obligated to release the Rolling Reserve. Ozow
> may, upon prior written notice to the Merchant, increase the Rolling Reserve percentage or
> extend the Holdback Period if, in Ozow's reasonable discretion: 9.7.1 Ozow identifies specific
> Card Transactions that are deemed suspicious; 9.7.2 the Card Transactions exhibit a high
> reversal or Chargeback rate; or 9.7.3 the Card Transactions present an increased risk of loss to
> Ozow.

> 9.10 The Merchant shall remain liable for all amounts due in respect of chargebacks, fines,
> penalties, or other liabilities, even if such amounts exceed the funds held in the Rolling
> Reserve or settlements.

The trigger is confirmed **not gated on formal Schedule 2 High-Risk classification** — "or where
otherwise deemed applicable by Ozow in its discretion" is an independent, standalone trigger.

**Additional mechanism found on this pass, not separately itemised in `reconciliation.md`'s
Section 3 fee table** (it appears only in the unilateral-change table, item 5): **clause 10.1
(Annexure 3, Card) allows Ozow to impose transaction caps "as a condition of onboarding or
Activation"**:
> 10.1 Ozow reserves the right, exercisable in its sole and absolute discretion, to restrict,
> limit, or decline specific Card Transactions or categories of Card Transactions, or to impose
> caps on the Merchant's aggregate Card Transaction volumes or values, at any time during the term
> of this Agreement (including as a condition of onboarding or Activation)...

This is a volume/value cap, not a fund hold — but for a triennial Show with a concentrated
ticket-sales spike, an unstated volume cap imposed "as a condition of onboarding" could throttle
sales during the exact window SAOC needs full throughput. This does not answer gap 6
(probation/evaluation-period fund forfeiture) — see that section below — it is a separate,
narrower risk (throughput cap, not fund withholding).

**Realistic worst case for SAOC (Card rail specifically, the only rail with a quantified
reserve):** if SAOC processes National Show ticket sales via Card and Ozow deems the
concentrated-volume pattern reserve-worthy, up to 10% of that month's Card turnover can be held
for 180 days from the date each tranche of funds was withheld — meaning, in practice, a rolling
window that can extend materially beyond 180 days from the Show's close if ticket sales are spread
across the pre-Show weeks (each week's reserve slice has its own 180-day clock, per "the date on
which the relevant funds were withheld"). Combined with 9.7's discretionary extension trigger and
9.10's provision that Ozow can retain amounts even after the Holdback Period if liabilities are
still outstanding, **the worst case is a meaningful fraction of Show revenue inaccessible for six
months or more, entirely at Ozow's discretion, on a rail with no formal High-Risk gate required to
trigger it.** This matches — and is fully verified against — the reconciliation's conclusion. No
correction needed.

**Pay by Bank and PayShap have no reserve mechanism found anywhere in Annexures 1 or 2** — the
Rolling Reserve is a Card-only (Annexure 3) construct. If SAOC steers ticket sales toward Pay by
Bank/PayShap and away from Card, the Rolling Reserve exposure does not apply — though Float (7.2,
general MSA) still can, for any rail requiring refund capability.

---

## 3. LOCK-IN — term, auto-renewal, early-termination penalty

**Confirmed: clause 4.3.1, verbatim, exactly as briefed:**
> 4.3.1 Either party may terminate this Agreement for any reason upon thirty (30) days' written
> notice to the other party.

**No fixed initial term.** Clause 4.1.1: "This Agreement commences on the Effective Date and
continues indefinitely until terminated in accordance with its terms." There is no 12/24/36-month
minimum term clause anywhere in the MSA — confirmed by full read of Part 2 (clauses 3–17) and
targeted search across the whole document for "term" / "months" / "renew" in a contractual-tenor
sense.

**No auto-renewal trap.** Since the Agreement is indefinite-duration rather than fixed-term with
renewal, there is no auto-renewal clause to find, and none exists. This is structurally different
from — not just more lenient than — a fixed 36-month auto-renewing term.

**No early-termination penalty found anywhere.** Searched specifically for "termination fee,"
"early termination," and "penalty" in a termination context — the only "penalty" in the document
is the unrelated Card Scheme **Penalty Handling Fee** (Annexure 3, §9.4, for Card Scheme
fines/violations, not for ending the contract). Clause 4.6 (Effect of Termination) imposes no exit
penalty — only payment of amounts already due (4.6.1.3) and survival of certain clauses (9, 10,
19–25) for their natural purpose (liability caps, indemnities, confidentiality, IP, dispute
resolution, general provisions), not as a penalty mechanism.

**Product-level opt-out is also penalty-free, separately confirmed:**
> 15.4.1 The Merchant may elect to deactivate any individual Product by providing Ozow with thirty
> (30) days' prior written notice. Deactivation of a Product shall not, by itself, terminate this
> Agreement or affect the Merchant's rights or obligations in respect of any other Product or
> Service. The Merchant shall remain liable for all fees, charges, and obligations accrued up to
> the effective date of deactivation.

**Caveat, not a lock-in mechanism but relevant context for SAOC's decision:** clause 4.5.1
(Dormancy) means the *practical* lifespan of an idle account is capped at 9 months, cutting the
other way — Ozow can end the relationship unilaterally due to SAOC's own usage pattern (see
`reconciliation.md` §2, already correctly flagged as the single biggest structural mismatch found
in this contract). This does not create lock-in; it is the opposite problem — forced *un*-lock,
requiring re-onboarding before the next Show. It should be read alongside the 30-day
termination-for-convenience finding, not conflated with it: **Ozow has no lock-in mechanism, but
it also has no guarantee of account continuity across a 3-year gap.**

**Verdict on gap 3: CONFIRMED as briefed.** 30 days' notice, either party, for any reason. No
minimum term. No auto-renewal. No early-termination penalty found anywhere in the document. This
is a genuine, verified structural advantage over PayFast's stated 36-month auto-renewing term (per
the brief; PayFast's actual clause was not re-verified in this pass — that is the parallel
teardown's job).

---

## 4. SETTLEMENT — confirmed, no correction to reconciliation.md

Re-read Annexure 1 §5, Annexure 2 §1.3/§4.2, Annexure 3 (no settlement-day clause found anywhere
in it — confirmed by full read of all 18 clauses of Annexure 3 above), MSA §7.1, and MSA §8.2.1.

**Pay by Bank (Annexure 1, cl. 5.1):**
> 5.1.1 Screen-scraping transactions are subject to standard EFT settlement timeframes as
> determined by the South African payment clearing system. 5.1.2 API integration transactions may
> offer real-time or near-real-time settlement depending on the specific Sponsor Bank and payment
> rail utilized. 5.1.3 ...settlement timing is dependent on the relevant Sponsor Bank and payment
> infrastructure and may be affected by factors outside Ozow's control.

**PayShap:** not re-quoted here (already correctly quoted in `reconciliation.md`) — confirmed no
numeric day-count.

**Card (Annexure 3):** confirmed — no settlement-to-merchant timeframe anywhere in the 18 clauses
of this Annexure. Settlement is governed only by the general MSA §7.1 "reasonable endeavours"
standard.

**Liability exclusion, MSA §8.2.1.3–.4, confirmed verbatim:**
> 8.2.1.3 any delays in the settlement of Transaction funds, howsoever arising; and 8.2.1.4
> non-settlement of Transaction funds, howsoever arising.
(Both listed under "Exclusions from Ozow's Liability," §8.2.1, releasing Ozow from liability for
both.)

**Verdict on gap 4: CONFIRMED, no correction to reconciliation.md.** No annexure states a
day-count for any rail except Crypto (Annexure 4, §2.2.3: "two (2) to five (5) Business Days").
Clause 8.2.1 excludes Ozow's liability for settlement delay/non-settlement regardless of cause.

---

## 5. REFUND MECHANICS

**What the merchant must display to buyers:** Card Scheme requirement only, not a general Ozow
requirement — Annexure 3, cl. 6.1.3: the Merchant's website/application must prominently display
"the Merchant's return, refund, and cancellation policies" as part of Card Scheme brand-mark
compliance. No equivalent display requirement is imposed for Pay by Bank or PayShap in Annexures 1
or 2.

**Refund-to-original-method restriction — confirmed across all rails:**
- Pay by Bank, Annexure 1 §6.1: "Ozow may process refunds to Customers through the same payment
  method used for the original transaction."
- Card, Annexure 3 §13.1: "The Merchant shall not provide cash refunds or refunds by any method
  other than a credit to the Card originally used for the Transaction, unless otherwise permitted
  by the applicable Card Scheme Rules."
- This confirms `reconciliation.md`'s POPIA-advantage framing on the *mechanic* (no bank details
  collected) is accurate, while its caveat about SAOC's Responsible Party burden under cl. 20.5
  remains correctly stated and is not contradicted here.

**Partial refunds:** not addressed anywhere in the MSA or any Annexure. **ABSENT — not addressed.**
No clause distinguishes full vs. partial refunds or states whether partial refunds are supported
mechanically.

**Time limits on requesting a refund:** not addressed. **ABSENT — not addressed.** No clause
states a window (e.g., "within X days of the transaction") within which a Refund must be
requested or processed. The only time-bound provisions found relate to *chargebacks* (Card
Chargeback Threshold monitoring, Annexure 3 §12) and *documentation retention* (§8.1.9, 180 days),
not to a refund request deadline.

**Practical constraint on refunding a cancelled Show — the funding gate, confirmed and directly
material to SAOC's use case:**
> 7.3.1 Where a Service provides refund functionality and subject to there being sufficient funds
> in the Merchant's Float or aggregated balance held by Ozow, Ozow shall process Refunds as
> instructed by the Merchant.

If a National Show were cancelled after ticket revenue had already been subject to set-off (§3.5),
deduction (§7.1.3), or — for Card — locked into the Rolling Reserve (Annexure 3 §9.5), SAOC's
ability to refund every ticket-buyer promptly is directly contingent on whatever aggregated
balance or Float remains accessible at that moment, not on the gross amount originally collected.
This is the single most concrete way the reserve/set-off mechanisms in gap 2 could bite in
practice for a triennial-Show non-profit: **a mass-cancellation refund event is exactly the
scenario where Ozow's discretionary holds would matter most, and the contract does not carve out
any expedited-refund path for such an event.**

**Verdict on gap 5:** refund-to-original-method restriction CONFIRMED across all rails. Buyer-facing
disclosure requirement CONFIRMED but Card-Scheme-specific only. Partial refunds and refund time
limits are ABSENT — not addressed anywhere in the contract. Practical cancellation-refund
constraint is a real, contract-confirmed dependency on available Float/balance, not a hypothetical.

---

## 6. NEW-MERCHANT / PROBATION TREATMENT

**Searched specifically for this** ("new merchant," "probation," "evaluation period" — see grep
output) — **zero hits** for any dedicated new-merchant evaluation regime.

**ABSENT — not addressed** as a named or dedicated mechanism. There is no clause creating a
defined onboarding/probation window during which funds are specifically withheld or forfeited
pending fraud evaluation, and no clause naming a "Fraud Shield"-equivalent product.

**The closest analogues found, which are NOT equivalent to a dedicated new-merchant probation
regime and should not be conflated with one:**
- Annexure 3, cl. 10.1 — Ozow may impose Card transaction/value caps "as a condition of onboarding
  or Activation," in its "sole and absolute discretion." This throttles volume, not funds already
  collected — no forfeiture mechanism.
- Annexure 3, cl. 9.5's Rolling Reserve trigger ("or where otherwise deemed applicable by Ozow in
  its discretion") is broad enough to be applied to a new merchant's early transaction pattern,
  but it is the same general-purpose reserve mechanism covered in gap 2, not a distinct
  new-merchant product with its own rules.
- General onboarding/KYC clauses (MSA §11.4.1.3, Annexure 3 §2.1–2.3) require information and
  compliance but impose no fund-withholding consequence tied specifically to newness.

**Verdict on gap 6: ABSENT.** No PayFast-Fraud-Shield equivalent exists in this contract. The
generic discretionary Rolling Reserve (Card only, gap 2) and the discretionary volume cap
(Annexure 3 §10.1) are the only mechanisms that could functionally resemble new-merchant caution,
but neither is scoped, named, or time-bound as a probation period — they are open-ended
discretionary powers Ozow can exercise at any point in the relationship, not specifically at
onboarding.

---

## 7. ELIGIBILITY AND ONBOARDING

**Non-profit / PBO / NPO status:** searched the full document — **ABSENT.** No mention of
non-profit, PBO, or NPO entity types anywhere in the MSA, Schedule 1 (Definitions), Schedule 2
(High-Risk), or any Annexure.

**Entity types generally:** Schedule 1 definitions and clause 2.1(c) of the MSA define "a person"
broadly ("natural persons, corporate or unincorporated bodies... and their personal
representatives, successors and permitted assigns") but this is generic interpretive boilerplate,
not an onboarding entity-type taxonomy. No document found that lists accepted merchant entity
categories (company, sole proprietor, NPO, trust, etc.) the way the brief's PayFast comparison
implies exists there.

**Advance-purchase / event ticketing:** **ABSENT** as a named business model. No clause addresses
ticketing, events, or advance-purchase goods/services delivered later than payment as a category —
consistent with `reconciliation.md`'s Schedule 2 finding (§1 of that document): SAOC's industry is
not enumerated as High-Risk, but the *transaction pattern* (volume/velocity spike) is exactly what
clause 2.2's open-ended discretionary High-Risk designation power is written to catch. That
analysis is correct and is not contradicted by this pass.

**Verdict on gap 7: ABSENT** on all three specific points (non-profit/PBO path, entity-type
taxonomy, advance-purchase/ticketing business model). This mirrors the paper's PayFast finding
that no non-profit onboarding path is documented — Ozow's contract gives no more clarity than
PayFast's public materials did on this point; both require a direct question to the vendor before
signing.

---

## 8. SERVICE LEVELS — Schedule 4, what's promised and what remedy applies if missed

Full read of Schedule 4 (clauses 1–7) confirms the reconciliation's characterisation and adds
detail not previously captured:

**System Interface Response Time (cl. 2.1):**
> 2.1.1 ninety-five percent (95%) of Transactions shall be processed with a System Interface
> Response Time of less than five (5) seconds; and 2.1.2 ninety-nine point five percent (99.5%) of
> Transactions shall be processed with a System Interface Response Time of less than ten (10)
> seconds.

**Service Availability (cl. 4.1.1):**
> Ozow shall use reasonable endeavours to ensure that the Services are available ninety-eight
> percent (98%) of the time in any calendar month (the "Contractual Availability")...

Both commitments are qualified by "use reasonable endeavours to ensure" — not an absolute
guarantee — and both are subject to broad Contingency exclusions (cl. 4.4: any downtime caused by
third parties, Force Majeure, "any other cause or circumstance beyond Ozow's reasonable control").

**Incident response — the one part of Schedule 4 with numeric commitments not previously quoted in
`reconciliation.md`:**

| Severity | Initial Response | On-going Response | Restoration | Resolution |
|---|---|---|---|---|
| Critical (no service) | 30 minutes | Every hour | 2 hours | 24 hours |
| Severe | Within 1 hour | Every 4 hours | 4 hours | 48 hours |
| Routine | 24 hours | Every 2 Business Days | N/A | 5 Business Days |

**The remedy question — searched specifically:** no service credit, fee rebate, refund, or any
other financial or contractual remedy is stated anywhere in Schedule 4 for missing any of these
targets (response times, restoration times, resolution times, the 95%/99.5% response-time
thresholds, or the 98% availability threshold). Clause 6.3 explicitly disclaims Ozow's obligation
for issues arising from the Merchant's own reporting-process failures, but there is no
corresponding clause creating an obligation on Ozow if *it* misses a target. The SLA is entirely
process/target-descriptive; MSA §9 (Liability Cap, 12 months' Processing Fees) and §8.2 (exclusion
for settlement delay) are the only fallback mechanisms, and both cap or exclude Ozow's exposure
rather than compensate the Merchant for an SLA miss specifically.

**Verdict on gap 8: a promise with no remedy, confirmed by direct search — there is no SLA breach
remedy clause anywhere in Schedule 4 or cross-referenced elsewhere.** This is the same
"promise-with-no-teeth" pattern already identified in `reconciliation.md` for settlement timing
(gap 4) and now confirmed to extend to system performance and support responsiveness as well.

---

## 9. DISPUTES — arbitration mechanics, cost exposure, forum

Full read of clause 23 (not read in the prior pass, per the brief's flag):

**Escalation first (cl. 23.1):**
> 23.1.1 ...any dispute arising from this Agreement shall, in the first instance, be referred to
> the service delivery managers of the parties... who shall use their best endeavours to resolve
> the dispute within fourteen (14) Business Days of the dispute being referred.

**Arbitration (cl. 23.2), if escalation fails:**
> 23.2.1 ...the dispute shall be submitted to binding arbitration governed by the Arbitration Act
> 42 of 1965 (or any replacement Act) and shall take place in accordance with the Commercial
> Arbitration Rules of the Arbitration Foundation of Southern Africa (AFSA).
>
> 23.2.2 The arbitration proceeding shall be: 23.2.2.1 conducted by a mutually agreed upon
> arbitrator selected from AFSA's panel of arbitrators; 23.2.2.2 held in Johannesburg, South
> Africa; and 23.2.2.3 conducted in English.
>
> 23.2.3 The judgment upon the award rendered may be entered and enforced in any court of
> competent jurisdiction.

**Urgent interim relief carve-out (cl. 23.3):**
> 23.3.1 Nothing in this clause 23 shall prohibit a party from approaching any court of competent
> jurisdiction for urgent interim relief pending determination of the dispute by arbitration.
> 23.3.2 For purposes of urgent relief, the parties consent to the non-exclusive jurisdiction of
> the Gauteng Local Division of the High Court of South Africa, Johannesburg.

**Complaints channel, separate from formal disputes (cl. 23.4):**
> 23.4.1 Complaints may be logged by contacting support@ozow.com. 23.4.2 All complaints are
> handled through Ozow's standardized complaints process. The Ozow Complaints Policy can be found
> at www.ozow.com.

**Cost exposure — this is the material finding for a "volunteer committee, no finance department"
non-profit:**
- Binding **private** arbitration (not litigation) is mandatory for any dispute that survives the
  14-Business-Day escalation step — SAOC has no route to a South African court for an ordinary
  commercial dispute (only for *urgent interim relief*, cl. 23.3).
- Forum is **Johannesburg**, via AFSA's Commercial Arbitration Rules — this imposes travel/venue
  cost on SAOC (a national body, not necessarily Gauteng-based) regardless of where SAOC or the
  particular Show is located.
- General legal-costs clause, cl. 25.7.1 (not part of clause 23, but governs cost recovery for
  "legal proceedings" generally, which would include an arbitration award): "If a party
  successfully enforces or defends its rights under this Agreement in legal proceedings, that
  party shall be entitled to recover from the other party its legal fees on a **party-and-party**
  scale, including fees of counsel on brief, tracing agent's fees, and collection charges." This
  is the *ordinary, lower* costs scale — it does **not** match the **"attorney and own client"**
  (higher) scale used specifically for indemnity-related costs (cl. 10.1, 10.2.2). AFSA arbitration
  itself also carries the arbitrator's fees and venue costs, borne (subject to the award) by the
  parties, which is a real out-of-pocket cost private arbitration imposes that court litigation
  under the small claims/normal civil system would not.

**Verdict on gap 9: dispute resolution requires binding private arbitration in Johannesburg under
AFSA rules once informal escalation fails, with costs recoverable on the ordinary party-and-party
scale (not the elevated attorney-and-own-client scale reserved for indemnity claims). For a
volunteer committee with limited working capital, mandatory arbitration removes the option of a
small claims or ordinary magistrate's/high court process and concentrates cost and inconvenience
in Johannesburg regardless of where the dispute originates.** This clause was not addressed at all
in `reconciliation.md` — it is a genuine gap the prior pass flagged but did not fill, now closed.

---

## Verification of reconciliation.md — no errors found

Every clause reconciliation.md quoted and every conclusion it drew that this pass re-checked
(Schedule 2 §1, Termination §4.2–4.6, Fees §6, Settlement §7.1/Annexure timelines, Liability §9–10,
Unilateral Change table, POPIA §20, and the reconciliation table itself) was verified against the
source text **word-for-word and found accurate**. No corrections are required to
`reconciliation.md`. This teardown's contribution is confined to: (1) the direct verbatim
re-verification itself, (2) the gaps the earlier pass explicitly left open — new-merchant
probation (ABSENT), eligibility/onboarding (ABSENT), full SLA remedy analysis (none found), and
full arbitration mechanics (now read and quoted) — and (3) incremental detail on refund mechanics
(partial refunds and refund time limits are ABSENT) and the Annexure 3 §10.1 onboarding volume-cap
clause, which sits adjacent to but is distinct from the Rolling Reserve.

---

## Summary table — gaps 1–9

| # | Gap | Verdict |
|---|---|---|
| 1 | Fees | No termination, monthly/minimum, setup, or PCI fee. Full inventory confirmed as in reconciliation.md — no additions. |
| 2 | Money you cannot get at | Set-off (3.5), deduction pre-settlement (7.1.3), Float (7.2), Rolling Reserve 10%/180 days (Annexure 3, 9.5–9.10) all confirmed verbatim. Onboarding volume cap (Annexure 3, 10.1) noted as an additional, distinct throttle risk. Worst case: material fraction of Card revenue inaccessible 180+ days, entirely discretionary. |
| 3 | Lock-in | CONFIRMED: 30 days' notice, either party, any reason (4.3.1). No minimum term (4.1.1, indefinite). No auto-renewal. No early-termination penalty found anywhere. Genuine advantage, verified. |
| 4 | Settlement | CONFIRMED: no day-count for any rail except Crypto. Liability excluded for settlement delay/non-settlement (8.2.1.3–.4). No correction to prior pass. |
| 5 | Refund mechanics | Refund-to-original-method confirmed all rails. Buyer-facing disclosure is Card-Scheme-specific only. Partial refunds and refund time limits ABSENT. Cancellation-refund capacity is contingent on Float/balance at the time — a real, not hypothetical, constraint. |
| 6 | New-merchant/probation | ABSENT. No PayFast-Fraud-Shield equivalent. Closest analogues (Rolling Reserve, onboarding volume cap) are general-purpose discretionary powers, not a dedicated probation regime. |
| 7 | Eligibility/onboarding | ABSENT on non-profit/PBO path, entity-type taxonomy, and advance-purchase/ticketing business model. |
| 8 | Service levels | Targets stated (95%/99.5% response time, 98% availability, tiered incident response/restoration/resolution times) but qualified by "reasonable endeavours" and broad Contingency exclusions. No remedy of any kind for a missed target found anywhere in Schedule 4 or elsewhere. Promise with no remedy. |
| 9 | Disputes | Mandatory binding AFSA arbitration in Johannesburg after 14-Business-Day escalation, party-and-party costs scale, urgent-relief-only court access. Not addressed in the prior pass — now fully quoted and closed. |
