---
schema: athanor.mission/v1
slug: gateway-rubric
goal: Research every South African payment gateway to one uniform evidence standard
  and deliver an interactive weighted teardown the Council can drive itself
created_at: '2026-08-14T18:20:00.000000+00:00'
started_at: '2026-08-14T18:20:00.000000+00:00'
last_active_at: '2026-08-14T22:05:00.000000+00:00'
status: done
cost_estimate:
  features: 5
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M3
  feature: F5
  ts: '2026-08-14T22:05:00.000000+00:00'
features:
- id: F1
  title: Prove Alembic can retrieve comparable source material for every provider
  status: done
- id: F2
  title: Write up each gateway against one fixed 15-heading template
  status: done
- id: F3
  title: Census the whole SA market; every exclusion evidenced with a reason code
  status: done
- id: F4
  title: Build the weighted teardown artifact with sources linked per cell
  status: done
- id: F5
  title: Audit the scoring adversarially and trace all 130 cells to source
  status: done
milestones:
- id: M1
  title: Reachability proven
  status: done
- id: M2
  title: Ten providers written up
  status: done
- id: M3
  title: Artifact published and audited
  status: done
---

# Mission — gateway-rubric

**Goal:** Let the Council decide between five payment gateways by assigning its own importance
weights to its own deciding factors, on evidence gathered to one uniform standard.

**Providers (all five, no pre-elimination):** Ozow, PayFast, Yoco, Peach Payments, Paystack.

---

## THE PIPELINE — run in this order, do not skip ahead

This is the instruction Brad has now given three times. It is written here because context
compaction keeps losing it and the session keeps jumping to the artifact.

### Stage 1 — REACHABILITY (in progress)
Prove, per gateway, that Alembic can retrieve **fair, comparable** source material:
T&Cs / merchant contract, technical docs, marketing + pricing, support centre, NPO pages.

- Five agents dispatched 2026-08-14, one per gateway. Output: `.agent/memory/scratch/reach/<gateway>.md`
- Every fetch logged with: URL, HTTP status, Alembic strategy + confidence header, word count, VERDICT.
- VERDICT ∈ REACHABLE | PARTIAL | BLOCKED | NOT FOUND.
- **False-HIGH-confidence check is mandatory on every fetch.** Alembic returns HIGH confidence while
  serving navigation menus (confirmed on support.yoco.help, peachpayments.com/fees). If the returned
  heading does not match the requested document, it is BLOCKED, whatever the header says.
- **Gate:** Stage 2 does not start until the five reports exist and the comparability gaps are known.
  If a doc type is unreachable for one provider, that asymmetry must be stated, not papered over.

### Stage 2 — RESEARCH, ONE GATEWAY AT A TIME
One mission per gateway. Run them **sequentially, not in parallel** — Brad's instruction. Each writes
up its own data to the same fixed template so the five are genuinely comparable. No cross-provider
comparison inside a per-gateway write-up.

### Stage 3 — THE ARTIFACT
Only after all five write-ups exist. It compares them and **lets Brad assign the importance of each
deciding factor.**

---

## HARD CONSTRAINTS ON THE ARTIFACT (violated once already — 2026-08-14)

- **The weighting is Brad's, not mine.** No opinionated presets. A first build shipped with invented
  presets ("show-day operations", "cheapest wins", "protect us from the fine print") — that is the
  session's judgement wearing the Council's clothes. Removed; do not reintroduce.
- **Deciding factors come from Brad**, not from what the research happened to turn up.
  Factors he has named so far: pricing/fees; payment types supported (once-off, subscriptions,
  donations, in-person); refunds; harsh T&Cs; documented non-profit support; and **the gap between
  the marketing price and the price actually committed to in the contract** — he calls this his
  harsh-T&Cs decider. He has invited additional factors to be proposed, but proposed ≠ imposed.
- **Unverified facts must be visibly unverified**, never silently scored at a midpoint and blended in.
- The artifact holds evidence and does arithmetic. It does not lean.

---

## Standing facts (already established — do not re-derive)

- Deadline: **end of August 2026**, ~2 weeks. Show runs **three days**, then the account idles ~36 months.
- SAOC has **no merchant account anywhere**. The PayFast integration is a personal sandbox, not an account.
- Verified fee per R500 card ticket, ex-VAT: Ozow R14.25 · Paystack R15.50 · Peach R16.25 · Yoco R16.75 · PayFast R18.00.
- Only PayFast has a named NPO product (Cause account). Its rate is unpublished and whether it covers
  ticket sales rather than donations is **unresolved — the hinge fact**. Question drafted and ready to
  send: `docs/research-evidence/npo-pricing.md`.
- Evidence already on disk (do NOT re-fetch): `docs/research-evidence/` — both merchant contracts
  verbatim, three teardowns, merchant evidence, NPO pricing sweep, exclusions write-up.
- Ozow docs route: Stoplight JSON API, `https://hub.ozow.com/api/v1/projects/cHJqOjIzNzc2Mg/nodes/<slug>`.

## Known Alembic defects (report upstream)
1. PDFs unsupported — blocks Yoco's merchant agreement entirely. `?js=true` 502s on PDF URLs.
2. **False HIGH confidence on nav-menu extractions** — support.yoco.help, peachpayments.com/fees.
   Workaround: append `.md` to force content-negotiation. This one defeats the evidence protocol.

## Superseded
`docs/gateway-scorecard.html` — built out of order, at Stage 3 before Stage 1 finished, with invented
presets. Kept only as a layout reference. Do not publish it as the deliverable.

---

## STATUS 2026-08-14 19:00 — Stages 1–3 COMPLETE

**Deliverable:** https://claude.ai/code/artifact/3371d306-8941-423a-88ee-6e34a307d636
Source: `docs/gateway-comparison.html`. Republish same path to update. Favicon ⚖️.
13 factors, sliders start equal at 3, each tickable off, NO presets, NO recommendation.
Factors Brad did not name are tagged "proposed" in the UI.

**Evidence on disk — all five to the same 15 headings:**
`docs/research-evidence/{ozow,payfast,yoco,peach,paystack}-writeup.md`
`docs/research-evidence/security-certifications.md` (282 lines)
`docs/research-evidence/alembic-defects-2026-08-14.md` → filed as InunuNet/Alembic#351
`.agent/memory/scratch/reach/*.md` — reachability proof, retrieval routes per provider

**Headline findings (do not re-derive):**
- Peach is the ONLY provider whose contract states the rates (Annexure A, change by mutual
  agreement). Ozow/Yoco/Paystack defer to public pricing pages; PayFast to a private
  "Application" — and its cl. 21.2(iii) cross-references cl. 21.3(ii), which does not exist.
- So the marketing-vs-contract gap is near-universal, NOT a PayFast quirk. Framing corrected.
- Ozow cl. 20.8.1 (marketing to SAOC's customers + trans-border, opt-out) is UNIQUE — Yoco and
  Peach confirmed absent from primary sources, PayFast scoped to merchant only, Paystack has no
  marketing clause but permits Third Country transfer with consent burden on merchant.
- Cheapest rails per R500: Ozow Pay by Bank R7.50 · Peach Capitec R9.00 · Paystack EFT R10.00 ·
  PayFast Instant EFT R10.00. Card: Ozow R14.25 < Paystack R15.50 < Peach R16.25 < Yoco R16.75
  < PayFast R18.00.
- Peach is the only one with an SLA (99.0%, service credits). Paystack explicitly disclaims uptime.
- Yoco: ABSENT from Mastercard's SDP register (other four present with AOC dates + QSA names);
  no ISO claim; no 3DS statement for online checkout. Its two contracts also conflict with each
  other on arbitration and liability cap.
- Paystack's AOC is filed under Paystack, Inc. (US), not confirmed for the SA entity.
- PASA registers ARE reachable via r.jina.ai → all five VERIFIED registered. Visa registry,
  IAF CertSearch, SGS directory remain unreachable (IAF is paywalled even for humans).

**Retrieval routes that work (reuse, don't rediscover):**
- PDFs Alembic reports `pdf-unsupported`: `curl -s "http://localhost:7077/https://r.jina.ai/<pdf-url>"`
- Cloudflare-fronted pages (paystack.com): `?no_cache=true` + `Accept: application/json`
- Peach fees table: `?js=true` (plain fetch returns a sitemap at HIGH confidence)
- Yoco/Fern support articles: append `.md` to force content-negotiation

**Open — needs the vendors, not more research:** no provider publishes a verification turnaround;
PayFast's Minimum Volume Fee amount and Cause rate/scope; Yoco's governing contract, PCI status
and 3DS; Peach's KYC turnaround and hold cap; Paystack SA entity's own attestation.

## UPDATE — six providers, factors revised

- **Flutterwave added as a sixth** after `docs/research-evidence/exclusions-audit.md` found it was
  never assessed. PASA-verified (Flutterwave Technology Solutions (Pty) Ltd, reg 2017/146006/07,
  Absa-sponsored), ZAR settlement, self-serve SA KYC, ~72h published approval (the ONLY provider
  publishing one). Write-up: `docs/research-evidence/flutterwave-writeup.md`.
  **Two disqualifier-grade findings:** contractual 10% rolling reserve held 180 days (~R100k of a
  R1m show, for six months), and its SA-served MSA is Nigeria-templated (Nigerian law, Lagos
  arbitration) contradicting its own /za/terms. Also NGO/Charities need pre-approval.
- **Factor "Can we be live by end of August" REPLACED** with "How quickly it can be built"
  (`docs/research-evidence/integration-effort.md`) — Brad's point: approval turnaround is
  unpublished and unknowable, whereas documentation quality is measurable. Ozow scores worst (3):
  its Stoplight API reference returns HTTP 500 on every node, confirmed across two sessions, and
  webhook verification docs sit behind those broken pages. PayFast scores 9 — demo credentials
  published in-docs, no account needed. None of the six has a first-party Node SDK except
  Flutterwave.
- Removed a "no Nigerian link needed" note on Paystack — that was this session's framing, not a
  finding, and carried an unpleasant implication. Do not reintroduce.
- All 78 cells (13 factors × 6 providers) now open a plain-English explanation on click:
  what the factor means, what it means for that provider, and how solid the evidence is.

## Exclusions audit — outcome
`docs/research-evidence/exclusions-audit.md`. Confirmed DROP on evidence: Stripe (no SA merchant
onboarding), PayPal (cannot hold/pay out ZAR), Mukuru (remittance, no checkout product), DPO Pay /
PayGate (**same corporate parent as PayFast — never a second option**), Adumo, PayJustNow.
KEEP-PENDING if the list ever reopens: Zapper (only provider naming NPOs on its own pricing page,
rate sales-gated), Netcash, Stitch Express, iKhokha.
**Process finding:** Yoco was partly excluded for an "empty balance refund risk" that PayFast and
Ozow carry identically and were not penalised for — the criterion was applied unevenly.

## UNRESOLVED CONTRADICTION — do not average away
The exclusions audit put PayFast's R500 card fee at ~R14.68. Every other source, including
PayFast's own worked example on payfast.io/fees/, gives **R18.00 (3.2% + R2)**. R18.00 stands as
the vendor-quoted figure; the discrepancy is logged, not reconciled.

---

## FINAL — 2026-08-14 (session close). Ten providers, audited.

**Deliverable:** https://claude.ai/code/artifact/3371d306-8941-423a-88ee-6e34a307d636
Source `docs/gateway-comparison.html` — "Payment Gateway Teardown". 13 factors × 10 providers =
130 cells, each opening a plain-English explanation AND a live link to the provider's own source
document. Sliders start equal, no presets, no recommendation.

**Providers IN (10):** Ozow, PayFast, Yoco, Peach, Paystack, Flutterwave, Stitch, iKhokha, Zapper,
PayGenius. Census of 35 assessed: `docs/research-evidence/gateway-census.md` (19 OUT with reason
codes, 1 unresolved naming question). Four of the ten had originally been dropped without anyone
reading their contracts.

**Audits run this session — read these before trusting any number:**
- `scoring-audit.md` — adversarial review of the scoring system
- `provenance-audit-A.md` / `-B.md` — all 130 cells traced to source. 129 SOURCED, 1 UNSOURCED
  (PayFast money — fixed), 12 WEAK (all fixed)
- `integration-effort-v2.md` — the build row rebuilt after the first pass scored our fetch failures
  as provider defects

## THREE SCORING PRINCIPLES — learned the hard way, do not regress

1. **Silence is not protection.** A contract that says nothing scores MID, never high. Yoco scored
   10/VERIFIED on customer data because its contract was silent; corrected to 6/PARTIAL. Same fix
   applied across the dormancy row.
2. **A stated maximum is a protection; silence is not.** The inverse error, made the same day:
   PayFast's 540-day hold cap (cl. 9.8) was scored 1.5 as the worst term found anywhere. It is the
   CEILING on cl. 9.7's otherwise open-ended hold, and it tracks card-scheme dispute windows. Peach
   and Stitch reserve the same hold with NO cap. Corrected to 4; Peach 7→6.
3. **A right reserved is not a practice.** Brad's point, now a note on the page: these are worst-case
   legal powers, used against merchants in trouble, not a forecast of behaviour toward SAOC.
   We can read what contracts permit; we cannot read how they behave. Only merchant references can.

## Standing corrections
- PayFast R500 card fee is **R18.00** (3.2% + R2, its own worked example). The R14.68 in
  `exclusions-audit.md` is uncited and unused — do not resurrect it.
- "Bot-walled" / "500 error" / "could not retrieve" is OUR failure, never a provider defect.
  Every such claim in this project eventually proved retrievable.

## Open — needs the vendors, not more research
No provider publishes an approval turnaround except Flutterwave (~72h). PayFast's Minimum Volume
Fee amount and Cause-account rate/scope. Yoco's governing contract (its 2020 and 2026 documents
conflict on arbitration and liability cap), its PCI status (absent from Mastercard's register) and
whether 3DS covers online checkout. Peach's KYC turnaround. Zapper's NPO Custom rate. Paystack SA
entity's own PCI attestation. Zapper has NO webhook signing in its published spec — ask before building.

## Next session
Brad may do a single review pass. Nothing is mid-flight; all agents completed.
