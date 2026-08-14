# PayFast General Terms and Conditions — Teardown Against the 9-Point Comparison Framework

Source: `/Users/vetus/ai/SAOC/.agent/memory/scratch/payfast-terms-20260814/payfast-terms.md`
(PayFast General Terms and Conditions, https://payfast.io/legal/general-terms-conditions/,
~22,916 words). Quotes are verbatim with clause numbers as they appear in the source. Structure
mirrors the companion Ozow teardown at
`/Users/vetus/ai/SAOC/.agent/memory/scratch/ozow-terms-20260814/teardown.md` so the two documents
can be read side by side. Findings stated plainly — not softened because SAOC already runs a
PayFast integration, and not sharpened to make a case against it either.

Client context: South African Orchid Council, a registered non-profit. Sells tickets to a
National Show held once every three years, concentrated into a short selling window, with entry
delivered later than payment. Possible future: recurring membership subscriptions. Volunteer
committee, no finance department, limited working capital.

Status: COMPLETE — all 9 sections verified against the source text.

---

## 1. FEES — every chargeable item found

**Termination fee — clause 21.3(ii) does not exist in this document.** Clause 21.2(iii) reads:

> "If your account continues to be inactive for a period of twelve (12) months, the Agreement
> shall automatically terminate without the requirement to obtain a court order or any further
> notification from us and a Termination Fee set forth in clause 21.3(ii) may be charged by us at
> our discretion."

But clause 21.3 in the source text ("Termination by you") contains only sub-clause (i) — the
right to terminate for convenience or for PayFast's uncured breach, "without... any penalty for
such termination." There is no 21.3(ii). The document cross-references a termination-fee amount
that is never actually stated anywhere in the ~22,900-word text (confirmed by
`grep -n -i "termination fee"` — the only hit is the 21.2(iii) cross-reference itself). **The
termination fee exists as a concept PayFast has reserved the right to charge "at our discretion,"
but no amount, formula, or cap is disclosed in this contract.** This is worse than a high fee: it
is an unbounded, undocumented one, referenced by a clause number that leads nowhere.

**Minimum Volume Fee (3.4, defined p. Definitions):**
> "In the event the monthly volume of Payment Transactions is ZAR 20,000 or less, you shall pay
> the Minimum Volume Fee stated in the Application."
> "'Minimum Volume Fee' means a monthly fee (as stipulated in the Application form) that shall be
> applied and payable in the event your Sale Proceeds is ZAR 20,000 or less in a calendar month."

This is directly material to SAOC: a National Show held once every three years means most months
of the cycle will have ZAR 0 in Sale Proceeds, which is inside the "ZAR 20,000 or less" band. **The
amount of this fee is not stated in the contract** — it is set in "the Application," a separate
document not included in the T&Cs supplied.

**Transaction Fee** — defined but not quantified in the general terms:
> "'Transaction Fee' means either the percentage fee per Payment Transaction including processing
> of Refunds, Reversals, payable by you to us, or the lump sum fee per Payment Transaction payable
> by you to us, or both, as the context may require."

No percentage or rand amount appears anywhere in this document.

**Payout fee (4.5):**
> "Each payout may incur a Fee as specified in your Application or notified by us."

**Dashboard Service fee (Schedule, Payment Gateway Services §2):**
> "The Dashboard Service will be available to you for free of cost for the first one month (the
> 'Trial Period')... After end of the Trial Period, unless you have unsubscribed for the Dashboard
> Service, we will continue to provide the Dashboard Service at a charge stated in the Application
> form. We reserve the right to amend the charges from time to time with prior notice to you..."

**Smart Bundle fee** — defined as "a fixed lumpsum fee per month," amount not stated in this
document; "Products or Services may be added to or removed from this Smart Bundle from time to
time by us at our sole discretion."

**Fraud Shield fee (Schedule 4, §5)** — opt-in add-on, only relevant if SAOC enrols:
> "We will provide the Fraud Shield Services to you for the Fees communicated to you via email...
> We will have the right to amend the Fees from time to time."

**Fee increases generally (3.5):**
> "The Fees may be increased by us, or we may introduce new Fees by giving thirty (30) days (a
> shorter or longer notice, if required by the Applicable Law) advance written notice to you..."

**PCI / setup fee — ABSENT as a distinct chargeable item.** No clause imposes a fixed onboarding,
setup, or PCI compliance fee. PCI DSS is referenced only as a compliance *obligation* (clause 1.1:
Services performed "in compliance of the PCI DSS, Card Scheme Rules, and Applicable Laws";
19.5(xii) requires use of PCI-certified QIR integrators) — not as a fee PayFast charges the
merchant.

**VAT (3.2):**
> "All Fees and other amounts payable under this Agreement are exclusive of any Value Added Tax
> (VAT) or any other taxes or levies under Applicable Laws and are payable by you."

**Levies (defined, 28 Definitions):**
> "'Levies' means any tax, assessments or fine, charges, fee and penalties of any nature which a
> Card Scheme or a regulatory authority may levy on us or you in relation to the Payment
> Transactions and/or Services provided to you under this Agreement."

Levies are pass-through and uncapped by nature (defined by reference to whatever a Card Scheme or
regulator imposes).

**Fee inventory table:**

| Fee | Clause | Amount fixed in this contract? | Notes |
|---|---|---|---|
| Transaction Fee | 3.1, definitions | No — % or lump sum, not stated | |
| Minimum Volume Fee | 3.4 | No — set in the Application | Applies whenever monthly Sale Proceeds ≤ ZAR 20,000 — most months of SAOC's 3-year cycle |
| Payout Fee | 4.5 | No — set in the Application or "notified by us" | |
| Dashboard Service fee | Payment Gateway Services Sched. §2 | No — set in the Application, amendable on notice | First month free |
| Smart Bundle fee | definitions | No — "fixed lumpsum," amount not stated | Contents alterable by PayFast at sole discretion |
| Fraud Shield fee | Sched. 4 §5 | No — "communicated... via email," amendable | Opt-in only |
| Termination Fee | 21.2(iii), purportedly 21.3(ii) | **No — cross-referenced clause does not exist** | Charged "at our discretion" on 12-month inactivity termination; amount nowhere in the document |
| Levies | 3.2, definitions | No — pass-through of Card Scheme/regulator charges | Uncapped by definition |
| Fee increases | 3.5, 24.1 | N/A | 30 days' notice (or shorter/longer if law requires) |

**Conclusion:** every fee that actually costs money in this contract — the Transaction Fee, the
Minimum Volume Fee, the payout fee, the Dashboard/Smart Bundle fees — is set by reference to "the
Application," a document not supplied for this review. The one number this contract does try to
quantify for the merchant (the Termination Fee) is quantified by cross-reference to a clause that
does not exist in the text. **This document, standing alone, discloses no fee amounts at all.**

---

## 2. MONEY YOU CANNOT GET AT — every hold/reserve/set-off mechanism, and realistic worst case

**Settlement funding frequency (9.1) — already established, confirmed verbatim:**
> "We shall settle the Sale Proceeds by a credit to the Bank Account, in accordance with the
> funding frequency set out in the Application. We reserve the right to change the funding
> frequency period upon notice to you."

**Consolidation and set-off across accounts (9.2):**
> "We may from time to time, consolidate any or all of your funds and other accounts with us if
> any; and set off, apply or transfer any and all such sums to satisfy any debt or liability that
> you and/or your Affiliate owe to us, including any debt or liability incurred to effect any
> required currency conversions."

**No interest on held funds (9.3):**
> "You agree that the Payment Transactions processed, or any collateral held under this Agreement
> shall not constitute a deposit with us, and shall not bear any interest."

Any money PayFast holds under 9.6/9.8/20 (below) earns SAOC nothing while it sits.

**Deduction priority order (9.5)** — PayFast may deduct from Sale Proceeds, or require refund, or
set off against collateral, in this order: (i) Refunds, (ii) Reversals, (iii) applicable taxes,
(iv) Chargebacks, (v) Levies, (vi) manual adjustments, (vii) Fees, (viii) any amount SAOC requests
in writing under clause 10.

**The twelve-trigger hold/lien clause (9.6) — already established, confirmed verbatim in full:**
> "We... may delay, withhold, or retain settlement of funds and/or amounts otherwise payable to
> you under this Agreement and/or adjust the same against any collateral amount, and/or against
> Chargebacks, Fees, Refunds, Reversals, and Levies payable by you. Further, you irrevocably grant
> us a lien over the Sale Proceeds and authorize us at any time, upon written notice to you, to
> exercise such rights in relation to the above."

The twelve triggers, verbatim: (i) the Agreement is terminated; (ii) breach of the Agreement, Card
Scheme Rules or Applicable Law; (iii) PayFast "reasonably believe[s]" an adverse change or
deterioration in SAOC's financial standing, including suspected or likely insolvency; (iv) changes
to SAOC's business activities PayFast reasonably believes raise its financial risk; (v) failure to
maintain a direct debit mandate in PayFast's favour; (vi) failure to provide requested information;
(vii) failure to provide security under clause 20, or security terminated/not honoured; (viii)
suspected fraud or other criminal activity; (ix) exceeding or likely to exceed the Excessive
Chargeback threshold; (x) Refunds/Levies/Chargebacks exceeding the value of Payment Transactions;
(xi) any Card Scheme or regulatory sanction caused by SAOC; (xii) 3D Secure disabled other than by
PayFast's own gross negligence or willful misconduct.

**Duration of PayFast's rights over held funds (9.7):**
> "Our rights and actions pursuant to clauses 4.4, 9.5 and 9.6 shall be legally binding on you and
> continue until we are satisfied that all sums due and payable by you under this Agreement have
> been fully paid."

No independent check on "satisfied" — PayFast's own satisfaction is the release condition.

**The 540-day hold ceiling (9.8) — already established, confirmed verbatim:**
> "We may retain any amounts held by us in accordance with clause 9.6 for a period of up to five
> hundred forty (540) days following the date of delivery of goods or performance of Services that
> are the subject of Payment Transactions or following the date of termination of this Agreement or
> until the Chargeback and/or Refund window has ended in accordance with the Card Scheme Rules,
> whichever is earlier, following which any remaining funds will be transferred to the Bank
> Account."

Three clocks, earliest wins — 540 days from delivery, 540 days from termination, or the shorter
Card Scheme chargeback/refund window. For a triennial National Show this can span most of the gap
to the next show if any of the twelve 9.6 triggers is invoked around the event.

**General set-off (9.9):**
> "We reserve the right to set off any outstanding amounts owed by you to us, both before and
> after demand and whether such liabilities are actual or contingent, against any settlement of
> Sale Proceeds due under this Agreement to you or any of your Affiliates and/or any amounts held
> as a collateral. We shall notify you as soon as practically possible to do so upon exercising our
> rights under this clause 9.9."

Notice is retrospective ("as soon as practically possible... upon exercising") — SAOC learns the
set-off has already happened, not before it happens.

**Refund debit right (11.9):**
> "The amount of each Chargeback and/or Refund represents a debit immediately due and payable...
> irrespective of whether a demand for this same is made and we may debit the Bank Account the
> amounts due or withhold Sales Proceeds to cover the value of Chargebacks, Refunds and Fees
> associated with their processing."

**Security collateral (20.1, 20.2) — already established, confirmed verbatim:**
> "20.1 We may from time to time require you to provide collateral by way of a cash deposit or a
> bank guarantee with a bank licensed by SARB in a form as we reasonably require to secure your
> performance of obligations under this Agreement. All costs associated with procuring, entering
> and maintaining the security arrangements shall be incurred at your sole expense. The collateral
> shall be released to you after expiry or earlier termination of the Agreement i.e., upon
> completion of the applicable Chargeback period of either 180 days or 540 days, as the case may
> be.
>
> 20.2 The security maybe increased by us where we reasonably require, from time to time based on
> the risk assessment done by us on you."

Note: "Collateral" is used as a defined-sounding term throughout (9.3, 9.5, 9.6, 20) but is never
formally defined in the Definitions clause (28) — **ABSENT**, a gap search confirms no `"Collateral"
means...` entry exists anywhere in the document.

**Realistic worst case for SAOC:** a National Show concentrates the great majority of a
3-year cycle's revenue into a few weeks. If PayFast invokes any 9.6 trigger during or shortly
after that window (e.g. the volume spike itself is read as (iv) "changes to your business
activities... higher financial risk," or (ix) an Excessive Chargeback threshold breach from a
handful of disputed tickets against a low transaction base) — settlement of that revenue can be
withheld for up to 540 days, with no interest, subject to a lien, and subject to being netted
against a cash-deposit or bank-guarantee collateral demand (20.1) that PayFast can also increase
unilaterally (20.2) at SAOC's cost. Because a triennial show relies on that revenue to fund the
*next* show's deposits and the gap between shows, a hold of this length can span the entire
inter-show period.

---

## 3. LOCK-IN — clauses 21.1–21.3 in full: term, auto-renewal, notice window, termination fee

**21.1 — term and auto-renewal, verbatim:**
> "You agree that this Agreement shall be valid and legally binding on you and us for a period of
> thirty-six (36) months commencing from the Effective Date (the 'Initial Term'), unless is
> terminated earlier by either Party in accordance with clause 21 of this Agreement. Upon expiry
> of the Initial Term, the Agreement shall automatically renew for a further period of thirty-six
> (36) months each (the 'Renewal Term(s)') unless you send a notice of non-renewal in writing to us
> no later than three (3) months before expiry of the Initial Term or the applicable Renewal Term."

36-month initial term, auto-renewing in further 36-month blocks, escaped only by written notice at
least 3 months before the current term's expiry. This maps almost exactly onto SAOC's 3-year Show
cycle — meaning the renewal deadline could fall in the immediate aftermath of one Show, when a
volunteer committee is least likely to be tracking a contract-notice clock.

**21.2 — suspension/termination by PayFast, verbatim, in full:**
> "(i) In the event Payment Transactions are not submitted for processing from the Effective Date
> and your account remains inactive for a period of six (6) months, we reserve the right to
> suspend the Services and charge the applicable Fees."

Six months of inactivity → PayFast may suspend the account *and continue charging fees* (almost
certainly the Minimum Volume Fee, since Sale Proceeds would be ZAR 0). For SAOC's sales pattern —
active only around each triennial Show — six months of inactivity is the default state, not an
edge case.

> "(ii) Without prejudice to other rights set out in this Agreement, Card Scheme Rules or
> Applicable Law, we shall have the right to terminate the Agreement without the requirement of a
> court order:
> (a) for convenience by giving sixty (60) days written notice to you;
> (b) with immediate effect, if you are in material breach... provided we first provide you with
> at least thirty (30) days written notice of the alleged breach requiring it to be remedied, and
> such breach remains un-remedied within such notice period of thirty (30) days;
> (c) with immediate effect, if any event or circumstance becomes known to us, which in our
> reasonable opinion is a suspected fraud, or is considered an act of deception, dishonesty, fraud,
> willful misrepresentation or you are engaged in selling any Undesirable Products, or that would
> result in losses or damages or reputational risk or any other criminal activity, breach of laws
> or regulatory requirements, whether within or outside of the Territory;
> (d) with immediate effect, if you enter into any act of bankruptcy or compromise with your
> creditors...;
> (e) with immediate effect, if you fail to comply with PCI DSS and other applicable data security
> standards; or
> (f) with immediate effect, if we are required to do so by any Card Scheme or a regulator;
> (g) with immediate effect, if the number of Chargebacks in relation to your business in our
> reasonable opinion, are excessively high; or
> (h) pursuant to any event of Force Majeure...; or
> (iii) If your account continues to be inactive for a period of twelve (12) months, the Agreement
> shall automatically terminate without the requirement to obtain a court order or any further
> notification from us and a Termination Fee set forth in clause 21.3(ii) may be charged by us at
> our discretion."

**21.3 — termination by SAOC, verbatim, in full (this is the entirety of the clause as it appears
in the source):**
> "(i) You shall have the right to terminate the Agreement or any product offered under this
> Agreement, without the requirement of obtaining a court order or any penalty for such
> termination, (a) for convenience by giving sixty (60) days written notice to us; or (b) if we are
> in material breach of the Agreement provided you first provide us with at least thirty (30) days
> written notice of the alleged breach requiring it to be remedied, and such breach remains
> un-remedied within such notice period of thirty (30) days following receipt of such notice by
> us."

**As stated in section 1 above: 21.3(ii) does not exist.** SAOC's own voluntary termination path
(21.3(i)) explicitly carries "no penalty." The only termination fee mentioned anywhere is the one
in 21.2(iii) for PayFast-initiated automatic termination on 12-month inactivity — and its amount
is undisclosed because the clause it points to is missing.

**Verdict on gap 3:** 36-month lock-in, auto-renewing, escapable only with a notice window (3
months before expiry) that a volunteer committee running a triennial event is at real risk of
missing. Voluntary termination for convenience carries no stated penalty. The one named
"Termination Fee" in the contract applies to *automatic* termination for a full year of inactivity
(a state SAOC will predictably be in for roughly 30 of every 36 months) and its amount is not
disclosed anywhere in the document supplied.

---

## 4. SETTLEMENT — what is actually promised, and whether any liability attaches to late settlement

**The entire settlement promise is clause 9.1:**
> "We shall settle the Sale Proceeds by a credit to the Bank Account, in accordance with the
> funding frequency set out in the Application. We reserve the right to change the funding
> frequency period upon notice to you."

That is the whole of the affirmative promise. It is:
- **Not a fixed frequency** — set in "the Application," a document not supplied for this review.
- **Unilaterally changeable** — PayFast "reserve[s] the right to change the funding frequency
  period upon notice," with no minimum notice period specified for this particular change (compare
  clause 24.1's general 30-day notice for Agreement amendments, which may or may not govern a
  funding-frequency change specifically).

**No liability for late settlement is stated anywhere.** Clause 23 (LIABILITY AND EXCLUSIONS OF
LIABILITY) caps PayFast's total annual liability for direct losses at "the Fees earned by us from
your Payment Transactions during the immediately preceding two (2) calendar months, or the cost of
reprocessing the related Transaction, whichever is lower" (23.2), excludes all indirect/
consequential loss including "loss of profits, loss of business, loss of good will" (23.3), and
disclaims liability for events "originating outside our systems" (23.4). Nothing in clause 9 or
clause 23 creates a service-level obligation, penalty, or compensation specifically tied to a
missed or delayed settlement date. **ABSENT — not addressed** as a distinct remedy; a late
settlement is, at most, folded into the general liability cap above, which for a low-fee-volume
non-profit could be a very small number relative to the funds actually delayed.

**Verdict on gap 4:** settlement is a discretionary-frequency promise, not a fixed one, with no
dedicated remedy for lateness. Any claim SAOC could bring for a late settlement would have to run
through the general liability clause, capped at two months of PayFast's own fee revenue from
SAOC's account — for a triennial-cycle merchant with fees concentrated in a few weeks a year, that
cap could be far smaller than the amount actually delayed.

---

## 5. REFUND MECHANICS — 11.5–11.10: buyer-facing disclosure, restrictions, partial refunds, time limits

**Buyer-facing checkout disclosure (11.5), verbatim:**
> "You shall disclose to Cardholders at the time a Payment Transaction is processed a fair policy
> for the return of goods or cancellation of services including any restrictions. The terms and
> conditions of the purchase shall be displayed on the same screen view as the checkout screen that
> presents the total purchase amount, or within the sequence of website pages the cardholder
> accesses during the checkout process and should not be in a separate hyper link."

This is a positive obligation on SAOC's checkout flow, not on PayFast's: refund/cancellation policy
must be on the same screen as the total purchase amount, not merely linked.

**Refund receipt (11.6):**
> "To evidence a Refund, you shall issue a Refund receipt and provide the Cardholder with a copy."

**Refund-to-original-card restriction (11.7), verbatim:**
> "The value of a Refund shall not exceed the amount of the original Payment Transaction and you
> may only process a Refund to the same Card which was used for the original Payment Transaction."

Confirms full refunds are capped at the original amount and must return to the original card — no
cash, EFT, or alternative-method refunds.

**Exchange-rate liability on refund errors (11.8):**
> "You will be liable for the exchange difference incurred in a Chargeback or a refund Transaction
> made in error by you."

**Immediate debit right (11.9)** — already quoted above (section 2).

**PayFast's discretion over refunds (11.10) — already established, confirmed verbatim:**
> "We may at our sole discretion, decide not to process a Refund unless amount to be so refunded
> has been deposited by you into the Bank Account for refund to the Cardholder. We may at our sole
> discretion, refuse to accept any Refund and in such circumstances we will, where possible, inform
> you of the reasons for refusal."

Two separate discretions: (a) PayFast can require SAOC to fund the refund from its own bank account
before PayFast will process it, and (b) PayFast can refuse to process a refund altogether, with
disclosure of reasons only "where possible" — not guaranteed.

**Partial refunds:** not addressed by any distinct clause. 11.7 states a refund "shall not exceed
the amount of the original Payment Transaction," which permits partial refunds by implication (a
lesser amount does not exceed the original) but no clause explicitly confirms partial-refund
support or states any mechanical limits (e.g. multiple partial refunds against one transaction).
**ABSENT — not addressed as a named mechanism**, only inferable from the ceiling language in 11.7.

**Time limits on requesting a refund:** **ABSENT — not addressed.** No clause states a window
within which a Refund must be requested or processed. Time-bound provisions found relate only to
Chargebacks (the 540-day hold in 9.8, the Card Scheme chargeback window) and to information
production on a Chargeback dispute (11.1(viii), 7 days), not to a refund-request deadline.

**Verdict on gap 5:** refund-to-original-card and amount-ceiling restrictions CONFIRMED (11.7).
Buyer-facing disclosure requirement CONFIRMED (11.5), and it is stricter than a typical "link to
policy" requirement — same screen as the checkout total. PayFast's fund-first-or-we-refuse
discretion (11.10) is the standout item: a body with limited working capital could be required to
front refund money into its own bank account before PayFast will release the refund, even though
PayFast is separately empowered to hold or withhold SAOC's Sale Proceeds under 9.6/9.8. Partial
refunds and refund-request time limits are ABSENT — not addressed anywhere in the contract.

---

## 6. NEW-MERCHANT / PROBATION TREATMENT — the Fraud Shield Evaluation Period

**Fraud Shield is a paid, opt-in add-on** — Schedule 4 §1: "These Fraud Shield Terms and
Conditions... are incorporated into and form part of your Agreement with us. The Fraud Shield
Services is a 'Services' for the purposes of your Agreement with us." Availability is "tied to,
and contingent upon, your use of our other Services," and it is charged for separately (§5). It is
not automatically part of the base merchant relationship — it only applies if SAOC enrols and pays
for it.

**"New Merchant" is a defined term, and its definition is narrow (§7 Definitions):**
> "'New Merchant' means where you have been our active Merchant for less than six months."

**The Evaluation Period withholding (§3 New Merchants), verbatim:**
> "If you are a New Merchant, and we have activated your access to the Fraud Shield Services, we
> will not pay you the amount for Covered Chargebacks during the Evaluation Period. Instead, we
> will hold these amounts, and only pay them to you once you have successfully passed our internal
> control processes, including our processes related to credit and fraud risk. We may extend the
> Evaluation Period based on certain criteria determined by us. If during the Evaluation Period
> these criteria are not met, then these Fraud Shield Terms will automatically terminate, and you
> will not be entitled any amounts held by us (or otherwise owed to you) with respect to Covered
> Chargebacks."

**"Evaluation Period" is itself open-ended (§7 Definitions):**
> "'Evaluation Period' means a period of time determined by us during which we will not pay you the
> amount for Covered Chargebacks."

No minimum or maximum duration is stated — PayFast sets it, and can extend it "based on certain
criteria determined by us." Criteria are not disclosed in this document.

**Forfeiture is real, not just delay (§4 Your Responsibility):**
> "We may also hold you responsible for a Covered Chargeback if:... (d) you are a New Merchant, as
> described in Section 3..."

Being a New Merchant is independently listed as a ground for PayFast to hold SAOC (not itself)
responsible for a Covered Chargeback — i.e., during the Evaluation Period the Fraud Shield
protection SAOC is paying for does not actually cover it.

**Would SAOC be a "New Merchant"?** Under the six-month definition, only for the first six months
of an active PayFast relationship — meaning if SAOC re-enrols in Fraud Shield after a long
inactive gap (the pattern its triennial cycle produces, see section 3), it is plausible each fresh
enrolment could restart inside a fresh six-month "New Merchant" window, though the contract defines
"New Merchant" by reference to being "our active Merchant," not by reference to Fraud Shield
enrolment specifically — this interaction is not spelled out and is a genuine ambiguity, not a
confirmed fact.

**Exposure:** if SAOC pays for Fraud Shield around a Show launch (exactly when new, higher-volume,
higher-risk transaction activity would make fraud protection most attractive) and qualifies as a
New Merchant, any Covered Chargeback amounts during that Show's selling window are withheld for an
undefined Evaluation Period and can be forfeited entirely if PayFast's undisclosed internal
criteria are not met — with no ceiling on the Evaluation Period's length stated in the contract.

**Verdict on gap 6:** the Fraud Shield/New Merchant regime is real, named, and matches the brief's
description — not equivalent to Ozow's teardown finding (ABSENT for Ozow). It is opt-in, so SAOC
is not automatically exposed, but if used it carries genuine, undisclosed-duration withholding and
possible total forfeiture risk concentrated exactly around the transaction spike a Show produces.

---

## 7. ELIGIBILITY AND ONBOARDING

**Non-profit / NPO status:** **ABSENT.** Full-text search for "non-profit," "nonprofit," "NPO"
found zero hits anywhere in the document. No dedicated onboarding path, fee schedule, or
eligibility criterion for non-profit entities is documented.

**Advance-purchase / event ticketing as a named category:** **ABSENT.** Full-text search for
"ticket" found zero hits. No clause names event ticketing, advance-purchase goods/services, or
delayed-delivery transaction models as a category (compare "Merchant Industry Specific Terms,"
clause 12, which names only car rental, hotel accommodation, and marketplace — Schedule 2).

**Undesirable Products — the operative eligibility gate, confirmed verbatim (definitions, clause
28):**
> "'Undesirable Products' means any products offered for sale by you which we, in its sole
> discretion, considers undesirable for any reason, including ethical or moral reasons or factors
> which may have an adverse effect on the reputation of Payfast."

This is the entire eligibility standard for prohibited categories: not an enumerated list, but an
open-ended, PayFast-sole-discretion judgment, tied directly into the immediate-termination trigger
at 21.2(ii)(c) (quoted in full in section 3). No enumerated "Undesirable Products" or "Prohibited
Categories" list is included in this document.

**Dispatch-before-payment restriction (clause 12.3) — directly relevant to a delayed-delivery
ticket model, verbatim:**
> "Where you are involved in dispatching of goods in Online Transactions or MO/TO transactions, you
> are responsible for verifying the Cardholder's address and ensuring the goods are dispatched to
> this address. We cannot provide name and address verification as part of the Authorization
> process. In relation to the dispatch of goods, you undertake not to raise a Transaction Record
> prior to the goods being dispatched. You shall advise the Cardholder of the time it will take to
> dispatch the goods and if, for any reason, you do not have the goods available for dispatch to
> the Cardholder within such advised time period, then the Cardholder shall be notified of that
> fact and the order re-confirmed by the Cardholder."

This clause is written around physical goods dispatch, and its applicability to a Show entry
ticket (a right of admission delivered on the Show date, not a physical good "dispatched") is not
settled by the contract's own terms — the clause's language ("dispatching of goods," "address")
does not map cleanly onto ticketing, so whether it applies at all is genuinely unclear from the
text, not something this teardown should resolve by inference. Flagged as a direct question for
PayFast, not asserted as a confirmed restriction.

**KYC / underwriting information demands (19.5(viii)–(ix)):** PayFast can require, "at any time
throughout the Term (even before services are provided)," audited financial statements, balance
sheet and profit/loss statements "for any fiscal year," and beneficial-owner information for AML
purposes — with a right to withhold settlements if KYC/trade-license/shareholder information is not
kept updated (19.5(ix)). A volunteer non-profit committee is likely to find "audited financial
statements" a nontrivial standing obligation.

**Verdict on gap 7:** no documented non-profit onboarding path (ABSENT, matching the Ozow finding).
No named ticketing/advance-purchase category (ABSENT). The prohibited-category gate is a
sole-discretion standard, not a list. The dispatch-before-payment clause (12.3) is a real,
directly-worded restriction whose application to ticket sales is textually unclear and needs a
direct question to PayFast before relying on it either way.

---

## 8. SERVICE LEVELS — what uptime or support is promised, and what remedy applies if missed

**Full-text search performed** for "service level," "uptime," "availability of the Service," "SLA"
— **zero hits** anywhere in the ~22,900-word document, including the schedules.

**The only quality-of-service language in the entire contract is clause 1.1:**
> "In consideration of the Fees related to the Services, we shall provide all Services in
> accordance with the terms and conditions of this Agreement, using reasonable skill and care and
> in compliance of the PCI DSS, Card Scheme Rules, and Applicable Laws."

"Reasonable skill and care" is a general standard of performance, not a measurable service level
(no percentage uptime, no response-time target, no support-ticket resolution time).

**PayFast affirmatively disclaims uptime as a warranty (19.3):**
> "We do not warrant that Services will be uninterrupted or error free."

**No remedy is attached to any interruption.** Clause 23 (Liability and Exclusions) caps direct
loss liability at two months' fee revenue (23.2), excludes indirect/consequential loss including
loss of business and loss of goodwill (23.3), and disclaims liability for "events or activities
originating outside our systems (such as infrastructure failure, internet disturbances or
malfunctioning in third party systems)" except where caused by PayFast's own gross negligence or
willful misconduct (23.4).

**Verdict on gap 8: ABSENT.** There is no service level agreement in this document — no uptime
percentage, no response-time commitment, no support SLA, and no dedicated remedy for an outage. A
promise with no remedy is not a promise, and here there is not even an unremedied promise: PayFast
explicitly disclaims an uninterrupted/error-free service standard. For a merchant whose entire
year's transaction volume can be concentrated into the days around a National Show, an unplanned
outage during that window carries no contractual recourse beyond the general liability cap.

---

## 9. DISPUTES — governing law, forum, arbitration, cost exposure

**Governing law and jurisdiction (clause 26), verbatim, in full:**
> "(i) This Agreement shall be governed by and shall be construed in accordance with the laws of
> Republic of South Africa.
>
> (ii) All disputes related to or arising out of this Agreement shall be first settled through
> conciliation between CEOs of the Parties or a senior executive delegated by the CEOs, and where
> no mutually acceptable outcome is achieved within thirty (30) days of reference of the matter to
> the CEOs or their nominated delegates, each of the Parties agrees to irrevocably and
> unconditionally submit their disputes to the exclusive jurisdiction of the courts of Cape Town,
> South Africa."

South African law, mandatory pre-litigation conciliation between "CEOs... or a senior executive
delegated by the CEOs" (a formality for a volunteer non-profit that does not have a CEO in the
corporate sense — its equivalent would presumably be the chairperson or an appointed delegate),
30-day conciliation window, then exclusive jurisdiction of the Cape Town courts — not arbitration.
No arbitration clause exists anywhere in the document (confirmed by search for "arbitrat" — zero
hits).

**Cost exposure is not addressed by clause 26 itself.** Ordinary South African civil litigation
cost rules would apply by default (each party generally bears its own costs unless a costs order
is made against the losing party) — the contract states no special costs-shifting, no cap on legal
costs, and no fee-shifting-to-loser clause. **ABSENT — not addressed** as a distinct contractual
term; whatever cost exposure exists is whatever ordinary Cape Town High Court/Magistrate's Court
practice would impose, not a bespoke contractual allocation.

**Indemnity survives termination (22, 23.5):** clause 22.1 requires SAOC to indemnify PayFast
against losses arising from, among other things, "any Chargeback, Refund or Reversals" and "the
Payment Transactions including any secured, unsecured Transactions" — and clause 23.5 confirms
"the provisions of clause 22 (indemnity) and clause 23 (liability and exclusions of liability)...
shall survive termination of this Agreement." A dispute arising from a chargeback wave during a
Show could therefore expose SAOC to indemnity costs regardless of whether the merchant relationship
has already ended.

**Verdict on gap 9:** governing law is South African, forum is the Cape Town courts (not
arbitration), with a mandatory 30-day executive conciliation step first. No special cost-allocation
term exists — ordinary litigation cost exposure applies by default. Indemnity and liability
obligations survive termination, so ending the PayFast relationship does not end exposure to
disputes over transactions processed while it was active.

---

## Summary table — gaps 1–9

| # | Gap | Verdict |
|---|---|---|
| 1 | Fees | No fee amount is fixed in this document; Transaction Fee, Minimum Volume Fee, payout fee, Dashboard/Smart Bundle fees all deferred to "the Application." The one fee this contract tries to name (Termination Fee, 21.2(iii)) cross-references a clause, 21.3(ii), that does not exist in the text. |
| 2 | Money you cannot get at | 9.2 set-off/consolidation, 9.5 deduction order, 9.6 twelve-trigger hold + irrevocable lien, 9.7 open-ended duration ("until we are satisfied"), 9.8 540-day ceiling (earliest of three clocks), 9.9 set-off with after-the-fact notice, 20.1–20.2 collateral demand, increasable at PayFast's discretion. No interest accrues on held funds (9.3). Realistic worst case: a Show-window trigger can lock up most of a 3-year cycle's revenue for up to 540 days. |
| 3 | Lock-in | 36-month term, auto-renewing 36-month blocks, escapable only by written notice ≥3 months before expiry (21.1). PayFast may terminate for convenience on 60 days' notice or immediately on any of 8 listed grounds (21.2). SAOC's voluntary termination (21.3(i)) states no penalty — the only named Termination Fee applies to automatic termination on 12 months' inactivity, amount undisclosed. |
| 4 | Settlement | Frequency set in "the Application," unilaterally changeable on notice (9.1). No dedicated remedy for late settlement — falls under the general liability cap (2 months' fee revenue, 23.2). |
| 5 | Refund mechanics | Refund-to-original-card and amount-ceiling restrictions confirmed (11.7). Checkout-screen disclosure requirement confirmed, stricter than a linked policy (11.5). PayFast may require SAOC to fund a refund from its own account first, or refuse outright (11.10). Partial refunds and refund-request time limits: ABSENT. |
| 6 | New-merchant / probation | Real and named (Fraud Shield, Schedule 4) — opt-in, paid add-on. "New Merchant" = active Merchant <6 months. Evaluation Period duration undisclosed, extendable at PayFast's discretion, and Covered Chargeback amounts can be forfeited entirely if undisclosed internal criteria are not met. |
| 7 | Eligibility and onboarding | No non-profit onboarding path documented (ABSENT). No named ticketing/advance-purchase category (ABSENT). Prohibited-category gate ("Undesirable Products") is sole-discretion, not an enumerated list. Dispatch-before-payment clause (12.3) is real but its application to ticketing is textually unclear — needs a direct question to PayFast. |
| 8 | Service levels | ABSENT. No uptime %, no response-time commitment, no support SLA anywhere in the document. PayFast affirmatively disclaims an uninterrupted/error-free standard (19.3). No dedicated remedy for outage — falls under the same general liability cap. |
| 9 | Disputes | South African law; Cape Town courts (not arbitration); mandatory 30-day CEO/senior-executive conciliation first (26). No special cost-allocation clause — default litigation cost rules apply. Indemnity and liability obligations survive termination (23.5). |

**Overall:** this contract, read on its own text, discloses almost no fee amounts (everything
material is deferred to an external "Application" document not supplied for this review), contains
a broken internal cross-reference on the one fee it does try to name, and offers no service-level
commitment at all. Several already-established headline risks (9.6/9.8 hold mechanism, 20.1/20.2
collateral, 21.1 lock-in) are confirmed verbatim and, for a triennial-cycle non-profit, concentrate
their worst-case impact precisely around the few weeks when SAOC is transacting at all.
