# F4 (vendor-registration-form-rebuild) — UI: Booth Requirements + Tables/Chairs + Electricity & Water (Sections 4, 5, 6): decision record

Source: `docs/leeann-source/2027-vendor-registration-form_2026-08-25.md`, Sections 4 (4.1-4.4),
5 (5.1-5.2), 6 (6.1-6.7). Depends on F1 (`goldens/f1-data-model-foundation.md`), which already
added every Section 4/6 field this feature collects to `types/index.ts` and wired them into
`lib/vendor-submissions.ts`, all optional, deliberately leaving `boothType` untouched (F1's
sequencing rule: "boothType enum stays untouched here ... deferred to F4"). This feature is the
enum correction itself, plus the UI for every other Section 4/5/6 addition.

## The boothType enum correction: a RENAME, not a widening — this is the one breaking change

The live `VendorBoothType` union (`types/index.ts:491`) has 3 members: `'standard' | 'corner' |
'end-of-row'`, rendered by `components/vendors/VendorBoothFieldset.tsx`'s `BOOTH_TYPE_OPTIONS`
and validated by `lib/vendor-submissions.ts`'s `VENDOR_BOOTH_TYPES` array.

Source 4.2 lists 4 checkboxes: "Standard / In-row · Corner · End-of-row · No preference".

Mapping every source item against the live 3:

| Source item | Live value | Verdict |
|---|---|---|
| Standard / In-row | `standard` | **RENAME** to `standard-in-row` — the live label "Standard" doesn't capture "in-row", and unlike F3's vendorCategory correction, every other live value is either already correct or brand new, so there is no reason to keep a stale spelling around |
| Corner | `corner` | keep, unchanged |
| End-of-row | `end-of-row` | keep, unchanged |
| No preference | — | **new**: `no-preference` |

This is the mirror image of F3's vendorCategory correction: F3 widened (kept all 8 old values,
added 3 new). F4 **renames** one value and adds one new value, net 3 → 4 members. The
architect considered keeping `'standard'` alongside a new `'standard-in-row'` (an additive,
F3-style widening that would let this land as a non-breaking change) and rejected it: the
source has exactly one "standard position" concept ("Standard / In-row"), and having two live
spellings for the same real-world option (`standard` and `standard-in-row`) would leave a
permanent, meaningless duplicate in the union with no way to tell which one is "current" —
worse than a clean one-shot rename given this project's confirmed pre-production posture (see
below). Do not re-litigate this by adding `'standard'` back in a later feature.

## Why the rename and its only UI producer must ship in the SAME feature (this one)

F1's sequencing rule exists because the live public API stays deployed and accepting real
submissions continuously between every feature merge (standing deploy authorization: "push any
time"). Narrowing/renaming `VendorBoothType` in F1, ahead of the UI change that stops emitting
`'standard'`, would have made the live public API start rejecting real in-flight submissions
from the still-deployed old `VendorBoothFieldset.tsx` the instant F1 deployed — which is exactly
why F1 deliberately left `boothType` untouched and deferred the correction here.

This mission has no later feature to defer the breaking half to (unlike, hypothetically, a
mission with a dedicated "clean up remaining enums" feature) — Section 4's UI rebuild IS this
mission's boothType-consuming feature. So the correct sequencing is: land the type rename, the
validator rename, and the UI change that stops emitting `'standard'` and starts emitting
`'standard-in-row'`/`'no-preference'`, all in this one feature/deploy. Because a single Next.js
deploy ships frontend and backend atomically, there is no intermediate state where the old UI is
live against the new validator (or vice versa) — the two halves change together in the same
request-serving instant, unlike F1's 11-feature-wide rollout window. This is why F4, unlike F1,
is allowed to touch the enum: it is the terminal feature for this specific field's migration,
not an intermediate one.

## No dual-write / backwards-compatibility mapping needed — why

A breaking rename would normally need a compatibility shim (accept both old and new values for
some transition window) if there were a real risk of an in-flight old-shaped request arriving
after the new validator deploys. That risk doesn't apply here for two independent reasons,
either of which would be sufficient alone:

1. **Atomic deploy**: as above, there is no window between "new validator live" and "old UI
   retired" — they ship in the same deploy.
2. **Pre-production dataset**: per project memory `project_sanity_dataset_not_live`, the
   Firestore `vendorSubmissions` collection backing this form is pre-production — there is no
   real vendor submission sitting in Firestore today with `boothType: 'standard'` that a
   compatibility shim would need to keep readable. (If this ever changes — e.g. real
   submissions land before this feature ships — a migration script rewriting any stored
   `'standard'` value to `'standard-in-row'` would be needed before this feature's validator
   change goes live; @dev must flag this to Brad if Firestore is found to contain any vendor
   submission at implementation time, rather than silently assuming it's still empty.)

No admin-facing reader needs a migration either: `lib/vendor-approval-confirmation.ts` and
`emails/VendorApprovalConfirmation.tsx` (F8, mission `vendor-registration` 2026-08-17) only ever
*display* `boothType` via `formatOptionalField()` — a plain pass-through with no label map keyed
on the literal value — so a stored `'standard-in-row'` renders correctly with zero code change
there. `app/api/admin/vendors/[id]/review/route.ts` and `lib/vendor-register-response.ts` are
likewise pass-through/label-map-by-field-name (not by-value), unaffected.

## The ripple sweep: exactly one downstream fixture at risk, confirmed by grep

Unlike F3's vendorCategory widening (which had to sweep 4 downstream contracts plus a
Playwright DOM-id dependency), a **rename** only breaks callers that hardcode the literal
`'standard'` as a `VendorBoothType`-typed value — grep confirms there is exactly **one**:

- `contracts/checks/vendor-f8-approval-email/fixtures/vendor-f8-approval-email-typecheck.ts:28`
  — `boothType: 'standard'` inside a `VendorApprovalConfirmationInput` literal. This WILL fail
  to compile the moment `'standard'` is removed from `VendorBoothType`. @dev must update this
  line to a still-valid member (e.g. `'standard-in-row'`) as part of this feature's ripple-sweep
  fix — it is a fixture literal, not production logic, so editing it is in scope for this
  feature even though the file lives under a different (already-shipped) contract's directory.

Two other files use `boothType` as a *label map key* (the field name, not one of its values) and
are unaffected: `lib/vendor-register-response.ts:121` (`boothType: 'Booth type'`) and
`components/vendors/VendorRadioGroupField.tsx` (a comment, not code).

Confirmed NOT at risk (checked, not assumed):

- `contracts/checks/vendor-f4-submissions-model/fixtures/vendor-submission-typecheck.ts:67` uses
  `boothType: 'corner'` — survives unrenamed.
- `contracts/checks/vendor-form-ui/fixtures/form-state-full.fixture.json` uses
  `"boothType": "corner"`; `form-state-minimal.fixture.json` uses `"boothType": ""` — both are
  `VendorRegisterFormState.boothType: string` (a plain string, never the closed union) and both
  values survive the rename untouched. These are the two golden fixtures A3(e) re-validates
  end-to-end through the real `buildVendorRegistrationPayload()` →
  `validateVendorSubmissionInput()` pipeline as the concrete ripple-sweep proof.
- No Playwright-driven contract in this repo constructs a `vendor-register-boothType-<value>`
  DOM id (grep across the repo for `vendor-register-boothType` returns zero matches) — unlike
  F3's vendorCategory correction, which had 4 live Playwright contracts clicking
  `#vendor-register-vendorCategory-plant-sales` by id. This means F4's rebuild of
  `VendorBoothFieldset.tsx` is free to change `BOOTH_TYPE_OPTIONS`' values without any E2E
  click-target regression risk.

`check-f4-ripple-sweep.sh` re-runs the F8 fixture's own scoped tsconfig after confirming the fix,
plus the two confirmed-safe tsconfigs (belt-and-suspenders, since "unaffected" should still be
proven not assumed), and greps for the DOM-id pattern to catch any future contract that starts
depending on it without this sweep being extended.

## Section 6 gate wiring — single source of truth, no duplicated conditions

Source 6.2-6.5 (outlet count, equipment list, continuous-operation question) all sit under 6.1
("Electricity Required?"). The live codebase already has exactly this shape of gate for the
pre-existing `electricalLoad` field: `isElectricalLoadApplicable(state) => state.powerRequired
=== 'true'`. This feature reuses that same function, unmodified, for the two new
electricity-required-gated fields (`electricalOutletsRequired`, `electricalEquipmentList`) —
it does NOT introduce a second function with an identical condition under a different name.

`electricalEquipmentContinuousOperation` (source 6.5) is itself gated on
`isElectricalLoadApplicable` (it only makes sense to ask "does equipment run continuously" if
electricity was requested at all), and its own dependent field
`electricalEquipmentContinuousDetails` is gated on BOTH conditions —
`isElectricalEquipmentContinuousDetailsFieldApplicable(state) =>
isElectricalLoadApplicable(state) && state.electricalEquipmentContinuousOperation === 'true'` —
composing the existing gate rather than re-deriving `powerRequired === 'true'` a second time.
A1's assertion note on "nested-gate correctness" (A5 in the contract) exists because a naive
implementation might gate `electricalEquipmentContinuousDetails` on
`electricalEquipmentContinuousOperation` alone and forget that flipping `powerRequired` back to
not-required should also hide/exclude it — the two gates must compose, not just the inner one
stand alone.

Source 6.6 (`waterRequired`, pre-existing) gates the new `waterIntendedUse` field — a new,
symmetrical `isWaterIntendedUseFieldApplicable(state) => state.waterRequired === 'true'` is
added for consistency with the other three new gate functions (never an inline condition
written once in the render layer and again in the payload builder).

Source 6.7 (`wastewaterDrainageRequired`, new) is its own independent toggle, NOT nested under
6.6/waterRequired — the source presents it as a separate question ("Wastewater / Drainage
Requirement: None / Required") with its own Yes/No-shaped control, gating only its own details
field (`wastewaterDrainageDetails`).

## Section 4 fields — three new, one enum, no gate needed for two of them

`boothPositionRequest` (4.2's free-text preference, separate from the boothType radio) and
`specialDisplayRequirements` (4.4) are both ungated, always-visible free text — the source has
no controlling boolean for either. `adjacentBoothRequested` (4.3, new boolean) gates
`adjacentBoothVendorName`, mirroring the existing `isElectricalLoadApplicable`-style pattern
exactly: `isAdjacentBoothVendorNameFieldApplicable(state) => state.adjacentBoothRequested ===
'true'`.

## Section 5 — genuinely unchanged

`tableCount`/`chairCount` already exist, already render, and the source's 5.1/5.2 add nothing
this feature needs to touch — the mission brief's "stay unchanged" is taken literally: no file
in this feature's scope references them except to confirm (A6) they still render at their
current position.

## No invented figures

No new field in this feature carries a fee, dimension standard, or wattage/amperage limit — the
source names none for Sections 4-6 beyond the descriptive dimension text already handled as
static copy (not a field) in the live fieldset. `electricalOutletsRequired` is a plain optional
count with no min/max validation beyond the existing `validateOptionalNumber` pattern F1 already
wired.

## What this feature does NOT prove

- That any admin-review surface can display these eleven new fields — that's F11.
- That Section 7 (Gas/Cooking/Heat), which sits between Section 6 and Section 8 in the source
  and is sometimes visually adjacent to "requires special utilities," is covered — it is
  explicitly F5's job, not this feature's, per the mission's milestone breakdown.
- Any Firestore read/write, HTTP route, or Firebase Storage behavior — this feature only touches
  the same pure, side-effect-free files F1/F3 already established as pure
  (`lib/vendor-submissions.ts`, `lib/vendor-register-form-payload.ts`).
