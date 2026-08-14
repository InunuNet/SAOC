# Scoring audit — adversarial review of gateway-comparison.html

Reviewed the `CRIT`/`FW`/`ST`/`IK`/`ZA`/`PG` data against the write-ups in this directory.
The Yoco-data fix (silence → 6/PARTIAL, Zapper 6.5, Peach 8) is confirmed in the file and is sound.
This audit hunts for the same defect class elsewhere plus the other eight checks requested.

## 1. Dormancy factor: the silence-as-virtue fix was applied to `data` but not to `dormant` (MATERIAL, unfixed)

The `dormant` factor still scores confirmed silence at a flat **7** for four providers, un-differentiated
by how thoroughly that silence was confirmed — exactly the pattern the `data` factor was corrected for.

| Provider | Current | Write-up support | Should be | Reason |
|---|---|---|---|---|
| peach | 7, v, "silent — absent from all 35 pages" | full-document search, no clause | ~6 | Same shape as data's Peach-is-not-this-one; this is silence, not a stated safeguard. Corrected `data` convention puts thoroughly-confirmed silence at 6–6.5, not 7. |
| paystack | 7, v, "silent — no clause either way" | contract silent | ~6 | Same. |
| flutterwave | 7, v, "silent — no clause found" | added late, least scrutiny of the three "silent" cells | ~5.5 | Should score *below* Peach/Paystack's more thoroughly-confirmed silence, not the same — currently identical at 7 despite the cell's own text admitting it's a shallower check than Peach's/Paystack's. |
| zapper | 7, v, "confirmed by a full read of all 21 clauses" | thorough confirmed silence | ~6.5 | This is the strongest-verified silence of the four (parallel to Zapper's own 6.5 on `data` for the identical reasoning) — it is inconsistent that Zapper's `data` cell got the differentiated 6.5 treatment but its `dormant` cell did not.

Net effect: lowers Peach, Paystack, Flutterwave, Zapper each by roughly 0.5–1.5 points on one of 13
equally-weighted factors — too small to move the leader (Peach's lead is carried by `gap`/`exit`/`sla`/`sec`,
not `dormant`), but it is the same defect class the reviewer was told to hunt for, still live, and it's an
internal-consistency failure: the page corrected this exact logic on one factor and left it uncorrected on
the adjacent one that deals with the same underlying question (inactivity risk).

## 2. Status-label integrity — one soft miss, otherwise clean

`build`, Yoco: scored 8/**v** but its own detail text says "Sandbox appears self-serve but wasn't
independently confirmed." An unconfirmed claim inside a "Verified" cell. Should be **p**, not **v**.
Score of 8 is still roughly defensible (HMAC scheme + Node sample *are* independently verified), but the
status letter overstates certainty. Low materiality — cosmetic, doesn't change the number meaningfully.

Checked every other `v`-labelled cell that carries a caveat in its detail text (Paystack `sec` 6.5/p,
Flutterwave `gap` 4.5/p, Peach `build` 5/p, iKhokha `data` 5/p) — all of those are already correctly
downgraded to **p**. No reverse failures found (no `n` cell where the write-up actually establishes the fact).

## 3. Score-vs-evidence / monotonic cost ordering — sound

Recomputed the `cost` ordering against the rand figures in each cell: Ozow R14.25(10) > Zapper
R14.50(9.7) > Stitch R14.75(9.4) > PayGenius R15.00-floor(7) > Paystack/Flutterwave R15.50(8.3) > Peach
R16.25(7.3) > Yoco R16.75(6.7) > PayFast R18.00(5). Ordering is monotonic in price except PayGenius, whose
lower score despite a lower headline figure is correctly explained by "at best... a floor, not a rate" — a
confirmed-cheaper provider does not outscore a cheaper-if-it-holds one. No cheaper-scores-lower defect found.

Minor (low materiality): three providers charge an identical **R10.00 / 2%** EFT rail — PayFast (8),
Paystack (8.5), Stitch (8.5) — with no stated reason for the 0.5-point gap against PayFast. Cosmetic scale
noise, not a ranking risk (rail carries the same weight as every other factor and 0.5 pts moves nothing).

## 4. Unknowns at the midpoint — consistently applied

Every `n`-status cell across CRIT/FW/ST/IK/ZA/PG is scored exactly 5, with no exceptions. Verified this
provider-by-provider for iKhokha (6 unknowns), PayGenius (6 unknowns), Zapper (5 unknowns), Yoco/PayFast
`money`. Convention holds.

## 5. Asymmetric criteria — the named past failure does not recur elsewhere

Went factor-by-factor looking for a clause applied to one provider but not to peers who carry the identical
exposure (the Yoco-empty-balance case). Found none. `dormant`'s treatment (issue #1 above) is an
*inconsistency between factors*, not an asymmetry within one factor — every provider with a "silent" fact
pattern on `dormant` gets the same 7, which is the opposite problem (uniform, just uniformly too generous).

## 6. Double-counting — one defensible borderline case, no clear violation

PayFast is penalised on both `dormant` (1) and `exit` (1) for what could look like the same underlying
"bad T&Cs" fact. Checked against the write-up: these are two distinct clauses — clause 3.4 (Minimum Volume
Fee / 6-month suspend / 12-month auto-terminate, scored under `dormant`) versus the 36-month auto-renewing
term and undisclosed termination fee (scored under `exit`). Different contractual mechanisms, both real and
both bad — not the same fact counted twice. No action needed.

## 7. Scale abuse — no unjustified 1s or 10s found

Every 10 traces to a genuinely best-possible fact (Ozow's zero-fixed-fee card rate, Peach's contract-bound
pricing/exit terms, Yoco's real "nothing happens" dormancy, Flutterwave's official SDK). Every 1 traces to a
genuinely bad fact stated in the contract (Ozow's marketing-consent clause, PayFast's undisclosed fee +
3-year lock-in, Paystack's disclaimed uptime). None are being used merely as "worst of this set" padding.

## 8. Thin-documentation bias — checked in both directions, none found

Computed the mean score-per-factor across the seven fully-documented providers: **5.82/10**. iKhokha
(4.81×10=48.1), Zapper (5.71×10=57.1) and PayGenius (4.54×10=45.4) land on both sides of that line under
equal weights — Zapper close to the documented-provider average, iKhokha and PayGenius meaningfully below
it. The "unknown = 5" convention is not systematically inflating or punishing the thin three relative to the
seven with full contracts. This dimension is sound.

## 9. Explain-vs-cell contradictions — one already-fixed pair, no new ones found

`data`'s explain text ("silence scores in the middle, not at the top... only an explicit safeguard earns a
high score") is now honoured by its own cells (Yoco 6, Zapper 6.5, Peach 8, per the prior fix). `dormant`'s
explain text says almost the same thing ("silence protects you less than an explicit clause") but, per #1,
its own cells still violate it at 7. This is the same contradiction the reviewer already fixed once, now
found on the sibling factor.

---

## Ranked findings for the reply

1. **`dormant`, peach/paystack/flutterwave/zapper, 7/v → ~6, 6, 5.5, 6.5** — the exact defect class already
   fixed on `data` survives unfixed on `dormant`; explain text and cells contradict each other. Does **not**
   change the leader (Peach's ~76→~75 stays first by a wide margin).
2. **`build`, yoco, 8/v → 8/p** — status-label overclaim on an admittedly-unconfirmed detail. Cosmetic.
3. **`rail`, payfast, 8 vs paystack/stitch 8.5 at an identical R10/2%** — unexplained 0.5-pt scale noise.
   Cosmetic.
4. Checks 3–9 (monotonicity, midpoint convention, asymmetry, double-counting, scale abuse, thin-doc bias,
   remaining explain/cell pairs) are **sound** — no further defects found.

No correction changes which provider leads under equal weights: Peach remains first by roughly 17 points
over second place, and none of the findings above touch the factors (`gap`, `exit`, `sla`, `sec`) that
carry Peach's lead.
