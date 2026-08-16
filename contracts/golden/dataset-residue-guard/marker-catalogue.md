# Marker catalogue — derived from reading every check under `contracts/checks/`
# that can mutate the live Sanity dataset (2026-08-16 survey)

This is the authoritative list `scripts/scan-dataset-residue.ts` must encode. Do not
invent new patterns and do not drop any of these — each is traced to the exact file
and line where a check writes it into the live dataset.

## Correction to the original 16-file grep

The initial survey (`grep -rl "setFieldsAndPublish\|createOrReplace\|\.patch(\|\.commit("
contracts/checks/`) undercounted. Three more files mutate the dataset through wrapper
helpers the literal-string grep does not match (`commitAndCaptureRev(...)`, a shared
`mutate()` helper), and one shared helper file exports a sentinel-generator used by a
mutating check but has no mutation call itself:

- `contracts/checks/show-visitor-info/check-cms-round-trip.mjs` — mutates via
  `_mutation-guard.mjs`'s wrapped client, not a literal `.patch(`
- `contracts/checks/show-exhibitor-info/check-cms-round-trip.mjs` — mutates via
  `commitAndCaptureRev()` (line 187)
- `contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs` — mutates
  `aboutPage.boardIntroText` directly

Lesson for the scanner spec: never trust a fixed enumeration of "which files mutate" to
bound the marker list. The scanner's pattern list is deliberately broad (see the two
catch-all patterns at the bottom) precisely so a *new* check adopting a slightly
different sentinel shape is still caught without a spec update.

## Sanity-dataset markers (in scope for this scanner)

| # | Pattern name | Regex | Source (file:line) | Example |
|---|---|---|---|---|
| 1 | SVI-SENTINEL | `/SVI-[A-Z0-9-]*SENTINEL-\d+/` | `contracts/checks/show-visitor-info/_mutation-guard.mjs:44-50` (`SENTINEL_PREFIX`, `SENTINEL_PATTERN`, `makeSentinel()`) | `SVI-PARKING-SENTINEL-1786481132420` (the actual incident residue string named in that file's header comment, line 8) |
| 2 | EXH-SENTINEL | `/EXH-[A-Z0-9-]*SENTINEL-\d+/` | `contracts/checks/show-exhibitor-info/_mutation-guard.mjs:68-73` | `EXH-DEADLINE-SENTINEL-1786482650802` |
| 3 | NOT-A-REAL-STATUS | `/not-a-real-status-\d+/i` | `contracts/checks/show-exhibitor-info/_mutation-guard.mjs:68` (same `SENTINEL_PATTERN` alternation) | `not-a-real-status-42` |
| 4 | F3-SENTINEL | `/F3-[A-Z]+-SENTINEL-\d+/` | `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs:71-79` (`nonce`, `sentinels.title`, `sentinels.location`) and `check-exhibitor-stages-round-trip.mjs:89-90` (`STAGES_SENTINEL_TEXT`) | `F3-TITLE-SENTINEL-1786560879358` — this is the exact string from the 2026-08-15 incident |
| 5 | FAR-FUTURE-YEAR (countdown) | `/20(9[0-9])-\d{2}-\d{2}/` (tightened 2026-08-16 — see amendment note below) | `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs:79` (`SENTINEL_DATETIME_INPUT = '2099-01-01 00:00'`) | `2098-12-31T22:00:00.000Z` — the incident's countdown value; also matches `2099-01-01 00:00` (space-separated, still `-MM-DD`) |
| 6 | ZZCHECK-SENTINEL | `/ZZCHECK-[A-Z0-9]+-[A-Z0-9]+/` | `contracts/checks/cms-wiring-cleanup/_shared.mjs:198-199` (`sentinel(tag)`) | `ZZCHECK-ARCHIVEYEAR-LZ3K9F1` (base-36 uppercase timestamp, NOT a decimal run — a pure `\d+` pattern misses this one) |
| 7 | F6-LOOP-PROOF | `/F6-LOOP-PROOF-\d+-[a-f0-9]+/` | `contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs:66` | `F6-LOOP-PROOF-1786560879358-a3f912` |
| 8 | generic SENTINEL substring (catch-all) | `/SENTINEL/` | every file above — deliberately redundant with #1-#4 so a future check that mangles its own prefix format is still caught | any string containing the literal word |
| 9 | embedded 13-digit epoch-ms nonce (catch-all, heuristic) | `/(?<!\d)\d{13}(?!\d)/` | general shape of `Date.now()` used as a nonce/suffix across every mutating check (e.g. `_mutation-guard.mjs:50`, `check-headline-round-trip.mjs:71`, `_shared.mjs:198`) | `1786560879358` appearing inside an otherwise human-readable string |

## False-positive risk (updated 2026-08-16 — see amendment below)

The claim that pattern #9 was "the only heuristic entry with meaningful
false-positive risk" is now stale. A9 (2026-08-16) made `walk()` coerce numeric
leaves through every pattern, not just string leaves — that changed the risk
profile for the whole catalogue, not just #9:

- **Pattern #5 FAR-FUTURE-YEAR** was the unanchored bare-run `/20(9[0-9])/` and, once
  numeric leaves were coerced, false-positived on ordinary numeric fields whose value
  happened to fall in 2090-2099 — confirmed by QA with a real `ticketType.price: 2099`
  (see `contracts/golden/dataset-residue-guard/fixture-far-future-year-numeric-fp.json`).
  Tightened (2026-08-16 amendment, contract F3(b)) to `/20(9[0-9])-\d{2}-\d{2}/` —
  require ISO/date-like context (a 209x year immediately followed by `-MM-DD`) instead
  of a bare four-digit run. Still catches the real incident value
  (`2098-12-31T22:00:00.000Z`) and the other cataloged 209x value
  (`SENTINEL_DATETIME_INPUT = '2099-01-01 00:00'`).
- **Pattern #9 EPOCH-MS-NONCE** (`/(?<!\d)\d{13}(?!\d)/`) remains the highest-risk
  heuristic — QA additionally confirmed two coercion-driven false-positive shapes once
  numeric leaves are stringified: a JS number written in exponential form, e.g.
  `1.78e12`, stringifies via `String(value)` to `"1780000000000"` (13 digits) and trips
  the catch-all; a **negative** 13-digit value (e.g. `-1786560879358`) stringifies to
  `"-1786560879358"`, and the lookbehind/lookahead `(?<!\d)...(?!\d)` do not exclude the
  leading `-`, so the trailing 13 digits still match. Both remain accepted, documented
  risk (treat a #9-only hit as "flag for human review", not automatic incident) rather
  than newly-introduced defects — no contract change requested for #9 in this
  amendment. Hits on #1-#8 (post-tightening) remain unambiguous and should be treated
  as confirmed residue.

## Explicitly out of scope for this scanner

- `contracts/checks/ticketing-hardening/_shared.mjs` — `SENTINEL_EMAIL_DOMAIN =
  'harden-check.invalid'` and `ticketType` docs with `_id match "harden2-check-*"`
  (line 180). These mutate **Firestore**, not the Sanity dataset. A Firestore
  equivalent of this scanner is a legitimate follow-up but is not this contract.
