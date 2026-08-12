# Venue Prose Residue — Fixing Stale Characteristic-Describing Copy

Mission: `venue-prose-residue`, F1. Follows `venue-seed-truth` (gate 16/16 green, committed 2026-08-12), which fixed every venue-name reference across the codebase and live Sanity dataset. A second adversarial QA pass found this contract's namesake defect class: prose describing the venue's *physical characteristics* had survived the name-anchored sweep because it never named the venue at all — it described features ("parking garages," "convention centre," "MyCiTi bus service") true of the old CTICC venue and false or unverified for the new real venue (The Hangar, Stellenbosch Flying Club).

This contract took **two passes** to close. Round 1 gate-passed while most of the defect class stayed open (a checker that implemented only 2 of 4 documented phrases, and covered only 2 of 3 defective FAQ ids). Round 2 found the root causes: the checker's incomplete implementation against its own spec, and an unsourced invented claim ("no scheduled public transport to the airfield") that the round-1 fix itself had added. Both are now closed.

Contract file: `contracts/contract-venue-prose-residue.yaml` (30 assertions).  
Golden files: `contracts/golden/venue-prose-residue/` (7 files).  
Gate status: 30/30 green as of 2026-08-12.

---

## The defect class

Name-anchored string sweeps (searching for "CTICC", "Cape Town International Convention", etc.) cannot catch prose that describes physical characteristics without naming the venue itself:

> "a modern convention centre with step-free access"  
> "several parking garages"  
> "a drive of roughly half an hour from Cape Town International"  
> "MyCiTi bus route A01 to Civic Centre station"  
> "nearby the V&A Waterfront, Kirstenbosch"

This is exactly the failure mode that `.claude/rules/content-modeling.md` §3 predicts: "the failure mode to design against is not 'content is missing' — it is 'content is confidently wrong'. Missing content is visible. Stale content looks fine."

When the venue changed from CTICC to The Hangar (Stellenbosch Flying Club), these sentences survived intact, now describing an airfield hangar 45 km outside Stellenbosch with none of those characteristics.

---

## Current state vs historical-record ruling

The golden copy-source file (`contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json`) contains both **venue-identity fields** (name, address, city, province, coordinates) and **venue-descriptive prose** (travel directions, parking, public transport, accommodation, attractions).

These are handled differently:

| Content | Ruling | Owner | Changed by this contract |
|---------|--------|-------|----------|
| Identity fields (name, addressLines, city, province, postalCode, latitude, longitude, phone) | Historical record: what the original research targeted (CTICC). Frozen, not updated. | `contract-venue-seed-truth.yaml` | No — A13 protects them |
| Descriptive prose (directionsNote, airportRoutes, accommodation, attractions, gettingThereIntro, accommodationIntro, parking, accessibility, publicTransport, FAQ answers) | Current-state spec: what a visitor should currently know about getting to the show. Must reflect the real venue or stay honestly unconfirmed. | This contract | Yes — A12 requires correction |

The dividing line: **identity fields describe *which* venue the research targeted; descriptive prose describes *how to get there* today.** When the venue changes, identity stays frozen (that's what it was true for), but prose must update or empty.

---

## How the round-1 gate went green while the defect stayed open

**Finding 1 — Checker underimplementation:** `phrase-denylist.golden.md` documented four denied phrases. `check_json_denylist.py` implemented only two. The golden JSON continued to carry "Foreshore," "MyCiTi," "V&A Waterfront," "Table Mountain," "Bo-Kaap," and "Kirstenbosch" in its prose fields (all true descriptions of CTICC's Cape Town location, all false for Stellenbosch). A12 passed because the checker never saw most of what it claimed to check.

**Finding 2 — Invented unsourced claim:** Round 1's fix for `showFaq-getting-there-1` added a new sentence: "There is no scheduled public transport to the airfield." Nothing in the repo sources this — there is no Stellenbosch equivalent of the historical CTICC research notes. It is a brand-new invented claim added *while fixing the stale prose*, exactly the opposite of what rule 5 forbids.

Both findings and their fixes are documented in `contracts/golden/venue-prose-residue/README.md`.

---

## The fixes

**Checker conformance (A22):** `check_denylist_conformance.py` now proves the implemented denylist regex and FAQ-id set exactly match what `phrase-denylist.golden.md` documents. If a future edit adds a phrase to the doc without the checker, or vice versa, A22 fails.

**Expanded denylist (A12, A25-A26):** Twelve phrases now checked (not just two): "convention centre," "parking garage," "Foreshore," drive-time phrases, "MyCiTi," "Civic Centre station," "V&A Waterfront," "Table Mountain," "Bo-Kaap," "Company's Garden," "Robben Island," "Kirstenbosch" — each scoped to specific files/fields to avoid false positives on legitimate uses (e.g., "Witbank Civic Centre" is a real society venue, protected by exact phrase matching and file scoping).

**Structured data cleanup (A12):** Three fields (`airportRoutes`, `accommodation`, `attractions`) carry stale *structured data* (whole array entries), not text. They are now required to equal `[]`, matching the corrected seed script.

**No invented claims (A23-A26):** Two new checkers prevent confident assertions about public transport when nothing is sourced: `check_no_confident_transport_claim.py` bans the *shape* of an unverified claim (rejecting both "no public transport" AND "public transport available" equally) rather than specific wording, so a future dev cannot slip past it by rewording.

**Tone model (A5, A10, A13, A20):** Negative controls preserve the correct tone: `showFaq-getting-there-3` ("On-site details... are still being worked out and will be published here as they are settled.") remains unchanged, showing the honest-silence model every rewrite must follow.

---

## Live documents touched

Three Sanity FAQ documents (read-only checks):
- `showFaq-accessibility-1` — dropped the "convention centre" description
- `showFaq-getting-there-2` — dropped the "parking garages" claim
- `showFaq-getting-there-1` — either dropped or researched the drive-time claim; does not assert public-transport availability

One Sanity singleton field:
- `showVisitorInfo.publicTransport` — does not assert public-transport availability as fact

One seed script:
- `scripts/seed-show-visitor-info.ts` — reflects the same corrections

One golden copy-source JSON:
- `contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json` — updated across all prose fields to match the corrected script

Two documentation files:
- `docs/show-visitor-info-for-editors.md` — removed the line claiming CTICC as the current working assumption
- `docs/show-visitor-info.md` — removed the equivalent dev-facing claim; the seeded venue (Hangar, Stellenbosch Flying Club, confirmed 2026-08-12) now stands alone

One README:
- `contracts/golden/venue-seed-truth/README.md` — corrected the false claim that a complete sweep found "zero remaining stale strings"

---

## How to run the gates

Both contracts are independent and can be run separately:

```bash
# Venue seed (names, identity fields)
python3 execution/contract.py gate contracts/contract-venue-seed-truth.yaml

# Venue prose (characteristics-describing copy)
python3 execution/contract.py gate contracts/contract-venue-prose-residue.yaml
```

The prose-residue contract takes longer (~4–5 minutes) because five assertions mutate and restore the live Sanity dataset under a lock guard. Timeouts range up to 1200 seconds; do not kill a running gate mid-mutation. See `docs/show-visitor-info.md` "Operational notes for maintainers" for details on the sentinel guard and residue recovery.

---

## When the venue changes again (in three years)

The next venue change follows this procedure:

1. **Identify the new venue and its details.** Contact the committee for confirmation; document address, city, province, postal code, coordinates, phone.

2. **Update identity fields only in live Sanity (`nationalShow.venue`).**  Update: name, addressLines, city, province, postalCode, latitude, longitude, mapsUrl. Do NOT fill in directionsNote, parking, or other prose fields yet — rule 5 forbids inventing detail to fill gaps.

3. **Run `contract-venue-seed-truth.yaml`** (A2–A6 will gate-fail until you update the seed scripts). Edit `contracts/golden/venue-seed-truth/expected-venue.json` and `scripts/seed-show-visitor-info.ts` with the new venue data, matching identity fields exactly. Leave all travel/parking/accommodation arrays empty (`[]`). Run the gate; it will pass once everything matches.

4. **Mark venue-dependent prose as `pending`.** On `showVisitorInfo` in Studio, change the confirmations for `parking`, `accessibility`, `publicTransport`, `gettingThereIntro`, `accommodationIntro` from `research` (old venue, now stale) to `pending` (genuinely unresearched for the new venue). Every FAQ document stays `pending` unless the committee confirms the answer for the new venue. Publish.

5. **Do not sweep or replace.** Do not run a find-and-replace on the old venue name. Route-by-route, field-by-field, decide what's genuinely out of scope (e.g., past shows' venues, unrelated society venues) and leave those alone.

6. **Run `contract-venue-prose-residue.yaml`** at any point after step 1. It will assert the stale characteristic-describing prose is cleared. If you've followed the steps above, it passes immediately.

---

## Gaps and follow-ups

- ~~`contracts/golden/f4-seed-page-singletons/nationalShow.golden.json` still pins CTICC~~ — RESOLVED 2026-08-12: updated to `The Hangar, Stellenbosch Flying Club` to match `scripts/seed-page-singletons.ts`'s `seedNationalShow()` (owned by `contracts/cms-loop-f3-national-show.yaml`). `contract-venue-prose-residue.yaml`'s A19 negative control was also rewritten the same day — it previously asserted this file still PINNED the stale CTICC string, which meant it failed the moment this fix landed; it now structurally proves the prose-residue contract never references that file path at all, independent of the owning contract's state.

- ~~Older golden files ... Decide whether they should carry a "superseded" banner~~ — RESOLVED 2026-08-12: `cticc-research.golden.md`, `venue-single-source.golden.md`, `show-identity-wiring.golden.md` and `assertion-discrimination.golden.md` each now carry a prepended superseded banner (what the file documented, that the venue changed on 2026-08-12, commits `427fbaf`/`32e01cf`, and a pointer back to this document). Bodies were left byte-for-byte intact underneath. `contract-venue-prose-residue.yaml`'s A20 negative control was extended the same day to actually check all five protected files (it previously only checked `cticc-research.golden.md` despite `phrase-denylist.golden.md`'s scope table always naming all five).

- **Two smaller drifts found in a follow-up adversarial QA pass on 2026-08-12, not yet fixed:**
  - `contracts/golden/venue-prose-residue/check_no_confident_transport_claim.py`'s docstring claims it bans the *shape* of a public-transport claim, but its `NEGATIVE_CLAIM`/`POSITIVE_CLAIM` regexes only match the original incident's exact wording. A paraphrase ("There is currently no bus service to the airfield") or a differently-worded invented claim ("A shuttle will run from Stellenbosch station") would pass silently. The docstring overclaims; either the docstring should be narrowed to state exactly what it matches, or the regexes should be hardened to actually match the claim's shape.
  - `contracts/golden/venue-prose-residue/check_denylist_conformance.py`'s `REQUIRED_PHRASES` list has 12 entries; `phrase-denylist.golden.md`'s phrase table documents 13 — missing `roughly 25 to 40 minutes` (the golden JSON's own wording of the drive-time claim, distinct from the FAQ's "half an hour from Cape Town International" wording). A22 currently cannot detect drift on this specific phrase because the conformance checker's own list is already out of sync with its spec.

---

## References

- Content modeling rule 3 (the rule this contract exists to enforce): `.claude/rules/content-modeling.md` §3
- Full technical detail, including why round 1 failed: `contracts/golden/venue-prose-residue/README.md`
- Phrase denylist, scope reasoning, and false-positive guards: `contracts/golden/venue-prose-residue/phrase-denylist.golden.md`
- Tone model for rewrites: `contracts/golden/venue-prose-residue/correct-tone-model.golden.md`
