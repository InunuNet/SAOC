# Yoco — Merchant Terms Writeup

Sources, all PRIMARY, fetched via `curl -s "http://localhost:7077/https://r.jina.ai/<pdf-url>"`
today (2026-08-14): **Merchant Agreement** (`yoco.com/merchant-agreement.pdf`, "July 2020" per
its own document title, 14 pages, card-machine/in-person focused) and **Payment Services T&Cs**
(`a.storyblok.com/.../yoco-payment-services-t-cs-28-february-2025.pdf`, 6 pages, dated Feb 2025).
Both PDFs were previously unreachable (Alembic `pdf-unsupported`) — cracked via the `r.jina.ai`
proxy route documented in `.agent/memory/scratch/reach/yoco.md`. Corroborating: `yoco-teardown.md`
(covers Yoco's separate Main T&Cs, dated Feb 2026, and Help Centre — a newer, broader document
than the two PDFs), `npo-pricing.md`. **Note on document scope:** the Merchant Agreement is
explicitly card-machine/in-person ("Card Reader") focused; SAOC's use case is online ticket sales.
The Payment Services T&Cs is channel-neutral. Main T&Cs (Feb 2026, from `yoco-teardown.md`) is the
newest and broadest document and is cited where it fills a gap the two PDFs leave open.

---

## 1. Fees, advertised
**VERIFIED** (pricing page/support article, not contract). Source: `support.yoco.help/en/
articles/109451-core-plan.md`, per `yoco-teardown.md`, fetched 2026-08-14. Core Plan (free,
default), **Online local debit/credit: 2.95% + R2 ex-VAT** (R0–R50k/month tier). On a R500 online
ticket: **R16.75 ex-VAT**. (In-person card-machine rates differ and are not the relevant channel
for SAOC's online ticket sales.)

## 2. Fees, contractual — MOST IMPORTANT HEADING
**VERIFIED — neither PDF states a rate; both defer to an external Fee Schedule.** Merchant
Agreement cl. 6.1–6.2, verbatim: *"The price of the Card Reader is included in the Fee Schedule...
you will be required to make the payments set out in the Fee Schedule to Yoco on an ongoing
basis."* "Fee Schedule" is defined (cl. 1.1.14) as *"the fee schedule according to which Yoco will
charge you for Transactions... which is accessible on the pricing page of the Website and/or as
communicated to you by Yoco from time to time."* Fee changes: 30 days' notice, and if you disagree
"you will need to close your Merchant Account" (cl. 6.3). Payment Services T&Cs is more openly
adverse, cl. 5.2, verbatim, in full: *"We can change our fees or introduce new ones **without
notifying you**. You must accept these changes if you want to keep using our payment services."*
**No fee percentage or rand amount appears anywhere in either contract PDF** — both are fully
deferred to the public/app pricing page. This makes Yoco's contractual disclosure comparable to
Ozow's (deferred to website) and stronger than PayFast's (deferred to a private, unpublished
"Application").

## 3. Monthly / minimum / dormancy fees
**VERIFIED absent from both PDFs, no monthly/minimum fee clause found.** Main T&Cs / pricing page
(per `yoco-teardown.md`) separately confirm: R0 subscription fee on Core Plan; no minimum-volume
fee (unlike PayFast's ZAR 20,000 threshold); no setup or connectivity fee, explicitly stated on
the pricing page. Neither PDF fetched today contains a dormancy fee clause.

## 4. Payment types
**VERIFIED from these PDFs, in-person/card-machine scope.** Card clearing and settlement via
Card Reader hardware (Merchant Agreement cl. 5.1.1); hardware supply and support explicitly
included (cl. 5.1.2, "supply of the Card Reader," replacement, support). Payment Services T&Cs
adds: online payment links (cl. 3.1, "debit and credit cards **or online payment links**") — this
is the channel relevant to SAOC. **Recurring/subscription billing: not addressed in either PDF** —
absent, not confirmed either present or absent as a distinct product in these documents. Donations:
not named as a category in either PDF.

## 5. Refunds
**VERIFIED, primary-source, resolving a prior gap.** Merchant Agreement cl. 8.2.1–8.2.2: same-day
reversal to Cardholder, or **refund up to 90 (ninety) days back to the Cardholder** — confirms the
90-day cap previously known only from Help Centre content is a **contractual** term, not just
support documentation. Funding gate: not explicit in either PDF as a named clause, but cl. 9.1
(Payment Services T&Cs) ties settlement to "net amount... LESS our fees," consistent with the
Help Centre's "sufficient funds in your Yoco balance" statement already on file. **Partial
refunds:** not addressed as a distinct mechanism in either PDF — "refund a Transaction for up to
90 days" (cl. 8.2.2) does not state a full-vs-partial distinction; per `yoco-teardown.md`, partial
refunds are confirmed supported at the Checkout API level (nullable `amount` field) — a
developer-docs source, not this contract text. **Same-day-only debit-card restriction:** not
found in these two PDFs; sourced only from Help Centre content per `yoco-teardown.md` (PARTIAL,
not primary-source verified here).

## 6. Contract term and exit
**VERIFIED, and the two PDFs are not identical to each other or to the Main T&Cs.** Merchant
Agreement cl. 3.4: merchant may terminate anytime "by contacting support@yoco.com" (3.4.1); Yoco
may terminate **immediately** for material breach or Association/Acquiring Bank direction
(3.4.2.1), or on **14 days' notice** "in all other circumstances" (3.4.2.2). Payment Services
T&Cs cl. 6.1–6.2: merchant may terminate by written notice or by simply ceasing use; **Yoco "can
terminate or suspend our payment services whenever necessary, and we don't have to tell you
first."** No fixed initial term in either PDF; no auto-renewal clause; no early-termination
penalty found in either PDF. This is **consistent in substance** with the Main T&Cs finding
already on file ("cancel anytime... no penalties or notice periods") though the two PDFs specify
Yoco's own exit rights (14 days generally, or none at all under the newer Payment Services T&Cs)
more precisely than the Main T&Cs FAQ language did.

## 7. Dormancy
**Not addressed in either PDF — silent.** No inactivity-triggered suspension, fee, or termination
clause found in the Merchant Agreement or Payment Services T&Cs. This is consistent with — but not
independently re-confirmed by — the Main T&Cs Help Centre finding already on file ("profile
remains inactive over time," no fee). **Label: PARTIAL** for the overall dormancy picture (Help
Centre source, not this contract text); **VERIFIED absent** specifically for these two PDFs.

## 8. Settlement
**VERIFIED.** Merchant Agreement cl. 9.1: per-Transaction settlement to Bank Account per the
"Yoco Payout Schedule," net of fees. Payout can be delayed/withheld for outstanding FICA
documentation or Chargeback-related reasons (cl. 9.2, cross-referencing cl. 11.1). Payment
Services T&Cs cl. 9.3 lists delay/withholding triggers: outstanding paperwork, application not
meeting requirements, suspected fraud/illegal activity, unauthorised transactions, or chargebacks
— all open-ended, **no numeric cap, percentage, or day-count stated in either PDF**. This matches
`yoco-teardown.md`'s finding that the "Reserve Account" cap/holdback period could not be found in
public sources — **now confirmed as a genuine contractual gap, not a research-access gap**: having
read both full PDFs, no cap percentage or holdback duration is stated anywhere in either document.

## 9. Chargebacks and disputes
**VERIFIED — Reserve Account mechanism confirmed from primary source, previously only a search
snippet.** Merchant Agreement cl. 11.1, verbatim, in full: *"You agree that in the event of a
Chargeback, Yoco may – 11.1.1 withhold the full value of the Chargeback amount in the Reserve
Account, subject to clause 11.2; 11.1.2 adjust the fees set out in the Fee Schedule; 11.1.3 delay
the payment of any payouts into your Bank Account; 11.1.4 terminate, modify or suspend your access
to the Services; and/or 11.1.5 debit the amount of any Chargeback and any associated fees, fines,
or penalties... from your Merchant Account (including... any Reserve Account), any payouts due to
you."* Release condition (cl. 11.2): held until Chargeback is finally assessed, OR the dispute
window under law/Association Rules expires, OR Yoco determines no Chargeback will occur — **no
percentage cap and no fixed holdback duration are stated**, confirmed by full read of both PDFs.
Payment Services T&Cs cl. 9.5–9.8 restates the same mechanism for online/omnichannel use, adding:
if Yoco cannot recover a Chargeback, merchant pays the full amount on demand plus attorney-and-
own-client-scale legal costs (cl. 9.8) — mirrored in Merchant Agreement cl. 11.3. **Forum/dispute
resolution — a genuine conflict between documents, flagged, not resolved:** Merchant Agreement cl.
17.1–17.2 mandates **binding arbitration in Cape Town**, arbitrator appointed by Yoco, costs split
equally. The Payment Services T&Cs is silent on dispute resolution. The Main T&Cs (Feb 2026, per
`yoco-teardown.md`) states **no arbitration** — any court with jurisdiction, including Magistrates'
Court, South African law only, no named forum. **These two are inconsistent**, and which governs
for SAOC's online-ticketing use case is unresolved — the Merchant Agreement's own title ("July
2020") suggests it may be superseded by the newer Main T&Cs, but neither document states an
express supersession/precedence rule resolving this conflict for dispute-resolution purposes
specifically. Flag as an open question, not an assumption either way.

## 10. Liability cap
**VERIFIED, and inconsistent between documents.** Merchant Agreement cl. 14.1: broad exclusion of
direct, indirect, punitive, incidental, special, consequential, or exemplary damages — **no cap
figure or formula stated**, a full exclusion rather than a capped formula (carved out only for
gross negligence against CPA consumers, cl. 14.2 — not applicable to SAOC as a business merchant).
This differs from the Main T&Cs (Feb 2026, per `yoco-teardown.md`) §15.2, which states a concrete
formula: 6 months' fees, or a flat **ZAR 20,000** floor if no fees have yet been paid. **The two
documents are inconsistent in kind** (full exclusion vs. a capped formula) — the more recent Main
T&Cs figure should be treated as the current position pending clarification, since it is dated
Feb 2026 versus the Merchant Agreement's 2020 date, but this is not stated as a formal supersession
anywhere reviewed.

## 11. Service levels
**VERIFIED absent, both PDFs.** Merchant Agreement cl. 13.2.4: Yoco does not warrant the Services
will be available at any particular time/location, uninterrupted, or secure; no defects/errors
correction commitment. No uptime percentage, response-time target, or remedy for a missed target
anywhere in either PDF. Consistent with the Main T&Cs finding already on file (§5.2, "as is/as
available" disclaimer, no numeric target).

## 12. Customer data
**VERIFIED — no Ozow-cl.-20.8.1 equivalent found in either PDF; this closes the gap the brief
flagged as unchecked.** Merchant Agreement cl. 7.1.4 authorises Yoco to process **the merchant's**
Personal Information (not the merchant's customers'), "in accordance with the Privacy Policy."
Cl. 8.4 / Payment Services T&Cs cl. 8.7: Yoco may share **Transaction data** with employees,
agents, the Acquiring Bank, Associations, and third-party service providers "for training,
research, analysis and operational business purposes" — this is data-sharing for Yoco's own
operations, **not a marketing-to-Cardholders clause, and not an express trans-border-processing
consent clause** (contrast Ozow cl. 20.7/20.8.1.3, which names cross-border transfer explicitly
and requires an adequacy assessment). **No clause in either PDF authorises Yoco to send marketing
communications to the merchant's customers, and no clause names cross-border data transfer.** This
is a real, checked finding — Yoco's two primary contracts, read directly, contain neither the
customer-marketing right nor the explicit cross-border consent that Ozow's contract has. (Caveat:
Yoco's separate Privacy Policy, referenced but not itself fetched in this pass, could contain
either provision — not ruled out, only absent from these two contract documents.)

## 13. Non-profit support
**VERIFIED — real KYC path, but this is business-type classification, not a pricing tier.**
Neither of these two PDFs mentions "non-profit," "NPO," or "charity" anywhere — confirmed by full
read of both. The NPO path exists in a separate document: `support.yoco.help/en/articles/111102`
(per `yoco-teardown.md` and `npo-pricing.md`), which defines "Non-Profit Organisation" as a
selectable business type (can be unregistered; chairperson/treasurer/secretary/director may sign
up), with per-stakeholder identity verification and a stated **48-hour per-person review
turnaround**. **This is a KYC/onboarding classification only — no fee percentage, discount, or
reduced rate is tied to NPO status anywhere found**, in these PDFs or the support article
(`npo-pricing.md`: "VERIFIED ABSENT" for an NPO pricing tier). The only rate reduction available
to any entity type is a R100,000/month volume threshold (support article 109451), irrelevant to
SAOC's concentrated triennial sales pattern unless pre-sales alone clear that threshold.

## 14. Onboarding
**PARTIAL.** Merchant Agreement cl. 4.1 describes a 7-step process (apply → pay for Card Reader →
Yoco checks → hardware delivery → FICA verification on delivery → app setup → FICA documentation)
— this is the **card-machine** onboarding flow, not necessarily identical to online-only
onboarding. Payment Services T&Cs cl. 4 confirms transactions can start before verification
completes, but payout is withheld until FICA/application review is "successfully reviewed and
approved" — **no stated turnaround time** in either PDF. The only concrete timeframe found anywhere
in Yoco's material is the NPO FICA guide's 48-hour **per-stakeholder** review window (§13, from
`yoco-teardown.md`, not these PDFs). **No overall end-to-end onboarding-time SLA is stated in any
Yoco document reviewed.** Feasibility of going live inside two weeks: plausible by inference from
the per-stakeholder 48-hour figure for a responsive 3-person committee, but **NOT ESTABLISHED** as
a stated commitment — ask directly.

## 15. Open questions for the vendor
1. For online ticket sales via Checkout/payment links (not a Card Reader), which contract governs
   dispute resolution — the Merchant Agreement's mandatory Cape Town arbitration (cl. 17), or the
   Main T&Cs' any-competent-court position? The two conflict and neither states a stated
   supersession rule.
2. What is the current liability cap that applies to SAOC — the Merchant Agreement's full
   exclusion (cl. 14) or the Main T&Cs' ZAR 20,000/6-months-fees formula (§15.2)?
3. What is the Reserve Account's actual cap percentage and maximum holdback period for online
   Card chargebacks — neither PDF states a number, unlike Ozow's 10%/180-day or PayFast's 540-day
   figures?
4. What is the realistic end-to-end onboarding time for a 3-person NPO committee (chairperson,
   treasurer, secretary), given the 48-hour per-stakeholder review window and SAOC's ~2-week
   deadline?
5. Does Yoco's Privacy Policy (not reviewed in this pass) contain any customer-marketing or
   cross-border-data-transfer consent clause equivalent to Ozow's cl. 20.8.1, given that neither
   of Yoco's two contract PDFs contains one?
