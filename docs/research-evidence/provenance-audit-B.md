# Provenance Audit B — Flutterwave, Stitch, iKhokha, Zapper, PayGenius

Every scored cell in `docs/gateway-comparison.html` for FW/ST/IK/ZA/PG checked against its
matching write-up (`flutterwave-writeup.md`, `stitch-writeup.md`, `ikhokha-writeup.md`,
`zapper-writeup.md`, `paygenius-writeup.md`). 65 cells (13 factors × 5 providers).

Classification: **SOURCED** (primary doc, quote/clause, label matches evidence) ·
**WEAK** (traceable but thin, or the status label doesn't match what backs it — in either
direction) · **UNSOURCED** (cannot be traced to any retrieved document).

## 65-row table

| Factor | Provider | Class | Source doc | Quote/clause? | Status correct? |
|---|---|---|---|---|---|
| cost | Flutterwave | SOURCED | flutterwave-writeup §1 | Y (pricing page) | Y |
| rail | Flutterwave | SOURCED | flutterwave-writeup §1/§4 | Y | Y |
| gap | Flutterwave | SOURCED | flutterwave-writeup §2 | Y (Cl.9) | Y |
| exit | Flutterwave | SOURCED | flutterwave-writeup §6 | Y (Cl.4, 16) | Y |
| dormant | Flutterwave | SOURCED | flutterwave-writeup §7 | N (confirmed silence) | Y |
| types | Flutterwave | SOURCED | flutterwave-writeup §4 | Y (pricing/FAQ) | Y |
| refunds | Flutterwave | SOURCED | flutterwave-writeup §5 | Y (Cl.7, partial) | Y |
| npo | Flutterwave | SOURCED | flutterwave-writeup §13 | Y (pre-approval quote) | Y |
| data | Flutterwave | SOURCED | flutterwave-writeup §12 | Y (/za/terms quote) | Y |
| sla | Flutterwave | SOURCED | flutterwave-writeup §11 | Y ("BEST EFFORTS") | Y |
| build | Flutterwave | SOURCED | flutterwave-writeup (integration) | Y (SDK/docs named) | Y |
| sec | Flutterwave | SOURCED | flutterwave-writeup (threshold) | Y (PASA row 37) | Y |
| money | Flutterwave | SOURCED | flutterwave-writeup §8 | Y (Cl.6.1/13, verbatim) | Y |
| cost | Stitch | SOURCED | stitch-writeup #1 | Y (pricing page) | Y |
| rail | Stitch | SOURCED | stitch-writeup #1 | Y | Y |
| gap | Stitch | SOURCED | stitch-writeup #2 | Y (quoted clause) | Y |
| exit | Stitch | SOURCED | stitch-writeup #6 | Y | Y |
| dormant | Stitch | SOURCED | stitch-writeup (d)/#7 | Y (verbatim) | Y |
| types | Stitch | SOURCED | stitch-writeup #4 | Y | Y |
| refunds | Stitch | SOURCED | stitch-writeup #5 | Y | Y |
| npo | Stitch | SOURCED | stitch-writeup #13/(c) | N (confirmed absence) | Y |
| data | Stitch | SOURCED* | stitch-writeup #12 | Y (cross-border clause) | Y — see note |
| sla | Stitch | SOURCED | stitch-writeup #11 | Y (disclaimer quoted) | Y |
| build | Stitch | SOURCED | stitch-writeup (integration) | Y (SDK/Svix named) | Y |
| sec | Stitch | SOURCED | stitch-writeup (b) | Y (PASA TPPP+SO entries) | Y |
| money | Stitch | SOURCED | stitch-writeup #8 | Y (retention clause) | Y |
| cost | iKhokha | WEAK-consistent | ikhokha-writeup §1 | partial ("from") | Y (p, correctly hedged) |
| rail | iKhokha | SOURCED (negative) | ikhokha-writeup §1 | N | Y (n) |
| gap | iKhokha | SOURCED | ikhokha-writeup §2 | Y (Cl.6.2, blank Sched.) | Y |
| exit | iKhokha | **MISMATCH** | ikhokha-writeup §6 | Y (Cl.27, quoted) | **N — see below** |
| dormant | iKhokha | SOURCED (negative) | ikhokha-writeup §7 | N | Y |
| types | iKhokha | SOURCED | ikhokha-writeup §4 | Y (Wix page) | Y |
| refunds | iKhokha | **MISMATCH** | ikhokha-writeup §5 | Y (WooCommerce + Cl.14) | **N — see below** |
| npo | iKhokha | SOURCED (negative) | ikhokha-writeup §13 | N (confirmed absence) | Y |
| data | iKhokha | SOURCED | ikhokha-writeup §12 | Y (Cl.21, partial) | Y |
| sla | iKhokha | SOURCED (negative) | ikhokha-writeup §11 | N | Y |
| build | iKhokha | SOURCED | ikhokha-writeup §16 | Y (partial, honest) | Y |
| sec | iKhokha | SOURCED (negative) | ikhokha-writeup (no PASA check) | N | Y |
| money | iKhokha | SOURCED | ikhokha-writeup §8 | Y (Cl.6.1) | Y |
| cost | Zapper | **WEAK-overstated** | zapper-writeup §1 | partial (3rd-party) | **N — see below** |
| rail | Zapper | SOURCED (negative) | zapper-writeup §1 | N | Y |
| gap | Zapper | SOURCED | zapper-writeup §2 | Y (Cl.4.3, verbatim) | Y |
| exit | Zapper | **MISMATCH** | zapper-writeup §6 | Y (Cl.16.1, 2.4, 5.2) | **N — see below** |
| dormant | Zapper | SOURCED | zapper-writeup §7 | N (confirmed silence) | Y |
| types | Zapper | SOURCED | zapper-writeup §4 | Y | Y |
| refunds | Zapper | **MISMATCH** | zapper-writeup §5 | Y (Cl.9, 9.4) | **N — see below** |
| npo | Zapper | SOURCED | zapper-writeup §13 | Y ("Custom Plan" quote) | Y |
| data | Zapper | SOURCED | zapper-writeup §12 | N (confirmed by full read) | Y |
| sla | Zapper | **MISMATCH** | zapper-writeup §11 | Y (Cl.20.2, verbatim) | **N — see below** |
| build | Zapper | SOURCED | zapper-writeup §16 | Y (partial, honest) | Y |
| sec | Zapper | SOURCED (negative) | zapper-writeup (no PASA check done) | N | Y |
| money | Zapper | SOURCED | zapper-writeup §8 | Y (pricing page + Cl.4.13-14) | Y |
| cost | PayGenius | SOURCED | paygenius-writeup §1 | Y (fees table + floor language) | Y |
| rail | PayGenius | SOURCED | paygenius-writeup §1 | Y | Y |
| gap | PayGenius | SOURCED | paygenius-writeup §2 | Y (Cl.4.2, verbatim) | Y |
| exit | PayGenius | SOURCED (negative) | paygenius-writeup §6 | N (General Terms missing) | Y |
| dormant | PayGenius | SOURCED (negative) | paygenius-writeup §7 | N | Y |
| types | PayGenius | SOURCED | paygenius-writeup §4 | Y (partial) | Y |
| refunds | PayGenius | SOURCED | paygenius-writeup §5 | Y (Cl.4.1.5, verbatim) | Y |
| npo | PayGenius | SOURCED (negative) | paygenius-writeup §13 | N (confirmed absence) | Y |
| data | PayGenius | SOURCED (negative) | paygenius-writeup §12 | N (General Terms missing) | Y |
| sla | PayGenius | **MISMATCH** | paygenius-writeup §11 | Y (Cl.10.1, verbatim) | **N — see below** |
| build | PayGenius | SOURCED (negative) | paygenius-writeup §16 | N | Y |
| sec | PayGenius | SOURCED (negative) | paygenius-writeup (no PASA check) | N | Y |
| money | PayGenius | SOURCED | paygenius-writeup §8 | Y (Cl.3.4.1, 3.4.3) | Y |

## Counts

- SOURCED (incl. correctly-labeled negatives): **58 / 65**
- WEAK: **7 / 65**
- UNSOURCED: **0 / 65**

No cell in this set of five rests on nothing at all — every cell traces to a specific writeup
section. The defects found are not fabrication; they are **label/evidence mismatches**, six of
which understate what was actually retrieved, and one which overstates it.

## The 7 WEAK cells, in detail

### 1. Zapper `cost` — overstated (the one specifically flagged in the brief)
HTML: `9.7, v`. Zapper's own writeup §1 states: *"zapper.com/pricing (Alembic flagged this page
LOW confidence; corroborated independently by smesouthafrica.co.za)"*. The page's own status
legend defines `v` as "taken from the provider's own contract or pricing page and quoted in the
research files" — a low-confidence primary fetch backstopped by a third-party site does not meet
that bar. **Fix: downgrade to `p`.** This is the most serious WEAK finding for this batch — it is
the exact suspect the brief named, and the writeup's own honesty ("Alembic flagged LOW
confidence") was not carried through to the scored cell.

### 2. Zapper `sla` — understated
HTML: `5, "Not established", n`. Zapper's writeup §11 is headed **"VERIFIED (limited)"** and
quotes Clause 20.2 verbatim: *"Zapper will use reasonable endeavours to respond to the Merchant
within 2 business days"* of an outage notification. This is a real, quoted, clause-numbered
response-time commitment — thin, but not nothing. SLA is a factor the brief cares about
specifically (spec deadline pressure). **Fix: score ~2–3, status `p`/`v`, with the 2-business-day
response commitment in the detail text** — currently a real fact is being scored as unknown.

### 3. PayGenius `sla` — understated
HTML: `5, "Not established", n`. Writeup §11 is headed **"VERIFIED (qualitative only, no %
uptime)"** and quotes Clause 10.1 verbatim: *"we shall use reasonable care and diligence to
ensure that the Service is available on a 24 hour per day basis... [but] we make no
representations or warranties regarding the time it will take."* A weak, hedged, non-binding
promise — but a quoted, clause-numbered one. **Fix: score ~2, status `v`, noting the 24-hour
"reasonable care" language and its explicit non-warranty.**

### 4. iKhokha `exit`
HTML: `5, "Not established", n`. Writeup §6 is headed **"VERIFIED (2021 template only)"** and
quotes Clause 27 verbatim: indefinite term, either party exits on 30 days' written notice, no
auto-renewal or penalty found. **Fix: score ~7 (comparable to Stitch/Zapper's clean exit terms),
status `p`** — `p` rather than `v` because the source is the stale 2021 template, which is a real
caveat worth carrying, but "not established" is wrong; the clause was read and quoted.

### 5. Zapper `exit`
HTML: `5, "Not established", n`. Writeup §6 is headed **"VERIFIED"** and quotes Clause 16.1 (30
days' notice either way), Clause 2.4 (7-day penalty-free cooling-off), Clause 5.2 (termination
right on a fee change). **Fix: score ~7–8, status `v`** — this is one of the more merchant-
friendly exit terms found in the whole exercise and is currently invisible in the table.

### 6. iKhokha `refunds`
HTML: `5, "Not established; a per-chargeback fee exists", n`. Writeup §5 documents a real,
sourced refund mechanism (WooCommerce dashboard, full/partial, "no extra fees," 48-hour payout)
**and** flags a genuine contradiction against the 2021 agreement's Clause 14 ("You may not give
refunds via Electronic Funds Transfer"). That contradiction is itself a finding worth surfacing —
currently it is buried under `n`/"not established." **Fix: score ~4, status `p`, detail should
state the WooCommerce-vs-Clause-14 conflict explicitly** (this is the same kind of
advertised-vs-contracted gap the page already surfaces for PayGenius's refund-fee row).

### 7. Zapper `refunds`
HTML: `5, "Not established", n`. Writeup §5 quotes Clause 9 (merchant processes refunds; Zapper
"may, but will not be obliged") and Clause 9.4 verbatim ("The Merchant will not be entitled to
any refund on the Transaction Fee"). **Fix: score ~4, status `v`** — comparable in shape to
Ozow's `refunds` row (funding-gated, fee not returned), which is scored 4/`v` on the page already.

## Notes on cells checked against the brief's specific suspects

- **iKhokha cost (9.5 in CRIT / matches 9.5 baseline structure)**: hedged correctly as `p`,
  "from 2.85%" explicitly flagged as a floor, contract fee schedule explicitly noted as blank.
  No overstatement found.
- **Zapper cost (9.7)**: overstated — see WEAK #1 above. This is the real finding.
- **PayGenius cost (7)**: confirmed established as a floor from PayGenius's own fees page
  (`info.paygenius.co.za/fees`), quoted table plus explicit "Fees can vary" language. Correctly
  `p`, not `v`. Sound.
- **Flutterwave `money` (10%/180-day reserve)**: has both a clause number (6.1 and 13) and a
  verbatim quote ("Maintain a 10% rolling reserve from daily settlement due to the Merchant for a
  period of 180 days"). This is the best-sourced cell in the whole batch — no issue.
- **Flutterwave `sec`**: PASA register itself was fetched (row 37, entity name, registration
  number, sponsoring bank all quoted). No issue.
- Cells labelled `v` whose note says "not confirmed"/"could not be located": none found in this
  batch of five — the two known contradictions referenced in the brief were elsewhere.
- `build` row: not re-litigated per instructions: all five rest on the same writeups already
  audited above (SDK existence, sandbox self-serve or not, webhook doc presence), all correctly
  labelled `n`/`p` where evidence is thin (iKhokha, Zapper, PayGenius) and `v` where a first-party
  SDK and doc page were directly confirmed (Flutterwave, Stitch).

## Is this batch of five materially less well-evidenced than the original five?

**Yes, for iKhokha, Zapper and PayGenius — no, for Flutterwave and Stitch.** Flutterwave and
Stitch are as well-sourced as anything reviewed elsewhere on the page: primary contracts read in
full, clauses quoted, PASA register independently checked. iKhokha, Zapper and PayGenius carry
materially more `n`/negative-but-honest cells (iKhokha 5/13, Zapper 4/13, PayGenius 6/13 factors
scored `n`) than Flutterwave/Stitch (0/13 each) — consistent with the page's own admission that
they were "researched in a single pass late in the process" on thinner paperwork. The one
overstatement found (Zapper `cost`) sits in exactly this thinner tier, which is the pattern to
watch: rushed research is where a `v` slips past its evidence.
