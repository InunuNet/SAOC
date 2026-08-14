# Session state — 2026-08-14 (write-up before auto-compact)

Everything below is on disk. Nothing here depends on conversation context.

## Live artifact
`docs/payment-gateway-decision.html` — published at
https://claude.ai/code/artifact/c20e6419-d68f-4958-92b5-a78050f06dc9
Republish with the same file path + that URL. Favicon 💳. Brad is reading it live.

## Source documents on disk (do NOT re-fetch)
- `.agent/memory/scratch/ozow-terms-20260814/ozow-terms.md` — Ozow Merchant T&Cs V1.2026, eff.
  1 Apr 2026, 34,265 words. Fetched via Stoplight JSON API:
  `https://hub.ozow.com/api/v1/projects/cHJqOjIzNzc2Mg/nodes/<slug>` (`data` field holds the
  markdown). Site map: `/api/v1/projects/cHJqOjIzNzc2Mg/table-of-contents`. Alembic prefixes a
  header line before the JSON — strip to the first `{` before parsing.
- `.agent/memory/scratch/ozow-terms-20260814/teardown.md` — 4,746 words, 9 sections.
- `.agent/memory/scratch/ozow-terms-20260814/reconciliation.md` — claim-by-claim vs old paper.
- `.agent/memory/scratch/payfast-terms-20260814/payfast-terms.md` — PayFast General T&Cs,
  22,916 words, from https://payfast.io/legal/general-terms-conditions/ (plain fetch, HIGH conf).
- `.agent/memory/scratch/payfast-terms-20260814/teardown.md` — 6,564 words, mirrors Ozow's.
- `.agent/memory/scratch/yoco-20260814/teardown.md` — plus raw sources in same dir.
- `.agent/memory/scratch/exclusions-writeup.md` — all 13 providers, why in/out.
- `.agent/memory/scratch/audit/claims.csv` — 236 claims (116 HIGH), verification cols empty.
- `.agent/memory/scratch/audit/protocol.md`, `negative-control-key.md` — 9 seeded falsehoods.
- `.agent/memory/scratch/FROZEN-payment-gateway-decision-b79c871.html` — audit target snapshot.

## CORRECTION — my Yoco pricing claim was WRONG
I told Brad "Yoco is the cheapest card option at R14.75 per R500 ticket." **Wrong.**
Yoco's ONLINE rate (the relevant one — not the in-person card-machine rate) is
**2.95% + R2 ex-VAT** on the R0–R50k/month tier = **R16.75 on a R500 ticket**.

Corrected ranking per R500 card ticket, ex-VAT:
- Ozow 2.85% + R1 = **R15.25** (cheapest)
- Yoco 2.95% + R2 = **R16.75**
- PayFast 3.2% + R2 = **R18.00**

Yoco sits BETWEEN the two, not below both. The "cheapest rail" claim does not survive
re-verification. Yoco's real advantages are onboarding, lock-in and dormancy (below).

## Yoco — verified findings
- **Lock-in: best of the three.** No minimum term, cancel anytime, no penalty, no notice period.
  (PayFast: 36-month auto-renewing. Ozow: 30 days' notice, no minimum term.)
- **Dormancy: best for a triennial cycle.** Profile simply "remains inactive" — no stated
  suspension, termination or fee. (PayFast: suspend at 6 months, AUTO-TERMINATE at 12 + fee.
  Ozow: termination permitted at 9 months.)
- **NPO onboarding: REAL and well-evidenced** — explicit "Non-Profit Organisation" business type,
  registered or unregistered, chairperson/treasurer/secretary may sign up, dedicated FICA guide,
  48-hour per-stakeholder review. No overall onboarding-time SLA — ask support given the deadline.
- **Refunds:** 90-day cap CONFIRMED; same-day-only debit refunds CONFIRMED; partial refunds
  CONFIRMED (more explicit than either competitor).
- **Liability cap:** 6 months' fees OR a flat R20,000 floor — the only one of the three stating an
  absolute rand figure.
- **Service levels: ABSENT** (matches PayFast; Ozow at least states targets).
- **Disputes:** SA courts incl. Magistrate's Court, no arbitration, no mandatory escalation —
  simpler than both competitors.
- **UNRESOLVED, not absent:** Yoco's reserve/hold mechanics. A "Reserve Account" clause is
  believed to exist but only via unverified search snippets — the Merchant Agreement PDF could
  not be read. Open question for Yoco support. Do NOT assert a figure.

## ALEMBIC BUGS — report to the maintainers
1. **PDFs unsupported.** Yoco's Merchant Agreement (`yoco.com/merchant-agreement.pdf`) and
   Payment Services T&Cs (a.storyblok.com PDF) return strategy `pdf-unsupported`, 0% yield. No
   JSON-API workaround exists — these are binaries. Google Docs Viewer, Scribd mirror and the
   Salesforce Lightning help page were all tried and all failed (JS-gated, correctly low-conf).
2. **`?js=true` 502s on PDF URLs** — "Page.goto: Download is starting". Playwright treats the PDF
   as a download rather than a page.
3. **SERIOUS: false HIGH confidence.** Four `support.yoco.help` articles returned strategy
   `llms.txt:excerpt` with **HIGH confidence** but the content was the site's navigation menu,
   not the requested article. Nothing flagged it. Workaround: append `.md` to the article URL,
   which triggers `content-negotiation` and returns correct content. Suggested fix: prefer
   content-negotiation over llms.txt:excerpt when both exist, or verify the extracted heading
   matches the requested slug before reporting HIGH.
   *This matters most — silently wrong content at high confidence defeats the whole
   evidence protocol.*

## Open question just raised by Brad — NOT yet answered
Ozow clause 20.8.1: accepting the terms grants Ozow consent to market to SAOC's ticket buyers
and members. Brad's point: this appears to conflict with POPIA, since SAOC cannot give consent
on its members' behalf. **He asked whether PayFast and Yoco have equivalent clauses.**
A grep of PayFast's terms for merchant-customer marketing consent found NOTHING, so it may be
Ozow-specific — but "not found" is not "not there" and this needs a proper check of both
PayFast and Yoco before any claim is made.

## VAT — verified from SARS, HIGH confidence
From 1 April 2026: **compulsory VAT registration at taxable supplies over R2.3 million/year**
(raised from R1m); **voluntary over R120,000** in any 12 months (raised from R50,000); register
within 21 business days of crossing. Source:
https://www.sars.gov.za/types-of-tax/value-added-tax/register-for-vat/ and the SARS Budget 2026
FAQ. NOTE: model priors would say R1m — they are stale.
**NOT yet verified:** whether non-profit / "association not for gain" / "welfare organisation"
status changes registration duty. SARS VAT414 guide fetch timed out. Do not answer from memory.

## Missions
- `admin-auth-hardening` — F1, F2 DONE, gate green 12/12, QA PASS. F3 (provisioning) next and is
  the blocker for the door scanner; project has ZERO auth accounts.
- `research-adversarial-audit` — ACTIVE. M1 done (F1, F2). M2 (F3, F4, F5, F7) and M3 (F6) open.
  **Nine known defects recorded in the mission file** — read it, don't re-derive them.

## ANSWERED — Ozow clause 20.8.1 marketing consent vs POPIA (verified verbatim)

**Ozow 20.8.1 — "The Merchant expressly consents and agrees that:"**
- 20.8.1.1 — Ozow, its Affiliates and service providers "may contact the Merchant **and its
  Customers**" using any email/phone the Merchant provides, "including contact by manual calling,
  pre-recorded or artificial voice messages, text messages, emails, and automatic telephone
  dialing systems".
- 20.8.1.2 — Ozow may send "advertising and marketing communications (including direct marketing,
  electronic marketing, or telemarketing)... **subject to the Merchant's or Customer's right to
  opt out**".
- 20.8.1.3 — Ozow may process and store Personal Information of the Merchant **and Customers**
  **trans-border** per cl. 20.7.
- 20.8.1.4 — Ozow may use the Merchant's logo and name in its marketing.
- 20.9 — an Opt-Out Rights clause exists.

**Why Brad's objection is well-founded.** It is drafted as OPT-OUT. POPIA s69 requires prior
consent (opt-in) for electronic direct marketing, and consent under POPIA must come from the
DATA SUBJECT — the member — not from SAOC on their behalf. Ozow cl. 20.5 makes SAOC the
Responsible Party for customer personal information, so SAOC is the party carrying the
obligation while purporting to grant a consent it does not own. Also note 20.8.1.3 puts
trans-border processing in the same consent block, which engages POPIA s72 separately.

**PayFast: NO equivalent clause found.** Searched its 22,916-word agreement for marketing /
promotion / newsletter against customer / cardholder — only hit is cl. 2.1 describing its own
Dashboard analytics product. PayFast cl. (line 461) instead puts the obligation the other way:
the merchant must handle Cardholder personal information per Applicable Law. So PayFast does NOT
appear to take marketing rights over the merchant's customers.

**Yoco: UNKNOWN.** Its Merchant Agreement is a PDF Alembic cannot read (see Alembic bugs above).
Must be checked before any three-way claim is made.

**Status: this looks like a genuine Ozow-specific differentiator** — i.e. it survives the
"is it common to all?" rule and IS worth keeping in the paper. But the Yoco gap must be closed
first, and legal characterisation (whether the clause is enforceable against members) is for a
lawyer, not for us. State the clause and the concern; do not opine on enforceability.

## MERCHANT EVIDENCE + CERTIFICATIONS (agent complete, full file: merchant-evidence.md)

**Review volume is itself the finding.** Hellopeter reviews in 12 months: **Yoco 353, PayFast
108, Ozow 7.** The paper currently quotes Ozow's 2.1/5 from 7 reviews as a mark against Ozow and
does not mention PayFast's numbers at all. PayFast is a **barbell: 41.7% 5-star / 51.9% 1-star
across 108 reviews** — far more evidence of merchant problems than exists for Ozow. Ozow's thin
sample is UNINFORMATIVE, not reassuring, and must be said that way.

**PayFast — the most corroborated negative pattern of the three.** Funds locked in-account for
weeks to 5+ months during verification/payout, across 5+ independent named-detail reviews. Also
one account of ITN failures causing commission charged on cancelled transactions. Positive
reviews cluster on individual support staff, not on the structural fund-hold issue. This is the
only case where public merchant experience corroborates a contract clause actually being
exercised.

**Yoco — highest volume, most positive (64.3% 5-star)**, but a real corroborated pattern of
sudden account suspension with funds/hardware locked and no warning (2 detailed Hellopeter
accounts + a Trustpilot snippet, one invoking CPA ss. 40/41/48/54). Also a non-profit
donor-refund-in-error case — directly relevant to SAOC.

**Ozow — too little evidence to characterise.** One usable merchant account (payout ~4x slower
than the promised 24hr window, unresponsive support). No dedicated Ozow Trustpilot business page.

**No public evidence that the long-duration clauses are exercised** — PayFast's 540-day hold or
dormancy termination, Ozow's 180-day reserve or 9-month dormancy, Yoco's 90-day refund cap. Weak
evidence in BOTH directions; explicitly not reassurance.

**CERTIFICATIONS — NONE VERIFIED. All CLAIMED-ONLY.**
- Ozow: claims "PCI DSS Level 1 Certified and ISO 27001 Certified", unqualified, in its own T&Cs.
- PayFast: claims PCI DSS Level 1 + ISO 27001 **"(where applicable)"** — a hedge Ozow does not use.
- Yoco: only generic "PCI compliance", no level stated, and **no ISO 27001 claim found at all**.
  This CONTRADICTS the paper's line that all providers claim ISO 27001 — verify before printing.

Registries were unreachable, not failed: Visa Global Registry is a JS search (returns
"Searching..." with 0 rows, or dumps all 9,023 records ignoring the filter); Mastercard SDP is
PDF-only and additionally WAF-blocked (Akamai Access Denied); IAF CertSearch is a JS SPA
returning only a marketing stub. **Add to the Alembic bug list** — as is the finding that
individual Hellopeter review deep-links are ~50% low-confidence through Alembic while aggregate
listing pages are consistently high.
