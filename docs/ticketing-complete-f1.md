# F1: Ticket Taxonomy + Computed Early-Bird Pricing Engine

**Mission:** ticketing-complete (M1, milestone 1). Two pure, side-effect-free modules replacing the concept of separately-priced early-bird products with one computed discount any product can carry: a fine-grained ticket-category taxonomy (7 categories) and a pricing engine that evaluates 20% off for purchases 90+ days before the show's confirmed 2027-09-16 start (cutoff 2027-06-18), as a deterministic function of `(basePrice, purchaseDate, showStartDate)`.

**Contract:** `.agent/memory/project/specs/ticketing-complete/contract-f1.yaml` — 12 assertions, phase 4.

**Status:** Green. 12/12 assertions pass. Module purity verified. Timezone boundary validated, including a SAST-vs-UTC off-by-one bug caught only by early-morning show-start edge case.

---

## What F1 Is

Two new exports in pure TypeScript modules — no Firestore, no network, no implicit clock anywhere in either file:

### 1. Ticket Taxonomy (`lib/ticket-taxonomy.ts`)

Seven ticket categories: `admission`, `exhibitor`, `workshop`, `field-trip`, `symposium`, `wosa-conference`, `cocktail-reception`.

Each maps to:
- **`TicketCategory`** — a union of the seven literal strings
- **`TICKET_CATEGORY_LABELS`** — human-readable labels for display
- **`TICKET_CATEGORY_PURCHASE_SURFACE`** — mapping to the existing Sanity `ticketType.category` enum (`admission` | `conference` | `workshop-field-trip`) that gates which public page a `ticketType` document appears on

### 2. Computed Early-Bird Pricing (`lib/admission-early-bird-pricing.ts`)

- **`ADMISSION_EARLY_BIRD_DISCOUNT_PERCENT`** = 20 (confirmed constant, mission-stated)
- **`ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW`** = 90 (confirmed constant, implies 2027-06-18 cutoff)
- **`deriveAdmissionEarlyBirdCutoffIso(showStartDate: Date): string`** — derives the cutoff date as ISO 8601 with explicit SAST offset (`+02:00`), never bare UTC
- **`resolveComputedEarlyBirdPrice(input: { basePrice, purchaseDate, showStartDate }): { amount, tier }`** — pure function: returns `Math.round(basePrice * 0.8)` and tier `'earlyBird'` if `purchaseDate` falls within the window (through the end of cutoff day inclusive), else `basePrice` and tier `'regular'`

Both modules import ONLY types and pure functions. `admission-early-bird-pricing.ts` reuses the existing `isWithinEarlyBirdWindow()` boundary comparator from `lib/checkout-reservation.ts` (imported by value, not re-implemented) — a design mirror of `lib/vendor-stand-pricing.ts`'s own pattern.

---

## Timezone Ruling — SAST (+02:00), Evaluated Exactly Like The Vendor-Stand Precedent

### The Rule

**`deriveAdmissionEarlyBirdCutoffIso()` must produce an ISO string with an explicit `+02:00` offset, never bare UTC/`Z`.** 90 days before the show's confirmed 2027-09-16 start (per the live Sanity document `show-19-2027.startDate: 2027-09-16T09:00:00+02:00`) is 2027-06-18 — matching the mission text's stated cutoff verbatim, confirming the arithmetic.

The boundary is evaluated in SAST, not UTC and not server-local time (which happens to be SAST on the dev machine, a coincidence, not the reason). **The reason is the show's own calendar day, defined in SAST because that's the venue's timezone.**

### The Defect Caught (SAST vs. UTC Calendar-Day Disagreement)

**Defect:** When a show starts before 02:00 SAST, its UTC instant falls on the *previous* UTC calendar day. Getting the 90-day-before calendar date wrong by this disagreement is a silent off-by-one: it happens to produce the right answer when the show starts mid-morning (like the real 09:00 SAST start), which is exactly why it can hide in a fixture set that never exercises an early-morning start.

**Example:** Show starts 2027-09-16T01:00:00+02:00 (SAST 01:00 on the 16th). Its UTC instant is 2027-09-15T23:00:00Z (UTC 23:00 on the 15th). Reading Y/M/D directly off the UTC instant yields "2027-09-15", not "2027-09-16". Subtracting 90 days from the wrong calendar day produces the wrong cutoff.

**Fix:** `deriveAdmissionEarlyBirdCutoffIso()` shifts the instant forward by 2 hours (the SAST offset) *before* reading UTC-labelled Y/M/D components off it. Those components are then genuinely the SAST wall-clock date, not the UTC one — the calendar-day math operates on the correct calendar day, and the off-by-one vanishes.

```typescript
// From lib/admission-early-bird-pricing.ts:
const sastShifted = new Date(showStartDate.getTime() + SAST_OFFSET_MS);
const cutoff = new Date(
  Date.UTC(
    sastShifted.getUTCFullYear(),
    sastShifted.getUTCMonth(),
    sastShifted.getUTCDate() - ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW,
  ),
);
```

**What Caught It:** Contract assertion A12 (the "discriminating case"), added 2026-09-08. Runs every case in `goldens/fixtures/f1-pricing-boundary-cases.json`'s `cutoffDerivationCases` array, including `'cutoff-derivation-early-morning-start'` — a 2027-09-16T01:00:00+02:00 show start (UTC 2027-09-15T23:00:00Z), the only entry in the whole fixture set capable of catching a UTC-calendar-component off-by-one. Every other case's start time shares the same calendar date in both zones and would pass even with the bug present. **This is the edge case that proves the timezone logic matters at all.**

The fixture set without A12 (six pre-existing assertions covering the cutoff math) was blind to this bug class. Proving the fix works required deliberately reverting the offset-shift code, re-running A12, and confirming it failed — establishing that A12 is not vacuously true and actually discriminates.

### Rationale for Explicit Offset, Not UTC

A Firebase App Hosting container runs UTC. Firestore and Cloud Logging timestamps are UTC. A bare-UTC cutoff boundary (ISO string ending with `Z`) would silently land 2 hours off from the SAST calendar day Brad actually means. Writing the boundary as an explicit `+02:00` offset string ensures that when this string is handed to `isWithinEarlyBirdWindow()`, the boundary it computes lands at SAST midnight, not UTC midnight. Same reasoning as `lib/vendor-stand-pricing.ts`'s own precedent — the two modules apply the same timezone discipline independently.

---

## Constant Discipline — 90-Day Cutoff Is NOT Shared

**ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW** is its own constant — deliberately NOT imported from, or shared with, the vendor-stand module's **VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW** or the provisional refund-policy module's day thresholds, even though all three currently read "90" or similar.

Three unrelated rules happen to share a number today. They are not the same rule:
- Vendor stands early-bird: 90 days before 2027-09-16 → payable at the early-bird rate
- Admission early-bird: 90 days before 2027-09-16 → eligible for 20% discount
- Refund policy thresholds: 90/60/50 days (speculative, pending Lee-Ann's final doc) — different semantics entirely (refund eligibility windows, not pricing cutoffs)

**Why not share?** Sharing a constant across unrelated rules creates a false mutual dependency. Changing the vendor-stand early-bird window for future shows would silently change admission pricing unless code discipline prevents it. Silent coupling of this kind is exactly the invisible drift hazard that spreads values-and-diverge incidents (the 18–21 September placeholder for the venue did this — the figure was edited once and propagated silently to six places in the codebase, none of which were semantically linked). A single `grep ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW` finds every use. A shared constant imported into three modules becomes a hunt-through-imports problem that fails under pressure.

**Enforcement:** Contract assertion A3 ("NEGATIVE CONTROL") checks that the pricing module does NOT reference the vendor-stand or refund-policy constants. The check is not preventative (TypeScript doesn't forbid importing); it is accountability — the assertion will fail if someone tries to share it later without updating the contract, forcing a deliberate debate rather than a silent drift.

---

## Exhibitor Entry — Deliberately Unresolved

**`TICKET_CATEGORY_PURCHASE_SURFACE.exhibitor`** is the explicit literal `'unresolved-nos-boundary'`, never silently defaulted to `'admission'` or any other schema value.

### Why Unresolved?

Exhibitor Entry's real purchase surface is `/national-show/exhibitors`, inside `app/(marketing)/national-show/**` — a tree this mission is barred from touching (F5's negotiated boundary, session `saocnosdesign-ea`). Which of the three existing Sanity `ticketType.category` values (if any) an exhibitor `ticketType` document should carry is genuinely undecided pending F5's component-API handoff between this session and the NOS (national-show) session.

### Why Not Silent Default?

A silent default here would be exactly the kind of invented eligibility relationship the mission's anti-fabrication constraint targets. Brad's standing brief: "no invented ... eligibility relationship." An implicit `exhibitor → admission` mapping is a claim of equivalence that nobody has verified. An explicit unresolved marker is honest — it acknowledges the gap without bridging it with a false fact.

### Enforcement

Contract assertion A8 ("NEGATIVE CONTROL for silent default") checks the ACTUAL RUNTIME VALUE at `TICKET_CATEGORY_PURCHASE_SURFACE.exhibitor`, not just the text presence of the string `'unresolved-nos-boundary'` in the file. QA mutation testing (2026-09-08) found that a naive `grep 'unresolved-nos-boundary'` could be fooled by a mutant that set the value to `'admission'` while leaving the constant declaration and its doc comment intact — source text passes, runtime value lies. The assertion now imports the module and checks the map's actual value, so it survives reformatting and catches the silent default.

---

## What This Does NOT Prove

- **Product prices, capacities, or schemas are decided.** F1 ships the generic "apply a discount percentage to a base price" function. F2 (Sanity schema + seed script) decides which product's price becomes the `basePrice` anchor, and at what values. F1 invents nothing.
- **Checkout enforcement is wired.** The pricing function is pure; it cannot enforce anything. `app/api/tickets/checkout/route.ts` and `lib/checkout-reservation.ts` consume it. Those files' own assertions are separate (F4's contract).
- **UI behaves correctly.** This module is invisible to the user; no page displays "early bird pricing engine." The UI that surfaces early-bird prices is F4's scope. A test of the pure function is not a test of what the user sees.

---

## Testing — 12/12 Assertions Pass

All assertions in `contract-f1.yaml` are green.

### Assertion Coverage

| A# | Description | Status | Notes |
|---|---|---|---|
| A1 | TICKET_CATEGORIES array has exactly 7 categories, no more/fewer | ✅ | TIGHTENED 2026-09-08: runtime module read, not grep |
| A2 | `admission-early-bird-pricing.ts` exports required symbols (resolveComputedEarlyBirdPrice, deriveAdmissionEarlyBirdCutoffIso, 20%, 90) | ✅ | Baseline existence check |
| A3 | NEGATIVE CONTROL: pricing module does NOT import vendor-stand or refund-policy constants | ✅ | Confirms constant isolation discipline |
| A4 | isWithinEarlyBirdWindow is CALLED (not just imported or documented in comments) | ✅ | TIGHTENED 2026-09-08: detects reimplementation mutant + filters doc-comment false positives |
| A5 | Pricing boundary truth table (91/90/89 days before show start, cutoff day boundaries, rounding, SAST-vs-UTC disagreement) matches golden fixture | ✅ | Verifier runs `node --import tsx/esm` |
| A6 | NEGATIVE CONTROL for A5: broken naive-UTC cutoff variant DISAGREES at documented disagreement instant | ✅ | Proves A5 is not vacuously true |
| A7 | Module anti-fabrication: no hardcoded ZAR product prices anywhere | ✅ | Bans specific known figures (104, 120, 130, ..., 900) |
| A8 | TICKET_CATEGORY_PURCHASE_SURFACE.exhibitor actually equals `'unresolved-nos-boundary'` at runtime | ✅ | TIGHTENED 2026-09-08: runtime map-value check, not grep |
| A9 | Module purity: importing under tsx/esm does not throw and requires no Firestore/network | ✅ | Empirically proves "dependency-free" |
| A10 | Golden README documents F7 test-framework choice (precedent for later features) | ✅ | Design-record completeness |
| A11 | HARD RULE: F1 constructs NO Sanity write client and calls no mutating method | ✅ | Bans `.commit()`, `.patch()`, `createOrReplace`, `createIfNotExists`, `@sanity/client` |
| A12 | DISCRIMINATING CASE: cutoff derivation must use SAST calendar date, not UTC date (tested with early-morning 2027-09-16T01:00:00+02:00 = 2027-09-15T23:00:00Z UTC case) | ✅ | Only case catching the bug; all other cases blind |

### QA Findings — Code Correct, Assertions Incomplete

**A4 weakness:** The original check (grep for import line) was mutant-safe against a reimplementation that keeps the import but calls a locally-defined comparator instead. **Consequence:** no actual defect in the code — `resolveComputedEarlyBirdPrice()` does call the real `isWithinEarlyBirdWindow()` from checkout-reservation — but the assertion was weaker than its own goal. **Fix applied:** A4 now checks for an actual CALL SITE (line with `isWithinEarlyBirdWindow(` outside of comments), filtering doc-comment mentions via line-prefix stripping, and bans local redeclaration of the identifier. Code does not need to change; assertion is tightened.

**A8 weakness:** The original check (grep for string `'unresolved-nos-boundary'`) was mutant-safe against setting the value to the silent default `'admission'` while leaving the constant declaration and doc comment intact. **Consequence:** no actual defect — the value in the codebase is correct — but the assertion could not have caught it. **Fix applied:** A8 now imports the module at runtime and checks the actual map value, not the file text. Survives reformatting. Code does not need to change; assertion is tightened.

**Defect class:** Both are examples of "the thing the assertion exists to prevent can hide in source text while the actual value lies" — a pattern audited and documented in `.agent/memory/scratch/qa-report-ticketing-complete.md`. Assertions have since been tightened; no code changes were needed.

### Fixture Coverage and Edge Cases

**Pricing boundary test (`f1-pricing-boundary-cases.json`):**
- 91 days before show start → regular price (just outside window)
- 90 days before show start → early-bird price (first day of window)
- 89 days before show start → early-bird price (well inside window)
- 2027-06-18T00:00:00+02:00 (cutoff first instant) → early-bird price (within window)
- 2027-06-18T23:59:59+02:00 (cutoff last instant) → early-bird price (through end of cutoff day, inclusive)
- Fractional-rand rounding case (`basePrice * 0.8` not a whole number)
- SAST-vs-UTC disagreement case: 2027-09-16T01:00:00+02:00 (UTC 2027-09-15T23:00:00Z) — **only case catching the off-by-one bug**

**Cutoff derivation test (`f1-pricing-boundary-cases.json`, `cutoffDerivationCases` array):**
- Early-morning start (2027-09-16T01:00:00+02:00) — the case that catches the bug
- Mid-morning start (the real show's 09:00 SAST time) — passes both with and without the bug (why it was hidden)
- Late-afternoon and evening starts — pass both ways

---

## Files Changed

- `lib/ticket-taxonomy.ts` (new) — 7-category taxonomy, category labels, purchase-surface mapping with explicit exhibitor-unresolved marker
- `lib/admission-early-bird-pricing.ts` (new) — 20% discount, 90-day cutoff, SAST-offset-shift cutoff derivation, computed pricing resolver
- `.agent/memory/project/specs/ticketing-complete/contract-f1.yaml` — contract gate (12 assertions, all required)
- `.agent/memory/project/specs/ticketing-complete/goldens/README.md` — design record (timezone, constant discipline, exhibitor unresolved)
- `.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f1-taxonomy.json` — golden truth table for 7 categories
- `.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f1-pricing-boundary-cases.json` — golden pricing boundary test cases + cutoff derivation cases
- `.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f1-broken-naive-utc-fixture.json` — negative-control fixture (broken UTC variant)
- `contracts/checks/ticketing-complete-f1/check-pricing-boundaries.mjs` — A5/A6 verifier (runs boundary test and negative control)
- `contracts/checks/ticketing-complete-f1/check-cutoff-derivation.mjs` — A12 verifier (runs cutoff-derivation test cases)

---

## Sources

- `contract-f1.yaml` — mission goal, autonomy, assertion specs
- `.agent/memory/project/specs/ticketing-complete/goldens/README.md` — design decisions (timezone, constant isolation, exhibitor unresolved, what F1 does NOT do)
- `lib/admission-early-bird-pricing.ts` — implementation and SAST-offset-shift pattern
- `lib/ticket-taxonomy.ts` — taxonomy definition and exhibitor-unresolved literal
- `.agent/evidence/ticketing-complete/f1/functional.txt` — assertion results (12/12 pass)
- `.agent/memory/scratch/qa-report-ticketing-complete.md` — QA findings on assertion tightening (A4/A8)
