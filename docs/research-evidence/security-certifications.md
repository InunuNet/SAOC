# Security and Compliance Certification — Facts Only

Comparison-template heading 16. Ozow, PayFast, Yoco, Peach Payments, Paystack. Facts only — no
scoring, ranking, or cross-provider judgement. All fetches via Alembic (`curl -s
http://localhost:7077/<url>`), 2026-08-14. Client context: SA NPO, ~2,000 online (card-not-present)
tickets at ~R500 for a 3-day event, live by end of August 2026.

Labels: **VERIFIED** (independently checkable evidence — registry entry, published certificate
text), **VENDOR-ASSERTED** (provider says so, no independent confirmation available),
**NOT ESTABLISHED** (searched, not found — stated with what was tried).

---

## Independent verification attempted (amended pass — chasing actual certificates, not claims)

- **Mastercard SDP Compliant Registered Service Provider List** — **REACHABLE this pass**,
  reversing the prior "PDF blocked" finding. The direct PDF URL is WAF-blocked to a plain `curl`,
  but `curl -s "http://localhost:7077/https://r.jina.ai/<pdf-url>"` retrieved the current
  (October 2025, 69-page, list of ~9,000+ entries) list in full. This is Mastercard's own published
  register of companies for which Mastercard has **received a QSA-conducted PCI DSS Report on
  Compliance / Attestation of Compliance** — a genuine independent artefact, not a marketing claim.
  Full-text search of the retrieved list found: **Ozow (Pty) Ltd, Payfast (Pty) Ltd, and Baobab
  Payments GmbH** (Peach Payments' registered entity) present, each with a dated AOC entry and a
  named QSA (below). **Paystack, Inc.** (the global/US entity, not explicitly "Paystack South
  Africa (Pty) Ltd") is also present. **"Yoco" does not appear anywhere in the document** — searched
  in full, absent. See per-provider sections for the exact row quoted.
- **Visa Global Registry of Service Providers** (`visa.com/splisting/searchGrsp.do`) — **still
  UNREACHABLE for a targeted query**, retested this pass with `?js=true&no_cache=true` and
  `X-Alembic-Grace-Ms: 5000` as instructed. The page renders and returns "9,023 Records Found," but
  the `companyNameCriteria` parameter is not applied server-side — the returned table is the same
  unfiltered global dump regardless of the query string (confirmed: searching `Ozow` returns 0
  occurrences of "Ozow" in the result set). The search is driven by a client-side AJAX call that
  Alembic's fetch — even with JS rendering and a grace period — does not trigger. **A human would
  need to open `visa.com/splisting/searchGrsp.do` in an actual browser, type the company name into
  the search box, and click Search** to get a filtered result; this cannot currently be done by an
  automated fetch.
- **IAF CertSearch** (`iafcertsearch.org`) — **still UNREACHABLE**, retested this pass on the
  homepage, a guessed `/search-results/?keyword=<name>` URL, and via `r.jina.ai`. All three return
  either the generic homepage stub or a "404 — page not found" (the guessed search URL pattern is
  wrong; IAF CertSearch's real search is a JS single-page app with no discoverable static or
  query-string search endpoint). **A human would need to visit `iafcertsearch.org`, use the
  interactive search box, and — per IAF's own model — likely pay for a paid CertSearch plan to see
  results**, since IAF CertSearch is a commercial, subscription-gated database, not a free public
  registry like PASA's or Mastercard's.
- **SGS "Certified Clients and Products" directory** (`sgs.com/en/certified-clients-and-products`)
  — attempted as a possible route to an ISO 27001 certificate number for any provider naming SGS as
  certifier; **blocked by Akamai WAF** ("Access Denied," edge reference ID returned), same failure
  pattern as Mastercard's raw PDF endpoint. Not usable via Alembic or direct curl.
- **PASA (Payments Association of South Africa) public TPPP and SO registers** — **REACHABLE**.
  PASA publishes two PDFs at `authorisation.pasa.org.za/so-and-tppp/documents/`:
  `Public-list-TPPP-October-2024.pdf` and `Public-list-SO-March-2025.pdf`, both fetched in full via
  `r.jina.ai` fallback. This is an official regulator-adjacent registry (PASA is recognised by SARB
  as the Payment System Management Body), independent of any vendor's own marketing — used below as
  VERIFIED evidence for PASA/SARB status, item 4.

---

## 1. Ozow

**PCI DSS** — **VERIFIED** on the Mastercard SDP Compliant Registered Service Provider List
(October 2025 edition, fetched via `r.jina.ai`): *"Ozow (Pty) Ltd 10/04/2024 Galix Networking Pty.
Ltd. MEA"* — i.e. Mastercard's own register shows an **AOC dated 10 October 2024**, assessed by
QSA **Galix Networking (Pty) Ltd**, region MEA. This is a genuine third party confirming a
Mastercard-conducted-or-received PCI DSS attestation exists — a real artefact, not a marketing
claim. What is **not** independently confirmed: the exact **level** (Mastercard's list only
distinguishes Level 1 Service Providers, consistent with Ozow's own "Level 1" claim, but the list
itself doesn't print the level per row) and the **PCI DSS version** (v3.2.1/v4.0/v4.0.1) — those
remain VENDOR-ASSERTED, from Ozow's own privacy policy: *"Ozow is PCI DSS Level 1 Certified and
ISO 27001 Certified"* (§11.2), also restated on `ozow.com/security` ("We abide by PCI-DSS Level 1
processes... even though we don't process credit cards"). No AOC document itself, version number,
or Visa-registry cross-confirmation was recovered — the Visa registry remains unreachable (above).

**ISO 27001** — VENDOR-ASSERTED only. Same privacy-policy clause as above, plus "mechanisms in
place... to maintain its ISO 27001 and PCIDSS-certification" (§25.3.1–25.3.3). No certificate
number or certification body named; IAF CertSearch (the one route that could independently confirm
this) remains unreachable.

**ISO 27701 / SOC 2** — NOT ESTABLISHED. No claim found.

**PASA / SARB** — VERIFIED (independent registry). MSA cl. 3.2.2: Ozow "is registered as a TPPP
with its Sponsor Bank and... PASA, and as a System Operator with PASA." Confirmed on both PASA
public registers: TPPP list, "Ozow (Pty) Ltd," reg. 2013/214663/07, sponsored by **Absa, Capitec,
Investec, and Nedbank**; SO list also lists Ozow — a registered **System Operator** in its own
right, not only a sponsored TPPP.

**3-D Secure** — CONTRACT-ASSERTED. MSA cl. 14.1 mandates 3DS for all Card-not-Present
Transactions; cl. 13.1.2.4 lists 3DS among Ozow's services; cl. 14.2 puts liability on the Merchant
if 3DS is disabled — implying the standard liability shift applies when 3DS is used.

**Where claimed** — privacy policy/terms clause, no dedicated trust-centre page or AOC.

## 2. PayFast

**PCI DSS** — **VERIFIED** on the Mastercard SDP list: *"Payfast (Pty) Ltd 05/22/2025 Foregenix
Limited MEA"* — an **AOC dated 22 May 2025**, assessed by QSA **Foregenix Limited**, region MEA —
the most recently dated of the three MEA entries found (Ozow's is October 2024), consistent with
PayFast's compliance pages describing an actively maintained certification. The **level and PCI
DSS version themselves remain VENDOR-ASSERTED only**: `payfast.io/pci-dss/` and
`/compliance-documentation/` publish a "Level 1" claim (per prior fetch in `merchant-evidence.md`),
but both pages were **unreachable this pass** — `payfast.io` returned "Site is offline... scheduled
maintenance" on repeated attempts today, so the exact wording could not be re-confirmed live. No
AOC document, certificate number, or Visa-registry cross-confirmation was recovered. General Terms
cl. 1.1 commits PayFast to "compliance of the PCI DSS"; cl. 20 requires merchant SAQ-D/QIR use —
merchant obligations, not a restatement of PayFast's own cert.

**ISO 27001** — VENDOR-ASSERTED only, hedged: `payfast.io/privacy-policy/` claims compliance "with
ISO 27001 **(where applicable)**" — weaker/conditional vs. Ozow's unqualified claim (per prior
fetch; PayFast's site was unreachable to re-confirm this pass, see above). No cert number.

**ISO 27701 / SOC 2** — NOT ESTABLISHED. Targeted search returned nothing PayFast-specific.

**PASA / SARB** — VERIFIED (independent registry). General Terms never assert PayFast's own
PASA/TPPP status (only require the Merchant to bank with a SARB-licensed bank, cl. 4.1). Confirmed
independently regardless: TPPP list, "Payfast (Pty) Ltd," reg. 1999/017441/07, sponsored by **Absa,
Investec, and Nedbank**; SO list also lists PayFast — a registered **System Operator** in its own
right.

**3-D Secure** — CONTRACT-ASSERTED. Cl. 8.4(iii): online transactions authenticated "via 3D
Secure"; cl. (xii p.257) addresses liability "in the event 3D secure authentication is disabled...
other than as a result of gross negligence or willful misconduct by us" — implying PayFast bears
responsibility if it disables 3DS, though no clause names "liability shift" explicitly.

**Where claimed** — dedicated compliance pages, not the General Terms text itself.

## 3. Yoco

**PCI DSS** — VENDOR-ASSERTED, and the only one of the five actively **absent from the one
registry that was checkable**. Help Centre article "How Yoco Keeps your Payments and Data Secure"
(`support.yoco.help/en/articles/109572`): "All Yoco card machines are PCI compliant and EMV
certified" — no level, no version, no AOC/QSA. Developer docs say only "ensuring PCI compliance."
No dedicated compliance page exists — `yoco.com/za/security/` 404s. **Checked against the
Mastercard SDP Compliant Registered Service Provider List (Oct 2025, full-text searched): no entry
for "Yoco" or "Yoco Technologies" anywhere in the ~9,000-row document.** This does not prove Yoco
lacks PCI DSS certification — the SDP list only lists Service Providers for which Mastercard itself
has received an AOC, and Yoco may hold a certificate that was simply never submitted to Mastercard,
or may rely on an acquiring bank's PCI compliance rather than its own — but it is a genuine,
checkable absence on the one register this research could actually search, worth putting to Yoco
directly.

**ISO 27001 / ISO 27701 / SOC 2** — NOT ESTABLISHED for all three. No claim found on Yoco's own
site (Help Centre, developer docs, blog) or general search — an absence of the claim itself, not
merely unverifiable.

**PASA / SARB** — VERIFIED (independent registry). No self-statement found on Yoco's own site.
Confirmed on the PASA **TPPP register only** (absent from the SO register): "Yoco Technologies
(Pty) Ltd," reg. 2013/203377/07, sponsored by **Absa and Nedbank**. Yoco is a sponsored TPPP, not
a registered System Operator (unlike Ozow and PayFast).

**3-D Secure** — NOT ESTABLISHED for card-not-present/online transactions specifically. Yoco's
security article and card-payment marketing focus on **card-machine (in-person)** PCI/EMV
compliance. Neither the Gateway FAQ nor the developer Checkout API docs used the phrase "3D
Secure"/"3DS" for the online flow in this pass — a genuine gap directly relevant to SAOC's
card-not-present ticket sales, worth confirming with Yoco before signing.

**Where claimed** — Help Centre article and a developer-docs footer line; no compliance page (404).

## 4. Peach Payments

**PCI DSS** — **VERIFIED** on the Mastercard SDP list, and the strongest-matched entry of the
five because the vendor's own certificate page names the exact legal entity used on the registry.
Peach's dedicated page `peachpayments.com/legal-doc/pci-compliance-certificate/` states: *"PCI DSS
Level 1 Certified... This document is a certificate of compliance awarded to Boabab Payments GMBH
DBA: Peach Payments (PTY) LTD and indicates that the company has been assessed against... v4.0.1
and has met the requirements."* The Mastercard SDP list carries a matching row under that exact
legal name: *"Baobab Payments GmbH 11/04/2024 Galix IT Compliance (Pty) Ltd"* — an **AOC dated 11
April 2024**, assessed by QSA **Galix IT Compliance (Pty) Ltd**. This is the only one of the five
providers where the vendor-published entity name and the Mastercard registry entity name match
exactly, letting the two sources cross-confirm each other. Peach's own page additionally names the
**standard version (v4.0.1)** — not printed on Mastercard's list — so that specific detail remains
VENDOR-ASSERTED even though the underlying AOC's existence is now VERIFIED. No AOC document itself,
certificate number, or Visa-registry cross-confirmation was recovered. Repeated on
`peachpayments.com/info`.

**ISO 27001 / ISO 27701 / SOC 2** — NOT ESTABLISHED for all three. No claim on the PCI page,
`/solutions/security/`, or a targeted search — only the same PCI DSS Level 1 language recurs.

**PASA / SARB** — VERIFIED (independent registry), structurally distinctive. The 35-page MSA
contains no PASA/TPPP self-statement in the clauses extracted. Confirmed independently under the
registered (not trading) name: TPPP list, "Peach Payment Services (Pty) Ltd," reg.
2012/076633/07, sponsored by **Absa, Capitec, and Nedbank**; SO list, "Baobab Payments (Peach
Payments), HRB252872, Baobab Payments GmbH" — registered as a System Operator under its German
holding entity's Handelsregister number, matching the "DBA Peach Payments" wording on its own PCI
page.

**3-D Secure** — CONTRACT-ASSERTED, uniquely priced separately. MSA Annexure A §IV: "Local SA card
**with 3DS** 2.95%" vs. "**without 3DS** 3.5%" — 3DS is optional at the merchant's choice, with a
materially lower fee when used, implying the differential reflects the fraud-liability shift
(not stated explicitly).

**Where claimed** — dedicated certificate page (most specific text); ISO absent; 3DS is a priced
line item in the binding fee schedule, not a narrative clause.

## 5. Paystack (South Africa)

**PCI DSS** — **VERIFIED, with a jurisdictional caveat**, on the Mastercard SDP list: *"Paystack,
Inc. 11/08/2024 VikingCloud, Inc. US"* — an **AOC dated 8 November 2024**, assessed by QSA
**VikingCloud, Inc.**, region **US**. The registered entity on Mastercard's list is **"Paystack,
Inc."**, the global/US parent — **not** explicitly "Paystack South Africa (Pty) Ltd," the entity
that actually contracts with SA merchants. No separately listed South African entity was found on
the Mastercard list. Paystack's own dedicated page `paystack.com/compliance` states: *"Paystack has
been audited by an independent PCI Qualified Security Assessor (QSA) and we're **PCI DSS 3.2
compliant** as a **Level 1 Service Provider**"* and self-cites both "Paystack on the Visa PCI
DSS-certified service provider database" and "Paystack on the Mastercard Payment Facilitator
database" — those two self-citations remain VENDOR-ASSERTED (Visa's registry could not be queried
to confirm; the Mastercard entry found independently is under the global "Paystack, Inc." name, not
verified as covering the SA legal entity specifically). Also notable: `paystack.com/compliance`
states **PCI DSS 3.2** — an older version than Peach's stated v4.0.1 — worth confirming is current
rather than a stale page. The DPA (Clause 13) separately commits to annual third-party audits
producing a **redacted Summary Report available to the Merchant on written request**.

**ISO 27001 / 27701** — VENDOR-ASSERTED, explicit and unqualified, on two sources: the Terms
(*"As an ISO 27001 and 27701 certified organisation..."*) and a dedicated page,
`paystack.com/security`, both fetched 2026-08-14. No certificate number or certifying body
published on either; IAF CertSearch (the one route that could independently confirm this) remains
unreachable. Paystack is the only one of the five with an explicit **ISO 27701** claim found.

**SOC 2 Type II** — NOT ESTABLISHED as a named claim, though the DPA audit clause describes a
functionally similar annual attestation mechanism without using the term "SOC 2."

**PASA / SARB** — VERIFIED, both contractually and by independent registry (strongest documented
case of the five). MSA Introduction: Paystack South Africa (Pty) Ltd "is licensed by [PASA] to
operate as a third party payment provider" (matches the brief's clause 1.1). Confirmed on the PASA
**TPPP register only**: "PayStack South Africa (Pty) Ltd," reg. 2019/304691/07, sponsored by
**Absa and Nedbank**. Sponsored TPPP, not a registered System Operator (same position as Yoco).

**3-D Secure** — VENDOR-ASSERTED, present as part of a two-factor flow. Support article "Pay with
card" (`support.paystack.com/en/articles/2128258`): the card channel is authorised "by providing
your card pin, a one-time password and/or **3D Secure authorisation**" (hyperlinked to a dedicated
3DS explainer) — explicit confirmation of 3DS support for card-not-present transactions. No
liability-shift language found in the MSA text reviewed.

**Where claimed** — PCI/ISO in the privacy-policy section of the published Terms page, not a
separate trust centre; redacted audit Summary Report available on request per the DPA; 3DS in a
dedicated support article.

---

## Summary table

| Provider | PCI DSS | ISO 27001 | ISO 27701 / SOC 2 | PASA/SARB (verified) | 3DS (card-not-present) |
|---|---|---|---|---|---|
| Ozow | **VERIFIED** existence of AOC — Mastercard SDP list, 10/04/2024, QSA Galix Networking. Level/version VENDOR-ASSERTED ("Level 1") | VENDOR-ASSERTED — unqualified | Neither found | VERIFIED — TPPP (4 banks) + registered **SO** | CONTRACT-ASSERTED — MSA-mandated |
| PayFast | **VERIFIED** existence of AOC — Mastercard SDP list, 05/22/2025, QSA Foregenix Ltd. Level/version VENDOR-ASSERTED ("Level 1"; site unreachable to re-confirm) | VENDOR-ASSERTED — hedged "(where applicable)" | Neither found | VERIFIED — TPPP (3 banks) + registered **SO** | CONTRACT-ASSERTED — MSA clause |
| Yoco | VENDOR-ASSERTED only — generic "PCI compliant," no level. **Absent from the Mastercard SDP list** (checked, not found) | NOT ESTABLISHED | Neither found | VERIFIED — TPPP only (2 banks), not an SO | NOT ESTABLISHED — no online-checkout 3DS language found |
| Peach Payments | **VERIFIED** existence of AOC — Mastercard SDP list, 11/04/2024, QSA Galix IT Compliance, entity name ("Baobab Payments GmbH") matches vendor's own cert page exactly. Version v4.0.1 is VENDOR-ASSERTED | NOT ESTABLISHED | Neither found | VERIFIED — TPPP (3 banks) + registered **SO** (as Baobab Payments GmbH) | CONTRACT-ASSERTED — separately priced with/without 3DS |
| Paystack | **VERIFIED** existence of AOC — Mastercard SDP list, 11/08/2024, QSA VikingCloud, but under the **global "Paystack, Inc." entity**, not confirmed as the SA entity. Stated version "PCI DSS 3.2" (older than Peach's v4.0.1) | VENDOR-ASSERTED — explicit, on 2 pages | ISO 27701 VENDOR-ASSERTED (explicit, only one of five); SOC 2 NOT ESTABLISHED | VERIFIED — TPPP only (2 banks), not an SO | VENDOR-ASSERTED — named "3D Secure authorisation" |

**Registries reachable this pass, with real artefacts recovered**: the **Mastercard SDP Compliant
Registered Service Provider List** (via `r.jina.ai` PDF fallback) and **PASA's public TPPP/SO
registers** (same route) — both independent of vendor marketing, both yielded dated, named
evidence. **Registries still unreachable**: **Visa's Global Registry of Service Providers**
(client-side AJAX search that ignores the query string — confirmed again with `?js=true` and a
5-second grace period; ~9,023 unfiltered rows returned regardless of the search term), **IAF
CertSearch** (JS single-page app, no query-string search endpoint found, likely subscription-gated
even if reached), and **SGS's certified-clients directory** (Akamai WAF "Access Denied"). No ISO
27001 certificate number was recoverable for any of the five providers through any route tried.

---

## What to ask each provider for, in writing

- **Ozow / PayFast / Peach Payments**: a copy of the current PCI DSS **Attestation of Compliance**
  itself (not just the confirmation that one exists) — specifically the **standard version** (v3.2.1
  vs v4.0/v4.0.1), the **exact certified legal entity**, and the **expiry/next-assessment date**.
  Mastercard's list confirms an AOC exists and names the QSA and a date, but none of the three
  publishes the actual document.
- **Ozow / PayFast / Yoco**: the **ISO 27001 certificate number and issuing certification body**
  (e.g. BSI, SGS, DEKRA, DQS) — none was found published by any of the three, only narrative claims.
- **Yoco specifically**: given the absence from Mastercard's SDP list, ask directly (a) whether Yoco
  holds its own PCI DSS certification and at what level, or relies on a third-party
  processor/acquirer's certification, and (b) whether **3-D Secure / EMV 3DS is applied to online
  Checkout API transactions** (card-not-present) — no public documentation confirms this either way,
  and it is the fraud-liability-shift mechanism most directly relevant to SAOC's online ticket sales.
- **Paystack**: confirm whether the PCI DSS AOC found under "Paystack, Inc." on Mastercard's list,
  and the "Level 1"/Visa-Mastercard-registry claims on `paystack.com/compliance`, **extend to
  Paystack South Africa (Pty) Ltd** as the contracting entity, and whether the "PCI DSS 3.2" version
  stated on that page is current (Peach's equivalent page names the newer v4.0.1).
- **All five**: ask whether an ISO/IEC 27701 or SOC 2 Type II report exists and can be shared
  (Paystack is the only one claiming ISO 27701; none claims SOC 2). A redacted third-party audit
  report — the mechanism Paystack's DPA already documents on request — is the most useful document
  a non-specialist client can actually verify, since none of the primary registries (Visa, IAF) could
  be queried in this research pass.
