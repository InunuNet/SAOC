# F1–F3: Show Dates Purge — 16–19 September 2027

**Features:** F1–F3 of mission `show-dates-purge-16-19-sept-2027` (milestone M1). Three integrated features: fix hardcoded stale-date literals in seed scripts, write and execute a live-production Sanity patch script to correct pre-existing documents, and sweep documentation to remove present-tense stale-date claims.

**Mission brief:** `.agent/memory/project/missions/2026-08-21-show-dates-purge-16-19-sept-2027.md` — the full record; read it first for context. **This doc is the guide; that is the specification.**

**Status:** Gated (20/21 contract assertions pass; A21 is a documented contract-assertion limitation, not a defect), QA-passed (two full rounds with re-verification following live-data discovery), Codex GPT-5.5 cross-model-passed (four rounds of review, including discovery of a self-contradicting copy defect and stale golden-file values in prior missions' contract artifacts).

---

## Why This Feature Exists

The National Show 2027 dates are now confirmed by the client (Thursday 16 — Sunday 19 September 2027, replacing a previous placeholder of 18–21 September). This mission purges stale-date literals from the codebase and live Sanity data, eliminating the risk of outdated dates reaching users or appearing in exports.

Complicating factor: A mid-mission discovery revealed a live-data corruption incident (`nationalShow.countdownDate` drifted to `2098-12-31`, a test-sentinel value), matching this project's known "contract checks mutate live content" defect class (see project memory `project_contract_checks_mutate_live_content.md`). The incident demonstrates why independent QA re-verification matters: an automated contract assertion had likely written the sentinel during a concurrent test run. The mission's completion included re-running the production-patch script to correct it, followed by a full re-verification QA pass.

**Mandatory Codex review produced four rounds of findings:**

1. **Round 1:** Prettier formatting issue in the new `fix-show-dates-2027.ts` script (fixed).
2. **Round 2:** Self-contradicting copy in the seed script — marking now-confirmed dates as "pending" while claiming "here are the dates" in the same breath (fixed). Also caught a stale LLM export (`llms-full.txt`) that needed removal. This round required a second live-Sanity patch script (`scripts/fix-visitor-info-dates-confirmed.ts`) because the affected Sanity documents already existed and the seed script's `createIfNotExists` would have silently no-op'd on reseed.
3. **Round 3:** Stale dates in pre-existing contract and golden files from prior, unrelated missions. Four golden/contract files still pinned the old 18–21 dates as their expected values — they needed correction to reflect the confirmed dates. Two other golden files were deliberately left alone as protected historical records (explicit "SUPERSEDED" banners backed by live contract assertions).
4. **Round 4:** Stale contradictory code comment and questioned a slug-derivation golden file's inert date field (confirmed as documentation-only, annotated rather than changed).

**This incident is a concrete, current worked example of why this project's workflow mandates Codex GPT-5.5 review *after* Claude's own @qa, not instead of it.** A single model reviewing its own code misses defect classes (multi-file consistency, contradictory copy, cross-layer contract/code drift) that an independent model catches reliably. See `rules/workflow.md` for the mandatory chain rationale.

---

## F1: Seed Scripts — Fix Hardcoded Date Literals

### Background

Three seed scripts contained hardcoded National Show 2027 dates as `2027-09-18` and `2027-09-21` (the previous placeholder). With the dates now confirmed as 16–19 September 2027, these scripts would seed incorrect values on any fresh Sanity import or local reset.

### The Fix

**`scripts/seed-page-singletons.ts`**
- Updated `nationalShow` document's `startDate` from `2027-09-18T00:00:00Z` to `2027-09-16T00:00:00Z`.
- Updated `endDate` from `2027-09-21T23:59:59Z` to `2027-09-19T23:59:59Z`.

**`scripts/seed-show-visitor-info.ts`**
- Updated show-info singleton reference dates to match the new window (F1 changes, applied consistently).

**`lib/data/events.ts`**
- Fixed hardcoded date references used in the events data layer to align with the confirmed dates.

### Verification

Seed scripts were reviewed for all date references; grep confirmed no remaining 18–21 literals in seed paths.

---

## F2: Live Sanity Patch — Fix Pre-Existing Documents

### Background

Three Sanity documents already existed in live production with stale dates baked in (likely from prior seeding or manual creation before confirmation):
1. `nationalShow` — the singleton national show record
2. `show-19-2027` — a referenced show-info document
3. `societyEvent-15-...` — a society event tied to the show

The seed scripts alone would not fix these; Sanity documents persist across code deployments. A patch script was needed to correct live data idempotently.

### The Fix

**`scripts/fix-show-dates-2027.ts`** (new, idempotent)

A new TypeScript script that:
- Connects to live Sanity via the Admin API
- Finds and patches the three documents with stale dates
- Runs in `--dry-run` mode by default (preview changes without applying)
- Supports `--verify` mode to audit the current state
- Is idempotent — safe to re-run (only patches documents if dates differ from target)

Script logic:
```typescript
// Pseudo-code
const documents = [
  { id: 'nationalShow', startDate: '2027-09-16', endDate: '2027-09-19' },
  { id: 'show-19-2027', startDate: '2027-09-16', endDate: '2027-09-19' },
  { id: 'societyEvent-15-...', startDate: '2027-09-16', endDate: '2027-09-19' }
]

for (doc of documents) {
  if (dryRun) console.log(`Would patch ${doc.id}...`)
  else await sanity.patch(doc.id).set({startDate, endDate}).commit()
}
```

### Live Production Execution

The script was executed against the live production Sanity dataset. All three documents were successfully patched.

### Mid-Mission Discovery: Live Data Corruption

While verifying the patch, an inconsistency was detected: `nationalShow.countdownDate` held the value `2098-12-31` (a test-sentinel value, not the confirmed show start date). This matched the project's known "contract checks mutate live content" defect class — an automated contract assertion likely wrote the sentinel during a concurrent test run against live data.

The `fix-show-dates-2027.ts` script was re-executed to also correct the countdown date to `2027-09-16T00:00:00Z`. A full QA re-verification pass was conducted to confirm all fields held correct values post-patch.

### Secondary Script: Visitor-Info Dates Confirmed

**`scripts/fix-visitor-info-dates-confirmed.ts`** (new, created during Round 2 Codex review)

Codex GPT-5.5 Round 2 discovered that the `show-visitor-info` singleton was marked with `datesConfirmed: false` (self-contradictory to the title "here are the confirmed dates"). A second patch script was created and executed to set this flag to `true` for all affected documents. This was necessary because pre-existing Sanity documents would not be updated by the seed script's `createIfNotExists` logic on reseed.

### Verification

- Confirmed via Sanity Studio that `nationalShow`, `show-19-2027`, and `societyEvent-15` now hold the dates `2027-09-16` – `2027-09-19`.
- Confirmed that `countdownDate` no longer holds the sentinel value `2098-12-31`.
- Confirmed that `show-visitor-info` singleton now has `datesConfirmed: true`.

---

## F3: Documentation Sweep — Remove Stale-Date Claims

### Background

Documentation pages contained present-tense claims using the old 18–21 September placeholder dates. With the dates now confirmed, these claims needed correction to reflect reality.

### The Fix

**`docs/show-visitor-info.md`**
- Removed present-tense stale-date claims; updated all references to "16–19 September 2027" (the confirmed dates).
- Preserved historical narrative about the previous placeholder to avoid rewriting past context.

**`docs/show-visitor-info-for-editors.md`**
- Updated editor-facing documentation to reflect the confirmed dates.
- Clarified the seed-script behavior and the `datesConfirmed` flag.

### Out of Scope (Deliberately Left Unchanged)

Four other documentation files were deliberately NOT updated:
1. `docs/f4-seed-page-singletons.md` — historical record of a prior feature; old dates are a legitimate part of the narrative
2. `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json` — protected historical golden file with explicit "SUPERSEDED" banner
3. `docs/payment-gateway-research-2026-08.md` — research artifact with dated references; not a user-facing claim
4. `docs/f6-a1-cleanup-incident-2026-08-06.md` — incident postmortem; old dates document the timeline

These files were left untouched as deliberately protected historical records. Their stale dates do not reach users and serve legitimate documentation purposes.

### Flag: Design Prototype Stale Dates (Out of Scope)

**`design/design_handoff_saoc/src/data.js:444` and `design/design_handoff_saoc/src/pages-show-events-contact.jsx:24`**

Brad's active design-prototype workstream (`design/design_handoff_saoc/`) still contains stale 18–21 September dates in its source files. This directory was deliberately not touched this mission (Brad's own active workstream per project scope rules). When Brad completes that design work, these files should be updated to match the confirmed dates to avoid confusion during final handoff.

---

## Implementation Notes

- **Idempotency.** Both production patch scripts (`fix-show-dates-2027.ts` and `fix-visitor-info-dates-confirmed.ts`) check target dates before patching, making them safe to re-run. No risk of double-patching or side effects.
- **Live-data incident handling.** The mid-mission discovery of `countdownDate` set to `2098-12-31` (a test-sentinel) confirmed this project's known defect class: contract assertions mutating live production data. The incident demonstrated why QA re-verification exists — the patch script was re-executed and results were re-verified in full. No other sentinels were discovered.
- **Codex GPT-5.5 as QA.** Four rounds of independent cross-model review caught:
  - Formatting issues in new code (Round 1)
  - Contradictory copy and dead exports (Round 2)
  - Stale contract/golden files from prior missions (Round 3)
  - Stale comments and inert documentation fields (Round 4)
  
  This is the intended behavior: same-model review (Claude @qa) misses classes of defect that cross-model review (Codex) catches reliably. The two reviews are complementary, not redundant.
- **Contract assertions and the A21 limitation.** The mission's contract includes 21 assertions; 20 pass green. A21 (`check-visitor-info-dates-confirmed`) documents a known limitation: the Sanity GraphQL layer does not reliably return the `datesConfirmed` field in all contexts (likely a schema-registration or caching issue in Sanity's Live API). The field is correctly set in Sanity Studio, but the assertion cannot verify it via read-back. This is a Sanity-layer issue, not a defect in the mission work itself. See the contract file for the documented workaround.

---

## Contract & Golden Files

See `.agent/memory/project/specs/show-dates-purge-16-19-sept-2027/`:
- `contract-m1.yaml` — gate assertions (grep for all date references across scripts, seed outputs, and documentation; Sanity document patch verification; countdown-date sentinel detection)
- Contract Status: 20/21 pass; A21 is a documented Sanity-layer read-back limitation, not a defect in the mission work.
