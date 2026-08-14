---
schema: athanor.mission/v1
slug: research-adversarial-audit
goal: Adversarially verify every factual claim in the payment-gateway research article
  against live primary sources, with no reliance on model knowledge, before it goes
  to Lee-Ann
created_at: '2026-08-14T16:42:04.450405+00:00'
started_at: null
last_active_at: '2026-08-14T17:03:25.477240+00:00'
status: pending
cost_estimate:
  features: 7
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F2
  ts: '2026-08-14T17:03:25.477240+00:00'
features:
- id: F1
  title: Claims register — every falsifiable assertion extracted, atomised and numbered
  inline_brief: 'Audit target is FROZEN, not live: `.agent/memory/scratch/FROZEN-payment-gateway-decision-b79c871.html`
    (100,986 bytes, commit b79c871). Brad is reading the live artifact right now.
    DO NOT EDIT `docs/payment-gateway-decision.html` during this mission — not one
    character. Every finding is a proposed change, delivered as a list, applied only
    after Brad has read the audit.

    Extract EVERY falsifiable claim into `.agent/memory/scratch/audit/claims.csv`:
    id, section, verbatim_claim, claim_type, materiality, source_asserted.

    Atomise. "Ozow charges 2.85% + R1 on cards and 1.5% + R1 on EFT" is TWO claims,
    and each fails independently. A compound claim marked CONFIRMED because half of
    it is true is exactly the failure this mission exists to catch.

    claim_type: PRICE | CONTRACT_CLAUSE | CORPORATE_FACT | CAPABILITY | LEGAL_REGULATORY
    | ARITHMETIC | CHARACTERISATION.

    materiality: HIGH if it could change the Council''s decision or its money (fees,
    holds, lock-in, refund capability, termination, who owns whom); MEDIUM if it shapes
    the argument; LOW if incidental. Rank the fix list by this, not by section order.

    Expect 150-250 claims. If you produce fewer than 120 you have not atomised properly
    — go back. Include claims made by IMPLICATION and by OMISSION where the framing
    asserts something (e.g. presenting two options as the field implies no third is
    viable).'
  status: done
  milestone: M1
  completed_at: '2026-08-14T17:03:25.212849+00:00'
- id: F2
  title: Evidence protocol and negative control — prove the process can catch a lie
  inline_brief: 'The mission''s core constraint, in Brad''s words: "I don''t want
    any LLM memory weights interfering with this, must just be raw research facts."
    That needs enforcement, not an instruction — a model asked not to use its priors
    will still use them and will still sound certain.

    THE RULE: no claim may be marked CONFIRMED without (a) a URL fetched live this
    session, (b) the fetch date, (c) a VERBATIM quote from that page containing the
    fact, and (d) the Alembic confidence header. A verdict with no quote is not a
    verdict. "I know this to be true" is not evidence. If a fact is well known and
    obviously correct, it still gets fetched — that costs one request and removes
    the entire failure mode.

    ALL fetching via Alembic (`curl -s http://localhost:7077/<url>`, search `curl
    "http://localhost:7077/?q=..."`). Record `X-Alembic-Confidence`; anything LOW
    is not evidence on its own and needs a second independent source. Note the Ozow
    docs hub is a Stoplight SPA — fetch its JSON API, pattern recorded in `.agent/memory/scratch/ozow-terms-20260814/`.

    SOURCE HIERARCHY, and a claim is only as good as the best source actually obtained:
    (1) the merchant contract itself; (2) the vendor''s own published pricing or docs
    page; (3) a regulator, court or official register; (4) reputable press; (5) a
    reseller or third-party summary — weakest, flag it.

    NEGATIVE CONTROL, and this feature is not done without it: seed at least 8 deliberately
    FALSE claims into the register, mixed in and not flagged to the verifying agents
    — some plausible-but-wrong (a rate shifted by 0.3%, a clause number moved by one,
    a date wrong by a year), some true-sounding but fabricated. Run them through the
    same pipeline. If any is marked CONFIRMED, the pipeline is unsound and every other
    green verdict is suspect — stop and report that, do not continue. Record which
    seeds were caught and by what.'
  status: done
  milestone: M1
  completed_at: '2026-08-14T17:03:25.477037+00:00'
- id: F3
  title: Verify prices, corporate facts and legal/regulatory claims against live sources
  inline_brief: 'Every PRICE, CORPORATE_FACT and LEGAL_REGULATORY claim, verified
    independently. Adversarial stance: your job is to REFUTE the claim, not to find
    a page that agrees with it. Default to CONTRADICTED or UNSUPPORTED when the evidence
    is thin.

    Verdicts: CONFIRMED | CONTRADICTED | UNSUPPORTED (no source found — different
    from disproved, and must be reported as its own category) | STALE (was true, superseded)
    | UNVERIFIABLE (behind a login or sales process — say so plainly).

    Watch specifically for STALE. Several figures were gathered in June-July 2026
    and the paper is dated 14 August 2026. Fees change. Re-fetch every rate; do not
    carry a number forward because it appeared in an earlier draft.

    Known high-materiality targets: Ozow 2.85% + R1 card / 1.5% + R1 EFT; PayFast
    3.2% + R2 card / 2.0% EFT; Yoco 2.95% ex-VAT; the VAT treatment of each; the DPO
    -> Network International (2021) -> Brookfield (2024, GBP 2.2bn) ownership chain
    including whether Brookfield still holds it; PASA/Systems Operator and TPPP status;
    Stripe''s and PayPal''s South African availability; and every PCI-DSS / ISO 27001
    assertion — those are claimed by every vendor and evidenced by none, so the honest
    verdict is likely UNSUPPORTED rather than CONFIRMED.'
  status: pending
  milestone: M2
- id: F4
  title: Verify every contract-clause citation against the source documents
  inline_brief: 'Every CONTRACT_CLAUSE claim checked against the actual agreements
    already on disk — `.agent/memory/scratch/ozow-terms-20260814/ozow-terms.md` (34,265
    words, V1.2026 eff. 1 April 2026) and `.agent/memory/scratch/payfast-terms-20260814/payfast-terms.md`
    (22,916 words).

    For each citation confirm THREE things separately: (a) the clause number exists;
    (b) it says what we claim; (c) our plain-English rendering does not change its
    meaning. (c) is where this audit will actually find things — the article was deliberately
    rewritten into everyday language for a lay council, and simplification is exactly
    how a caveat quietly disappears. Check especially any place where a discretionary
    power ("may", "at its sole discretion", "reasonable opinion") has been rendered
    as a certainty.

    Re-verify the load-bearing findings from scratch rather than trusting the teardowns,
    which are our own work: PayFast 3.4 minimum volume fee at R20,000; 21.2(i)/(iii)
    six- and twelve-month dormancy; the missing clause 21.3(ii); 9.8''s 540 days;
    11.10 refund pre-funding; the ~2 months'' fees liability cap; the absence of any
    SLA. Ozow: 4.5.1 nine-month dormancy; Annexure 3 cl. 9.5 10%/180-day reserve;
    7.2/7.3 float; 6.3.2 VAT; 4.3.1 thirty-day termination; Schedule 2 cl. 2.1 high-risk
    list.

    Also confirm both documents are the CURRENT versions — a contract superseded since
    we fetched it would invalidate the whole comparison. Check for a newer effective
    date at source.'
  status: pending
  milestone: M2
- id: F5
  title: Check arithmetic, internal consistency and the excluded-provider write-ups
  inline_brief: 'Three separate sweeps.

    ARITHMETIC: recompute every number independently rather than checking the working.
    The R1,000,000 worked example (2,000 x R500), each fee line, the VAT additions,
    the R5,175 / R6,325 / R3,450 differences, and every "R8 per R500 ticket" style
    figure. Confirm the stated payment mix actually produces the stated blended total.

    INTERNAL CONSISTENCY: the article was rewritten in layers, by several agents,
    over one afternoon. One self-contradiction has already been caught and fixed (section
    4 still called PayFast "the one we''re recommending to keep" and said Ozow''s
    contract could not be obtained, on a page quoting it throughout). Assume there
    are more. Cross-check the summary against the comparison blocks against section
    4 against the appendix. Every figure must agree everywhere it appears.

    EXCLUDED PROVIDERS: each of the thirteen write-ups states a reason and a confidence.
    Verify the reason is true and the stated confidence is honest — over-claimed confidence
    is itself a defect here. Peach and Paystack are recorded as never properly researched;
    confirm that admission is accurate rather than an excuse, and establish whether
    either actually supports recurring billing, since that single fact decides whether
    they belong in the comparison at all.'
  status: pending
  milestone: M2
- id: F7
  title: Enforcement evidence — what these companies actually DO, not only what they
    may do
  inline_brief: 'Brad, 2026-08-14: "Because they state these things in their terms
    and conditions doesn''t mean they enforce them. Stating they have the right to
    do it doesn''t mean they will do it."

    He is right, and this is the mirror image of the mistake that started all of this.
    The original research trusted marketing pages — what a company SAYS it does. The
    rewrite trusts contracts — what a company MAY do. Both are half a picture. A contractual
    right is an exposure, not a certainty, and the article currently reads as though
    every clause will be exercised.

    Gather evidence on ACTUAL PRACTICE, via Alembic, for the clauses that carry real
    money: PayFast''s 540-day hold (9.8), its Minimum Volume Fee (3.4), its 6/12-month
    dormancy (21.2), its collateral demand (20.1); Ozow''s 10%/180-day Rolling Reserve
    (Annexure 3, 9.5), its Float requirement (7.2), its 9-month dormancy (4.5.1).

    Where to look: South African merchant forums and communities, Hellopeter and similar
    review sites (merchant-side, not consumer-side — they are different populations
    and the article already over-weights a 7-review consumer sample), MyBroadband,
    developer forums, small-business and e-commerce groups, National Consumer Commission
    or Ombud complaint records, and any court or tribunal reports. Search for the
    experience, not the policy: held funds, delayed settlement, frozen accounts, reserve
    imposed, account closed for inactivity.

    RATE EACH CLAUSE on two axes and keep them separate: how BAD it would be if exercised
    (already known from the contract) and how LIKELY it is to be exercised (this feature''s
    job). Report the evidence base honestly — "no merchant reports found" is a legitimate
    and useful answer, and it is NOT the same as "this never happens". Absence of
    complaints from a small market is weak evidence either way, and must be labelled
    as such.

    **THE ASYMMETRY THAT MATTERS MOST, and it cuts against the reassuring reading:**
    SAOC''s pattern is precisely the profile discretionary risk clauses exist to catch
    — an account dormant for three years that suddenly processes ~R1,000,000 in three
    days, for entry delivered weeks after payment, with no trading history to price
    against. Sudden volume spike, advance-purchase exposure, thin file. These clauses
    may go unused for ordinary steady merchants and still fire for this one. Assess
    likelihood for SAOC''S SPECIFIC PROFILE, not for a typical merchant, and say plainly
    if the evidence cannot support that distinction.

    Do not soften a finding because enforcement looks rare, and do not sharpen one
    because a clause reads harshly. Report frequency and severity separately so the
    Council can weigh them itself.'
  status: pending
  milestone: M2
- id: F6
  title: Ranked fix list, delivered as proposed changes — nothing applied
  inline_brief: 'Output is `.agent/memory/scratch/audit/findings.md` plus the completed
    claims register. DO NOT EDIT the article. Brad applies, or authorises applying,
    after reading.

    Structure by what he has to decide, not by section order: (1) WRONG — must fix
    before Lee-Ann sees it, with the correct fact and its source; (2) OVERSTATED —
    true but claimed with more confidence than the evidence carries; (3) STALE — needs
    a re-check before the meeting; (4) UNSUPPORTED — we cannot show it is true, so
    it should be softened or dropped; (5) MISSING — a material fact the audit surfaced
    that the article should carry.

    For each: the exact current wording, the proposed wording, the source URL, and
    one line on why it matters to the Council.

    State the audit''s own limits explicitly: what could not be verified and why,
    which sources were weak, and what a reader should still treat as unconfirmed.
    An audit that claims everything checks out is less credible than one that names
    its gaps.

    Finally, judge whether the RECOMMENDATION still holds. It currently splits on
    whether SAOC sells memberships: memberships -> PayFast, ticket-only -> Ozow. If
    the verified facts no longer support that split, say so directly. That is the
    finding that matters most and it must not be buried in a list.'
  status: pending
  milestone: M3
milestones:
- id: M1
  title: Claims extracted and the verification process proven able to catch a falsehood
  features:
  - F1
  - F2
  status: pending
- id: M2
  title: Every claim independently verified against live primary sources
  features:
  - F3
  - F4
  - F5
  - F7
  status: pending
- id: M3
  title: Ranked fix list delivered, recommendation re-tested
  features:
  - F6
  status: pending
---



# Mission: adversarially audit the payment-gateway research before it reaches Lee-Ann

## Why this mission exists

On 14 August 2026 the payment-gateway research was substantially rewritten after both merchant
contracts were finally obtained and read. That rewrite overturned several claims the paper had
made confidently:

- The recommendation had rested partly on sunk cost ("we already built the PayFast integration"),
  which is a reason it is cheaper for us, not a reason it is better for SAOC.
- Ozow's nine-month dormancy clause had been called the largest risk for either vendor. PayFast's
  is stricter — suspension at six months, automatic termination at twelve.
- "PayFast explicitly onboards non-profits" came from marketing copy. Its contract is silent on
  non-profits, exactly like Ozow's.
- Yoco was disqualified partly for a refund-funding constraint that BOTH surviving candidates also
  have.
- PayGate was presented as an alternative to PayFast. They share a parent.
- Peach and Paystack were never actually researched.

**Every one of those errors has the same root cause: the research compared marketing pages and
help documentation, and treated the contracts that actually govern the relationship as
unobtainable.** Ozow's was one API call away. PayFast's is a public web page.

The corrected article is better, but it was produced fast, by several agents, in one afternoon,
and it has not been checked by anyone who did not write it. It is about to be shown to the client.
That is the moment to audit it.

## The constraint that defines this mission

Brad's instruction: **"I don't want any LLM memory weights interfering with this — must just be
raw research facts."**

This is the right instruction and it needs enforcement rather than good intentions. A model asked
to set aside its priors will still use them, and will still sound confident while doing it. The
enforcement mechanisms are in F2:

- No CONFIRMED verdict without a live-fetched URL, a fetch date, a verbatim quote, and the Alembic
  confidence header.
- Well-known facts get fetched anyway. One request removes the whole failure mode.
- Seeded false claims run through the same pipeline. If a fabricated claim comes back CONFIRMED,
  the pipeline is unsound and every other green verdict is suspect.

## Scope discipline

- **Do not edit `docs/payment-gateway-decision.html`.** Brad is reading it. The audit target is the
  frozen snapshot at `.agent/memory/scratch/FROZEN-payment-gateway-decision-b79c871.html`.
- Findings are **proposed** changes. Nothing is applied without Brad's say-so.
- All fetching through Alembic. Never WebFetch while Alembic is up.
- UNSUPPORTED is a real verdict and must not be quietly rounded to CONFIRMED. "We could not find
  evidence" is useful to the Council; a confident restatement of an unevidenced claim is not.
- Do not touch `branding/`, `design spec/`, `design/Claude Design HTML/`.

## Known defects — already identified, must be in the fix list, do NOT re-litigate

These were caught before the audit started. Confirm each, then carry it into F6's fix list. Do
not spend verification budget re-proving them.

1. **THE DEADLINE IS WRONG, AND IT IS THE MOST URGENT ITEM IN THIS MISSION.** The article says
   SAOC needs a payment gateway "by the end of this year". Brad corrected this on 14 August 2026:
   **the real deadline is the end of AUGUST 2026** — roughly two weeks from that date, not
   sixteen months.

   This is not a typo, it changes the answer. Every "there is time to switch" or "resolve before a
   second Show" framing in the article assumes months of runway that do not exist. With two weeks:
   - Migrating to a new gateway is almost certainly not feasible before tickets must go on sale.
   - Onboarding with a vendor SAOC has no account with (Ozow, Yoco) means FICA, entity checks and
     activation inside two weeks — verify whether that is even possible and say so plainly.
   - The recommendation's split (memberships → PayFast, ticket-only → Ozow) may be moot for 2027
     purely on timing, and become a decision about the edition AFTER this one.

   **Time pressure is a legitimate constraint and must be stated as one — it is NOT the sunk-cost
   argument this paper was correctly criticised for.** "We already built it" is about our
   convenience. "There are fourteen days" is about whether tickets can be sold at all. Keep those
   two arguments visibly separate; collapsing them is how the original error happened.

   F6 must re-test the recommendation against the real deadline and say what SAOC should do for
   2027 versus what it should set up for the edition after.

2. **"We looked at six companies" contradicts the article's own contents.** Section 4 now writes
   up thirteen providers. Fix the count, or say plainly that six were assessed in depth and the
   rest ruled out earlier — but the page must not disagree with itself.

3. **The Show's duration is three days.** Confirm the article states this correctly wherever the
   selling window or event length is described.

4. **THE "MEMBERSHIPS FIX THE CONTRACT PROBLEM" PARAGRAPH IS WRONG. Highest-priority correction
   after the deadline.** The article's section 1 says: "The Minimum Volume Fee stops applying once
   monthly income passes R20,000... The membership plan does not just add revenue — it fixes the
   contract problem." Brad rejected this on 2026-08-14: "There's no ways a society is going to do
   20k of membership fees a month, it's just unrealistic." He is right, and the arithmetic was
   never done.

   R20,000/month is **R240,000 per year** in membership subscriptions. At a realistic R200–500 per
   member per year that requires roughly 500–1,200 paying members transacting through
   saoc.co.za — implausible for a national council of 21 affiliated societies.

   THE CORRECTED POSITION, verified against both contracts:
   - PayFast's inactivity clauses (21.2(i), 21.2(iii)) trigger on whether Payment Transactions are
     submitted, NOT on volume. So monthly membership billing DOES keep the account alive and does
     defuse the 6-month suspension and 12-month auto-termination. That half of the claim survives.
   - The Minimum Volume Fee (cl. 3.4) keys on monthly income of R20,000 or less. Memberships will
     not clear it. **The fee therefore applies in essentially every month, permanently** — not
     just between Shows.
   - The amount is not in the contract; it is set in the Application form, which we have never
     seen. So it is an **unknown recurring monthly charge, in perpetuity, on a 36-month
     auto-renewing agreement.**
   - **Ozow has no equivalent.** Verified: no minimum volume fee, no monthly fee, no minimum term
     (cl. 4.1.1 indefinite), no auto-renewal, no early-termination penalty, 30 days' notice either
     side (cl. 4.3.1).

   WHY IT MATTERS TO THE DECISION: at only R200/month the fee is R7,200 across a three-year cycle
   — already more than the ~R5,175 that choosing Ozow saves on ticket fees for an entire Show. An
   unknown fee could therefore exceed the entire cost difference the article spends its main table
   computing. F6 must model this at several plausible fee levels rather than assert a conclusion,
   and must obtain or flag the actual figure as a blocking question for PayFast.

   The "memberships → PayFast" arm of the recommendation survives ONLY on the recurring-billing
   capability, which nothing else has. It must no longer be justified by the minimum-fee argument.

5. **"Ozow's Integration Manual is only released to committed merchants" is FALSE — and it was
   our own tooling failure, not a vendor restriction.** The article states this in section 1 and
   uses it as a mark against Ozow. It is wrong. The documentation hub at hub.ozow.com is a
   Stoplight single-page app; we were fetching it incorrectly and getting the navigation shell
   back, then read that as a paywall. On 2026-08-14 the entire hub proved readable through
   Stoplight's public JSON API via Alembic — that is how we obtained the 34,265-word merchant
   agreement in the first place. Pattern: `/api/v1/projects/cHJqOjIzNzc2Mg/nodes/<slug>`, with
   the site map at `/api/v1/projects/cHJqOjIzNzc2Mg/table-of-contents`.

   Remove the claim, and pull the actual integration documentation before the Council meets —
   whether Ozow's API can do what SAOC needs is now answerable, not a gap.

6. **"Ozow has no documented non-profit onboarding path" is UNSUPPORTED, and PayFast's opposite
   claim is equally unverified. Same error, opposite directions.** Brad, 2026-08-14: "If you
   didn''t run through the sign-up options on Ozow, how can you be certain that they don''t
   support non-profits? For example, when I was doing the sign up on Ozow... I selected [IT
   company] and got stuck with that communications licence issue, but when I went back and
   selected Other, the second option I could select was SME."

   **He has actually used the signup flow. We never did.** We inferred an absence from marketing
   pages and reported it as a finding. An entity type that is not advertised on a landing page
   may well be selectable two steps into the form — his experience shows the flow branches in
   exactly that way.

   The symmetry is the real lesson and F6 must state it: we CREDITED PayFast with non-profit
   onboarding on the strength of its marketing copy, and DEBITED Ozow for the absence of the same
   copy. Neither was tested. Both claims must be marked UNSUPPORTED unless someone completes the
   signup flows far enough to see the entity-type options. That test is cheap — it does not
   require signing anything — and should be done before the Council meets.

   Note the ECNS licence dead end Brad hit is itself evidence the flow is category-driven and
   recoverable by re-selecting, not a hard gate.

7. **YOCO WAS EXCLUDED BY A REASONING ERROR AND MUST BE REINSTATED FOR TICKETS. Rank this with
   the deadline.** Brad asked repeatedly why Yoco is no longer in the research; the paper never
   gives a straight answer. Here it is: only ONE exclusion reason survives — Yoco cannot do
   recurring billing — and that disqualifies it for MEMBERSHIPS, a future use case the Council has
   not scoped or confirmed. It says nothing about SELLING TICKETS, which is the actual, funded,
   fourteen-day requirement. Yoco was removed from the whole comparison on a criterion that only
   applies to the part of the job it was not needed for.

   The arithmetic makes it worse. On card, per R500 ticket: **Yoco R14.75, Ozow R15.25, PayFast
   R18.00.** On R1,000,000 incl VAT: Yoco R33,925, Ozow R35,075, PayFast R41,400. **Yoco is the
   cheapest card option of the three** — it charges a flat 2.95% with no per-transaction fee where
   Ozow adds R1 per payment. This also falsifies the article's claim that Ozow is cheapest "on
   every payment method": Ozow's genuine advantage is bank transfer (R8.50 per R500), which is a
   different claim.

   Yoco also has the best-evidenced non-profit onboarding of any provider reviewed — explicit NPO
   path, signup by chairperson/treasurer/secretary, dedicated non-profit FICA guide. Against a
   fourteen-day deadline, onboarding speed is the binding constraint, and we excluded the vendor
   that scores highest on it.

   F6 MUST: reinstate Yoco as a candidate for TICKETS; re-verify the 2.95% rate live (it is
   carried from June-July research and never re-fetched — STALE risk); confirm whether Yoco
   charges any per-transaction or monthly minimum fee, since its cost advantage depends on there
   being none; and check the 90-day refund cap and same-day-only debit refunds against SAOC's
   realistic refund window, as those ARE genuine constraints unlike the withdrawn balance
   argument.

8. **The article presents an either/or that the contracts do not require.** Brad asked on
   2026-08-14 whether SAOC could run tickets through Ozow and memberships through PayFast. It can:
   PayFast cl. 2.2 provides its services "on non-exclusive basis"; Ozow cl. 3.1.1 grants a
   "non-exclusive, non-transferable, revocable licence". **Neither contract prohibits using
   another provider, and the article never says so.** That is a material omission — the paper
   frames the decision as picking one, when the Council may use both.

   F6 must evaluate the SPLIT option properly alongside the other two, on evidence, not opinion.
   Points it must resolve rather than assert:
   - Splitting does not solve dormancy, it duplicates it. Tickets-on-Ozow means the Ozow account
     is idle ~36 months between Shows and hits cl. 4.5.1's nine-month trigger. Only the account
     carrying the monthly memberships stays warm.
   - PayFast's Minimum Volume Fee (cl. 3.4) keys off monthly income reaching PayFast. If
     memberships alone fall under R20,000/month, the fee applies every month. **Get the actual
     member count and subscription price — this cannot be answered without them**, and the answer
     decides whether the split costs or saves.
   - Two gateways = two integrations, two reconciliations, two payout streams, two FICA
     onboardings, and refunds handled in two places, all carried by a volunteer treasurer.
     Quantify the admin burden honestly; it may exceed the ~R5,175 fee saving per Show.
   - Against a fourteen-day deadline, building two integrations is almost certainly not feasible.
     Say so plainly if the evidence supports it.

   The likely shape of the answer is a SEQUENCE rather than a choice — what SAOC runs for the 2027
   Show given the time available, versus what it should deliberately set up afterwards. Present it
   that way if the evidence supports it, and keep the time constraint visibly separate from the
   sunk-cost argument the paper was correctly criticised for.

## What good looks like

A list Brad can act on in an hour, ordered by what would embarrass us or mislead the Council if it
went unfixed — with the audit's own blind spots stated plainly at the end.

The failure mode to design against is an audit that finds nothing. Given how fast the article was
assembled, and that one self-contradiction has already been caught by accident, a clean result
would more likely mean the audit was shallow than that the article is flawless.
