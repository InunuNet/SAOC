# F1: Venue — "Never Changed" Narrative Removal & Live Verification

**Feature:** F1 of mission `venue-never-changed-copy-fix` (milestone M1). Removes framing that suggests the show's venue changed from a previous venue to The Hangar, Stellenbosch Flying Club. The venue was never changed — CTICC was an incorrect early placeholder, never actually committed to — and the site must read as if the venue was simply always The Hangar.

**Contract:** `contracts/golden/venue-never-changed-copy-fix-f1/contract-f1.yaml` and `contracts/golden/venue-never-changed-copy-fix-f1/README.md` — the full design record and scope rationale.

**Status:** Live & Verified. Code implemented, QA-passed, Codex cross-model-passed, live Sanity patch applied and verified against production dataset (2026-08-24).

---

## Why This Feature Exists

**The defect:** The site was narrating the venue correction as a "change away from" a prior venue ("the show venue has changed to the Stellenbosch Flying Club", "the previous guidance... no longer applies", "researched... against the working venue", "for the new venue"). This created a false impression that CTICC was a real, committed venue that we later abandoned, when in fact CTICC was always just an incorrect placeholder.

**Client instruction (Brad, 2026-08-24):** "The show's venue never changed. We just had the wrong venue in the beginning. We must take any reference to the venue changing off the website, please."

**Why this is complex:** The narrative framing appears in multiple layers:
- Six live prose fields on the Sanity `showVisitorInfo` singleton document
- The seed script (`scripts/seed-show-visitor-info.ts`) that populates fresh datasets
- The golden JSON file that acts as the seed script's copy-source
- Developer-facing documentation that quotes the old text verbatim
- Code comments explaining the research context

A simple find-and-replace risks leaving residue in one layer while missing another. This contract enforces byte-identical corrections across all three artifacts independently, plus automated checks that the live Sanity document actually received the patch (not just that the source code changed).

---

## The Changes

### 1. Six Live Prose Fields Corrected on `showVisitorInfo` Document

The live Sanity document (`_id: "showVisitorInfo"`, project `26yfbug4`, dataset `production`) had six fields rewritten to remove "changed" framing:

| Field | Before | After |
|-------|--------|-------|
| `researchLabel` | "Researched by the web team against the working venue — not yet confirmed by the show committee" | "Researched by the web team — not yet confirmed by the show committee" |
| `planIntro` | "Everything you need to get to the National Orchid Show and make a day of it. Travel and accommodation guidance below is our own research against the working venue; the show committee will confirm the final details." | "Everything you need to get to the National Orchid Show and make a day of it. Travel and accommodation guidance for the venue is still being put together; the show committee will confirm the final details." |
| `gettingThereIntro` | "The show venue has changed to the Stellenbosch Flying Club. Travel, parking and accommodation guidance for the new venue has not been worked out yet — the previous guidance was written for a Cape Town city-centre venue and no longer applies." | "Travel, parking and accommodation guidance for the Stellenbosch Flying Club has not been worked out yet. It will be published here once it is ready." |
| `parking` | "Parking arrangements have not been confirmed for the new venue." | "Parking arrangements have not been confirmed." |
| `accommodationIntro` | "Accommodation guidance for the Stellenbosch area is still being put together. The previous list was written for a Cape Town city-centre venue and has been removed rather than left to mislead." | "Accommodation guidance for the Stellenbosch area is still being put together." |
| `accessibility` | "Accessibility details have not been confirmed for the new venue." | "Accessibility details have not been confirmed." |

**How it was applied:** A one-off idempotent patch script, `scripts/fix-venue-never-changed-copy.ts`, modelled exactly on `scripts/fix-visitor-info-dates-confirmed.ts`, was written and executed by the orchestrator. It applies `.patch(VISITOR_INFO_ID).set()` calls for these six fields only, never using `.setIfMissing()` (which would silently no-op if already set). The script includes `--dry-run` and `--verify` flags for safe re-checking.

### 2. Seed Script Updated: `scripts/seed-show-visitor-info.ts`

The six fields in the `seedVisitorInfo()` function were updated to match the corrected text exactly. This ensures any fresh dataset seeded going forward will get the correct, change-free framing from the start.

### 3. Golden JSON Synchronized: `contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json`

The `showVisitorInfoDocument` section in the golden JSON was updated to hold byte-identical corrected text for the same six fields. This file serves two purposes:
- Copy-source validation for the seed script (they must always match)
- Separate assertion target for a contract check that never touches source code (never touches live Sanity either — read-only verification only)

### 4. Developer Documentation Updated: `docs/show-visitor-info-for-editors.md`

Line ~63 quotes the `researchLabel` verbatim for Lee-Ann (showing her what the Studio field displays). This line was updated from the old text to the new text so the documentation remains correct after the Sanity document changes.

### 5. Code Comments Corrected: `scripts/seed-show-visitor-info.ts`

Two code comments inside this file were rewritten to remove "venue changed" framing:

**Comment above `const CONFIRMATIONS` (lines ~207-211):**
- OLD: "...the travel/accommodation research done against the previous working venue no longer applies to the new one and has not been redone..."
- NEW: "...travel and accommodation research for the venue has not been done yet..."

**Comment above `const AIRPORT_ROUTES` (lines ~163-168):** ⚠️ **DELIBERATELY LEFT UNCHANGED** — see "Scope & Non-Changes" below.

---

## Scope & Non-Changes

### Deliberately Untouched: `AIRPORT_ROUTES` Comment

The comment above `const AIRPORT_ROUTES` still reads: "The venue changed from the previous working-venue assumption (a Cape Town city-centre convention centre)..." and includes the phrase "city-centre convention centre".

**Why it stays unchanged:**
1. It is protected as a negative control by `contract-venue-prose-residue.yaml`'s A10 assertion, which explicitly pins this exact block verbatim as a dated historical record of the CTICC research phase.
2. It is a `//` code comment, never rendered on the live website — Brad's instruction ("take any reference to the venue changing off the website") does not reach it. Removing it would be scope creep.
3. This contract's own `check-seed-script.sh` (A1) excludes exactly this block from its denylist scan before checking the rest of the file, preventing a false conflict with `venue-prose-residue`'s A10.
4. A detailed ruling appears in `contracts/golden/venue-never-changed-copy-fix-f1/README.md` "What this contract does NOT do" and in the corrected-fields golden file.

### Not Touched by This Feature

- **`nationalShowVenuePatch.venue.directionsNote`** in the golden JSON — a separate defect owned by `venue-prose-residue`'s own A13/A12 assertions. This contract has no authority to edit a field another contract's assertion explicitly protects. See the contract's README "Explicitly out of scope" for the full reasoning.
- **All `showFaq-*` documents** (live and golden) — verified clean by independent queries; already correct, listed as negative controls (A4) so a regression is caught.
- **`docs/show-visitor-info.md`** and forward-looking descriptions in `docs/show-visitor-info-for-editors.md` — text like "when the committee confirms the real venue, you change it once..." and "if it ever changes again in 2030" describe the Studio mechanism's general capability, not a claim that the 2027 show's venue changed. These are explicit negative controls so this fix cannot accidentally strip real documentation.

---

## Contract Assertions & Verification

The contract (`contract-f1.yaml`) runs eight assertions, covering source code, golden files, live dataset, and future-proofing:

| Assertion | Scope | Verification |
|-----------|-------|---|
| **A1** | `scripts/seed-show-visitor-info.ts` contains corrected text (six fields + one code comment), no denylist phrases | `bash contracts/checks/venue-never-changed-copy-fix-f1/check-seed-script.sh` |
| **A2** | `contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json` holds byte-identical corrected text for same six fields | `python3 contracts/checks/venue-never-changed-copy-fix-f1/check_golden_json.py` |
| **A3** | Contract's own checks never reference `directionsNote` as a live assertion target (respects `venue-prose-residue`'s ownership) | `bash contracts/checks/venue-never-changed-copy-fix-f1/check-directionsnote-untouched.sh` |
| **A4** | Negative controls: four live `showFaq-*` documents and forward-looking doc language remain clean | `python3 contracts/checks/venue-never-changed-copy-fix-f1/check_negative_controls.py` |
| **A5** | `docs/show-visitor-info-for-editors.md` quotes the corrected `researchLabel` text, not the old text | `bash contracts/checks/venue-never-changed-copy-fix-f1/check-editors-doc.sh` |
| **A6** | READ-ONLY GET against live production Sanity document proves the patch script actually ran | `python3 contracts/checks/venue-never-changed-copy-fix-f1/check_live_doc.py` |
| **A7** | TypeScript compilation succeeds (proves patch script syntax is valid) | `npx tsc --noEmit` |
| **A8** | DENYLIST regex definitions are byte-identical across all four checker scripts (prevents drift bug) | `python3 contracts/checks/venue-never-changed-copy-fix-f1/check_denylist_conformance.py` |

**A6 is the critical live-dataset verification:** it reads the live document from Sanity production and confirms all six fields hold the exact corrected text, proving the patch script was actually executed against production, not just that source code changed.

---

## How to Re-Run Verification

If content ever needs re-checking or the patch needs to be re-applied to a fresh dataset:

### Re-verify Against Production
```bash
python3 contracts/checks/venue-never-changed-copy-fix-f1/check_live_doc.py
```

Requires:
- `SANITY_PROJECT_ID=26yfbug4`
- `SANITY_DATASET=production`
- `SANITY_API_TOKEN` (Editor token or higher) in `.env.local`

Outputs a structured result showing each of the six fields, whether it contains denylist phrases, and whether it matches the expected corrected text exactly.

### Re-Apply the Patch
```bash
# Dry-run first (reads-only, no writes):
npx ts-node scripts/fix-venue-never-changed-copy.ts --dry-run

# Apply the patch:
npx ts-node scripts/fix-venue-never-changed-copy.ts

# Verify it took:
npx ts-node scripts/fix-venue-never-changed-copy.ts --verify
```

The script is idempotent — running it multiple times against the same document is safe. It only calls `.set()` on the six named fields; other fields on `showVisitorInfo` are never touched.

---

## Coordination with `venue-prose-residue` Contract

This feature and `venue-prose-residue` (a separate contract) both touch some of the same Sanity fields (`parking`, `accessibility`, `gettingThereIntro`, `accommodationIntro`) but for completely different defects:

- **`venue-prose-residue`** removes CTICC-identifying phrases ("convention centre", "MyCiTi", drive-time claims, etc.).
- **`venue-never-changed-copy-fix`** removes change-framing narrative ("has changed to", "previous", "new venue", "working venue").

The corrected text in this feature contains zero CTICC-identifying phrases, so applying this fix cannot regress `venue-prose-residue`'s assertions. Both contracts' checks reference non-overlapping phrase lists and may be gated independently. If both are ever red simultaneously, apply them as separate patches to the same fields (not one combined rewrite) so each contract's diff remains attributable.

---

## Testing Notes

- **No new components or routes** — changes are content-only (Sanity fields, seed data, documentation).
- **Visual regression testing** — `/national-show/plan-your-visit` and related show-info pages should render identically except for the narrative reframing (no color, layout, or structure changes).
- **Negative controls** — the four `showFaq-*` documents should render exactly as before. The venue-change explanation in the `AIRPORT_ROUTES` comment should remain visually invisible (dev-only).

---

## Live Deployment Timeline

1. **2026-08-24:** Seed script, golden JSON, and documentation corrected in source.
2. **2026-08-24:** Patch script (`scripts/fix-venue-never-changed-copy.ts`) written and executed by orchestrator against production Sanity.
3. **2026-08-24:** A6 (live-document verification) confirmed all six fields updated on production.
4. **2026-08-24:** QA passed; Codex GPT-5.5 cross-model review passed; ready for contract gate.

---

## Links

- **Golden README:** `contracts/golden/venue-never-changed-copy-fix-f1/README.md` — detailed coordination rules, scope exceptions, and rationale
- **Corrected Fields:** `contracts/golden/venue-never-changed-copy-fix-f1/corrected-fields.golden.md` — exact before/after text for all six fields and both comments
- **Patch Script:** `scripts/fix-venue-never-changed-copy.ts` — model for future one-off Sanity patches on already-existing documents
- **Related Contract:** `contracts/golden/venue-prose-residue/contract.yaml` — CTICC-phrase removal (separate, non-overlapping defect)
- **Dataset Mutation Safety:** `contracts/golden/dataset-mutation-safety.golden.md` — incident record explaining why contracts never write to Sanity
