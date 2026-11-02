# SAOC Backlog

Organised by **priority and subject**, not by session. Rebuilt 2026-08-19 from a 2,677-line
session diary (pre-cleanup copy: `archive/backlog-2026-08-19-pre-cleanup.md`).
_Last compacted: 2026-10-07 by backlog_trim.py. Full history: git log on this file._

**Rules for this file.** One line of stale information here misleads every agent, every session.
Completed items are deleted, not ticked — git history is the record. Plan steps live in
`Plans/` and mission files, not here. `[verify]` marks an item whose status is genuinely unknown.

**Governing context.** The ticketing system is being rebuilt to the council's brief
(`Ticketing system overview - with details.docx`, Drive `1fegrT9UKObJ71tUjUme_kFtqieSOsYca`).
The approved plan is `Plans/valiant-squishing-thimble.md`. It supersedes older project
assumptions about ticketing: single-line checkout, terminal once-per-lifetime check-in, the
`attendeeName`/`attendeeEmail` pair, and single-ticket-type assumptions are all being replaced.
Do not scope work from an entry that contradicts it.

---

## Standing rules

- **Leave `branding/`, `design spec/`, `design/Claude Design HTML/` alone** (Brad, 2026-08-12).
  He is reorganising them by hand. Do not read, move, edit or "tidy" anything inside them.
- **`design/design_handoff_saoc/src/data.js:444` and `src/pages-show-events-contact.jsx:24`
  still carry the stale 18–21 September show dates** (found during `show-dates-purge-16-19-sept-2027`,
  2026-08-22) — deliberately left untouched, same reason as above (Brad's active design-prototype
  workstream, not this project's own missions to edit). Flag for him to sync once he's done with
  that workstream; not an action item for any SAOC mission.
- **No invented brand assets** — colours, logos, type, semantic feedback colours. Ask Brad.
- **Scope = SAOC only.** Not WOSA (separate developer), not Athanor R&D. Dogfood the harness and
  file every harness bug upstream at `InunuNet/Athanor` rather than working around it silently.
- **Never drive a PayFast test from the local server.** `SITE_URL` is unset locally and falls back
  to `https://saoc.co.za` (the old Joomla site), so the ITN is delivered there and the ticket sits
  `reserved` forever. Use the deployed host for payment testing.
- **Local dev:** `pnpm dev:secure`, not `pnpm dev`. Chrome auto-upgrades `.co.za` to HTTPS.
- **PR-review-before-main is standing for all three lanes** (Brad delegated, 2026-09-10). No
  lane pushes straight to `main`, including docs-only changes: branch → PR → the *other* lane
  reviews → one approving review → merge. No self-merge. The design lane's own workspace repo
  (`/Users/vetus/ai/SAOC NOS Design`) is out of scope — it holds their session record, not
  deliverables.
- **Primary navigation is frozen** until Brad picks a dropdown layout (2026-09-10).
  `components/chrome/nav-config.ts`, `Header.tsx`, `MegaMenu.tsx`, `MobileMenu.tsx` are
  off-limits to the NOS build lane's M4. `components/show/ShowSectionNav.tsx` is **not**
  frozen — it's a content pattern (R21) and belongs to the NOS lane. Open recommendation on
  the table: Layout 3 (full-width sheet, all three Show groups at once) — Brad hasn't picked.

---

## Next up (queued, not yet a mission — dispatch as soon as current mission closes)

- [ ] **[P3] Brad wants a training session covering the harness's available hooks and … → [details](data/p3-brad-wants-a-training-session-coverin.md)

- [ ] **[P1] A14 re-verification after deploy** (site-content-alignment M1-M2, 2026-09… → [details](data/p1-a14-re-verification-after-deploy-site.md)

- [ ] **[P1] Send Lee-Ann the 11 questions** in
  `.agent/memory/project/specs/site-co… → [details](data/p1-send-lee-ann-the-11-questions-in-agen.md)

- [ ] **[P2] Brad's unruled design question** (site-content-alignment, 2026-09-10) — the handoff's
  `SKILL.md` prescribes literal bracket-placeholders + sage/mono "TBD" blocks; shipped components
  use bordered mono badges instead. Unresolved; do not decide it.

- [ ] **[P2] `/national-show` renders zero status markers** (site-content-alignment, 2026-09-10) —
  cause untraced (correct fail-closed suppression vs. a wiring break). @qa flagged rather than
  assumed; needs investigation.

- [ ] **[P3] `prettier --check` warns** on the 4 files touched by site-content-alignment F3
  (2026-09-10); not wired into CI.

- [ ] **[P3] A15 assertion-shape audit** (site-content-alignment, 2026-09-10) — check … → [details](data/p3-a15-assertion-shape-audit-site-conten.md)

- [ ] **[P3] Rename `contracts/checks/menu-system-layout4-f8/check-logo-source-resolut… → [details](data/p3-rename-contracts-checks-menu-system-l.md)

- [ ] **[P3] Dead `GOLD_BONE`/`GOLD_BLURB` residue in `e2e/mega-menu-layout4-visual-fidelity.spec.ts`**
  (menu-system-layout4 F8, 2026-09-21) — confirmed dead (`GOLD_BLURB` isn't even a colour;
  it's old CTA copy). Two eslint warnings. Trivial cleanup.

- [ ] **[P3] Non-ASCII Basic Auth credentials never authenticate in `proxy.ts`**
  (be… → [details](data/p3-non-ascii-basic-auth-credentials-neve.md)

- [ ] **[P3] Pre-existing `next/image` warning on `components/chrome/Header.tsx`**
  (… → [details](data/p3-pre-existing-next-image-warning-on-co.md)

- [ ] **[P2] Pre-existing triad baseline hash drift**: `verify_f2_baseline_hash_consistency.py`
  exits 1 on `contracts/contract-policy-pages.yaml` → [details](data/p2-triad-baseline-hash-drift-contract-po.md)

- [ ] **[P3, design question for Brad] Mobile drawer Tickets rail is SAOC dark green, not
  NOS royal-purple like desktop** → [details](data/p3-mobile-drawer-tickets-rail-colour-que.md)

- [ ] **[P3] A18 mobile check ran at 606px (Chrome floor), not real 390px**
  → [details](data/p3-a18-mobile-check-ran-at-606px-not-390.md)

- [ ] **[P1] Harness friction: `execution/gate_sweep.py --sandbox-dir` is jointly unsa… → [details](data/p1-harness-friction-execution-gate-sweep.md)

- [ ] **[P2, needs Brad] Auto-memory entry `project_show_dates_placeholder` may be par… → [details](data/p2-needs-brad-auto-memory-entry-project.md)

- [ ] **[P1] Sibling checker has the identical stale-`ctaHref` bug F9 just fixed, curr… → [details](data/p1-sibling-checker-has-the-identical-sta.md)

- [ ] **[P1] Scheduled CI has failed daily since 2026-09-12 — `/national-show/workshop… → [details](data/p1-scheduled-ci-has-failed-daily-since-2.md)

- [ ] **[P1] TWO unparseable contracts — their assertions have never run**
  (found 20… → [details](data/p1-two-unparseable-contracts-their-asser.md)

- [ ] **[P2] `ticketing-purchase-pages-f3/check-seed-category-field.mjs` hardcodes a s… → [details](data/p2-ticketing-purchase-pages-f3-check-see.md)

- [ ] **[P2] Focus ring fails the 3:1 non-text contrast floor on two vendor forms** (m… → [details](data/p2-focus-ring-fails-the-3-1-non-text-con.md)

- [ ] **[P0] No enforcement for the "never cd" rule — agents keep prompting the operat… → [details](data/p0-no-enforcement-for-the-never-cd-rule.md)

- [ ] **[P0] Harness `backlog_trim.py` deletes open items without archiving them** (fo… → [details](data/p0-harness-backlog-trim-py-deletes-open.md)

- [ ] **[P1] Migration script write-polarity — decision needed, not fixed overnight** … → [details](data/p1-migration-script-write-polarity-decis.md)

- [ ] **[P2] `POST /api/contact` needs a test-mode guard or mocked mailer before autom… → [details](data/p2-post-api-contact-needs-a-test-mode-gu.md)

  cannot go green without declaring triad coverage** (mission `verification-triad-gate`, M2/F2 —
  DONE 2026-09-06; M1/F1 was DONE 2026-09-04). Original ask (2026-09-02, Brad, via team lead):
  today's `.claude/rules/workflow.md` mandate (Codex + BrowserAgent-on-deployed + gws-read-only)
  was enforced only by an agent having read the rules file, exactly the gap that let the
  `SITE_URL`/`hosted.app` defect reach a green gate. F1 (2026-09-04) built the mechanism:
  `browser_deployed_check` and `gws_inbox_check` as first-class contract assertion kinds, plus
  `execution/verify_triad_coverage.py`. **F2 (2026-09-06) closes the gap**: `contract.py`'s
  `gate_cmd()` now runs `_run_triad_coverage_preflight()` after `_preflight_residue_guard()` and
  before `_gate_dispatch()`, hard-blocking a non-grandfathered UI/workflow contract missing any
  triad kind (`TRIAD_ENFORCEMENT_EXIT_CODE=6`) and failing closed on any linter-infrastructure
  error (`TRIAD_PREFLIGHT_ERROR_EXIT_CODE=7`) — deliberately the opposite fail posture of the
  dataset-residue guard, since the linter has zero external dependencies. Existing noncompliant
  contracts are grandfathered via `execution/triad-baseline-exempt.txt` +
  `execution/triad-baseline-exempt.sha256` (re-arms on edit). The `phases_raw`/`phases`
  false-negative in `iter_assertions_with_shape()` is also fixed (it now reads the real
  author-written `phases` key, not the post-normalisation-only `phases_raw`). See
  `.agent/memory/project/specs/verification-triad-gate/contract-f2.yaml` for the five binding
  architect decisions and `docs/verification-triad-gate.md` for usage.

- [ ] **[P0] Triad-coverage classifier is dodgeable by URL-shaped assertions** (missio… → [details](data/p0-triad-coverage-classifier-is-dodgeabl.md)

  **Filed upstream as Athanor#1420** (2026-09-08, mission `ticketing-complete`) with a second,
  independent confirmation of the same root cause going the other direction: keying on the
  literal substring `app/` misclassifies in BOTH directions, not just the URL-shaped dodge
  above. It EXEMPTED the Playwright e2e harness (F7, 49 Playwright references, drives real
  browser specs against the deployed site — exactly what the triad exists to verify) and the
  screenshot-embedding contract (F8), while BLOCKING the nav rebuild (F6) only because two of
  its nineteen assertions happen to run `grep -c` on `app/globals.css`. Net effect on this
  mission: none of its six contracts carries a triad assertion of any kind, and four of them
  gated green having never been asked to. HARNESS-owned (`.agent/update-manifest.yaml` marks
  `execution/` wholesale, no per-file carve-out), so filed upstream rather than patched locally
  per `.claude/rules/athanor.md`. Offered a PR pending upstream's choice between widening the
  signal list (URL patterns, Playwright/browser-test references, etc.) and adding an explicit
  `ui:` contract declaration that opts a contract in without relying on text-sniffing at all.

- [ ] **[P1] `contracts/cms-loop-f1-cdn-purge.yaml` A1 mutates the real Sanity dataset… → [details](data/p1-contracts-cms-loop-f1-cdn-purge-yaml.md)

- [ ] **[P2] `CLAUDE.md`'s "Verification triad gate" section is now factually stale an… → [details](data/p2-claude-md-s-verification-triad-gate-s.md)

- [ ] **[P1] Upstream PR to InunuNet/Athanor: `template/execution/contract.py` does no… → [details](data/p1-upstream-pr-to-inununet-athanor-templ.md)

- [ ] **P0 — Working-process review (INTERACTIVE — Brad at the keyboard, not agent wor… → [details](data/p0-working-process-review-interactive-br.md)

- [ ] **[P2] Restore the deferred legacy-order check for stand pricing tiers** (deferr… → [details](data/p2-restore-the-deferred-legacy-order-che.md)

- [ ] **[P2] Register Society — society profile intake + registration flow** (added 20… → [details](data/p2-register-society-society-profile-inta.md)

- [ ] **[P3] `docs/f5-day-selection-attendees.md:29`'s UTC+2 explanation is factually wrong**
  (pre-existing; found by Codex GPT-5.5 during `show-dates-23-26-sept-2027`, 2026-10-06).

- [ ] **[P3] `docs/b4-national-show.md:57` describes a removed `TARGET_MS` literal**
  (pre-existing; found during `show-dates-23-26-sept-2027`, 2026-10-06).

- [ ] **[P2, needs Brad] `design/design_handoff_saoc/README.md:141,200` still say the … → [details](data/p2-needs-brad-design-design-handoff-saoc.md)

- [ ] **[P3] A26-style single-fetch `browser_deployed_check` assertions can flake** — … → [details](data/p3-a26-style-single-fetch-browser-deploy.md)

---

- [ ] **[P3] Leftover "previous venue's values" comment at `scripts/seed-show-visitor-… → [details](data/p3-leftover-previous-venue-s-values-comm.md)

- [ ] **[P1] @docs Haiku tier defect / sync-regeneration risk.** Standing decision (20… → [details](data/p1-docs-haiku-tier-defect-sync-regenerat.md)

---

- [ ] **[P1, needs Brad] Rotate the `FIREBASE_ADMIN_PRIVATE_KEY` service-account key**… → [details](data/p1-needs-brad-rotate-the-firebase-admin.md)

- [ ] **[P3] `contract-f2.yaml` A13's prose still describes the old discovered 4-target set**
  (`beta-password-wall` M1/F2 retry-1, 2026-10-06). Fold in the correction at the next edit; the
  sha256 pin depends on it.

---

## Blocked on the council / Lee-Ann

- [ ] **[P1] Ticket prices and capacities — estimate now, correct later (Brad's standi… → [details](data/p1-ticket-prices-and-capacities-estimate.md)
- [ ] **[P1] Refund and cancellation terms — draft real content ourselves for her to r… → [details](data/p1-refund-and-cancellation-terms-draft-r.md)
- [ ] **[P1] POPIA Information Officer — placeholder decision made 2026-08-21, needs i… → [details](data/p1-popia-information-officer-placeholder.md)
- [ ] **[P1] All three policy pages carry an "AI-generated draft, not legal advice" notice** and
  need professional legal review before the council relies on them.
- [ ] **[P1, commercial — Brad's call] Spec V3 scopes TWO websites**, not one: a perma… → [details](data/p1-commercial-brad-s-call-spec-v3-scopes.md)
- [ ] **[P1] Spec V3 §8 is a 13-question list for INUNU** (CMS, filtering, bookings,
  notifications, archiving). Several already have answers in our codebase. Worth a written reply.
- [ ] **[P1] Stellenbosch visitor travel content.** Every CTICC-anchored travel sectio… → [details](data/p1-stellenbosch-visitor-travel-content-e.md)
- [ ] **[P1] Ticketing source document changed on 2026-08-26 (same day as the vendor d… → [details](data/p1-ticketing-source-document-changed-on.md)
- [ ] **[P1, council-blocked] Two vendor-registration contradictions between the writt… → [details](data/p1-council-blocked-two-vendor-registrati.md)
- [ ] **[P2] Two vendor-registration form ambiguities need Lee-Ann's answer before the… → [details](data/p2-two-vendor-registration-form-ambiguit.md)
- [ ] **[P2] Vendor Terms & Conditions document does not exist.**
  `VendorPaymentFiel… → [details](data/p2-vendor-terms-conditions-document-does.md)
- [ ] **[P2] National Show brand model.** Brad's unconfirmed hypothesis: a stable mast… → [details](data/p2-national-show-brand-model-brad-s-unco.md)
- [ ] **[P2] Secure organisation-owned document custody.** Institutional records sit i… → [details](data/p2-secure-organisation-owned-document-cu.md)
- [ ] **[P2] Real Show copy has arrived and is not yet loaded.** `About - 2027 Nationa… → [details](data/p2-real-show-copy-has-arrived-and-is-not.md)

---

## Blocked on Brad (human action, not dispatchable)

---


---
_Slimmed 2026-11-02: sections from 'Ticketing — open work' onward moved to archive; open P1 headings: P1 — F1's computed early-bird pricing engine has ZERO runtime call sites; P1 — the walkthrough exists TWICE, and the contract guards the copy Brad doesn't read; P1 — residue scanning proves a value is WRONG, never that it is VISIBLE; hydration-only; P1 — four contract families mutate LIVE data and rely on `finally`; SIGKILL skips `fina; P1 — BUILD: the visibility half of scan-dataset-residue.ts (design donated, ready to bu. Full prior text: `archive/backlog-2026-11-02-pre-slim.md` (grep-only)._
