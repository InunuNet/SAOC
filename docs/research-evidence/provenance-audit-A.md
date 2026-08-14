# Provenance Audit A — Ozow, PayFast, Yoco, Peach Payments, Paystack

65 scored cells (13 factors × 5 providers) checked against `docs/research-evidence/*-writeup.md`,
the two full contract dumps (`ozow-merchant-terms-v1.2026.md`, `payfast-general-terms.md`), the
teardowns, `security-certifications.md`, `npo-pricing.md`, `integration-effort.md`,
`merchant-evidence.md`, and `.agent/memory/scratch/reach/*`. No web re-fetching was needed — every
figure below was traceable to an on-disk document.

## Row-by-row table

| Factor | Provider | Class | Source doc | Quote/clause? | Status label correct? |
|---|---|---|---|---|---|
| cost | ozow | SOURCED | ozow-writeup §1 (ozow.com/pricing) | y | y |
| cost | paystack | SOURCED | paystack-writeup §1 | y | y |
| cost | peach | SOURCED | peach-writeup §1 (Annexure A) | y | y |
| cost | yoco | SOURCED | yoco-writeup §1 (support.yoco.help) | y | y |
| cost | payfast | SOURCED | payfast-writeup §1 (payfast.io/fees, worked example) | y | y |
| rail | ozow | SOURCED | ozow-writeup §1 | y | y |
| rail | peach | WEAK | peach-writeup §1 | y | n — labelled "Capitec Pay 1.5% + R1.50"; source calls the rail "PayByBank," and the R1.50 is Peach's universal per-transaction Processing Fee (Annexure A §II, applies to *every* method), not a Capitec-specific surcharge. Math is right, name is wrong. |
| rail | paystack | SOURCED | paystack-writeup §1 | y | y |
| rail | payfast | SOURCED | payfast-writeup §1 | y | y |
| rail | yoco | SOURCED | yoco-writeup (absence finding) | y | y |
| gap | peach | SOURCED | peach-writeup §2 (cl. 4.5) | y | y |
| gap | paystack | SOURCED | paystack-writeup §2 (MSA D.1) | y | y |
| gap | ozow | SOURCED | ozow-writeup §2 (cl. 6.1.1, 6.4.1.2) | y | y |
| gap | yoco | SOURCED | yoco-writeup §2 (cl. 5.2, verbatim) | y | y |
| gap | payfast | SOURCED | payfast-writeup §2 (cl. 3.4, broken 21.3(ii) x-ref) | y | y |
| exit | peach | SOURCED | peach-writeup §6 (cl. 8.1–8.4) | y | y |
| exit | yoco | WEAK | yoco-writeup §6 | y | n — score 9/"v" reads as unambiguously favourable, but the source shows Yoco's own exit rights are inconsistent across its two contracts: 14 days' notice under the Merchant Agreement, vs. "can terminate or suspend... whenever necessary, we don't have to tell you first" under the newer Payment Services T&Cs. The cell's explain text doesn't carry that asymmetry. |
| exit | ozow | SOURCED | ozow-writeup §6 (cl. 4.3.1) | y | y |
| exit | paystack | SOURCED | paystack-writeup §6 (MSA A.8.1) | y | y |
| exit | payfast | SOURCED | payfast-writeup §6 (cl. 21.1) | y | y |
| dormant | yoco | WEAK | yoco-writeup §7 | y | n — see "most serious WEAK cells" below |
| dormant | peach | SOURCED | peach-writeup §7 | y | y |
| dormant | paystack | SOURCED | paystack-writeup §7 | y | y |
| dormant | ozow | SOURCED | ozow-writeup §7 (cl. 4.5.1) | y | y |
| dormant | payfast | SOURCED | payfast-writeup §7 (cl. 21.2(i)/(iii)) | y | y |
| types | payfast | SOURCED | payfast-writeup §4 | y | y |
| types | peach | SOURCED | peach-writeup §4 | y | y |
| types | yoco | SOURCED | yoco-writeup §4 | y | y |
| types | paystack | WEAK | paystack-writeup §4 | y | n — writeup's own verdict is "VERIFIED/PARTIAL" (subscriptions annual-interval and card-machine hardware both explicitly "NOT ESTABLISHED"); CRIT collapses this to a flat "v". |
| types | ozow | SOURCED | ozow-writeup §4 | y | y |
| refunds | yoco | WEAK | yoco-writeup §5 + yoco-teardown.md:399-403 | y | n — see "most serious WEAK cells" below |
| refunds | payfast | SOURCED | payfast-writeup §5 (cl. 11.7) | y | y |
| refunds | paystack | SOURCED | paystack-writeup §5 (status already "p", correctly) | y | y |
| refunds | peach | SOURCED | peach-writeup §5 (cl. 6.4.9, R3 fee) | y | y |
| refunds | ozow | SOURCED | ozow-writeup §5 (cl. 7.3.1) | y | y |
| npo | payfast | SOURCED | payfast-writeup §13 (status already "p") | y | y |
| npo | yoco | SOURCED | yoco-writeup §13 / npo-pricing.md | y | y |
| npo | peach | SOURCED | peach-writeup §13 / npo-pricing.md | y | y (borderline — verdict is itself mixed VERIFIED+NOT ESTABLISHED, but both halves of the CRIT claim are individually true) |
| npo | paystack | SOURCED | paystack-writeup §13 (404 checks) | y | y |
| npo | ozow | SOURCED | ozow-writeup §13 / npo-pricing.md (double-checked) | y | y |
| data | yoco | SOURCED | yoco-writeup §12 | y | y |
| data | peach | SOURCED | peach-writeup §12 (Annexure C) | y | y |
| data | payfast | SOURCED | payfast-writeup §12 (cl. 16.4) | y | y |
| data | paystack | SOURCED | paystack-writeup §12 (MSA Section E) | y | y |
| data | ozow | SOURCED | ozow-writeup §12 (cl. 20.8.1, full quote) | y | y |
| sla | peach | SOURCED | peach-writeup §11 (Annexure B) | y | y |
| sla | ozow | SOURCED | ozow-writeup §11 (Schedule 4) | y | y |
| sla | yoco | SOURCED | yoco-writeup §11 | y | y |
| sla | payfast | SOURCED | payfast-writeup §11 (zero hits, full-text search) | y | y |
| sla | paystack | SOURCED | paystack-writeup §11 (MSA A.16) | y | y |
| build | payfast | SOURCED | integration-effort.md §2 | y | y |
| build | yoco | SOURCED | integration-effort.md §3 | y | y |
| build | paystack | SOURCED | integration-effort.md §5 | y | y |
| build | peach | SOURCED | integration-effort.md §4 (bot-walled page correctly downgrades to "p") | y | y |
| build | ozow | SOURCED | integration-effort.md §1 (HTTP 500, confirmed twice) | y | y |
| sec | peach | SOURCED | security-certifications.md §4 (Mastercard SDP list quote) | y | y |
| sec | payfast | SOURCED | security-certifications.md §2 | y | y |
| sec | ozow | SOURCED | security-certifications.md §1 | y | y (see date-format footnote below) |
| sec | paystack | SOURCED | security-certifications.md §5 (status already "p" for entity mismatch) | y | y |
| sec | yoco | SOURCED | security-certifications.md §3 (absence from Mastercard list, confirmed) | y | y |
| money | peach | SOURCED | peach-writeup §8 (cl. 6.4.5, 6.4.8) | y | y |
| money | ozow | SOURCED | ozow-writeup §8–9 | y | y |
| money | paystack | SOURCED | paystack-writeup §8 (MSA D.3) | y | y |
| money | yoco | SOURCED | yoco-writeup §8 (genuine contractual gap, confirmed) | y | y |
| money | payfast | **UNSOURCED** | payfast-writeup §8, payfast-teardown.md:117-322 | y (exists, but cell ignores it) | **n** |

Counts: **59 SOURCED / 5 WEAK / 1 UNSOURCED** out of 65.

---

## The UNSOURCED cell — critical

**`money` × PayFast** currently reads: `[5,"Not established from the contracts","n"]`.

This is wrong, not merely thin. `payfast-writeup.md` §8 and `payfast-teardown.md` (section "MONEY
YOU CANNOT GET AT") both establish, with clause numbers and verbatim quotes, that PayFast's
contract states a fully quantified hold regime: a 12-trigger discretionary hold/lien (cl. 9.6), a
**540-day ceiling** on how long funds can be withheld (cl. 9.8, quoted verbatim), no interest on
held funds (cl. 9.3), and a separate 6-month dormancy suspension trigger (cl. 21.2(i)) — this is
also the exact fact the team lead's own audit brief names as one of the "4 facts only vendors can
answer" from project memory, except it is *not* an open question — it is answered, in this
project's own files, with a clause citation. What genuinely isn't stated in the contract is the
**settlement frequency** (T+1/T+2 — cl. 9.1 defers that to "the Application"); that part of "not
established" is fair. But the cell's own factor definition is "how fast we get paid, **and holds
on our money**" — and every sibling cell in this row (Peach, Ozow, Paystack) does report the hold
terms it found. PayFast's is the most severe hold of the five (540 days, vs. Paystack's ~6 months
post-termination and Peach's uncapped-but-undiscussed discretionary hold) and the row currently
scores it a neutral 5/"n" — the same as Yoco, which really has nothing on file. **Fix: rewrite the
cell to state the 540-day ceiling (cl. 9.8) and 12-trigger hold (cl. 9.6), score it near the bottom
of the row, and reserve "not established" for the settlement-frequency sub-question only.**

## Most serious WEAK cells

1. **`dormant` × Yoco** `[10,"Profile simply remains inactive; no fee","v"]` — scored the single
   best cell in the entire row, on a "v" label. But `yoco-writeup.md` §7 says this in its own
   words: dormancy is "**Not addressed in either PDF — silent**"; the "no fee, stays inactive"
   claim traces only to a Help Centre article, and the writeup itself grades the overall picture
   **PARTIAL**, not verified. Compare Peach and Paystack: both are *also* contractually silent on
   dormancy, and both were correctly scored mid (6/"v") with an explicit note that "silence is not
   a promise" — the same methodology stated inline in the `data` factor's `explain` text. Yoco's
   cell breaks that same rule for no stated reason: identical silence, but scored 10 instead of 6,
   on a status label the source document itself won't claim. Fix: drop to mid-range like Peach/
   Paystack, or re-label "p" and cite the Help Centre article by name as the actual (non-contract)
   source.

2. **`money` × PayFast** — see above. The most consequential single error in the five providers,
   because it hides the sharpest downside term in the whole comparison behind a "not established."

3. **`refunds` × Yoco** `[8,"90-day window; partial refunds explicit","v"]` — the 90-day figure is
   genuinely contractual (Merchant Agreement cl. 8.2.2, quoted). "Partial refunds explicit" is not:
   `yoco-writeup.md` §5 states plainly that partial refunds are "not addressed as a distinct
   mechanism in either PDF," and that the nullable-`amount`-field evidence comes from
   `yoco-teardown.md` — a developer-docs source, not the merchant contract. Both facts are bundled
   under one "v", which overstates how much of this cell is contract-verified. Fix: split the
   claim, or footnote that "partial" is sourced from API docs, not the agreement.

Runner-up WEAK cells (lower stakes, listed for completeness): `types` × Paystack (subscriptions/
hardware sub-claims are "NOT ESTABLISHED" per the writeup's own verdict table, collapsed into one
"v"); `exit` × Yoco (omits that the newer Payment Services T&Cs lets Yoco terminate/suspend "when-
ever necessary... we don't have to tell you first," which sits oddly next to a favourable exit
score); `rail` × Peach (labelled "Capitec Pay," should be "PayByBank" — the R1.50 is a universal
per-transaction fee, not a Capitec surcharge).

## Minor footnote, not scored as WEAK

`sec` × Ozow: `security-certifications.md` quotes the Mastercard register row as `"10/04/2024"` but
its own prose calls it "10 October 2024" two lines later — an internal date-format inconsistency
in the source document (DD/MM vs MM/DD unresolved). The CRIT cell reproduces the raw string
faithfully, so this isn't a CRIT-provenance fault, but the underlying evidence file should resolve
which reading is correct before anyone treats the date as load-bearing.

## What was NOT found suspect

The two specific red flags named in the brief did not reproduce for these five providers:
- No cell for these five carries a "v" alongside a note saying "bot-walled," "could not be
  retrieved," or "500 error." The one place that risk existed (Peach `build`, Ozow `build`) is
  already correctly downgraded to "p"/appropriately-worded "v" with the failure stated in the note.
- The PayFast R500 card-fee dispute is resolved: `docs/research-evidence/exclusions-audit.md:102`
  carries an uncited "~R14.68 (per existing docs)" figure with no source given anywhere in that
  file. Every other document — `payfast-writeup.md` §1, `npo-pricing.md` — traces R18.00 to
  PayFast's own `payfast.io/fees/` worked example, quoted verbatim ("You only pay: R18.00 (ex
  VAT)"). CRIT correctly uses R18.00. The R14.68 figure appears to be a stale artefact from an
  earlier pass and isn't used anywhere in the scored comparison.
