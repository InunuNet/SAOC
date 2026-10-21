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

## Ticketing — open work (read `Plans/valiant-squishing-thimble.md` first)

**Category structure, per Lee-Ann's spec (Drive `1fegrT9UKObJ71tUjUme_kFtqieSOsYca`):
"Orchid Exhibition" (with Visitor and Exhibitor/Vendor ticket types), Conferences, and
Workshops/Field Trips/Cocktails are three distinct top-level categories, not variants of one
flow.** Status as of 2026-08-21: **Orchid Exhibition — Visitor is SHIPPED** — multi-line-item
cart, the five real admission products (Early-Bird/Day Visitor/Early-Bird Weekend/Weekend/VIP),
day selection, named attendees, checkout, PayFast payment, confirmation — proven with a real
end-to-end purchase against the deployed site 2026-08-21 (both positions correctly `paid`,
`chosenDay` correctly persisted). **Exhibitor/Vendor ticketing, Conferences, and
Workshops/Field Trips/Cocktails are NOT built** — vendor registration (a separate, already-
built flow for booth applications) is not the same as an Exhibitor ticket/pass. **Nav restructure
DONE 2026-08-21** (`ticketing-nav-restructure` M1, gate 8/8) — "National Show" is now the single
top-level nav item with a mega-menu whose Tickets column routes to a chooser page
(`/national-show/tickets`) plus direct Visitor/Exhibitor/Vendor sub-links; the ticketed-"Events"
vs. societies-calendar-"Events" naming collision is resolved by construction. Scoped to Exhibition
only — Conferences and Workshops/Field-Trips/Cocktails now have their own nav sub-links too (see
F4 below). **`ticketing-conferences-and-events` (Mission Two) is DONE IN FULL as of 2026-08-21** —
`.agent/memory/project/missions/2026-08-21-ticketing-conferences-and-events.md` has the closeout
for every feature; mission `status` is `done`. M1 (F1 Conferences + F2 Workshops/Field-
Trips/Cocktails estimation/structure) and M2 (F3 purchase pages, F4 nav wiring, F5 checkout) are
all complete, 5/5 features. F2's known future item — a structurally-safe interim fix (resized
capacity constants) for a real oversell defect Codex GPT-5.5 caught (multi-head products and
shared capacity pools not modelled by the checkout's per-slug-only capacity enforcement) — is now
CLOSED: F5 shipped the real fix (multi-head- and shared-pool-aware capacity enforcement via
`planPooledCapacity()` in `lib/checkout-reservation.ts`) and restored the real physical ceilings
(200/200/60/60) that F2's interim numbers (100/50/30/30) had conservatively capped below.
Workshops themselves (the per-session structure) remain unpriced/unbuilt pending a real
council-confirmed session list — deliberately out of scope for this mission, not a gap in it.

**F3 (Build category-aware Conferences and Workshops & Field Trips purchase pages) is DONE as of
2026-08-21** — Conferences and Workshops & Field Trips now have real purchase pages/routes,
reachable from the nav chooser (`/national-show/tickets`) and directly
(`/national-show/conferences`, `/national-show/workshops`). Needed three defect-repair cycles
(a real production-data hazard, a seed-script gap, and an import-safety hazard — see the mission
file's Closeout — F3 note for detail) before shipping. **F4 (extend the mega-menu's Tickets
column with Conferences and Workshops & Field Trips) is DONE as of 2026-08-21** — gate 8/8,
@qa PASS, Codex GPT-5.5 PASS, `components/chrome/nav-config.ts` extended by append only, no
structural changes to Header/MegaMenu/MobileMenu. **F5 (checkout support for Conference and
Workshop/Field-Trip/Cocktail ticket types, plus the real pooled-capacity fix deferred from F2) is
DONE as of 2026-08-21** — contract gate 17/17 green, needed FIVE independent real defect-repair
cycles (cross-slug pool oversell; an inactive-sibling pool leak plus a UI sold-out display gap;
a coverage gap in the architect's own proof artifact found by @qa-apex; a shared-validator
integer/fractional bug on `capacity`; a cross-show pool-name-collision gap in
`ticketTypesByPoolQuery`) — see the mission file's Closeout — F5 for the full account and
`learned.md` for the reusable lessons. **This closes out Mission Two — no items remain in M2.**
**`national-show-menu-restructure` M1 (F1+F2) is DONE as of 2026-08-21** — contract gate 21/21
green, @qa PASS, Codex GPT-5.5 PASS. Fixed Brad's live-tested complaint: the National Show
mega-menu's Tickets column now sits alongside a new "About the Show" column (What to Expect,
Plan Your Visit, FAQ, Archive — previously confirmed-live but unreachable from any menu), and
`/national-show/exhibitors` plus the exhibitor chooser card on `/national-show/tickets` now
carry honest "not yet open" static messaging instead of reading as a silent purchase dead end.
See `docs/f1-national-show-menu-restructure.md` and `learned.md` for the reusable two-column-
flat-over-nested-submenu pattern.

---

## Security & admin auth

  `admin-session-refusal-log-enforcement`) — `contracts/checks/admin-session-refusal-log-enforcement-f1/`
  now runs a real refused POST /api/admin/session round trip and asserts the `classifyRefusal`
  reason/email log line actually fires, plus that refusal detail never leaks to the response.
  Gate passed 5/5, Codex GPT-5.5 clean after one fix round.
  server with an empty/unset/whitespace-only/trailing-comma `ADMIN_EMAIL_ALLOWLIST`. Residual risk
  is low (`parseAllowlist()` is a deterministic trimmed split) but this is exactly the
  secret-corruption defect class: an empty allowlist fails closed for everyone and is
  indistinguishable from a working gate from outside. Assert both that everyone is refused and that
  the `parsed length: 0` log line appears.
  ~24 per-show `manager` grants exceed it. The operator gets a raw `auth/claims-too-large` with no
  advance warning.
  refusal now produces.
  are behind Firebase Auth, so no browser agent can verify them render — only Brad can see these
  pages. Candidates: a narrowly-scoped rotatable test account, or a CI-only gate-bypass token never
  valid for production traffic.
  than returning false (`lib/admin-auth.ts:170,199` — no try/catch). Not exploitable: the shipped
  `resolveShowWindowLookup` catches internally and can never throw. Any future route that
  hand-rolls a `ShowWindowLookup` must catch internally or wrap at the boundary.
  `hasCapability()`'s default is `() => null`. New routes must call `resolveShowWindowLookup`, pass
  `{ now, lookupShowWindow }`, and land with their own wiring check. Not a task; the convention.
  Separately: `checkin`, `tickets` and `export-csv` admin routes call no capability check at all —
  the checkin one is the documented deferral above; the other two are pre-existing.
  name. Needs a custom `authDomain`.
  manual single-operator CLI.

---

## Accessibility & UI defects

  only, not live render.** `form-error-contrast-remaining-components` F1 (2026-08-24/25) applied the
  fix, but its error branch is unreachable today only because no current Sanity conference/workshop
  ticket type has `requiresDaySelection: true` set — a content fact, not a code guard.
  `CategoryTicketsPage` (used by `/national-show/conferences` and `/national-show/workshops`) CAN
  render `CartDayPicker` if an editor sets that flag on a multi-item category product. Recommend
  either a regression test forcing this path, or explicit documentation of the constraint, so it
  doesn't silently break if triggered later. Agent-actionable whenever picked up.
  contract identify real accent-contrast failures on live public pages. Remedy fully specified in
  `contracts/golden/wcag-accent-contrast/remedy.md`, deliberately not applied — it is a design-token
  decision. This is a live accessibility failure on public pages and should not sit indefinitely.
  2026-08-25 — investigation (mission `vendor-form-client-validation-gate`, F1) found the described
  defect did not exist in current committed source: `handleSubmit()` in
  `components/vendors/VendorRegisterForm.tsx` already runs client-side validation before the fetch,
  blocks on any error, and reuses the existing error-display path. No production fix was needed; a
  6-script Playwright regression-lock suite was added instead
  (`contracts/checks/vendor-form-client-validation-gate-f1/`) to prevent the defect from being
  reintroduced. Gate 7/7 PASS, QA PASS, Codex GPT-5.5 clean. Docs:
  `docs/vendor-form-client-validation-gate.md`.
  2026-08-25 — mission `vendor-boothcount-guarded-parse` (F1) routed `boothCount` through
  `toOptionalInt()` in `lib/vendor-register-form-payload.ts:117`, matching every other numeric
  field. A check suite covering all 4 historical Codex findings was added under
  `contracts/checks/vendor-boothcount-guarded-parse-f1/`. Gate 11/11 PASS, QA PASS (independently
  re-verified all 4 findings), Codex GPT-5.5 PASS. Docs: `docs/vendor-boothcount-guarded-parse.md`.
  the form while genuinely trying to fix it gets locked out. (The human-readable countdown itself
  was fixed in `f7c5f6f`; the 45-minute lockout on a form this error-prone is the remaining issue.)
  Two BrowserAgent tests were blocked by this and remain unrun: the exact error-banner text repro,
  and one clean valid submission.
  ~~checkboxes has `required`, and the client wouldn't block on it regardless. A screen-reader user is
  told the group is required; nothing backs that up.~~ Resolved as a side effect of the
  `vendor-form-client-validation-gate` mission (client + server now genuinely enforce
  at-least-one-category). `vendorcategory-aria-required-enforcement` mission (2026-08-25) added a
  regression-lock Playwright check suite (`contracts/checks/vendorcategory-aria-required-enforcement-f1/`)
  to keep it that way — no production source changed by that mission, check suite only.
  text/number/email/tel/url/textarea input relies on a barely-perceptible border-colour shift with
  `outline: none`. Checkboxes, radios, submit and nav links are correct; isolated to text inputs.~~
  Fixed 2026-08-25 via `vendor-form-input-focus-indicators` mission F1 — shared `inputClass` in
  `components/vendors/VendorFormField.tsx` now carries
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2
  focus-visible:ring-offset-ivory`. Gate 5/5 pass, QA PASS, Codex GPT-5.5 PASS. See
  `docs/vendor-form-input-focus-indicators.md`.
  `businessName` with no truncation or warning) **and no `pattern` on the phone field** —
  `type="tel"` accepts `"not a phone number !!"` verbatim.~~ RESOLVED 2026-08-25 via
  `vendor-form-maxlength-and-phone-pattern` mission F1 — per-field `maxLength` added across all
  25 fields (`VendorFormField.tsx` + the five fieldset components) and a phone format validator
  (`^(?=.*[0-9])[0-9+\-() ]{7,20}$`, requires at least one digit) wired identically into the client
  validator, the server validator, and the HTML `pattern` hint. Gate 8/8 pass, QA PASS, Codex
  GPT-5.5 found and confirmed the fix for a whitespace-only bypass mid-mission, re-ran clean. See
  `docs/vendor-form-maxlength-and-phone-pattern.md`.
  tracking-[0.16em]` across five shared components. Contrast passes at 5.24:1 — the problem is
  11px + uppercase + 1.76px letter-spacing combined, not colour. Brad found it genuinely hard to
  read at length, and he is the decision-maker, so this is authorised, not invented brand work.
  First check whether the treatment is scoped to the vendor components or shared site-wide; a fix
  must not silently diverge the vendor form's typography from the rest of the site. Recommendation:
  keep the mono/letter-spacing character, drop `uppercase` for sentence case.
  **DONE 2026-08-25** — treatment was NOT vendor-scoped, it was site-wide (30 files/40
  occurrences, no shared label component). Fixed site-wide per the item's own constraint above.
  Gate 5/5 pass, QA PASS, Codex GPT-5.5 PASS after two real fix rounds (broken contract-check
  scripts, not the production fix). See `docs/vendor-form-label-readability.md`, commit 574238f.
  list-mode wrapper has no `focus-visible:ring-*` class and falls back to the default browser outline.~~
  Fixed 2026-08-25 via `tickettypecard-focus-ring` mission F1 — list-mode `<Link>` now carries the same
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2`
  token set as the stepper buttons. Gate 4/4 pass, QA PASS, Codex GPT-5.5 PASS. See
  `docs/tickettypecard-focus-ring.md`.
  Flagged as non-blocking during the F1 focus-ring QA pass, not a real defect — the inert
  `opacity`/`soldOut` styling works but doesn't carry a semantic disabled state. Low-priority
  forward-looking cleanup, not urgent.

---

## Vendor registration

  need a cleanup decision before real vendors use the system** (found 2026-09-01, session
  close-out). IDs: `JZfHPoxnTSMytCzQgxib`, `UhUGhAjrdRrrl1LSrVDw`, `hi2Figor34cBTwqq76Wm`,
  `rWSrLFyINIxn3uVSo2gg`, `injKWpwqvHjOgsVRO6Ye`. Two share the slug `demoorchidnursery`, two
  share `zzqslugcollisiontestnursery` — deliberately created to exercise the P0 shared-slug
  defect below. Delete, or mark clearly as fixtures, before go-live.

  "No vendor applications have been submitted yet" while the page actually lists full
  REGISTRATIONS.** Reads as a bug when it is telling the truth about the wrong noun. Found
  2026-09-01, session close-out.

  Found 2026-09-01 while building the `vendor-flow-notifications` contract — the notification
  emails had to point review links at flat list pages instead of a specific application's detail
  view, because that route does not exist.

  and possibly more.** Found 2026-09-01 by `QA_E2E_VendorFlow_Adversarial` during live E2E prep.
  `verify-code` matches candidates by normalized business name, and
  `recordFailedVendorRegistrationCodeAttempt` loops over EVERY matching candidate — so five wrong
  guesses against one vendor lock out every other approved vendor whose name normalizes to the
  same slug. Lockout has no auto-expiry (`VENDOR_REGISTRATION_CODE_LOCK_THRESHOLD = 5`,
  `lib/vendor-registration-code.ts`); only an operator reissue clears it. Externally triggerable
  by anyone who knows a business name — two "Orchid Nursery" vendors is not a hypothetical in this
  domain. **Open question that decides severity: can a CORRECT code for one record authenticate
  against a DIFFERENT record sharing the slug?** If yes this is an authentication bypass, not a
  nuisance. Answer that before scoping the fix. Likely fix: scope the candidate set by record id
  (the token/link already carries one), not by name.

  **ANSWERED 2026-09-01 (same session), from source — `lib/vendor-registration-code.ts:113-130`,
  `verifyVendorRegistrationCode`.** The caller fetches ALL approved applications matching the
  typed slug, then the function loops over every candidate and returns success for the FIRST whose
  stored `registrationCodeId` matches the typed 4 digits. Three consequences, in descending
  confidence:
  1. **The module's documented security bound is false.** Its own header claims "at most 0.05%
     chance before locking" (5 attempts / 10,000 values). With N approved applications sharing a
     slug, each guess is tested against N stored codes, so the real per-guess probability of
     authenticating as SOME vendor under that name is N/10000 — linear in N. The M4 golden
     README's "why two vendors can share a 4-digit code, safely" section reasons only about the
     rare case of sharing slug AND identical digits, and never accounts for the loop. A stated
     safety property that is untrue in ordinary operation.
  2. **Identity resolves to whichever record's code matched, not to who is typing.** Where a slug
     collision and a code collision coincide, a vendor authenticates into a stranger's
     application. Low probability, unbounded severity.
  3. **Lockout amplification** (the original finding): one vendor's wrong guesses burn every
     same-slug vendor's attempt budget, externally triggerable by anyone who knows a business name.
  NOT an authentication bypass in the strict sense — holding vendor B's code does not let you in
  as vendor A, because B's digits will not match A's stored code. Do not overstate it in the fix
  contract; claims 1 and 2 are strong enough and survive scrutiny.
  **Likely fix:** scope the candidate set to a single application id (the approval link already
  carries one) rather than to a name, and correct the documented bound. Live demonstration on
  two disposable same-named records was authorised and is pending.

  ~20 pre-existing Playwright checks across four already-shipped, closed mission contracts from
  ever reaching `/national-show/vendors/register` again.** Every one of these checks does a bare
  `page.goto('${BASE_URL}/national-show/vendors/register')` with no `?token=`; F7 now renders only
  the generic "This registration link is invalid or has expired." message on that path, so every
  `#vendor-register-<field>` locator times out regardless of what the check is actually trying to
  prove. Affected: `.agent/memory/project/specs/vendor-form-client-validation-gate/contract-f1.yaml`
  (6 checks), `.agent/memory/project/specs/vendor-boothcount-guarded-parse/contract-f1.yaml` (4
  checks), `.agent/memory/project/specs/vendorcategory-aria-required-enforcement/contract-f1.yaml`
  (3 checks), `.agent/memory/project/specs/vendor-form-maxlength-and-phone-pattern/contract-f1.yaml`
  (2 checks) — file lists in each yaml's `command:` lines. None of these four contracts are wired
  into `contract-vendor-gated-registration-flow.yaml`'s own gate (confirmed: `grep -l` across
  `contracts/*.yaml` for each check-directory name returns nothing), so this does NOT block that
  mission's demo gate — but leaving it unrecorded would repeat exactly the "silently unreachable
  is worse than red" mistake already flagged above for `ticketing-hardening/`.
  **Prescribed fix** (not built yet — deliberately deferred past the 2026-08-31 demo, this is real
  new engineering, not a same-night patch): a single shared seed/mint/teardown fixture helper,
  mirroring `door-test-qr-seeder`'s already-proven real-Firestore pattern (see
  `contracts/contract-door-test-qr-seeder.yaml`) — writes one recognisable-fixture
  `vendorApplications` doc (`status: 'approved'`, no `registrationTokenConsumedAt`, an
  obviously-fixture email like `fixture@vendor-registration-check.invalid`), mints a real token
  for it via `mintVendorRegistrationToken` (real `VENDOR_REGISTRATION_TOKEN_SECRET`, no emulator
  needed — this only needs a live Firestore write, not the HTTP-authenticated admin review route),
  hands each check `?token=<minted>` to navigate with, and tears the doc down after every run.
  Must also add the fixture's applicationId to `scripts/scan-firestore-residue.ts`'s exemption
  list the same way the door-test-qr fixtures are exempted — skipping that step would repeat the
  sentinel-corruption defect class already logged under "Contract checks mutate live content."
  **UPDATE 2026-08-31 (M4, `vendor-gated-registration-flow` F22/F23):** the gate mechanism named
  above no longer exists — the pasted `?token=` link was replaced by a two-field human-readable
  code entry (`?name=&code=`, e.g. "Fynbos Pottery-4821", see `app/(marketing)/national-show/vendors/register/page.tsx`
  and `VendorRegisterPage`'s `searchParams`), with `mintVendorRegistrationToken`/
  `VENDOR_REGISTRATION_TOKEN_SECRET` retained only as an invisible post-code-entry session cookie,
  not the thing a check would navigate with. The prescribed fix above needs rewriting against the
  new mechanism (seed a fixture `vendorApplications` doc with a known plaintext code, or call the
  verify-code route first to mint the session cookie and inject it, then `page.goto` the register
  URL) before it can be implemented — do not implement the token-URL version literally described
  above, it targets a mechanism this project no longer has.
  "when we ask for a document it needs to actually upload a document, save it and email it as an
  attachment." Affects `phytosanitaryPermitNumber`, `citesPermitNumber`,
  `foodHandlingCertificateNumber`. F7's proof-of-payment path is the pattern to extend (public
  unauthenticated upload, base64 in / Storage out, MIME allowlist, size cap, extension derived from
  `mimeType` never the caller's filename). `lib/email.ts`'s `sendEmail()` has no attachment support
  — Resend supports `attachments: [{filename, content}]`, so extend rather than replace. Open
  design questions: does upload replace the number field or sit alongside it; who receives the
  attachment; does it apply to all three fields. F9's "collected, not verified" stance should very
  likely carry forward regardless.
  A real fix validates against SA's actual CIPC format and the 10-digit VAT format (starts with 4)
  — but confirm the CIPC format from an authoritative source; do not guess a registration-number
  regex.
  rate limiting. Reasonable for low-volume B2B registration, not CAPTCHA-strength against a
  determined bot. Answered for Brad; no fix implied unless he asks.

  close-out; @architect's recommendation). Four Codex GPT-5.5 passes each found another instance
  of ONE defect class — a handler-deps object missing a key entirely, or reachable but its failure
  masked by a catch-all — spread across the notification-wiring work. Adopt as written: (a) extend
  a contracts-wide typecheck config to cover every fixture constructing a handler deps object,
  catching the "missing key entirely" class at compile time (3 of the 4 incidents); AND (b) a
  shared `makeVendorRegistrationDeps()` helper whose default `onEmailError` captures and asserts
  zero calls unless a test explicitly expects them, catching the harder "reachable-but-masked"
  class that typechecking alone would NOT catch. ~1-2 hours, additive to passing checks.
  Explicitly NOT recommended: a grep-based call-site assertion — proving field presence rather
  than runtime correctness is this project's own audited defect class (see "weak-assertion audit"
  entries below).

  failure** (found 2026-09-02, `vendor-flow-notifications` close-out). Production is likely not
  exposed to the missing-dep case that surfaced during that mission (real routes pass typechecked
  closures), but any programming error inside the real send implementations — a bad property
  access on a Firestore doc, a template-rendering bug — surfaces in logs as an ordinary Resend
  failure and would be dismissed as transient. Mitigation: rethrow `TypeError`/`ReferenceError`
  while still swallowing network/API errors, or tag `onEmailError`'s payload with an error kind so
  alerting can separate the two.

  occupies the project directory (found 2026-09-02, `vendor-flow-notifications` close-out; PID
  54163, ~24h old at close). Next.js 16 refuses a second instance regardless of port. Needs the
  dev server stopped and the check re-run; NOT killed here, deliberately, as it is the user's
  process — also logged to `.agent/memory/project/needs-human.md`.

  command that fails** (found 2026-09-02, `vendor-flow-notifications` close-out):
  `node --import tsx/esm` breaks on the `@/` path alias, while the gate itself actually uses
  `npx tsx`. Same import-path trap already documented in `docs/firestore-undefined-write-safety.md`
  — fix the comment to match what the gate really runs.

  email permanently.** In `lib/vendor-stand-payment-notification.ts`, the Firestore transaction
  commits `status: 'paid'` and only THEN sends the notification emails, post-commit. If the
  process crashes, times out, or is killed in the gap between those two steps, neither email is
  ever sent. A replayed gateway ITN cannot recover it either: the replay hits the
  `order?.status !== 'pending'` idempotency guard and returns early without rebuilding
  `paidNotice`, so nothing gets retried. There is no outbox, no sent-flag, and no reconciliation
  sweep for this path. Result: a vendor pays, the order is correctly marked paid, and neither the
  vendor nor the admin is ever told. Found 2026-09-02 by the mandatory Codex GPT-5.5 layer, same
  pass that found the F3 money-loss bug — high confidence.
  **Why not fixed now:** this is the pre-existing architectural pattern across the whole repo,
  including the ticket settlement path — not a regression introduced by the vendor receipt work.
  Fixing it properly means a durable outbox or sent-flags plus a reconciliation sweep, which is
  its own mission. Deliberately deferred, not overlooked.
  **Related existing work to build on:** `app/api/admin/reconcile-orders/` already alerts on
  orders stranded in `reserved` past expiry (see `docs/order-reconciliation.md`). The same
  shape — a scheduled sweep detecting settled-but-unnotified orders — is the natural way to close
  this without a full outbox; likely the cheapest first step.
  **Scope note:** affects the ticket path too, not just vendor stand payment — any fix should be
  considered repo-wide rather than vendor-only.

---

## CMS / content

  2026-07-30: Studio publish wrote to the dataset and `POST /api/revalidate` returned 200, but the
  App Hosting CDN kept serving its cached object (`x-nextjs-cache: STALE` alongside
  `cdn-cache-status: hit`, `s-maxage=31536000`, `age` climbing). Lead, unconfirmed: `x-fah-adapter:
  nextjs-14.0.21` reported against a Next 16 app. **Content edits have since propagated and been
  verified live over HTTP more than once**, so this may be resolved — confirm before scoping work,
  and do not assume the version gap is the cause.
  `['events']` only — no `'sanity'` tag, and `'events'` does not match the real document `_type`
  (`societyEvent`) a webhook payload sends. Event detail pages likely will not revalidate even once
  the CDN question is settled.
  (7 occurrences). Seeds must be create-if-absent; a re-run today silently overwrites edited
  singletons.
  (every write is `createIfNotExists`) but it is a stale source of truth if the dataset is ever
  rebuilt from empty.
  has no fieldset, `hidden` or `readOnly` condition, and `structure.ts` lists `show` as a plain
  type list. If an editor ticks Active on a past archive doc, `resolveActiveShow()` correctly fails
  closed to `null` — and `ticketTypeMatchesActiveShow()` then rejects EVERY ticket type for EVERY
  buyer with a generic 500. A sitewide sales outage from one mis-click, no warning, no alerting.
  Lee-Ann is the person who would hit this. Needs its own behavioural assertions — a Studio-side
  guard, not just the code-side fail-close.
  a reference. They match exactly today, verified — but a future edit to either silently diverges
  in front of buyers. Needs one document to be authoritative.
  three years they'll do a new show with a new venue — are we going to recreate all of this every
  time?" The venue fact lives in four dataset places plus four repo files; they agree only because
  they were written by hand in one sitting. What good looks like: one venue object as the single
  source with the edition doc and calendar event referencing it; venue-dependent prose recording
  WHICH venue it was written for so a change auto-flags it stale (this alone would have caught the
  CTICC bug — the current `confirmations.*` flags rely on a human remembering); and a documented
  show-rollover procedure that is a content operation, never a code change. Sequence after the
  design-alignment mission, which may move these surfaces anyway.
  (fetched, never rendered), `aboutPage.boardIntroText`, `judgingPage.stats` (hero headings are
  hardcoded JSX), `contactPage.formRecipients` (consumed by nothing), and `show.awards` (lost its
  rendered surface in the archive merge — no live effect today since all values are null). Delete
  or wire; do not leave as-is.
  no query and no `/members` route; `judge` has zero documents. Both need the same scope decision:
  build, or remove so they stop misleading editors. Related: the real Members Portal is a separate
  future build, and the spec leaves open how membership status is verified against SAOC's actual
  records — that needs a client answer first.
  home page's Upcoming Events strip always renders a blank host-society column. Content-entry task
  needing domain knowledge; the code side is correct.
  which is the direct cause of `/events/[slug]` being unverifiable in the M2 regression pass.
  Studio has a per-document "Generate" button. Other spot-checked gaps: `society` description/logo/
  website, `boardMember` email/photo, `sponsor` tier/logo/website/description, `show` date.
  documents that may not exist** ("there is one document — click it to open"). Either the documents
  are seeded or the guide needs a first-time branch. `[verify]` — seeding may have happened since.
  Submissions land in `contactSubmissions` and nothing tells anyone; they are visible only in the
  Firebase console. Real gap before launch — worth a small authenticated list view, same pattern as
  the door scanner.
  home/about/national-show, upcoming show details, a news block, contact details. Do NOT attempt
  full-site editability in one mission. Seed must pre-populate every new field from current
  hardcoded values so she starts with real content, not blank forms.
  at a 2012 archived show. Checkout fails closed, so this is wasted-editor-effort only. Add an
  `options.filter` scoping to `active == true`.
  `SANITY_API_TOKEN`** — reading webhook config needs `sanity.project.webhooks/read` (401
  confirmed). Contracts assert the direct revalidate call instead, which is a weaker claim.
  render in dev. Cosmetic console noise.
  Requires a research pass first: v6 changelog, next-sanity v13 breaking changes, App Hosting SSR
  compatibility, React 19 peer story, schema/Studio API changes. Do NOT upgrade blind.
  Alembic blocks `localhost` by design, so it only works against the live external URL — usable
  post-cutover only, and never in CI. `public/llms.txt` stays hand-authored.

---

## Contract & test infrastructure

  exist.** Pre-existing, found by @docs during `verification-triad-gate` M1/F1 (2026-09-04) while
  writing up the new `codex_qa`-sibling assertion kinds. Either write the missing doc or repoint
  the messages at the real source (`.claude/rules/workflow.md`'s Layer 1 section /
  `execution/codex_qa.sh` itself). Low urgency — cosmetic, not a functional gap.

  Found 2026-09-01 by an independent mutation-testing pass (`QA_Son5_M3-F1_RewrittenChecksAdversarial`),
  confirmed by Codex GPT-5.5 (`execution/codex_qa.sh`, exit 1) with identical file:line citations
  and no disagreement. `contracts/checks/vendor-gated-registration-flow-m3/check-initiate-is-transactionally-idempotent.mjs:60-68,88-98`
  claims to prove transactional atomicity/collision-safety on the stand-payment initiate route.
  Two mutations both left it GREEN: (a) disabling the in-transaction "already paid" re-check
  (`app/api/vendors/stand-payment/initiate/route.ts:175`) — a separate earlier non-transactional
  guard at :106-109 already covers the scenario the check exercises, so the transaction's own
  re-check is never isolated; (b) deleting `db.runTransaction()` outright and replacing it with an
  unconditional `.set()` — still GREEN, because `contracts/harness/route-runner/fixture-firestore.mjs`
  keys docs by `vendorSubmissionId` in a plain Map, so every write path converges to one document
  by construction. The "concurrent calls" race a self-overwriting Map key, not a lock. The check
  proves "doc id is deterministic," not "the write path is transactional" — zero regression
  protection against the bug class it names.
  **A correct rewrite needs** either a fixture that models a genuine lost-update race (track
  whether `.get()` reads go stale against a concurrent `.set()`, or assert `runTransaction` was
  actually invoked and its callback re-read state), or an assertion isolating the in-transaction
  re-check — seed the paid-transition to land BETWEEN the top-level pre-check and the transaction's
  own read, so only the in-transaction guard can catch it.
  A55, A61, A62 were mutation-tested in the same pass and all PASS — they die when their feature
  dies. A62's "disabling the already-paid guard alone stays green" is correct behaviour, not a
  check bug: the in-transaction re-check is genuine defence-in-depth and catches it.

  the `vendor-gated-registration-flow` work has no mission `.md` file at all.** As of 2026-08-31,
  `.agent/memory/project/missions/active.json` still points at
  `2026-08-25-vendor-registration-form-rebuild.md` checkpointed at `M2/F3`. But three real commits
  landed since then (`fd518136`, `67d63ff`+`e439827`, `5e3c9e6`) implementing a differently-scoped
  "gated registration flow" (apply → committee approval → human-readable code → full form) that
  pivoted away from that mission's original F1–F11 plan, tracked under its own M1/M2/M4 milestones
  reaching at least F22/F23/F26 (per agent dispatch names this session, e.g.
  `Arch_Son5_M3-F26_VendorStandPayment`, `Dev_Opu5_M4-F22_VendorHumanReadableCode`) — but no
  mission `.md` file for `vendor-gated-registration-flow` exists anywhere under
  `.agent/memory/project/missions/`, only two contract specs
  (`.agent/memory/project/specs/vendor-gated-registration-flow/contract-f1.yaml`,
  `contract-f22.yaml`). A resumed session reading `active.json`/`mission.py resume` today would
  reconstruct the WRONG picture of what's done. Needs: either author the missing mission `.md`
  file retroactively from the actual commit history and re-point `active.json` at it, or confirm
  with Brad that the pivot deliberately superseded the original rebuild plan and archive/close the
  old mission file explicitly rather than leaving it silently stale. Do not guess at the milestone
  numbering — read the four commits' full messages first, they document the M1/M2/M4 structure in
  detail.
  a pinned file changed for a reviewed, deliberate reason and the pin was never re-cut, so the
  assertion went quietly red. **The current content IS the intended baseline in both cases** — this
  is drift to catch up with, not a regression to revert. Each needs a re-pin ceremony: @architect
  authors the expected value, @dev never computes a pin, and it is never an in-passing edit.
  1. ~~`app/api/tickets/itn/route.ts` — four pins.~~ ✅ **Re-pinned 2026-08-20 by
     `payment-provider-seam` F2.** `discover_route_pins.py` found a FIFTH pin beyond the four
     originally listed here — a DIFF pin (`ticketing-hardening` A33) deriving its own NEW_SHA from
     the same expected file the ceremony itself validates against. All five updated to `09adc6fcab5eb9c0a67e57bb1dc5ae533aeecf815e84353594927baae19964a8`;
     `shasum -c` and `diff` all exit 0. A sixth orphan copy of the expected file survives at
     `golden/ticketing-f10-itn-repin/itn-route.expected.ts.txt` (prose refs only) — consolidation
     still deferred. See `learned.md` "payment provider seam" session entries.
  2. **`lib/orders.ts` — one pin.**
     `contracts/golden/production-blockers-f4-itn-check-repoint/orders-lib.golden.sha256` records
     `47c2e83c…`; the file hashes to `a8c8b416…`. Triaged 2026-08-19 to commit `31ee68c`
     "fix(tickets): write expiresAt onto the position, releasing abandoned seats" — the reviewed
     fix to the live capacity bug. Needs its own catch-up ceremony; explicitly **NOT** folded into
     `payment-provider-seam` F2, which does not touch this file.
  evening.** Nothing fails when a pinned file changes legitimately and the pin is not updated: the
  assertion goes quietly red in a place nobody routinely looks, and the contract corpus decays
  while still reporting green overall. All five were found by an architect who happened to be
  reading, which is luck, not a control. @architect is drafting a standing drift-detection check
  across ALL contracts. **This is worth more than any individual re-pin.**
  longer calls `writeReservationPair()` directly.** Both assert a *structural, source-level* shape
  ("`writeReservationPair()` called exactly once in `app/api/tickets/checkout/route.ts`, inside
  the transaction, after the idempotency guard"; "a `RECOVERY_TOKEN_SECRET` fail-closed guard sits
  textually before that call site"). Commit `6046bc0` (M2-F5, pooled-capacity checkout — predates
  `ozow-payment-provider`, unrelated) replaced the direct call with a `reserveTicket()` wrapper
  that calls it internally; confirmed via `git show 6046bc0:app/api/tickets/checkout/route.ts` —
  the direct call was already gone before Ozow's mission even started. Found 2026-08-22 by Codex
  GPT-5.5's full-mission-diff pass on `ozow-payment-provider` (which also found and fixed a real,
  in-scope regression in the same contract's A3 — a test fixture missing F2's new required
  `gateway` field — now fixed). A4/A5 need re-scoping to assert the same invariants (atomic
  write-inside-transaction, fail-closed missing-secret guard) against `reserveTicket()`'s current
  shape, not the pre-refactor one; not fixed here — out of scope for `ozow-payment-provider`,
  which never touched this call site.
  is correctly formatted and currently accurate — @architect's initial "drifted" report was its own
  false negative, self-corrected. The defect is that no assertion in any contract runs it: a green
  pin that has never been evaluated. Different problem from a decayed one, and **not fixable by
  drift detection** — the hash matches; nothing ever checks it.
  `make update-template`.** The fix for dropped `timeout_seconds` copying is shipped locally
  (8/8 green) but `make update-template` will silently revert it and reopen the fixture-leak
  vulnerability with no warning. Coordinates: `InunuNet/Athanor` → `execution/contract.py`, 4 edits
  (26 ins / 5 del). Detail: `docs/contract-timeout-enforcement-harness.md`.
  satisfiable by something that is not the real property. The 2026-08-16 audit cleared four
  contracts and found no live vulnerability; the sweep is not exhaustive. **2026-09-01, M2
  F14-F21: two more silently-rotted checks found by accident (not by any scheduled audit) —
  `vendor-f4-submissions-model/check-required-field-rejection.mjs` still asserted on `boothCount`
  after it was deliberately made optional, and `check-regulatory-fields-unvalidated.mjs` asserted
  against category values since renamed. Second time in one project this class of decay has been
  found by chance rather than by process — this audit deserves to actually get scheduled, not
  just stay queued.**
  longer has.**~~ ✅ **Retired 2026-08-20 by `payment-provider-seam` F2** — removed from
  `check-itn-behaviour-unchanged.sh` (suite hard-counted `EXPECTED_SUITE_SIZE=3` so a silent
  re-add goes red). Note: the original "proven pre-existing via differential" method was itself
  found unsound mid-mission (the check is nondeterministic on BOTH pre- and post-rewire code — a
  differential across a flaky check proves nothing whichever way it lands); the retirement instead
  rests on the deterministic probe (pre-rewire route + bogus IP + settle time → `status='paid'`
  anyway) and on `8476c56` predating the check's last touch. Four downstream contracts still
  reference the removed file's prose — repointed, not orphaned. See `learned.md`.
  anywhere under `docs/` and trips on the sentence explaining the field was removed (red since
  `e7de1e0`). A6 expects `m_payment_id` literally inside a route that now correctly delegates to
  `lib/checkin.ts`. Retire-or-rewrite with the `exit 77` / `SUPERSEDED:` pattern used on D5/D6.
  assertion satisfiable without the real property) and `contract-ticketing-hardening.yaml` A16
  (secret-leak regex evaded by indirection or multiline formatting).
  the literal `functions.auth.user().onCreate(` on one physical line; the real chain is split across
  lines, so only the JSDoc comment matches. QA proved it by swapping the whole trigger for a no-op
  HTTP handler — all four structural checks still passed. Not exploitable today (the behavioural
  checks genuinely exercise the emulator) but a future regression changing the trigger type with the
  comment intact passes silently. Strip comments before matching, or match the real multi-line shape.
  — it passes against a commented-out call and against an `addScope` on a dead branch. If Apple
  sign-in ever stops receiving emails, suspect this check first. A real fix needs AST parsing.
  bare-JSX interpolation of undefined (renders blank) and template-literal coercion of null
  (renders "null" — that exact regression shipped in `bcbbc03`, fixed in `cd0308d`). Widen to
  `null` plus a bare-`{boothNumber}`-as-JSX-child guard.
  SDK call rather than grep stdout for "reset link".
  "this Sanity field is rendered" via a plain substring grep are false greens — they pass a field
  that appears only in a fetch, destructure or type annotation. That is precisely the
  `aboutPage.title` bug. The correct check requires the field inside a real JSX interpolation,
  excluding `{/* comment */}`. Also assert no reversed fallback precedence
  (`'literal' ?? data.field`), which lets a hardcoded string mask a published edit. Reference:
  A48/A49/A50/A50a in `contract-ticketing-m1-m2.yaml`.
  `contracts/checks/admin-auth-hardening/server-ctl.sh` claims lock/refcount handling in its
  comments and implements none — one fixed PIDFILE on port 3400, so one contract's `stop()` tears
  down a server another contract is still using. Causes intermittent failures specifically in busy
  multi-agent sessions.
  fixtures.** A4 deletes the three seeded `DOOR-QR-*` docs to prove teardown is scoped, and never
  re-seeds — on 2026-08-17 that cost a live testing session and read as a scanner failure. A4 should
  re-seed after asserting, or the gate should print a loud warning. A check's side effects on shared
  live state are part of its contract.
  runs against a local server reading `.env.local`, so it cannot catch a secret declared locally and
  missing from `apphosting.yaml`/Secret Manager (the `ADMIN_EMAIL_ALLOWLIST` incident). Wants a
  post-deploy smoke assertion probing the live URL for the specific failure mode.
  `firebase apphosting:secrets:set`, read the secret back and assert SHA-256 digest match, exact
  byte length, and no leading/trailing whitespace. Four payload-corruption incidents in 16 weeks
  reached production undetected because no post-write verification ran. `gcloud` is NOT needed —
  the Firebase CLI's cached OAuth token has `cloud-platform` scope. Detail:
  `docs/secret-corruption-incidents.md`.
  (git-tracked, legacy) and `.agent/memory/project/specs/<slug>/` (recent missions). An untracked
  contract for the boothCount bug was independently redesigned from scratch by a later architect —
  two designs, same destination, divergent APIs — and nothing caught it: the gate only runs the
  contract it is pointed at, and @qa reviews within scope. Codex found it only because it reviews a
  diff. Decide on ONE canonical location, or document which is for what and have @architect check
  both. At minimum, contracts must be committed when written — an untracked contract is invisible to
  every tool and unrecoverable if deleted.
  `validate_cmd()` is never called from `check_cmd()`/`gate_cmd()` so rejected values still reach
  the runner; no upper bound (`999999999999` causes an unhandled OverflowError); the `is not None`
  edit is correct but uncovered by any assertion. Do not claim complete validation until fixed.
  `mission.py cmd_gate` and `contract.py` both pass a plain env copy, so the gate runs with an empty
  ref and fails for the wrong reason. Persist it or inline it into the assertion command.
  holding all 10 assertions for F1–F4, and no feature declares a `contract:` field — so gating M1
  evaluates F3/F4 assertions outside that milestone and skips F2 entirely. Split per feature.
  `dataset-residue-guard`, is advisory only; a broken push still merges. Remedy command recorded in
  `docs/dataset-residue-guard.md`.
  `check-paid-write-inside-transaction-scope.mjs` and
  `check-server-confirm-fetch-outside-transaction-scope.mjs` need no secrets and cost nothing, but
  run only inside the credential-gated `contract-payfast-m1.yaml` suite, which rarely runs. A job
  triggered on diffs to `app/api/tickets/itn/route.ts` or `lib/orders.ts` would have caught F4's
  entire staleness the day F10 merged instead of months later via audit.
  patch.** It asserts the `nationalShow` schema declares exactly its original six fields, so it is
  already red for a sanctioned reason — the visitor stream legitimately added `showEndDate`,
  `edition`, `hostRegion`, `venue`. While in there, decide whether to delete the now-unreferenced
  `check-exhibitor-stages-round-trip.mjs`.
  The seed script's venue was corrected; the golden was not. Owned by
  `cms-loop-f3-national-show.yaml`; A19 in `contract-venue-prose-residue.yaml` deliberately leaves
  it alone as proof that fix stayed scoped. Self-detecting on the F4 contract's next run.
  attribution was found and corrected (golden identity fields claimed as owned by a contract that
  never protected them); the audit was not exhaustive. This is the exact defect class — imprecise
  ownership claims narrowing a checker's scope — that let stale CTICC prose survive two green gates.
  but `'event'` is not a real schema type — it is `societyEvent`. No false pass today, but A2 never
  exercises the real name, so a regression filtering `societyEvent` out of the create-new menu would
  go uncaught.
  branch is actually proven by the `qrcode` library throwing on `''`, not by the guard's own
  `.trim()` — a mutant that removed the guard still failed A3 for the wrong reason. A whitespace-only
  ref would encode silently. Add a dedicated whitespace-only case only the guard rejects.
  `contracts/checks/f6-home-fidelity/` has Playwright checks with no assertions invoking them
  (@architect died mid-session). Either wire them or remove the files and the unused `playwright`
  devDependency.
  including an entire feature implementation. History truthful in content, lying in labels, and it
  races the orchestrator's staging. Gated off (`chmod -x`) 2026-08-18; needs a contract before
  re-enabling: label accuracy plus never staging outside `.agent/memory/`.
  appears to dedupe on git SHA. Workaround is POSTing directly to the App Hosting REST builds
  endpoint.

---

  scenario-1 comparison.** It checks `position.pf_payment_id` on both sides — F10 moved payment
  identity to `order.gatewayPaymentId`, nothing writes the position field, and
  `buildReservationDocs` initialises it to `null`. Both sides are null every run regardless of
  what the transaction does; unfalsifiable. Found during `payment-provider-seam` F2's suite sweep
  (same shape as the retired A18 above) but explicitly left for `contract-payfast-m1`'s own pass —
  its two sibling assertions in the same block still bind, so this is a single-scenario repair,
  not a block-wide one.
  `docs/payment-seam.md`, `docs/payfast-integration.md`, `contracts/golden/payment-seam-f1/*`.
  The real guard is now integer-cents (`AMOUNT_MATCH_TOLERANCE_CENTS`,
  `app/api/tickets/itn/route.ts:34`, `lib/payments/payfast.ts` for the adapter-side
  `grossAmountCents` parse) — the float-tolerance version it replaces accepted a genuine 1-cent
  underpayment. Docs task, not code.
  bug.** `otherActiveTicketTypeSlug` can pick a ticket type that requires `chosenDay`, which the
  check never supplies — pre-existing, confirmed to fail identically before and after
  `verify-reservation-release-path`'s changes (2026-08-24), so out of scope there. Needs the
  fixture selection to filter out `requiresDaySelection: true` types, or supply `chosenDay`.
  this environment.** Documented as already-known-red by `verify-reservation-release-path`
  (2026-08-24); not a regression from that mission's changes.
  `contract.yaml`'s `assertions`.** Nothing currently wires the suite into `mission.py gate`, so
  a break in it raises no alert — `verify-reservation-release-path` (2026-08-24) only caught the
  `_shared.mjs` postCheckout-payload staleness because its own F1 happened to depend on that one
  file. Needs a future mission to either wire the suite into an active contract or formally
  retire it; leaving it silently unreachable is worse than either.

## Code quality & housekeeping

  earlier. Deliberately not fixed piecemeal inside feature contracts (fixing 4 of 28 leaves the rest
  inconsistent). Decide whether to run `pnpm format` repo-wide in one pass and gate it in CI.
  `request.json()` uncapped; App Router has no default limit. Project-wide; wants one shared guard.
  `force-dynamic`** — same cloud-prerender trap class as `/admin/vendors` (fixed). Has built OK so
  far; verify before it bites.
  `logger.*`**, losing structured Cloud Logging fields on a security-relevant deletion audit trail.
  The v1 import never pulls in the `console.*`-patching shim, so `{uid, email, reason}` flattens
  into the text payload. Against this project's own structured-logging rule.
  Microsoft/Entra proper nouns in `docs/admin-access.md` are correct and must NOT be "fixed".
  "minimal stub, doesn't call Resend" state. The code genuinely calls Resend and generates real QR
  images; the comments actively mislead a reader.
  full-colour illustration that loses definition at 16px, while the site chrome uses a monochrome
  line-drawing disa — the tab icon and the header mark are not yet the same identity.

---

## Harness — upstream to InunuNet/Athanor

  `ERROR: …/OVERNIGHT-PLAN-2026-07-30.md has no YAML frontmatter`, scans nothing, and returns 0 —
  so any caller gating on the exit code reads a hard failure as success, and closure scanning has
  been silently non-functional here for an unknown period. Two defects: **the exit code is the one
  that matters** (an ERROR path returning 0 is the same "reports green while measuring nothing"
  class this project keeps hitting), and separately the scanner should skip non-mission files rather
  than aborting the whole directory. Fixing only the input hides the exit-code bug again. A second
  symptom seen 2026-08-17 (`ERROR: could not resolve --repo:`) appears transient/environmental.
  `.claude/settings.json` `permissionMode`. Filed 2026-06-16.
  `make update-template`. Filed 2026-06-16.
  (reads a plain `/Users/...` as recursive delete from filesystem root). Worked around with one
  relative path per command. Worth tightening if it recurs.

- **Athanor#1391** (filed 2026-09-06, verification-triad-gate M2/F2) — the `docs -> gate`
  handoff blocks every gate run repo-wide on an unrelated document's mtime; trivially
  satisfiable by `touch`, so it's a speed bump for a real bad actor but routine friction for
  everyone else.
- **Athanor#1397** (filed 2026-09-06, verification-triad-gate M2/F2) — `sandbox.md` instructs
  agents to clean up their own sandbox files on completion, but every command shape that does so
  either prompts the operator (unresolvable variable delete path) or is denied outright; hit
  twice while filing this same issue, since `check_autonomy.sh` pattern-matches the whole
  command string including heredoc body text, so a bug report that merely *quotes* a denied
  command is itself denied.
- **Athanor#1399** (filed 2026-09-06, verification-triad-gate M2/F2) — the protected-path deny
  on `CLAUDE.md` leaves factual documentation inside the agent instruction file permanently
  uncorrectable by any agent once it goes stale; see the `CLAUDE.md` staleness item above.
- **Athanor#1453** (hooks outside the 4 hard-coded folders are deregistered) and **#1456** (a
  `json_deep_merge` on `.claude/settings.json` during `make update-template` 3.8.1→3.8.5 wiped
  hook registrations 58→9 with no warning), both filed 2026-09-28. Repro and repair:
  `python3 execution/repair_hooks.py --root <project>` (additive, restores from git history —
  never `git checkout` the file, it discards real 3.8.5 changes too). Open decision, not yet
  made: the 16 harness files withheld from reconciliation (Makefile, 12 `.claude/agents/*.md`,
  `workflow.md`/`sandbox.md`/`coding.md`) with real local edits — need either merging forward
  or pinning in `.agent/no-update`; `.agent/version` stays at 3.8.1 until one happens. See
  `learned.md` 2026-09-28 entry for full detail.
- **[Athanor#1459](https://github.com/InunuNet/Athanor/issues/1459)** (filed 2026-10-06,
  beta-password-wall M1/F2) — `execution/browser_deployed_check.sh` is HARNESS-owned
  (`.agent/update-manifest.yaml:12-13` marks the whole `execution/` path HARNESS). Its own
  independent live re-check (`~line 188-189`, a bare `curl -s -o /dev/null -w '%{http_code}'
  --max-time 10 "${origin}${path_tested}"`) has no credential option at all, so it gets HTTP 401
  against a password-walled beta the instant this mission ships — breaking the live re-check leg
  of EVERY `browser_deployed_check` triad assertion across this whole project, not just this
  mission's own. Not patched locally per `.claude/rules/athanor.md`.
  **Workaround (verified 2026-10-07, F4 A22 went FAIL→PASS):** exporting the env vars does
  NOTHING — the bare curl never reads them. curl DOES read `$CURL_HOME/.curlrc`, so: write
  `user = "<USER>:<PASSWORD>"` (values from `.env.local`, never echoed) to the gitignored,
  mode-600 `.tmp/sandbox/curlhome/.curlrc`, then run the gate with
  `CURL_HOME=/Users/vetus/ai/SAOC/.tmp/sandbox/curlhome`. The re-check then genuinely
  authenticates and verifies a real 2xx. Manifests must also record the current HEAD SHA.

---

## Hosting — decision pending Brad

Research: `documents/hosting-research-2026-06-20.md`. Vercel has Cape Town compute but SA SSR needs
Pro ($20/mo); Fly.io `jnb` is best-value SA SSR at $8–15/mo but requires a Dockerfile migration;
"Coolify on Hetzner JNB" was a misconception (Hetzner has no SA DC). **Recommendation: stay on
Firebase until latency is a measured problem.** Brad to confirm whether SA compute is a hard
requirement, the budget ceiling, and that no migration happens before DNS cutover.

---

## Phase 2 — out of scope (do not work on until Phase 1 ships)

- Society individual pages, society admin logins, federated ticketing
- Paid SAOC membership (recurring billing) + members-only area
- Digital archive of *Orchids South Africa* yearbooks
- Donation system, sponsorship management, Google Ad Grant
- Learning library, judges training portal, articles/video
- Society-published `.ics` calendar feeds aggregated into the national calendar. Not scraping —
  `.ics` is published natively by Google Calendar, Outlook and Facebook Events, and the codebase
  already emits it. Needs a moderation step and a manual-entry fallback. Validate cheaply first:
  ask how many of the 21 societies actually keep one.
- Conference registration, workshops, field trips, the cocktail event, time-conflict detection and
  the admin reporting layer from the council's ticketing brief — later slices, deliberately not in
  the current plan.

---

## Closure Candidates (needs sign-off)

_None currently. `execution/gh_closure_scan.py` does not run to completion (see harness section);
`InunuNet/SAOC` last showed zero open GitHub issues._

  at /tickets). `earlyBirdCutoff` exists per ticket type today but is ONLY enforced server-side
  at checkout (409 if you try to buy after cutoff) — see docs/f4-admission-products.md line 88.
  Nothing hides cards on the /tickets page: Early-Bird Exhibition Ticket and Day Visitor Ticket
  (its regular-price equivalent) both show simultaneously right now, regardless of date. Two
  gaps:
  1. Once `earlyBirdCutoff` passes, the early-bird card should disappear (currently stays
     listed and only fails at checkout — bad UX, buyer gets to fill in details before erroring).
  2. While still inside the early-bird window, the paired regular-price ticket should be
     hidden/disabled too — right now a buyer could choose the pricier regular ticket during the
     early-bird window when only the cheaper early-bird option should be available. No pairing
     field exists between an early-bird product and its regular equivalent (matched only by
     category/description today) — needs either a schema addition or an agreed naming
     convention before this can be built correctly.
  Brad's proposed rule: early-bird tickets sold up to ~9 months before the show; after that,
  only normal tickets show. Recommendation (Claude, 2026-08-24): make this presentational,
  driven off the existing `earlyBirdCutoff` field, not just the checkout-time 409. Needs
  architect spec work on the pairing mechanism before @dev.

  REFINED 2026-08-24 (Brad, second pass): NOT a hide/show toggle after all —
  1. `earlyBirdCutoff` is already Sanity-editable per ticket type
     (sanity/schemas/documents/ticketType.ts:78, via /studio) — no new admin surface needed,
     Brad just didn't know it was already there. Confirmed, no action needed on this point.
  2. Display behaviour: once early-bird has closed, don't hide the early-bird card — GREY IT
     OUT instead, so visitors can still see what they would have saved by buying early (social
     proof / FOMO for the next show's early-bird window). Same idea likely applies to the
     regular-price card during the early-bird window (grey out + show early-bird savings),
     though Brad specifically called out the "closed early-bird, show what you missed" case.
  Still needs the pairing mechanism (early-bird ↔ regular ticket) resolved before @dev — no
  schema field links the two today, only category/description similarity.

  public checkout — DONE 2026-08-24, mission `gateway-picker-admin-only`, gate 13/13 + QA PASS +
  Codex PASS. `ProviderChoice.tsx` removed; admin-only `activePaymentGateway` Firestore setting
  added at `/admin/settings` (same `manage-payment-settings` capability gate as the Ozow sandbox
  toggle); checkout route resolves the gateway server-side only and fails closed (500) if
  unset/invalid — no client-supplied `providerId` is trusted for gateway selection anymore.

  `ticketing-flow-redesign` (F1-F3, both milestones gate-green: M1/F1 10/10, M2/F2 10/10,
  M2/F3 10/10), commit `6ae483b`. Delivered: (1) vertical ticket-type cards with real orchid
  photos (`public/images/orchid-{pink,purple,yellow,violet,dark}.jpg`), replacing the abstract
  geometric icons; (2) one dedicated buy screen per Admission ticket type
  (`/tickets/[slug]`) instead of a shared cart+buy button; (3) early-bird and regular merged
  into ONE ticket per type via a new `regularPrice` field + `resolveEffectivePrice()` — price
  changes at `earlyBirdCutoff` instead of two separate products, which supersedes and closes the
  "early-bird / regular ticket display gating" item above (that item's pairing-mechanism problem
  no longer exists — there is only one ticket per type now); (4) VIP price fixed R300 → R480 so
  it stays the top tier above Weekend Pass's R400; (5) Day Visitor per-day quantity picker
  (`DayQuantityPicker.tsx`) for buyers wanting tickets across multiple show days. QA found and
  fixed 3 real bugs across 3 QA rounds + 1 browser-verification round on F3 alone (shared-identity
  attendee data loss, interleaved-edit day-misassignment, stale validation message) — see
  learned.md "Cart/checkout UI needs multiple QA rounds, not one" for the detail. Live-dataset
  price migration script is written but dry-run only, not yet applied to production Sanity data.

  OBSOLETE — F1 of `ticketing-flow-redesign` merged early-bird/regular into a single ticket per
  type via `regularPrice` + `resolveEffectivePrice()`, so the pairing-mechanism problem that item
  was blocked on no longer applies. Leaving the original entry in place with this note rather than
  deleting, per this project's backlog-hygiene convention of not silently removing history — but
  no further action needed on it.

  F2/F3, not yet actioned:
  1. Focus-ring styling gap on the ticket-type card in list-mode (visible keyboard-focus outline
     missing/incomplete) — accessibility polish, not a functional bug.
  2. A migration script exists for the F1 `regularPrice` schema field's live-dataset rollout, but
     it's dry-run only — needs to actually be run against the live Sanity dataset once Brad signs
     off (see project_sanity_dataset_not_live memory: site is pre-production, safe to edit, but
     keep the careful method).
  3. Day-of-week/date labels in the Day Visitor per-day quantity picker are currently raw values,
     not friendly-formatted (e.g. "Thu 17 Sep" instead of an ISO date or raw day index) — cosmetic,
     not functional.

  2026-08-25: once a vendor application is approved by the council in admin (existing F6/F7
  vendor review workflow, app/admin/vendors), that approval should also make the vendor visible
  on the front end of the website as part of a public vendor database/directory — not just
  internal admin state as it is today. Not yet specced or built. Relates to the still-open
  vendor↔ticket-linkage question above (backlog entry same day) — worth resolving both together
  since both concern what "approved" triggers.
  Addendum, Brad 2026-08-25: the vendor registration form should also let the vendor upload a
  logo and possibly marketing/product photos, so the front-end directory entry shows imagery,
  not just text. Confirmed against the newer source doc (2027_SAOC_National_Show_Vendor_
  Registration_Form.docx) — its "Marketing" section already asks for a logo upload and photo/
  marketing-use permission, which the live 31-field form does not currently collect at all. This
  should be picked up together with the vendor-form rebuild against that document (see the
  line-by-line comparison note above) rather than bolted on separately.

  needs discussion with Lia before any build. Raised 2026-08-25. Current state: the two systems
  are fully disconnected — `vendorSubmissions` (booth application → admin review → manual
  approval/booth assignment) has no link to `orders`/`tickets` or any Sanity `ticketType`, and no
  exhibitor/vendor ticket category exists yet (nav entries are placeholder "not yet open").
  Brad's open questions, unresolved: (1) does a vendor/exhibitor need to complete registration
  AND buy a ticket, or does registering serve as the "application" for a ticket the council
  issues afterward? (2) should approval trigger SAOC sending the vendor a payment request/invoice
  rather than the vendor self-serving a straight checkout like a regular attendee? (3) if
  approval-gated, what happens if a vendor is declined after registering — refund/no-charge path
  needs defining. Do not build anything here until this is resolved with Lia — this is a
  commercial/process decision, not an engineering one.

  is stale, unrelated to `vendor-registration-form-rebuild` F2 — found and confirmed pre-existing
  2026-08-25 during F2's Codex-fix round. `field-spec.golden.json` was written when
  `buildVendorSubmission()` returned exactly 31 fields (Aug-18 creation commit); it now returns 86
  (31 original + 55 added since, mostly by F1 of this mission). A2 mechanically regexes the ENTIRE
  return-object literal with no code boundary separating public-form fields from admin/logistics
  fields the public form never renders (confirmed via A4, which renders the real fieldset
  components — dozens of the 55 added fields, e.g. gasCylinderSize/wasteTypes/
  hasPublicLiabilityInsurance, are never rendered by VendorRegisterForm at all). So the fix is NOT
  "fill in the golden's 55 missing entries" (that would assert something false about what the
  public form renders) — it's a scoping bug in A2's derivation logic itself: it should derive its
  "real keys" from `VendorRegisterFormState` (the actual public-form shape, currently 45 fields),
  not from `buildVendorSubmission()`'s full draft type. Needs an @architect pass to re-scope A2 (or
  split it: one check for public-form completeness against `VendorRegisterFormState`, a separate
  one — if wanted — for admin/logistics field coverage). Not blocking any current mission; this
  contract predates and is independent of `vendor-registration-form-rebuild`.
  Related, same discovery pass: `.agent/memory/project/specs/vendor-registration-form-rebuild/
  checks/fixtures/vendor-submission-f1-typecheck.ts`'s `oldMinimal` fixture (an archived snapshot
  proving "F1 made nothing newly required") now legitimately fails to compile because F2
  correctly made physicalAddress/emergencyContactName/emergencyContactCellPhone required. Not
  wired into Makefile/execution as a live gate, so it's not currently failing anything — but it's
  now a stale/misleading artifact and should be retired or annotated as superseded-by-F2 rather
  than silently left to rot.
  Also, pre-existing and unrelated to F2 (found same pass, not fixed): `vendor-form-ui`'s A4
  (`check-fieldset-render-completeness`) fails on foodHandlingCertificateNumber/foodItemList
  because its full-state fixture's `vendorCategory` never includes `'food-retailer'`, so those
  conditionally-gated fields never render in the check. Traces to the original Aug-18 commit, not
  introduced by this mission.

  `contracts/contract-ticketing-f4-admission-products.yaml` during the 2026-09-01 architect
  tooling audit (`node --import tsx/esm` -> `npx tsx` sweep). Verdict confirmed unchanged before
  and after the invocation switch — not caused by that fix, already broken:
  1. `A3` (`check-single-source-of-truth.sh`) — `scripts/fix-vip-and-weekend-pass-pricing.ts`
     re-types a price/capacity literal outside `lib/provisional-figures.ts` instead of importing
     `ADMISSION_PRODUCTS`, breaking the single-source-of-truth invariant. (The script itself also
     fails to run as a plain `node` script — `ERR_UNKNOWN_FILE_EXTENSION` on a bare `.ts` file —
     separate from the content issue.)
  2. `A6` (`check-checkout-wiring.sh`) — `app/api/tickets/checkout/route.ts` never references
     `isWithinEarlyBirdWindow()`; the early-bird cutoff is stored on the ticketType document but
     never enforced at checkout.
  3. `A8` (`check-admission-products-data.mjs`) — `ADMISSION_PRODUCTS` is missing the
     `early-bird-weekend-pass` product entirely, and `weekend-pass.price` is 380, not the
     expected 400. Likely tied to the still-open multi-tier ticket pricing work (see
     `project_gateway_deadline_august_2026` / Lee-Ann pricing artifact memory — pricing not
     fully landed as of this writing).
  None block any current mission's gate (this contract lives outside every currently-active
  mission's own contract). Confirmed via `contract.py gate --run-checks`; A9
  (`check-provisional-badge-gated.mjs`) in this same contract WAS fixed by the tooling sweep
  (was erroring on `@/` module resolution, now genuinely passes) — do not conflate that fix
  with these 3, which are real, separate, pre-existing content/wiring gaps.

  contract failures found and confirmed (via diff-stash re-run, failures identical before/after)
  during F2's QA sweep, 2026-08-25/26:
  1. `vendor-f6-review-workflow/check-capability-added-and-role-bundles.mjs` — CAPABILITIES array
     count/order drift, unrelated feature.
  2. `vendor-f5-register-route/check-env-scrub-effective.mjs` — env-scrub test-harness issue,
     unrelated to vendor fields.
  3. `vendor-f3-showcase-page/check-untouched-scope.mjs` — unrelated file-hash drift on the
     exhibitors page / tickets ITN route.
  4. `vendor-form-ui/check-fieldset-render-completeness.mjs` — missing labels for
     `foodHandlingCertificateNumber`/`foodItemList` (same pre-existing gap already logged above
     under "Contract decay, P2" for this contract's A2).
  None block any current mission's gate (each contract lives outside `vendor-registration-form-
  rebuild`'s own contract-f1/f2.yaml). Worth a dedicated contract-decay audit pass at some point —
  see the existing P1 backlog item "Audit remaining contracts for the weak-assertion defect
  class."
> Truncated 127 items at trim time (2026-09-01). Restore from git history if needed.
> Truncated 5 items at trim time (2026-09-02). Restore from git history if needed.
> Truncated 9 items at trim time (2026-09-02). Restore from git history if needed.
> Truncated 104 items at trim time (2026-09-04). Restore from git history if needed.
> Truncated 3 items at trim time (2026-09-06). Restore from git history if needed.

  | case | exit |
  |---|---|
  | `FAIL` verdict | **1** |
  | `PASS` verdict | **0** |
  | unparseable transcript | 1 (fails closed) |
  | empty codex output | 1 (fails closed) |
  | **`codex_qa.sh ... \| head`** | **0 — the pipe's status, not the wrapper's** |

  The last row is what was observed. `$?` after a pipeline is the *last* command's status, so
  reading the wrapper through `head`, `tee` or any pipe discards its exit code. The wrapper is
  correct: `execution/codex_qa.sh:100-115` derives the code from line 1 of the transcript, and
  `execution/contract.py:392-415` invokes it via `subprocess.run` with no shell and no pipe,
  reading the real status and distinguishing rc 2 (wrapper error) and unexpected rc as
  *inconclusive* rather than as a pass or a fail. **Nothing to file upstream.**

  Pinned so the belief is tested rather than remembered:
  `scripts/checks/verify-codex-qa-exit-contract.sh` (assertion A48) drives all five cases,
  including the pipeline case as a known fact.

  **The real lesson, which is worth more than the reported bug:** never read a verdict wrapper's
  status through a pipe. And a defect report against harness code deserves the same
  two-directional test as an assertion — filing this upstream would have wasted a maintainer's
  time and risked a "fix" to a script that was already right.

  Both had working-looking implementations. Both had golden text describing a stronger property
  than the code delivered. **A limitation that reads as stronger than it is does more damage than
  no limitation at all, because it stops the next person looking** — which is precisely why
  neither was found by review and both needed an adversarial probe.

  **For contract and golden authors, in addition to the content-assertion rule above:**
  1. State the guarantee at the strength the *weakest enforcing layer* provides, never the
     strongest. "Accidental misuse does not compile; deliberate misuse fails CI" is honest;
     "structurally impossible" was not.
  2. A CI grep or lint rule is materially weaker than a type error. Say which one is holding the
     line, per claim.
  3. Every escape hatch belongs in the limitations list the day it is written, not the day
     somebody exploits it. The `__unsafeUnwrapGatedProse` export was absent from a limitations
     list that enumerated five other weaknesses.
  4. A boundary check nobody has watched fail is not a boundary check. Commit the probe that
     proves it fires — and commit it somewhere tracked: `.tmp/` is gitignored, so a self-test
     reading a sandbox fixture passes vacuously on a fresh checkout, which is exactly where it
     matters.

## NOS M1 — open on resume (paused 2026-09-10 by operator)
- A39 source-verification fix is COMPLETE (content-linkage check in `lib/data/show-pages.ts`); gate not re-run.
- Linkage check correctly FAILS two seed sections whose body is @dev's prose but labelled `council-supplied`:
  - `content/show-pages/13-booking-tickets.json` § `categories`
  - `content/show-pages/18-contact-us.json` § `overview`
  Fix on resume: replace with a real excerpt from the source, else reclassify to `placeholder-ai`. Never loosen the 25-char/sentence threshold.
- Structure itself is frozen pending three-session sign-off (SAOC lead / NOS Site / NOS Design) + operator approval.

  **One measured sub-class is now closed out, 2026-09-08: vacuously-green negative assertions
  (a `!`-negated/absence-shaped check whose referenced file or directory doesn't exist, so it
  passes unconditionally, examining nothing).** Found and hand-fixed three live instances
  this session while authoring new contracts (`ticketing-complete/contract-f2.yaml`'s old
  A13, `contract-f7.yaml`'s first-draft A28, `contract-f8.yaml`'s first-draft A6/A10/A11) —
  enough to suspect the existing corpus was "probably riddled with" the same shape. Measured
  it instead of assuming: a mechanical, read-only sweep (`.tmp/sandbox/vacuity-audit/sweep.py`,
  left in place) over 208 contract YAML files (`.agent/memory/project/specs/**`,
  `contracts/**`, root `contract.yaml`) found 2128 total assertions, 189 negative-shaped, and
  exactly **1 genuine idle-debt hit**: `vendor-page-fixes/contract-f2.yaml` A6, which checks
  that `scripts/send-test-vendor-confirmation-email.ts` never logs `RESEND_API_KEY` — that
  script no longer exists on disk. That mission has no active owner; someone should either
  rewrite the script or retire the assertion, but this is not urgent and not part of any
  current mission's scope.
  The four contracts already logged above as failing from the vendor F2 QA sweep
  (`vendor-f6-review-workflow`, `vendor-f5-register-route`, `vendor-f3-showcase-page`,
  `vendor-form-ui`) were checked FIRST and explicitly excluded — confirmed their check
  scripts still exist on disk and they fail for real, unrelated, already-logged reasons
  (capability-array drift, an env-scrub harness issue, unrelated file-hash drift, missing
  labels), not this defect shape.
  **Conclusion: this specific sub-class is not widespread** — one hit out of 2128 assertions,
  not the systemic rot three same-night anecdotes suggested. The broader weak-assertion class
  (satisfiable-by-something-else generally, not just "path doesn't exist") remains genuinely
  unaudited and this P1 stays open for that larger question — this entry closes out only the
  narrower, now-measured vacuous-negative sub-class.

## P2 — VIP early-bird cutoff wrote the legacy constant, not the mission's own 90-day rule
**Filed 2026-09-08. Found by Codex GPT-5.5 cross-model review of the completed F2 diff;
independently verified before acting.** `scripts/migrate-f2-ticket-taxonomy.ts:206` writes
VIP's `earlyBirdCutoff` from `lib/provisional-figures.ts:64`'s legacy
`EARLY_BIRD_CUTOFF = '2027-07-31'`, while this mission's confirmed rule — 90 days before the
confirmed 2027-09-16 start — computes **2027-06-18** via
`lib/admission-early-bird-pricing.ts:deriveAdmissionEarlyBirdCutoffIso()`. Runtime price
selection (`lib/checkout-reservation.ts:resolveEffectivePrice()`) reads the STORED field, not
the engine, so a migrated VIP would sell at the R500 early-bird rate for 43 days past the
cutoff the mission confirmed.

**Another instance of the house defect class.**
`contracts/checks/ticketing-complete-f2/check-vip-computed-early-bird-price.mjs` proves the
pricing ENGINE returns {500,'earlyBird'} at the real cutoff — it never inspects what the
migration WRITES. The assertion is fully satisfiable without the property holding. The check
measured a proxy (the engine) instead of the target (the data the engine's answer is stored
against), which is the same shape as version-banner-vs-binary, interactive-shell-vs-runner,
local-`main`-vs-`origin/main`, and `getComputedStyle()`-vs-composited-pixels.

**Scope is wider than the finding stated.** `EARLY_BIRD_CUTOFF` backs ~7 entries: `early-bird`,
`weekend-pass`, and the conference early-bird SKUs — not just VIP. Both
`docs/ticketing-complete-f2-open-decisions.md` §2 and the published F8 walkthrough §3 frame
this as an `early-bird-weekend-pass`-only question, which understates the blast radius.
NOTE: `early-bird-weekend-pass`'s own mismatch is a DELIBERATE open escalation to Brad
(`goldens/f2-open-decisions.json`: "a migration that silently picks one destroys the evidence
a decision was needed") and must NOT be resolved as a side effect of fixing VIP.

## P3 — CI ratchet cannot see check scripts whose path is built by shell variable interpolation
**Filed 2026-09-08, found by @qa adversarial pass on F7 via a planted probe.**
`contracts/checks/_shared/run_contract_suite.mjs:~155` (`referencedCheckScripts()`) excludes
any matched path containing `$`, deliberately, to avoid false positives on
`contracts/contract-show-visitor-info.yaml`'s legitimate `for`-loops. Consequence: an
assertion declaring `node "contracts/checks/x/${F}.mjs"` where the script does not exist is
reported NOWHERE in ratchet mode — not missing, not fail, silently bucketed `not-evaluated`,
which the ratchet does not gate on. So a declared check that will never run is invisible to
CI permanently. QA confirmed this is NOT a gap for quoted paths, `&&`-chains, or subshells.
Being fixed as "print it, don't gate on it" — gating would fire on the legitimate loops.

## SEQUENCING — regenerate missing-baseline.json ONCE, and last
`contracts/checks/_shared/missing-baseline.json` commits `count:3` against F8's A9/A10/A15,
but a concurrent F8 session has since created `contracts/checks/ticketing-complete-f8/*`, so
live count is **0 missing of 2242** (verified 2026-09-08) and contract-f7.yaml's A27
(`--verify-baseline`) fails right now. This is the ratchet working as designed, not a defect.
The regeneration is mechanical (`--write-baseline`) but must run AFTER the F2 cutoff fix lands
with its new check script written, so it happens exactly once rather than twice.
`parseErrorCount: 2` is expected to stay — the two unparseable contracts
(`gate-timeout-fix/contract-f1.yaml`, `mission-slug-collision-fix/contract-f1.yaml`) are
separately logged and not part of this mission.

## P1 — F1's computed early-bird pricing engine has ZERO runtime call sites
**Filed 2026-09-08. Found while verifying an @architect claim during the F2 Codex repair —
not by any check, and not by the QA pass on F1 itself.**

`grep -rn "resolveComputedEarlyBirdPrice\|deriveAdmissionEarlyBirdCutoffIso" app/ lib/
components/ scripts/` returns **no hits outside `lib/admission-early-bird-pricing.ts` itself
and the check scripts under `contracts/checks/ticketing-complete-f1/` and `.../f2/`.**
Nothing in `app/`, nothing in `components/`, no API route, no server component calls either
function.

Runtime pricing goes exclusively through `lib/checkout-reservation.ts:resolveEffectivePrice()`,
which reads the STORED Sanity `earlyBirdCutoff` / `price` / `regularPrice` fields and never
consults the engine. So F1 built a pricing engine, wrote golden fixtures and check scripts
proving that engine correct, passed its gate — and never connected it to anything that sells
a ticket.

**This is the house defect class at FEATURE scale rather than assertion scale.** The whole
F1 feature is a proxy: proven correct in isolation, never wired to the target. Same shape as
version-banner-vs-binary and `getComputedStyle()`-vs-composited-pixels, but a whole feature
rather than one assertion. Every F1 check is green and honest about what it measures; none of
them measures whether the engine is REACHABLE from a purchase.

Consequence for F2's VIP repair: fixing the STORED value is the correct and sufficient fix for
the actual selling price, precisely because runtime reads stored fields. The repair is not
undermined by this. But F1's stated purpose — "replaces separately-priced early-bird PRODUCTS
with one computed discount any product can carry... never two independently hand-maintained
prices that can drift apart" — is not delivered in production behaviour, and the drift it was
built to prevent is exactly what the VIP defect turned out to be.

**Decision needed (Brad):** wire the engine into checkout (a real feature touching
checkout-reservation, cart pricing, and the ticket-type display path), or retire it and commit
to stored-field pricing with a check that the stored values match the 90-day rule. Do not
leave it half-built — an orphaned engine is a standing invitation to assume pricing is
computed when it is not.

**Process lesson for the gate:** no contract in this mission asserts that a newly-built module
is CALLED by anything. "Module exists and is correct" and "module is reachable from the
behaviour it was built for" are two different properties, and only the first is currently
checkable. Worth a standing assertion shape: for any new lib/ module a feature introduces,
prove at least one non-test call site in app/ or lib/.

**Re-verified and measured, 2026-09-08 checkpoint.** Re-confirmed the zero-call-site grep
still holds. Went further and measured what the "no engine, stored fields only" reality
actually prices, against `lib/provisional-figures.ts` (its own header calls it the single
source of truth): VIP 500/625 = exactly 20% (matches Brad's confirmed rule, but by
coincidence of the stored literals, not because anything enforces it), Weekend Pass 380/400 =
5%, Symposium 450/550 = 18.2%, Joint 750/900 = 16.7%. Only VIP happens to comply. Every F1/F2
contract check imports and exercises `resolveComputedEarlyBirdPrice()` directly, so none of
them would ever catch Weekend/Symposium/Joint failing the 20% rule — the checks are all
green and all pointed at the wrong object. Also confirmed the engine is not *entirely*
disconnected: `deriveAdmissionEarlyBirdCutoffIso()` (the cutoff-date half) IS called live from
`lib/provisional-figures.ts:87` to derive VIP's cutoff — only the price-computation half is
orphaned. A half-wired engine is easy to mistake for a fully-wired one; don't let the live
cutoff call site stand in for proof the price call site exists too.

## P2 — glob-built check-script paths are dropped entirely by the contract runner (same hole as interpolation)

**Filed 2026-09-08 by @dev at the team lead's instruction, traced by @architect and verified
independently. Log only — deliberately NOT fixed here.**

`classifyReferencedCheckScripts()` in `contracts/checks/_shared/run_contract_suite.mjs:237-238`
sorts a matched check-script path into `literal` only when it contains neither a shell glob
character nor a `$`, and into `interpolated` only when it contains a `$`. A path carrying a
glob and no `$` therefore matches neither branch and is dropped on the floor — not counted
`missing`, not reported in the `unresolvable` bucket, not visible anywhere.

This is the identical blind spot QA proved for variable interpolation, one category over. The
interpolation case was closed on 2026-09-08 by printing an ungated `unresolvable` bucket
(see `.agent/memory/project/specs/ticketing-complete/goldens/f7-README.md` §10 and
assertions A32/A33); the glob case was
consciously left open at the time because no live instance had been demonstrated, and this
project's own bar is that a reported class needs a concrete instance.

**The live instance now exists.** `contracts/contract-show-visitor-info.yaml` A76 loops
`for f in contracts/checks/show-visitor-info/check-<glob>.mjs` — its check-script reference is
glob-built and is invisible to `--list-missing` and `--check-ratchet` today.

**Scope of the exposure is scan mode only.** In full-eval mode (single-file runs) an unmatched
glob is passed through to node as a literal string, which fails loudly and self-detects as a
real `fail`. The hole is specific to the corpus scan the CI ratchet uses — which is also where
it matters most, because that is the run nobody reads line by line.

**Proposed fix (not implemented):** add a third `globbed` category alongside `literal` and
`interpolated`, triaged and printed in the same `unresolvable` bucket, with the same deliberate
decision NOT to gate on it — gating would fail CI on correct contracts whose loops iterate over
files that really exist. Needs its own contract and its own falsifiability proof; extending A32
to cover it would be the natural pin.

## P2 — superseded F4 golden is red on main and nobody owns it
**Surfaced 2026-09-08 by the F2 dev during the VIP cutoff repair; verified red BEFORE that
change, so it is pre-existing, not caused by it.**
`contracts/checks/ticketing-f4-admission-products/check-admission-products-data.mjs` fails with
7 failures against the current tree. It encodes a superseded F4 golden: it expects 5 slugs
including `early-bird-weekend-pass`, VIP at R300, and `provisional: true` — all three of which
later missions deliberately changed (VIP is now R625/R500 settled under Brad's 2026-09-08
ruling; `provisional` became per-value rather than per-file).

The F2 repair alters one of its failure LINES (`vip.earlyBirdCutoff` now reports 2027-06-18
instead of 2027-07-31) but does not change its pass/fail state. Left alone deliberately — it is
a golden question (which expectations are still authoritative?), not a code one, and it belongs
to no active mission.

**Decision needed:** update the F4 golden to the current authoritative figures, or retire the
check as superseded. Do not "fix" it by loosening assertions — this repo's whole discipline is
that a check which cannot fail is worse than no check. Note this is the same ownership shape as
the `vendor-page-fixes/contract-f2.yaml` A6 item already logged above: a real assertion whose
subject moved on, with no active owner to notice.

## P2 — SAOC base declares no semantic status colour tokens (success/warning/error)
**Filed 2026-09-08 by the NOS design session (mission nos-design-system) as a base-level
finding, not a NOS one. Every claim in their audit independently re-verified here before
logging — all exact.**

`app/globals.css` `@theme` declares **13 colour tokens, all identity** (primary/-800/-700/-100,
accent, accent-soft, parchment, ivory, bone, ink, muted, rule, rule-soft). There is no
`--color-success`, `-warning`, `-error`, `-danger` or `-info`.

Consequence: status colour is expressed ad hoc with raw Tailwind palette utilities —
**14 occurrences across 4 files** (`components/events/SubmitEventForm.tsx`,
`app/admin/settings/page.tsx`, `components/vendors/VendorMarketingFieldset.tsx`,
`components/vendors/VendorMarketingUploadField.tsx`), and **`text-red-600` (8) and
`text-red-700` (5) are both in use for the same meaning** — drift already present, not
hypothetical.

**How it surfaced, which is the interesting part:** NOS's design authority ruled that status
colour is functional and must never join a palette shift — "a brand that recolours its own
error states has stopped warning anyone." Going to honour that rule, they found there was
nothing to exclude. The guardrail was unenforceable because the thing it guards does not
exist. A rule with no referent reads as satisfied.

Mostly UNDER-coloured rather than miscoloured (32 files carry `aria-live`/`role="alert"`/
`role="status"` regions, most with no colour at all), which is why it stayed invisible.

**NOT ACTIONED, deliberately.** `app/globals.css` is main-site style, and the style freeze is
Brad's standing instruction (nav was the one sanctioned exception). A token change there has
real blast radius. NOS is declaring these in their own layer only and explicitly did not touch
the base — if the base later declares them, NOS's values collapse to overrides and nothing is
stranded. Nothing is blocked meanwhile.

**Their design constraints, worth adopting if Brad greenlights this:**
- Two tokens per state (on-light and on-dark) — one value cannot clear 4.5:1 on both grounds;
  hold hue constant across the pair and lighten for dark.
- Never colour alone: a word or icon must carry the state too, so a drifted hue degrades to
  ugly rather than to silent.
- Verify in the TRIGGERED state, not at rest, at 390 and 1280.
- Measure contrast at the composited pixel, never `getComputedStyle()` — Tailwind v4
  serialises opacity-modified colours as `oklab()` and regex-parsing it returns plausible,
  wrong numbers (InunuNet/SAOC#3). This is the same proxy-measurement class this project keeps
  hitting; see the F1 orphaned-engine and vacuous-negative entries above.

They offered their token values as a base proposal once approved on a rendered swatch sheet.
**Decision for Brad:** accept that offer and lift the freeze for a scoped token addition, or
leave the base as-is and let NOS carry its own.

## P2 — `make update-template` changed .claude/settings.json; one hook was REMOVED, uncommitted
**Found 2026-09-08 during the pre-commit residue scan. Not agent work — this is output from
Brad's own `make update-template` run, sitting uncommitted.**

`.agent/update-manifest.yaml:63` classifies `.claude/settings.json` as **MERGE /
json_deep_merge**, not HARNESS — so it is not replaced wholesale and local intent is meant to
survive. The diff is **86 lines changed, 84 of them deletions**, which is a lot for a deep
merge and deserves a human eye.

Two distinct changes, one good and one a behaviour change:
1. **Genuine fix:** `[ -f execution/hooks/full_boot.sh ] && bash ... || exit 0` became
   `[ -f ... ] || exit 0; bash ...`. The old form swallows a real failure from `bash` and
   reports success — the exact `|| true`-on-blocking-hooks trap `.claude/rules/hooks.md`
   warns about. The new form propagates the true exit code. Also de-duplicated a
   double-registered `full_boot.sh` entry.
2. **Behaviour change, unreviewed:** the `session_start_away_report.sh` SessionStart hook was
   REMOVED entirely. If the away report is still wanted, it is now silently not running. This
   is the kind of loss a deep merge is supposed to prevent, so it is worth confirming it was
   intended upstream rather than collateral.

Also uncommitted from the same run: `.claude/policies/autonomy.json`,
`.grok/policies/autonomy.json`, `.anti/agents.json` (24 lines),
`template/.agent/config/hook_probes.json`.

**COMMIT HYGIENE — acted on:** the ticketing-complete mission commit must be scoped to mission
files only (contracts/, docs/, lib/, components/, scripts/, e2e/, .github/workflows/ci.yml,
.agent/memory/project/specs/ and memory files). These config/template files must NOT be swept
into it — they are a separate concern with a separate reviewer (Brad), and burying a hook
removal inside a feature commit is how it stops being noticed.

Related to the already-logged 61 unreconciled harness baselines from the same run.

## P1 — the walkthrough exists TWICE, and the contract guards the copy Brad doesn't read
**Found 2026-09-08 while resolving a rendering question before redeploying the artifact.**

`docs/ticketing-complete-f8-morning-review.md` is guarded by SIX contract assertions (A6
screenshots, A10 open-decisions coverage, A15 figure citations, plus negatives A20/A21/A22 and
now A23/A24). Those assertions verify that every figure in the markdown matches
`lib/provisional-figures.ts` at runtime.

But the published artifact at
`https://claude.ai/code/artifact/e372cb8c-c062-4e8e-baed-d7e4961e2be5` is **not a render of
that markdown**. Reading it shows a hand-authored HTML page — its own `<title>`, an imported
Google font stack, a full set of CSS custom properties and a dark-mode palette, ~4.4MB with
the screenshots embedded. It is a second, independently-written document.

**So the figure-verification chain stops at the markdown.** Brad opens the HTML. The markdown
could be perfect and the HTML could still say VIP is R300 — nothing checks it. A15 could stay
green forever while the document he actually reads drifts arbitrarily far from the source of
truth.

**This is the house defect class again, and it undercuts a decision made earlier today.** When
@architect recommended keeping A10 pointed at the walkthrough rather than F2's open-decisions
doc, its stated reason was "the walkthrough is the document Brad actually reads and the one
that's Artifact-published" — which would be circular if the artifact isn't the markdown. The
recommendation is still right (of the two REPO files, the walkthrough is the better target),
but the premise that guarding it guards what Brad sees is false.

A2 partially discloses this: it says a shell assertion "can confirm a URL-shaped string is
recorded, never that the artifact is actually live and rendering correctly," and names the
residual gap in goldens/f8-README.md rather than pretending coverage. Honest, but it describes
a liveness gap, not a CONTENT-PARITY gap, which is the larger of the two.

**Remediation options, for a decision:**
1. Generate the artifact HTML FROM the markdown so drift is structurally impossible. Best fix;
   costs the hand-designed presentation unless the generator preserves it.
2. Add an assertion that reads the published artifact and diffs its figures against
   `provisional-figures.ts` the way A15 does for the markdown. Keeps the design freedom, needs
   network access in a check.
3. Accept the gap and document it loudly. Weakest, but honest — and strictly better than the
   current state where the gap is undisclosed.

Until this is decided, ANY redeploy of the walkthrough artifact must carry the markdown's
changes across BY HAND and be verified against `provisional-figures.ts` manually. The §3
rewrite from this session is exactly such a change and has NOT yet been carried across.

## P1 — residue scanning proves a value is WRONG, never that it is VISIBLE; hydration-only fields hide
**Established 2026-09-08 by the NOS design session, by measuring the rendered page rather than
reasoning from field names. It corrected my own impact assessment, which was wrong.**

During the 6-field sentinel incident, I asserted that corrupt `nationalShow.title` and
`.location` would have poisoned layout captures via wrapping/truncation. Measured, that was
false, and the true picture split three ways:

- **`title` — no visual impact.** Both occurrences on /national-show sit inside the
  `application/ld+json` block as `Event.name`. The visible `<h1>`, header lockup and card
  titles all rendered the real title (12 occurrences). Still a real defect, but a
  STRUCTURED-DATA one: for ~12 hours the page told crawlers the event was named
  `F3-TITLE-SENTINEL-1788824005021`. An SEO bug, not a content bug.
- **`location` — clean.** Rendered correctly (4 occurrences), no "CTICC" anywhere.
- **`countdownDate` — the only one that reached a glyph, and the only one no static check
  could see.** The SSR payload ships `00` placeholders, so a source grep AND a curl of the
  SSR HTML both clear it FALSELY. It is passed as a client prop to `ShowCountdown` and only
  after hydration does the days cell paint `26412` — 86px wide against 31-43px for its
  siblings. No clipping, no overflow, but ~30px of lateral shift in the hero countdown row.
  The real date gives a 3-digit count at ~55px, so any HERO GEOMETRY capture in that window
  measured a row that will never ship. Contrast and colour numbers are unaffected; geometry
  ones are.

**THE GENERALISABLE RULE:** `scripts/scan-dataset-residue.ts` correctly detects that a stored
value is wrong — that part works and is what caught this incident. What nothing currently
answers is whether a given residue hit is VISIBLE, and the answer cannot be obtained from the
source or from the SSR HTML. A field consumed by a client component is invisible to both.
`countdownDate` passed every static check and was the only field of the three that a human
would actually have seen.

**If the scanner ever grows an "is this residue user-visible?" signal, it must look after
hydration.** Same shape as `getComputedStyle()` vs the composited pixel, and as every other
proxy-measurement failure logged above: the SSR HTML is a proxy for the rendered page, and it
disagrees exactly where it matters.

Corollary for incident triage: never rank residue severity by field name. I ranked `title`
highest because it sounded most visible and it was the least; `countdownDate` sounded like
metadata and was the only one anybody could see.

## P1 — four contract families mutate LIVE data and rely on `finally`; SIGKILL skips `finally`
**Root-caused 2026-09-08 after the six-field sentinel incident. This corrects the initial
framing (mine): the residue was NOT one mission's fault.**

Tracing each sentinel prefix against `contracts/golden/dataset-residue-guard/marker-catalogue.md`
gives FOUR independent sources, not one:

| corrupted field | writing check |
|---|---|
| nationalShow title/location/countdownDate | `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` |
| aboutPage.boardIntroText | `contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs` |
| award-am-saoc.threshold | `contracts/checks/cms-loop-f4-orphaned-types/check-award-threshold-reaches-site.mjs` |
| societyEvent description | `contracts/checks/cms-loop-f2-event-tags/check-studio-edit-reaches-site.mjs` |

(`contracts/checks/show-visitor-info/` was wrongly blamed at first — it has its own
restoreGuarded/withDatasetLock checks but they target DIFFERENT fields: showVisitorInfo.parking
and nationalShow.venue/showDate/showEndDate/edition/hostRegion. Not these six.)

**THE ARCHITECTURAL DEFECT.** All four write a sentinel to the LIVE dataset, then restore in a
`finally` block. Signal handling is inconsistent — cms-loop-f3 traps SIGTERM/SIGINT only;
f6-prove-cms-loop traps uncaughtException/unhandledRejection and no OS signals at all;
cms-loop-f4 and cms-loop-f2 have zero `process.on(` handlers — but that inconsistency is a
side issue, because **no Node process can trap SIGKILL. It is OS-enforced and always skips
`finally`.**

All four sentinels landed inside a 3.5-minute window (23:31:05-23:34:49 UTC 2026-09-07) with
no residue alert logged anywhere and no surviving session. Sentinel written + zero cleanup +
zero alert + process gone, uniformly across four independent checks, is the signature of a
hard kill (OOM, quota/session termination, `kill -9`) — not an application bug in
`restoreGuarded`. A graceful SIGTERM would have been caught by at least the F3 checks and
produced a `residueAlert()` block. The silence is the evidence.

**So better signal handling CANNOT fix this.** Any design whose correctness depends on a
`finally` block running is unsound when the value at risk is live shared content. Real options:
1. Don't mutate live data. Point these checks at a scratch dataset or a disposable document.
   Best fix — removes the hazard rather than narrowing the window.
2. Write-ahead intent: record "about to corrupt field X of doc Y, prior value Z" to a durable
   journal BEFORE mutating, so a later run (or CI) can always roll forward to clean, with no
   dependence on the writer surviving.
3. A lease/TTL on the sentinel so a stale one is self-evidently expired and auto-restored.

The existing CI `dataset-residue-guard` job (daily cron) is DETECTION, and it worked — but it
detects at up to 24h latency and, per `project_contract_checks_mutate_live_content`, its alerts
go to a log nobody reads. This incident sat ~12 hours and was found only because a contract
gate's pre-flight guard refused to run. Detection is not the gap; SAFE MUTATION is.

**Restoration performed** (targeted patch/unset per field, never a reseed — a
`createOrReplace` from seed-page-singletons.ts would have wiped nationalShow's edition, hero,
hostRegion, salesOpen, showDate, showEndDate and venue, none of which the seed lists):
title/location/countdownDate from `scripts/seed-page-singletons.ts:212/214/216`;
award threshold `"80-89 pts"` from `scripts/backfill-award-fields.ts:42` (schema
`sanity/schemas/documents/award.ts:11` confirms type string); `aboutPage.boardIntroText` UNSET
per the seed's own comment; `societyEvent-10-midlands-orchid-show.description` UNSET — proven
correct from Sanity transaction history, which shows the doc has exactly two transactions ever
and `description` was absent from the pre-corruption revision entirely, so it was never
legitimately populated. Scanner verified ALL CLEAR across 149 documents.

## P1 — BUILD: the visibility half of scan-dataset-residue.ts (design donated, ready to build)
**Offered 2026-09-08 by the NOS design session, which built a working prototype this morning
to answer the countdown question and handed the approach over. Credit theirs; the item belongs
with the scanner, not with a restyle mission.**

The gap (established in the P1 entry above): `scripts/scan-dataset-residue.ts` proves a stored
value is WRONG. Nothing answers whether that hit is USER-VISIBLE, and the answer exists in
neither the source nor the SSR HTML — `countdownDate` was a client prop whose SSR payload ships
`00` placeholders, so a grep and a curl BOTH cleared it falsely while it was the only one of
three sentinels a human could actually see.

**The design, which is small — roughly thirty lines of Playwright:**
1. Launch headless, `goto` with `waitUntil: 'networkidle'`.
2. Wait ~1200ms for hydration to settle and any ticking component to render once.
   **This delay IS the mechanism** — everything measured before hydration is a false clean.
3. `page.evaluate()` a reducer that runs PAGE-SIDE and returns only trimmed text plus measured
   boxes — a few hundred bytes of JSON, never a DOM dump. Doing the reduction in the page is
   what makes it cheap enough to loop.
4. Loop over breakpoints (390 and 1280).

**The inversion that turns it into the scanner's other half:** instead of naming an element to
read, feed it the sentinel strings `scan-dataset-residue.ts` has ALREADY found, and have the
page-side reducer walk text nodes looking for them — returning which sentinels reached a glyph,
in which element, at which breakpoint. Scanner: "is this value wrong." This: "does anyone see
it." Together they let an incident be triaged by measurement instead of by guessing from field
names, which is exactly what went wrong in the 2026-09-08 triage (I ranked `title` most severe;
it was invisible, confined to `application/ld+json`).

NOT BUILT — deliberately out of scope for ticketing-complete, which is mid-gate. Needs its own
contract. Note the prototype lives in the NOS session's own scratchpad, OUTSIDE this project,
so it cannot simply be read from here; either have it dropped into the SAOC tree first, or
rebuild from the design above, which is complete enough to work from.

Related: the same session has adopted running the scanner at BOTH ENDS of a measurement pass,
treating its own geometry numbers as suspect if the dataset moved underneath it. Worth making
standing practice for any agent taking visual measurements against live content.

## Upstream: Athanor #1435 — hardcoded dev-server port in verification guidance
Filed 2026-09-10: https://github.com/InunuNet/Athanor/issues/1435
`.claude/rules/shell-paths.md` (HARNESS-owned) hardcodes localhost:3002 in its Playwright example;
this project's CLAUDE.md says 3000; `pnpm dev` actually runs 3002. The dangerous half is the
"reuse whatever answers on 3000" pattern — on a multi-session machine that can verify a different
project's app and report green. Local fix until upstream lands: verifiers probe, prove server
identity before reuse, and record verified-vs-started in the evidence line.

## NOS M4 — state at 2026-09-10 wrap-up (commit c27b41cb, branch nos-site)

NOT DONE. The six new routes exist and typecheck but return 404 on localhost:3002.

RESUME HERE, in order:
1. Run `scripts/seed-show-pages.ts` — AUTHORISED by Brad. Target is the PRODUCTION dataset
   (26yfbug4). Creates and field-scoped patches only; report output verbatim; stop on anything
   that reads as an overwrite of council content. Without this the six routes stay 404 because
   loadShowPage returns null and R6's notFound() fires as designed.
2. HTTP-check all 18 NOS routes on port 3002 (NOT 3000 — pnpm dev is `next dev --port 3002`;
   CLAUDE.md's "localhost:3000" is NOT wrong — 3000 is what Next binds when free, 3002 is the
   fallback when it isn't. The doc is silent about the fallback; the fix belongs in the checker
   pinning its own port, not in the doc. Do not "correct" CLAUDE.md.
3. Only then tell saoc-eb the routes are ready, so they can build the menu against them.

Deferred to a separate slice (Brad's call): `scripts/checks/verify-nos-m4-notice.ts` (pixel
measurement, N1-N15/G3b), F16 visitor-info/showFaq provenance unification (V1-V5 correctly FAIL),
`ExhibitorSteps`/`ExhibitorQuestions` grid migration (D92 — escalate, never act unilaterally),
and the hub's pre-existing fixed-count grids (deferred WITH REASONS in the golden, not skipped).

Open, needs a decision:
- S1-S4 rendered-output snapshots have NO pre-M4 baseline. Resolution given but not executed:
  capture from a clean worktree at 3fe9c6e1, never from the current tree (that is the self-
  comparison trap S3 exists to catch). Check first whether any untouchable route reads showPage —
  if so the baseline must be captured BEFORE the seed.
- Gate checks need `M4_BASE_REF=3fe9c6e1`; `origin/main` predates this work and over-reports.

- `nos-site` is PUSHED (origin/nos-site, head 9f467869). saoc-eb reads the route manifest from
  `git show origin/nos-site:content/national-show-routes.json` (21 routes, 17 listed) to build the
  header. No PR opened yet.

## RESUME POINT 2026-09-10 → next session
Full plan on disk: `.agent/memory/project/plans/2026-09-11-m4-closeout.md`
Blocker: six routes 404 because `showPage` is invisible to ANONYMOUS Sanity reads (13 docs exist and
are published; dataset is public; `showPage` is the only type missing from an anonymous type list).
NOT CDN lag — that was disproved. Prime suspect is our own read path (`sanity/lib/fetch.ts`).

---

## UPSTREAM DEPENDENCY — InunuNet/Athanor#1436 (filed 2026-09-10)

`contract.py gate --phase max` hard-blocks with **exit 6** on a triad-coverage preflight before
running any assertion: *"contract-m4.yaml is a UI/workflow contract missing triad kind(s):
gws_inbox_check"*. This contradicts `CLAUDE.md`, which documents `verify_triad_coverage.py` as
**not wired into any gate path**. Either the behaviour or the documentation is wrong.

**Consequence for M4:** the 92-assertion contract could not be gated. Measurement was obtained by
invoking `contract.py check` per assertion instead — **61 PASS / 30 FAIL / 1 ERROR**, raw log at
`.tmp/sandbox/m4-seed/gate-m4-checks-raw.log`. The gate path and the measurement path can therefore
disagree silently, and only the per-assertion path was actually run. **State this in the PR.**

**Three escapes deliberately NOT taken, and why:**
1. Adding a `gws_inbox_check` assertion — this mission has no inbox surface, so the assertion would
   be vacuous. That is the exact defect class the triad exists to prevent.
2. Adding the contract to `scripts/checks/triad-baseline-exempt.txt` — exempting a contract to turn
   a gate green is indistinguishable from the outside from gaming the gate, and the list carries no
   reason next to the entry.
3. Patching `execution/contract.py` — harness-owned, reverted by the next `make update-template`.

**Preferred upstream fix:** a first-class way to declare a triad kind *not applicable* with a written
justification recorded next to the contract, distinct from a global exemption list. "Not applicable,
because there is no inbox surface in this mission" is an honest, reviewable claim; an exempt-list
entry is not.

**Until it lands:** measure with per-assertion `contract.py check`. Do not add to the exempt list and
do not patch the harness.

---

## BUG — `brain.py wrap-up` cannot run (2026-09-10)

`python3 execution/brain.py wrap-up` dies at `execution/brain.py:452`:
`TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'` on
`def latest_wrapup_timestamp() -> str | None:`.

That syntax is valid from Python 3.10, and **it fails identically under
`/tmp/athanor-py311-venv/bin/python3` (3.11.15)** — so the script is evidently re-executing itself
under an older interpreter rather than honouring the one that invoked it. Not investigated further;
found at a quota ceiling.

**Consequence:** the 2026-09-10 session close has NO brain wrap-up entry. The session summary lives
in `.agent/memory/project/plans/2026-09-11-m4-closeout.md` under "SESSION END 2026-09-10" instead.
Anyone reconstructing that day from brain alone will find a hole and should read the plan file.

### ROOT CAUSE FOUND — a stale venv, not a code bug

`brain.py:41-64` (`_ensure_chromadb`) re-execs the whole script into `~/.athanor-env` via `os.execv`
**whenever `import chromadb` fails in the calling interpreter** — regardless of which interpreter was
invoked. `~/.athanor-env/bin/python3` is a symlink created **21 Apr** pointing at
`/Applications/Xcode.app/Contents/Developer/usr/bin/python3` = **Python 3.9.6**.

`str | None` (PEP 604) needs **3.10+**. It entered at `brain.py:452` with harness template update
**3.7.107 -> 3.7.109** (commit `8995bde0`) — upstream's code, not ours.

**Why it looks intermittent:** brain works when invoked by a 3.10+ interpreter that ALREADY has
chromadb, because no re-exec happens. That is why the PreCompact hook stored
`mem_20260910_195151_d35fcd21` successfully at 19:51. It fails whenever the caller lacks chromadb,
because the rescue path lands on the 3.9.6 venv. Explicitly invoking a 3.11 interpreter does NOT
help — the re-exec overrides it.

**Confirmed scope: ALL subcommands**, read and write — `recall`, `last-session`, `wrap-up`,
`remember`. The failure is at module import, so nothing runs.

### THE FIX — needs Brad, because it is outside the project folder

`~/.athanor-env` lives in the operator's home directory, not this project, so per
`.claude/rules/scope.md` an agent must not rebuild it without permission asked and granted first.

Steps for the operator: delete the `~/.athanor-env` directory, recreate it with a 3.10+ interpreter
(`/opt/homebrew/bin/python3 -m venv ~/.athanor-env`), then `~/.athanor-env/bin/pip install chromadb`.

Note brain.py recreates the venv itself when absent, but builds it from whatever `sys.executable`
happens to be at that moment — which is how a 3.9 venv got created in the first place. Deleting it
alone is not sufficient; it must be recreated deliberately from a 3.10+ python.

### FILED UPSTREAM: InunuNet/Athanor#1437 (P0)
`execution/` is marked HARNESS in `.agent/update-manifest.yaml`, so do not patch `brain.py` in place.
The upstream defect: `_ensure_chromadb()` re-execs into a venv **without checking its Python
version**, turning a stale-environment problem into an unreadable `TypeError` at import. It should
assert the venv satisfies the minimum version and rebuild, or fail with a message naming the cause.
Same shape as the audited defect class — the rescue path is trusted without verifying the property
it depends on.

## Focus states suppressed site-wide — live a11y defect (logged 2026-09-10)

`design/design_handoff_saoc/src/styles.css` sets `outline: none` at lines 450, 1134,
1361 and 2112, and `colors_and_type.css` defines no focus token at all. Wherever those
rules apply on the shipped site, a keyboard user has **no visible focus indicator**.

Independent of the menu decision — no nav option fixes it. Needs its own slice.

Ring colours are already settled and need no new token (design lane ruling, 2026-09-10):
`--ink` #171917 on light grounds (15.89:1 on parchment, 14.13:1 on bone),
`--parchment` #f4f3ec on dark grounds (9.53:1 on primary, 13.57:1 on primary-800).
Solid outline, full alpha, `outline-offset` never below 2px.

Brass is NOT usable as a ring: `--accent` #9e8c6b measures 2.94:1 on parchment and
2.62:1 on bone — under the 3:1 floor on both light grounds. `--accent-soft` #c2b393
is 1.86:1 on parchment. Measured against `colors_and_type.css` values, not the design
lane's table, which carried three non-handoff hexes.

## SAOC and NOS palettes must not be mixed (Brad, 2026-09-10)

Brad: "SAOC has its own design, don't mix it with NOS." He is still finalising the
National Show design separately; that lane does not have the full picture.

**The NOS layer redeclares token NAMES that SAOC also uses, to different values.**
"parchment" and "muted" are each two different colours depending on layer. A hex is
only meaningful with its layer attached.

Verified by grep of `design/` and `branding/` on 2026-09-10: none of `#fbfaf0`,
`#f3f2d6`, `#6a6780`, `#565469`, `#a49dbe`, `#8f2834`, `#714a1e`, `#1f5c3e` appears
anywhere in SAOC's approved sources. They are NOS-layer values.

Consequence to check: any earlier ruling applied to a SAOC surface that was measured
against NOS grounds needs re-deriving from `colors_and_type.css`. The disclosure-rail
work (R11) is the known case — it was discussed using NOS parchment/bone/muted.

Standing: SAOC surfaces take colour only from `design/design_handoff_saoc/colors_and_type.css`.
## Orphaned council copy: `13-booking-tickets` seeds a showPage nothing renders (2026-09-10)

Found by the NOS lane while resolving the 12-vs-13 pageKey discrepancy on
`content/national-show-routes.json`. The discrepancy itself is benign and closed:
21 manifest rows, 12 carry a `pageKey`, and the 9 that do not are all functional
routes with their own implementations — `/national-show/{conferences,exhibitors,
vendors,tickets,archive}`, the three vendor sub-forms, and `/archive/[year]`.
Verified against the manifest on `origin/nos-site`, not taken on report.

The residual is ours. `13-booking-tickets.json` is Lee-Ann's council copy for
`/national-show/tickets`, but that route renders from the PayFast/ticketing
implementation, not from a `showPage` document. So the seed writes real council
copy into the dataset that nothing on the site reads.

**Why it matters:** the tickets page may be displaying provisional or
implementation-authored text while genuine committee copy sits unrendered in
Sanity. That is the inverse of the usual no-invention failure — not invented
content shipping, but sourced content NOT shipping — and it is invisible to the
provisional-marker system, which flags pages lacking copy, not pages ignoring
copy they have.

**Before touching the tickets page:** read `13-booking-tickets.json` and compare
it against what `/national-show/tickets` actually renders. Do not assume the
rendered text is the sourced text.

Not a defect in the NOS lane's PR — their verifier's CL1 already asserts against
that file's `categories` provenance, so it is known content, not a stray.

> Truncated 23 items at trim time (2026-09-10). Restore from git history if needed.

## `check-routes.mjs` hardcodes skip-as-pass at three call sites (2026-09-10)

Found while closing the shell-checker skip-channel gap in
`contracts/checks/_shared/run_contract_suite.mjs` (mission menu-system-layout4
M2 — see `SHELL_SKIP_EXIT_CODE` and its doc comment there, and
`contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs`, the
checker that motivated the fix). A sibling instance of the exact same defect
class exists in `contracts/checks/m2-next16-upgrade/check-routes.mjs:82,90,98`:

```
record('GET /societies/[slug]', true, 'SKIPPED — no society document with a slug in dataset');
record('GET /events/[slug]', true, 'SKIPPED — no societyEvent document with a slug in dataset');
record('GET /national-show/archive/[year]', true, 'SKIPPED — no nationalShow document with a year in dataset');
```

`record(name, ok, detail)` takes only a boolean `ok` — there is no third state,
so "nothing to measure" is hardcoded as `ok=true`, i.e. PASS, at the call site
itself. Structurally identical to the pre-fix `check-descriptor-provenance.mjs`
bug: the check ran, the property was or was not measured, and the reporting
layer collapsed the distinction. If the dataset ever legitimately has zero
societies/events/national shows with the needed field, these three routes'
200-status property silently reports verified when it was never exercised.

**Out of scope for menu-system-layout4** — this file belongs to mission
m2-next16-upgrade, not this one. Record here so it survives until that mission
(or whoever next touches this checker) fixes it.

**Fix shape, once picked up:** give `record()` a real third state (e.g. a
`skip: true` flag or a distinct status param) instead of overloading the
boolean `ok`, and have the checker's own summary/exit-code logic treat skips
separately from passes — same shape as `run_contract_suite.mjs`'s
`SHELL_SKIP_EXIT_CODE` fix, adapted to this checker's own summary format rather
than the shared runner's (this script isn't run through `run_contract_suite.mjs`
today, so the runner-level fix does not cover it).

## Menu System Layout 4 — F7 recorded-not-fixed (2026-09-11)

- `MegaMenu.tsx`'s panel uses `role="menu"`, contradicting WAI-ARIA APG's Disclosure
  Navigation guidance ("No ARIA is better than Bad ARIA").
- The nav data still permits a leaf label equal to its column heading — the `<h3>` change
  landed in F7 removed today's collisions but not the underlying trap.
- `MobileMenu.tsx` drift from the artifact's mobile treatment (`.msub__head`/`.msub`) —
  deliberately out of F7 scope.
- `--shadow-sheet` is self-referential (`:root` literal, `@theme` re-declares as
  `var(--shadow-sheet)`); resolves by declaration order today, could silently zero with
  only A1 as backstop.
- `check-style-values-sourced.mjs` accepts a citation's existence, not its truth — see
  `learned.md` 2026-09-11.

## Contract parseability audit needed (2026-09-11, still open)

**Unparseable contracts are silent non-gates.** `contract-f7.yaml` (mission
menu-system-layout4) was unparseable YAML for part of today; boot separately flagged
`gate-timeout-fix/contract-f1.yaml` and `mission-slug-collision-fix/contract-f1.yaml` in
the same state. Audit every `contract-*.yaml` for parseability and add a boot-level or CI
check — a contract that fails to load currently reports nothing rather than failing, so
every assertion in it silently gates nothing while reporting no error.

## Codex reasoning-effort default wrong in harness script (2026-09-11, still open)

Athanor#1438 — `execution/codex_qa.sh:77` hardcodes reasoning effort `medium` against the
documented `high`; medium returned a false PASS on this repo. Until it lands upstream, run
Codex via the documented fallback with `-c model_reasoning_effort=high` explicitly.

## `sanity/lib/fetch.ts` swallows errors to null (P1) — FIXED on `nos-site`, 2026-09-15

Fixed on the `nos-site` branch, commit `d15715fe`: added an opt-in `propagateErrors` flag
to `sanityFetch()`, default off (byte-identical for the other ~29 callers repo-wide). Only
`lib/data/show-pages.ts`'s `loadShowPageOrFallback` path sets it true, so a real outage now
throws to Next's error boundary instead of rendering "not yet published." Reviewed by Codex
GPT-5.5 at both medium and manual high effort, no findings. **Not yet on `main`** — lands
when PR #4 merges. If this file still shows the swallow on `main` after that, the fix did
not make it across; check `sanity/lib/fetch.ts` for `propagateErrors` to confirm.

## Rule needed: no `pkill`/`kill` by pattern (2026-09-11)

A subagent ran `pkill -f "next dev --port 3002"` during this session and killed a dev
server belonging to `/Users/vetus/ai/SaocNosDesign` — a different project, outside this
repo. This is a scope-boundary violation, not just a note: add a rule that agents never use
`pkill`/`kill` with a pattern; let Playwright's config manage its own servers.

## Triad gate can never go green pre-deploy / no-email (2026-09-14, still open)

Filed upstream as `InunuNet/Athanor#1441`. Two compounding defects:
1. `execution/verify_triad_coverage.py`'s `declared_kinds()` never reads an assertion's
   `inapplicable_kinds`/`inapplicable_reason` fields — the documented mechanism for
   declaring a triad leg genuinely inapplicable (e.g. no email surface) is inert; the
   coverage linter fails regardless. Reproduces today against the checked-in reference
   example, `site-content-alignment/contract-f3.yaml`'s A16.
2. `execution/contract.py`'s real gate dispatch (~lines 417-469) invokes
   `browser_deployed_check`/`gws_inbox_check` wrappers that hard-fail with an `error`
   verdict — not skip — when no manifest exists, and `error` fails the gate unconditionally
   regardless of `required: false`.

Net effect: no not-yet-deployed UI feature, and no no-email-surface feature, can ever reach
a green gate. Hit while gating `national-show-ticket-router` — the mission's own
contract-f1.yaml A26-A28 assertions (and sibling contracts' TKT-TRIAD-01/02/03,
A57-A59) are honestly documented but will show `error`/BLOCKED pre-deploy no matter what.
Do not patch `execution/` locally per `.claude/rules/athanor.md` — wait for the upstream
fix, treat gate results for these missions as BLOCKED-by-harness-defect rather than FAIL
until #1441 lands.

## Three pre-existing issues found during national-show-ticket-router QA, not fixed — out of scope for F1 (2026-09-14)

1. **Stepper-button focus ring uses `box-shadow`, not native `outline`** —
   `components/tickets/TicketTypeCard.tsx:126,147,172`. A stale QA check assumed native
   `outline`; the real implementation is a `box-shadow` ring, which is a legitimate a11y
   pattern but contradicts the check's assumption. Needs either the check corrected or the
   component switched, a design/QA call, not a router-move fix.
2. **Canvas `fillStyle` hex literals** — `components/tickets/DownloadTicketButton.tsx:60,67`.
   Hardcoded hex colours drawn directly to canvas instead of sourced from design tokens —
   pre-existing, unrelated to the ticket-router move.
3. **`/tickets/recover` route referenced but never built** — `lib/recovery-url.ts` builds a
   URL to `/tickets/recover`, but no such route exists anywhere in `app/`. Pre-existing dead
   reference, unrelated to F1's route relocation (the recovery flow was never implemented).
> Truncated 2 items at trim time (2026-09-14). Restore from git history if needed.

## Menu System Layout 4 — minor residue after mission close (2026-10-03)

Mission `menu-system-layout4` is DONE (M3 gate passed 2026-10-03, all milestones/features
F1-F11 complete, including F8's NOS logo lead block — the asset blocking it was supplied and
the feature shipped in `db2d268f`). Two small items from the build survive it:

1. **A12 literal-coupling follow-up.** A12's command line passes `400` and `200` as
   independent literals with no code-level tie to the golden's `render.widthPx`. Change the
   render width without changing the floor and A12 keeps passing while checking the wrong
   property. @architect and @qa independently ruled it real but not urgent (both values are
   static literals, so drift requires a human editing one and forgetting the other, and the
   golden's `derivationRule` documents the relationship). For whoever next touches A12 or
   `render.widthPx`.
2. **Harness defect — misleading gate message.** `execution/hooks/require_dev_result.sh:20`
   prints "BLOCKED: No dev-result-*.md found in .agent/memory/scratch/" when the real reason
   from `handoff_check.py` is staleness (`artefact stale: ... mtime age N exceeds
   max_age_seconds=86400`). The file existed; the message sent the session looking for a
   missing file instead. The hook discards `handoff_check.py`'s `reason` field instead of
   printing it. Per `.claude/rules/athanor.md` this is filed upstream against
   `InunuNet/Athanor`, never patched in the vendored copy — recording the dependency here so
   it survives until upstream lands it. Same pattern hits `require_qa_report.sh` and
   `require_research.sh`. **Confirmed recurring 2026-09-22**: it also fires on an ordinary
   session-close commit the day after a wrap-up, purely because the calendar date rolled over
   — `handoff_check.py --from maintainer --to close` reported `learned.md` at 102262s against
   `max_age_seconds=86400` (a wrap-up from the prior afternoon, one day earlier). The artefact
   was not missing or wrong, only a few hours past the 24h window; the commit-blocking hook
   gave no stderr indicating this, costing a diagnostic round to distinguish "stale" from
   "missing" before the fix (write fresh content, re-run wrap-up) was obvious.

(The CLAUDE.md-entry and two-unparseable-contracts items formerly listed here were resolved
or are tracked elsewhere: `docs/menu-system-layout4.md` stands as the feature's documentation,
and the two unparseable contracts are the same pair already tracked under "[P1] TWO
unparseable contracts" above.)
> Truncated 1 items at trim time (2026-09-19). Restore from git history if needed.
> Truncated 5 items at trim time (2026-09-21). Restore from git history if needed.
> Truncated 12 items at trim time (2026-10-03). Restore from git history if needed.
> Truncated 3 items at trim time (2026-10-03). Restore from git history if needed.
> Truncated 1 items at trim time (2026-10-06). Restore from git history if needed.
> Truncated 2 items at trim time (2026-10-06). Restore from git history if needed.

- [ ] **[P0] HARNESS defect: `mission.py close-out`'s auto-trim deleted 12 open backlog items
  with no archive link**, same bug class as the already-logged "[P0] Harness `backlog_trim.py`
  deletes open items without archiving them" above but a separate code path
  (`execution/skills/lib/mission_complete.py`, invoked by `mission.py close-out`, auto-committed
  as `966ca33c` without being asked). Two items in the same run WERE converted to proper
  `→ [details](data/...)` link rows; the other 12 — including the 4 vendor-council items above,
  restored here from `git show 2cdcc83f:.agent/memory/project/backlog.md` — were replaced by a
  bare "Truncated N items" line with no data file and no link, i.e. actually gone from the
  working file (recoverable only by someone already suspecting to check git log). File upstream
  against `InunuNet/Athanor`; do not patch `execution/` locally per `.claude/rules/athanor.md`.

- [ ] (2026-10-07, from saoc-nos-design-f1 page capture) `/national-show/vendors/payment` with no token shows a bare "This payment link is no longer valid" — correct behaviour, reads as broken. Needs a friendlier empty state with a route back; copy must be sourced (Lee-Ann/Brad) per no-invention, not drafted. Pattern: NOS rulings R18 (heading + one factual sentence + route back e.g. "Back to vendors" + contact link; never a void/placeholder) and R11 ("To be confirmed" chip on unconfirmed sentences); reuse the empty-state component arriving in the NOS ticket handoff (F7).

- [ ] (2026-10-07, QA F1 conference-workshop-tickets) Three pre-existing contract checks are stale and FAIL on HEAD independent of current work (hardcoded catalogue counts from an older snapshot): `contracts/checks/ticketing-purchase-pages-f3/check-category-assignment.mjs`, `contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs`, `contracts/checks/ticketing-conferences-and-events-f5/check-pool-data-invariant.mjs`. Update to read counts from the live exports, or retire with a note in their closed missions.

- [x] (2026-10-07, found by @architect during conference-workshop-tickets; FIXED 2026-10-07 same day) Pre-existing: `contracts/checks/payfast-m1/*` checks that import `app/api/tickets/itn/route.ts` via tsx register fail with `Cannot find module '@/lib/payments/payfast'` — the `@/` path alias isn't resolved under the plain-node + tsx register() pattern. Root cause: tsx/esm's `resolveTsPathsSync` (patched onto `Module._resolveFilename`) resolves a TOP-LEVEL `@/...` import fine but breaks for an `@/...` import made from WITHIN a dynamically-`import()`-ed CJS-format `.ts` file one level deeper (reproduced: `@/lib/payments/payfast` resolves standalone, but THAT module's own internal `@/lib/payfast` import fails). Fixed by patching `Module._resolveFilename` again, on top of tsx's own patch, inside `contracts/checks/payfast-m1/_itn-harness.mts` (rewrites any `@/`-prefixed specifier straight to its absolute path before tsx's resolver ever sees it) — every caller of `loadItnPost()` is fixed with zero caller-side changes, this harness is the only import point. Confirmed fixed: F3's A29 (`check-payfast-sandbox-e2e-day-visitor.mjs`) now passes end to end. Not yet re-run against every pre-existing payfast-m1 check individually, but they all route through the same `loadItnPost()`.

- [ ] (2026-10-07, F2 conference-workshop-tickets) `scripts/fix-vip-and-weekend-pass-pricing.ts` (manual --apply one-off) is now stale: it plans weekend-pass early-bird cutoff values, but weekend-pass.earlyBirdCutoff is intentionally null after the EB SKU split. Retire or update before anyone runs it with --apply.

- [x] **(2026-10-07, found + FIXED same day by @architect producing conference-workshop-tickets F3's A30 manifest) `contracts/checks/payfast-m1/_itn-harness.mts`'s `withFetchStub()` stubbed EVERY fetch call unconditionally, with no URL check.** The ITN route's `deliverConfirmationEmailAfterCommit()` fires its Resend SDK call (also the bare global `fetch`) from inside the same `POST()` execution `withFetchStub` wraps — so every confirmation-email send during an ITN-harness-driven check got PayFast's canned `{status, text: () => 'VALID'}` reply instead of a real Resend response, and threw "Unable to fetch data. The request could not be resolved." every time. Not a credentials/deliverability problem — a stub-scope bug. A29 never noticed (it only asserts ITN status + position `paid`, both unaffected — the email failure is caught and logged, same as a real Resend outage). It made A30 structurally impossible: no real Resend call could ever succeed, so no real gws-readable email could ever be produced. Fixed by scoping the stub to PayFast's own `PAYFAST_SANDBOX_VALIDATE_URL` only; everything else now passes through to the real fetch. Confirmed fixed: a real confirmation email landed in brad@inunu.net, read back via `gws gmail users messages get` (message id `1a11410a8f9e93ed`), A30's manifest produced and `execution/gws_inbox_check.sh` PASSes against it.

- [ ] **(2026-10-07, HARNESS defect, found by @architect producing conference-workshop-tickets F3's A27 manifest) `execution/browser_deployed_check.sh`'s own independent live re-check cannot pass for ANY page on this site while the beta wall is up.** Its live re-fetch (`execution/browser_deployed_check.sh:188`, `curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${origin}${path_tested}"`) sends no Authorization header at all, and `proxy.ts` (mission beta-password-wall, team-lead override 2026-10-06) gates EVERY path on beta.saoc.co.za behind Basic Auth except 6 exact-match webhook paths. Confirmed live: `curl -s -o /dev/null -w '%{http_code}' https://beta.saoc.co.za/tickets` → `401`. So the native `type: browser_deployed_check` triad kind cannot currently be satisfied for ANY in-scope page — a manifest can be produced with the real authenticated `http_status: 200`, but verification's own unauthenticated re-check will always see 401, declare a mismatch, and fail. This silently undermines every `browser_deployed_check` assertion added to this mission's contracts so far (F3 A27, F4 A22, F6 A24) — none can currently pass end to end, though the linter still credits them as declared. Per `.claude/rules/athanor.md` this is HARNESS-owned (`execution/`) and must not be patched locally — file upstream against `InunuNet/Athanor` (proposed fix: an optional `BROWSER_CHECK_AUTH_HEADER` env var the live re-check sends if set). Until that lands, these assertions should be plain-shell checks (same honest-labelling pattern as F3's A20/A28), not the native kind, or the beta wall needs a scoped bypass for the verifier's own live re-check specifically (team-lead/Brad decision, not an architect call).

- [ ] (2026-10-07, F3 triad) Stray real orders from A30 producer runs on Firestore: `CWT-F3-A30-muxgc972` (paid, no email — pre-fix run) and `CWT-F3-A30-muxge14k` (paid, Friday day-visitor, real email to brad@inunu.net); `SAOC-2027-F6HZVA7K3RH5` left to expire. They count against Friday's day-visitor capacity on the pre-production dataset — clear before launch.

- [ ] (2026-10-07, conference-workshop-tickets close-out) F7 (rendered ticket cards) is a separate
  future step, blocked on the NOS design peer's handoff (`saoc-nos-design-f1`) — see
  `comms.md`'s `[conference-workshop-tickets -> saoc-nos-design-f1] 2026-10-07 — CORRECTION to F6
  view-model handoff` block for the shipped interface deltas (as committed in `8104b07b`) the
  design lane needs to build against. Not part of the conference-workshop-tickets mission, which
  closed with all four milestones done (last commits `8104b07b`/`9b2c06e0`/`2cdcc83f`, deployed
  as build-2026-10-07-005).

- [ ] (2026-10-07, conference-workshop-tickets F6) Two more A28 sandbox test orders now exist for
  brad@inunu.net on Firestore: `CWT-F6-A28-muxpo7u5`, `CWT-F6-A28-muxqhu30` — on top of the
  earlier test orders already logged above (`CWT-F3-A30-muxgc972`, `CWT-F3-A30-muxge14k`,
  `SAOC-2027-F6HZVA7K3RH5`). All must be cleared from the pre-production dataset before launch.

- [ ] (2026-10-07, conference-workshop-tickets, needs Brad) Three open questions carried out of
  the mission, unresolved: **(1)** Exhibitor/Vendor R3500 fee scope — `needs-Brad #10` in
  `docs/national-show-conference-workshop-tickets.md` — is R3500 a new figure replacing the
  confirmed regular/early-bird prices, or an addition on top, and does it vary by form-selection
  choice at registration; **(2)** whether the Weekend Pass capacity cap is 300 (the carried-over
  estimate currently in the view-model/checkout) or uncapped; **(3)** card-mock visual approval
  for the rendered ticket cards, still pending Brad's sign-off.

- [ ] (harness dependency, 2026-10-08) Athanor upstreaming: Draft Lane section in template workflow.md + require_contract_for_write.sh per-path/feature resolution. Acked by athanor-c5; awaiting version. Then `make update-template`. Local rule meanwhile: docs/rules/draft-lane.md.

- [ ] (2026-10-08, ASSIGNED TO NOS SITE (saoc-nos-site-e3) by Brad: "SAOC is busy I think you can handel the form update." Branch off origin/main, full chain, no main merge without Brad sign-off; includes admin/email consumers. Brad: "hand the work back to SAOC when done forms need the full chain..". NOS Site hands SAOC the branch + gate result + handover note; SAOC then reviews and takes it to main/beta) Vendor form update to Lee-Ann's revised "13.2 Vendor Form - SAOC National Show Vendor Registration Form.docx" (Drive id 1tbA4GNbplWkW-4Pv3LPsdV5RT_ZdViBe, modified 2026-10-07 16:38). NOS Site found these gaps vs components/vendors/*: (1) Staff & Exhibitor Passes are per day (Setup/Day1/Day2/Day3/Breakdown x number of staff); the site has one staffPerDay field; (2) new WASTE, CLEANING AND ENVIRONMENTAL IMPACTS section (checkbox group + note); (3) missing notes: electrical safety compliance, delivery/collection slot timing, Storage & Security, booth confirmation once payment reflects, "Final booth allocation is made by the Show Organising Committee..."; (4) marketing-permission radio labels paraphrased, need verbatim; (5) vehicle labels should be "Less than 1 ton Delivery Van registration Number" / "Above 1 ton Truck registration number"; (6) "VAT Vendor" vs "VAT registered". Terms, declarations, categories and booth sizes already match verbatim. Verify each against the docx before building. SAOC spot-check 2026-10-08 against OUR current form (last vendor commit abeceae1, 2026-09-08, predates the 2026-10-07 docx): gaps 1 (single staffPerDay, VendorBoothUtilitiesFieldset.tsx:117), 2 (no waste/environmental section), 5 (generic vehicle labels, VendorBoothFieldset.tsx:40-45) and 6 ("VAT registered", VendorBusinessAddressFieldset.tsx:35) are present in our build too. Gap 3 is PARTIAL: an allocation note exists in VendorTermsFieldset.tsx:19 with different wording. Gap 4 is unchecked. Exact wording is still UNVERIFIED against the docx (NOS Site asked for its findings to be treated as unverified).
- [ ] (2026-10-08) execution/drive_docx_sync.py skips folder "13. Registration/Booking/Tickets" because of the "/" in its name, so vendor-form copy never syncs. Sanitise or map slash-bearing Drive folder names while keeping the containment check.
- [ ] (2026-10-08, Brad-approved idea, NOT yet a mission) Admin "Invite a vendor" action: committee invites a known nursery from /admin/vendors → system issues the existing single-use registration token and emails the full-form link directly, skipping the public /national-show/vendors/apply step. Source: Lee-Ann's 13.2 vendor form opens "We are pleased to welcome you as a pre-approved vendor" (invite-first), and her "Copy of Vendor Listing.xlsx" (Drive "4. South African Exhibitors", 2026-10-07) tracks Confirmed → Website Application → Payment received → Stands Required. Keep the public apply route as secondary. Constraint (Brad): Lee-Ann wants the vendor form to BE the contract between SAOC and the vendor, so the invited path must still land on the full form with its terms, declarations and signature block, never a shortcut that bypasses them. Coordinate with NOS Site's in-flight vendor-form update (handback to SAOC).
- [ ] (2026-10-08, Brad: no action, context only) Scott's comment (Drive "National Show - Website Comments and corrections.xlsx", 2026-10-07): header/footer text "should read South African Orchid Council SAOC". Brad is deliberately selling the council on "SA Orchid Council" as the modernised name, so keep "SA Orchid Council" in the lockup. Do not change the name on Scott's comment alone. Scott's other comment ("Different logo used in the header to the footer, maybe stick to the one in the header") is still open for Brad.


<!-- Merged 2026-10-19 by saoc-82: lines present only in the stale main working tree (feat/conference-workshop-tickets), appended verbatim in original order so nothing is lost. -->




















































































































































































































































































- [ ] [P3] (2026-10-13, Brad) Members Portal: "in progress" holding page only. Do it only after the NOS Site is finished; low priority. Brad: "Members portal needs a in progress holding page we will only do this when the NOS Site is finished its low priority." Copy must be sourced (no-invention).
- [ ] (2026-10-13, Brad standing instruction) Do not ask Lee-Ann about missing content (empty Drive folders, sections not yet written); she is busy with it. Ask only about content she has already supplied. Questions doc: https://docs.google.com/document/d/1C2_2EKYvJwzB5ejtwf0wpm5bk7z916-c8UQQrkQmSjc/edit
- [ ] (2026-10-13, Brad) VENDOR FLOW AS IT ACTUALLY RUNS: Lee-Ann has already invited the vendors personally. The vendor form is sent to them when ready and forms the contract between SAOC and the vendor. Once SAOC approves the submitted form, SAOC forwards a link and payment instructions. Brad verbatim: "Lee-Add has already invited the vendors personally the form will be sent to them when ready to form the Contract between SAOC and the vendor, once the Vendor form is approved by us we will forward them a link and payment instructions." Implication: the admin invite (feat/vendor-invite) is the primary path, and the public /national-show/vendors/apply route is secondary at most.
- [ ] [P1] (2026-10-13, Brad via NOS Site, beta 03348a72) Admin vendor review gaps, SAOC lane: (1) no full-registration detail view. /admin/vendors only lists a summary table and there is no app/admin/vendors/[id] route, so the admin cannot see booth, storage, waste, marketing, payment or declaration data. Brad: "No way for me to review the full application and check the actual data". (2) Both admin vendor tables overflow at desktop width: Status is clipped on /admin/vendors, Approve/Reissue actions are cut off on /admin/vendors/applications. (3) The public /national-show/vendors/apply validation shows raw keys ("businessName is required and must be a non-empty string") instead of field labels. Test application "TEST NOS form check (Claude, 2026-10-13)" (brad+nos-form@inunu.net) is PENDING; NOS Site will approve it on Brads go.
- [ ] [P0] (2026-10-13, NOS Site end-to-end vendor run on beta, Brad watching; submission 8TvyaRDdN8BFPcAkktOE) BLOCKER: POST /api/vendors/{id}/marketing-asset returns 500 for all 3 product photos (incl. a 134 KB JPEG), so no vendor can complete registration. NOS hypothesis, unconfirmed against server logs: lib/firebase-admin.ts initializeApp sets no storageBucket, so getStorage().bucket() throws.
- [ ] [P1] (2026-10-13, same run) Vendor flow defects: (a) /register full form does not prefill "Vendor / business name" from the gate. (b) The "I confirm I have read and agree to the Vendor Terms & Conditions" checkbox sits in Payment & terms, before the Declaration & Terms text it refers to. (c) Admin "Get payment link" sends a second payment email (Approve already sent one), though its label only says copy to clipboard. (d) Registration-approved email shows raw "Booth type: no-preference" instead of the label. (e) Stand size asked in /register (boothSize) and again on /payment, where it can be changed; /payment DOES preselect the /register choice (verified 2026-10-14). Beta holds test records (1 application, 1 approved registration, 3 emails to brad+nos-form): keep/delete is Brad's call.
- [x] [P0, DONE: NOS end-to-end retest PASSED 2026-10-14 on beta 77e50788, 3x 202 uploads, ref W8PuLWZ93u3YDKx7AqW5] (2026-10-14) Vendor uploads: Storage enabled + bucket created via API (europe-west4); SA write/delete verified. the code fix is on fix/admin-storage-bucket @ 77e50788 (initAdmin passes storageBucket; both upload routes give a clear error if it is unset). Codex PASS; not pushed. Root cause 2: the bucket saoc-webapp.firebasestorage.app does not exist (Storage never enabled; appspot.com also absent). Brad enables it at https://console.firebase.google.com/project/saoc-webapp/storage (location is permanent), then test a real upload end to end and roll out to beta.
- [ ] [P1] (2026-10-14, NOS retest) A vendor who leaves before uploading photos is locked out: the registration code is single-use and consumed at submit, so /register rejects it (vendor 8TvyaRDdN8BFPcAkktOE is stuck at 0/3 photos). Needs a path back to the upload step, e.g. a link in the received email, or Reissue working for submitted registrations. Design decision: Brad.
- [ ] [P2] (2026-10-14) After all 3 photos show "Uploaded.", /register still says the registration "is not complete until you have also uploaded all 3 required product photos". No completion state.
- [ ] [P2] (2026-10-14, seen only with a JS-triggered click) The /register form can fall through to a native GET before hydration: nothing is saved and every field (email and phone included) goes into the URL. Fix: method="post", or disable submit until hydrated.
- [ ] [cleanup, Brad] Beta test vendors: 8TvyaRDdN8BFPcAkktOE, W8PuLWZ93u3YDKx7AqW5 (applications + registrations + emails to brad+nos-form).
- [ ] [P0→live] (2026-10-14) Ozow stand payment rejected (BankReference sent as 42-char VSO ref vs Ozow String(20)). Fixed on fix/ozow-vso-bankref a42694dc (Codex PASS, mutation-proven), live on beta. Awaiting Brad's sandbox click + NOS settlement verification.
- [ ] [P2] (2026-10-14, NOS) Same pre-hydration native-GET risk (no method, no hydration guard) in: VendorApplyForm.tsx:146 (PII), VendorRegistrationCodeEntryForm.tsx:72 (access code), ContactForm:74, TicketPurchaseForm:46, SuggestionForm:87, SubmitEventForm:154, LoginFormFields:39 (admin login), DoorScannerClient:210. Apply + gate forms first. /register is fixed on fix/vendor-register-p2 8f3ae6e4.
- [ ] [merge] Vendor fix branches to integrate, all off 77e50788: fix/admin-storage-bucket 77e50788 (live), fix/ozow-vso-bankref a42694dc (live), fix/vendor-register-p2 8f3ae6e4 (NOS, pushed), fix/vendor-photo-resume (P1, in build). Beta currently = a42694dc only.
- [ ] [P0→beta] (2026-10-14) Vendor flow fixes integrated: integ/vendor-flow-fixes c11b51bd (pushed, LIVE on beta). Contains: storageBucket fix 77e50788; Ozow BankReference a42694dc; F4 short /vsp return URLs + Ozow field-cap guard + clamp (6e8ce0a9..a560d5be); F5 stand payments honour Ozow Sandbox Test Mode (9b2ecfe0); F2 photo-resume link + admin Get photo upload link (e8bd5bd4); NOS P2s (8f3ae6e4). Codex PASS on each and on the merge; pnpm build green. Pending: Brad's sandbox Pay Now click + NOS settlement verification; then @docs, gate, @maintainer, and merge to main (Brad sign-off). Pre-existing verify-show-page-m4 FAILs (R2,R6,R7,RS3,CL4,V1-V4) exist at base too: separate item.

- [ ] **P2 (2026-10-15, NOS smoke on beta c11b51bd)** /national-show/vendors/photos keeps showing "0 of 3 product photos uploaded" and "not complete" after all 3 uploads succeed, until reload. Cause: photos/page.tsx:92 renders the server-side uploadedCount; the VendorMarketingUploadField instances (line 95) pass no onUploaded. Mirror the VendorRegisterSuccess client wrapper. Fix dispatched under vendor-flow-fixes F2.
- [x] **P1 RESOLVED (see above)** Ozow sandbox Pay Now on W8PuLWZ93u3YDKx7AqW5: Ozow says Complete (IsTest, R0.01, txn 7c542873…), but the order stays pending with no email. The cause (no notify / signature reject / confirm lookup fail on IsTest) needs the App Hosting logs: gcloud needs Brad to re-auth, and the SA gets 403 on logs.
- [ ] Beta test-record cleanup (Brad decides): add application SWYzTPXNtI96ueeoFujO and registration ci9swD1ozZMPs8jwPX0m (NOS P2 completion run, 2026-10-15).
- [ ] P3 (NOS 2026-10-15): /register HTML keeps a hidden, unhydrated copy of the full form in Next's streaming container (div#S:0[hidden]). The visible form is fine. Check whether it matters.
- [ ] Beta cleanup (Brad decides): add application EM89hydzSXnFwwV8fJor and registration wdTRgjp5UDfOSvSDrqYv (NOS photos live-count retest, 2026-10-15).
- [ ] CLAUDE.md vendorStandOrders row is stale (floor-protected, needs Route 1/Brad). Replace the final sentence with: "Carries `expectedGatewayAmount` (`number | null`, vendor-flow-fixes F5): `0.01` only under Ozow Sandbox Test Mode, otherwise `null`; the settlement amount guard compares against `expectedGatewayAmount ?? amount`. Stand return URLs are `/vsp?a=<attemptId>`. See [docs/vendor-stand-payment-settlement.md](docs/vendor-stand-payment-settlement.md) and [docs/vendor-flow-fixes.md](docs/vendor-flow-fixes.md)."
- [ ] verify-show-page-m4 base FAIL set is 10, not 9 (R2, R6, R7, RS3, CL4, V1–V5); V5 already fails at c11b51bd.
- [x] Ozow sandbox settlement (2026-10-15): two causes. (1) The lookup omitted IsTest=true because of a strict 'true' compare (3ef1e100). (2) The status API returns camelCase but the code read PascalCase; conflicting casings now fail closed (4a57bb21, Codex PASS). VERIFIED on beta 15:10Z: order paid, /vsp confirmed, admin Paid, vendor and admin emails received.
- [ ] 3 Ozow checks already failing at c13a1ce9: ozow-m1-f2/check-providerid-fail-closed; ozow-m1-f3/check-live-purchase (needs a run-artifact arg); ozow-sandbox-toggle-f1/check-checkout-route-wiring (isOzowSandboxTestModeEnabled() called after reserveTicket() in the ticket checkout route).
- [ ] 2026-10-15 Lee-Ann (via Brad): use the SAOC branding logo with the full name 'South African Orchid Council' (lockup wordmark W2) site-wide. Dispatched as contract saoc-full-name-lockup F1.
- [ ] P3 (2026-10-15): /  at 768px has 1px horizontal overflow from components/home/ShowBand.tsx (font-mono uppercase span, right edge 769.03). It already exists at base f5622860.
- [ ] P1 vendor UX (NOS audit 2026-10-15; approved, F7 in progress): /national-show/vendors/apply checkboxes are 16x16 (15 targets, need 44px); the /vendors/register "Continue" button is 96x42; /vendors/payment with an invalid link is a dead end (one sentence, no contact action).
- [x] DECIDED 2026-10-15: use the existing /tickets flow (NOS lane). Was: NOS "Book tickets" P0. Point it at the existing /tickets/* flow, or ship the uncommitted /national-show/tickets/buy/* relocation (main tree, feat/conference-workshop-tickets, docs/national-show-ticket-router.md; built unrequested 2026-09-14).
- [x] DECIDED 2026-10-15: 'Exhibitors and Vendors' (F7). Was: the /national-show/vendors h1 "Exhibiting Nurseries" doesn't match the menu label "Trade Vendors".
- [ ] P1 (NOS Site 2026-10-15, verified): council-supplied sections whose sourcePath points into content/drive-source/ render the false "AI-generated placeholder" notice on beta (e.g. /national-show/sa-exhibitors). content/drive-source/ is gitignored wholesale (.gitignore:144) because Lee-Ann's spec doc carried plaintext mailbox passwords (commit 1d6512cb), so classifySection (lib/data/show-pages.ts:336) fails closed. Fix options: relink provenance to content/drive-recovered, or ship secret-scanned content.md files. Needs a spec; it touches the secrets boundary. Owner saoc-2b, after the pause. The /vendors paragraphs are Lee-Ann's copy (Drive 1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4), so they get no disclosure.

- [ ] (2026-10-15) Amend contracts/contract-ticket-reachability.yaml TKT-06/07 when NOS Site's fix/nos-audit-p1 lands: hero "Book tickets →" now targets /national-show/tickets (one link per admission product → /tickets/<slug>), reported by NOS Site as Brad's choice. Confirm with Brad on his return; don't amend before the branch lands.

## [SAOC] 2026-10-16 backlog — /national-show/tickets navigates TOP window when iframed (NOS Design Canary note). Find trigger (frame-bust script / top-level redirect); keep only if deliberate payment security. Post-meeting.

## Queued after NOS F3 (2026-10-16, from saoc-nos-design-cb; full rulings in the NOS rulings file)
- [ ] R31 /national-show/tickets: ticket choice on first screen. Typographic hero + 4-card audience index; visitor tickets as rows; per-row prices only when salesOpen; per-group R11 status chip; day-choice note on day rows. Data flags for Brad/Lee-Ann: "Early-Bird Weekend Pass" vs "Weekend Pass (Early Bird)" duplicate; "Conferences tickets" label.
- [ ] R32 /national-show/vendors/apply: field border ≥3:1, "(required)"/"(optional)" labels, autocomplete attrs, inline errors + focused error summary (also fixes e2e J4 no-client-validation), typographic hero, single primary button ≥48px.
- [ ] Launch F5 in progress (Arch_Son5_M1-F5_LaunchWeekend): /_next/image 404 + 10MB pages, security headers, sitewide canonical, /societies CLS. Source: .tmp/sandbox/excellence-audit/tech/REPORT.md
- [ ] Not yet scheduled from audit: contrast tokens (footer ivory/45, bg-accent buttons; handoff question), Joomla legacy redirect map (needs old URL list), sitemap gaps, noindex on ticket confirmation/cancelled/members, JSON-LD fixes.
- [ ] R33 /national-show/plan-your-visit (saoc-nos-design-cb): collapse 3 TBC chips into one R11 panel; venue card first full-width + map button ≥44px; 10111/10177/112 as tel: links; R11 chip style; R29 typographic hero. Queue after F3.
- [ ] R34 /national-show/exhibitors (saoc-nos-design-cb): page 9,569px, CTA at y8683. One R11 status line over Key-dates table (em-dash cells); in-page jump nav (sticky rail ≥1024, collapsible at 390); "Contact the council" button in top banner; 7-step process as numbered ol stepper; recheck standfirst contrast at 390. Queue after F3.
- [ ] UPSTREAM (Athanor): quota oracle mirror stale since 2026-10-08 and no session-surviving auto-resume after quota reset (pulse_quota_resume.sh default-OFF, unwired). Filed on /Users/vetus/ai/Athanor/comms.md 2026-10-16. Workaround: session-only CronCreate heartbeat 1df7f6b8 + one-shot 0a2088b4 at 05:41.
- [ ] Launch F7 a11y/UX (from saoc-nos-site-77 critique r2, beta b2e0e90d; report NOS Site .tmp/sandbox/nos-excellence-critique/round-2/REPORT.md): /tickets/weekend-pass Buy enabled at qty 0, total lacks aria-live, generic title, TEST MODE banner visible; mobile menu toggle lacks aria-expanded, Tickets+Sponsors listed twice (recheck after ff1a7e18); sticky header 74/62px vs scroll-padding-top:auto (WCAG 2.4.11); back-links 19px tall + three 22px links (2.5.8); hero photos repeat in pairs, all hero alts empty; ShowContentState h2-as-label 0px gap (sa-exhibitors, international-guests, programme).
- [ ] CONTENT for Brad/Lee-Ann: what-to-expect shows dates 23–26 Sept above "dates and daily opening hours still with committee" (contradiction); "Early-Bird Weekend Pass" vs "Weekend Pass (Early Bird)" duplicate SKU?; show hours; FAQ parking answer.
- [ ] After NOS chrome F2 ships: F2 architect tightens §7 item 13 per R35 — .pc-title/.pc-name judged at card-title role (Fraunces 400 22/1.25 opsz24); remove .pc-role tracking exemption (case-driven: label .14em or 0). CSS fix lands via saoc-nos-site-77 nos-critique-r2.
- [ ] CONTENT for Brad/Lee-Ann: Sanity showFaq — venue FAQ status `pending`, answer "At the hangar at Stellenbosch Flying Club…" has no Drive source; a second FAQ also gives the venue ("…on the R4…"). Needs committee wording, then status flip. Duplicate venue FAQs need review.
- [ ] Queued for after NOS F2: push saoc-nos-site-77 fix/nos-critique-r2 33ee45cc (60ch cap 6 routes + R35 presenter type), rebased on F2.
- [ ] NOS perf follow-up (Codex r2 P2 on NOS F2, accepted): app/(marketing)/layout.tsx:23 — SAOC root-layout fonts (Crimson Pro, Manrope, JetBrains Mono, Lora) preload on /national-show/* while Fraunces/Karla are preload:false. Scope SAOC font loading to SAOC route group or preload NOS faces on NOS routes.
- [ ] R39 symposium presenters (saoc-nos-site-77 r3, after r2): clamp bios to 4 lines + inline disclosure (aria-expanded), bio 17px body role.
- [ ] CONTENT for Brad/Lee-Ann: symposium presenters — only Elbert has a role line; no talk titles/sessions on any card.
- [ ] CONTENT for Brad/Lee-Ann (P0, F6): real National Show history — editions, years, host, venue, entries/visitors/trophies, champions, judges, real photos. lib/data/shows.ts seed is invented; F6 removes it.
- [ ] R37/R38 archive layout (typographic hero, hairline figure row, single 65ch about, dedupe XVIII/back links) — apply once real records exist; F6 lands the honest empty state first.
- [ ] R41 /national-show/faq (needs contract: showFaq per-answer status): move TBC badges from question to the pending sentence in the answer (13/14 mis-badged); "When is the show?" first; FAQPage JSON-LD for badge-free answers only; SVG chevron for disclosure, drop ※/± glyphs.
- [ ] Launch F7 add R42 SAOC home: hero carousel needs visible pause control + stop under prefers-reduced-motion (WCAG 2.2.2; carousel itself is in handoff README:22, keep it; README:145 = fade only); hero sub-copy 100% white + scrim ≥0.55 on every slide (check handoff for existing scrim first); slide labels by subject + aria-roledescription carousel/slide; → glyphs to SVG. Eyebrows stay (handoff README:52,64,101).

- [ ] R47 /events (saoc-nos-design-cb, 2026-10-16, 15/28): P1 make the National Show event row a link to /national-show (≥44px, focus ring); P1 Event JSON-LD + <time datetime> — UNBLOCKED — dates 23–26 Sep 2027 set by Brad 2026-10-06 (memory project_show_dates_placeholder); lean-deferred only; P2 compact events hero; P2 home "Upcoming society shows" label mismatch (use existing "What's on"); society shows = content gap for Lee-Ann. Newsletter input label/autocomplete routed to F7.
- [ ] R48 /members (saoc-nos-design-cb, 2026-10-16, 21/28): IA — "Members" holds a primary-nav slot for an unbuilt portal; move to footer Explore until portal ships (BRAD decision — nav is in the approved handoff); P2 duplicate "Contact SAOC" within ~400px (band → "Find your society"); P2 compact hero. Suggestion-form autocomplete routed to F7.
- [ ] R49 /about (saoc-nos-design-cb, 2026-10-16, 16/24): P1 six "To be confirmed" committee h3s → one R11 status line under "The national committee" (WCAG 2.4.6); P1 history prose ~95ch → 68ch, 17px body role, left-aligned; P2 duplicate "1968 Founded" vs "28 July 1968" → keep full date; P2 "EST. 1968 · BLOEMFONTEIN" → "Founded 1968" (mono kept).
- [x] R45–R48 folded into F7 as F7c (A14), 2026-10-16.
- [ ] Unpublish script hardening (Codex F6 P2): createIfNotExists leaves a pre-existing draft unstripped. Live drafts verified clean 2026-10-16.
- [ ] Footer newsletter Subscribe is a DEAD button (form only preventDefault, nothing stored) + input border ~1.5:1 (WCAG 1.4.11). Decision for Brad: hide until wired, or wire (needs a list/backend). Also: footer lockup label-in-name (audit P1-7); /national-show/faq has no h1 (NOS Site lane).
- [ ] /national-show/conferences: full-width ~460px ticket image above first ticket name at 1280 (nos-site-77 post-refresh review) — check against F3 tickets work when it lands.
- [ ] ShowContentState placeholder blocks: 0 paragraph gap + 0 h2→body gap (nos-site-77). Re-measure after F2-r36 deploys (0.5em heading margin).
- [ ] Hub copy gaps (F6 r4 arch, for Brad/Lee-Ann): "competitive" not in Drive wording; hub 2nd paragraph 100-point scale, ten botanical classes, Grand Champion definition — no Drive source (judging-content work). Archive heroes → typographic hero when R29 lands.

## R53 (saoc-nos-design-cb, 2026-10-16) — /national-show/workshops
- [P0 launch-gate] Ozow TEST MODE banner + R0.01 override are driven by the Firestore admin toggle `adminSettings/ozowSandboxTestMode` (lib/ozow-sandbox-test-mode.ts, fail-closed), NOT hard-coded and NOT env-driven. Beta host is the saoc-prod backend, so the toggle MUST be off before go-live. Proposed hardening: ignore the flag unless Ozow is in sandbox mode (env), plus a gate assertion like F8's. Needs a contract.
- [P1] Workshops: same stock photo on all 4 products with product-named alt (misrepresents); ~720px cards; no running total; Buy at y≈3755. Peer proposes compact rows + sticky total bar — check against design/design_handoff_saoc/ before any build (no-invention).
- [P2] Product names are <p>; should be h3 under a section h2.
- [Brad/Lee-Ann] "Field Trip (per outing)" vs "Field Trip (Single Outing)" looks like a duplicate SKU (cf. R31 #5).

## F8 beta re-measure (saoc-nos-site-77, 2026-10-16) — F8 PASS; follow-ups
- [F8b, accuracy] Gap sentence "has not yet supplied the content for this page" is false on sa-exhibitors (3 sourced Lee-Ann paragraphs shown). Fix: section-scoped wording when sourced prose present, or no block when only one section withheld. Needs contract.
- [F3] international-guests + sa-exhibitors: R11 gap block stacked over RealEmptyListing dashed box (+ "EACH ENTRY WILL SHOW" scaffold) — double absence statement; covered by F3's G2 card replacement, verify it resolves.
- [minor a11y] programme gap-block links (Symposium 123x24, Workshops 77x24) meet 2.5.8 at exactly 24px but below NOS 44px norm; duplicate the "More on the National Show" cards below — consider dropping.

## R54 (saoc-nos-design-cb, 2026-10-16) — /national-show/conferences
- [P1, stale copy — resolved cause] Lede promises "combined SAOC/WOSA Joint track" (conferences/page.tsx:17,32; tickets/page.tsx:50) but the Joint bundle was deliberately RETIRED (lib/provisional-figures.ts RETIRED_CONFERENCE_SLUGS, per Lee-Ann msgs 3-4). Fix = delete the Joint clause on both pages (removal only, no new copy). Needs contract.
- [P1] Each R2000 row needs a link to its existing page (/symposium, /wosa-conference). Link-only, no new copy.
- [P2] Unscoped "To be confirmed" chip above products (R41 pattern) — scope to what it qualifies.
- [P2] "Buy Ticket" label on a registration page; "Register" suggested — label shared with workshops; Brad's call (copy).
- R53 #2-#4 (stock photo, no running total, <p> names) apply here too (same component).

## R55 (saoc-nos-design-cb, 2026-10-16) — SAOC /contact (measured on 3002 = pre-F7 worktree)
- Send button contrast: ALREADY FIXED on main by F7 (text-ink on bg-accent, components/contact/ContactForm.tsx:174). Height ~41.7px < 44 still open.
- [P1 systemic] field border `--rule` #d9d7c9 (inputClass :70) fails 1.4.11 — same as R32/R45; fix once at token/field-class level. Needs contract.
- [P1] "Minimum 10 characters." not linked via aria-describedby; no role=status success region with focus. Error <p role="alert"> exists (:166).
- [P1] name/email inputs (:83,:101) lack autocomplete="name"/"email" (1.3.5).
- [Lee-Ann] hero "Reach the right person" vs a single address — source role-specific contacts or flag over-promise.

## R56 (saoc-nos-design-cb, 2026-10-16) — /national-show/vendors on beta (14/24)
- [P1, content owner] Hero "Meet the specialist nurseries showcasing…" contradicts the empty state ("No nurseries have been confirmed"). Delete or source — Lee-Ann.
- [P1] One action, three labels → /vendors/apply: "Register as a vendor" (vendors), "Vendor registration" (/tickets), "Vendor Application" (form h1). Peer: unify on "Vendor Application" (cites an earlier ruling — verify which before building).
- [P1] Primary CTA into the empty-state band (y≈1426) + "Get in Touch" secondary; drop the repeat band (y≈1814).
- [P2] 13px prose / ~45% column. Peer proposes 17px @68ch — CONFLICTS with r5's 60ch cap just shipped (6af92875); reconcile with the handoff type scale before any change. State-before-promo (R50 pattern).
- R56 follow-up: 17px body sourced (R14 addendum, v4 mock CSS "Karla 17/1.65/400"). 68ch WITHDRAWN (impeccable default, not a ruling) — NOS measure stays ≤60ch; R49's 68ch for SAOC /about also withdrawn. "Vendor Application" label: no prior ruling existed; basis = consistency with destination h1 — still Brad's wording call.

## R57 (saoc-nos-design-cb, 2026-10-16) — /national-show/about on beta (12/20)
- [P1] Theme line "From Wild Origins to Cultivated Excellence: The Future of Orchids" buried in para 2 — lift (duplicate, paragraph unchanged) as lede-role pull-quote under hero (Fraunces 300/28, R14 addendum).
- [Lee-Ann] ~1,800px prose, no h2s — subheads are new copy; ask for 3-4 (theme / what you'll see / WOSA / vendors). Add nothing meanwhile.
- [P2] body 16px → 17px (R14 addendum body role).
- [P2] ends on section nav, no closing action — reuse hub CTA pair "Plan your visit" + "Tickets" (existing labels).

## R58 (saoc-nos-design-cb, 2026-10-16) — SAOC /sponsors on beta (16/24)
- [Lee-Ann] h1 "The partners behind SAOC" with zero partners listed — delete or source; no empty/placeholder logo wall.
- [P1 provenance] "Our reach" reuses "56 accredited judges" (mock) — follows Brad decision #3 (placeholder figures). "184-page annual yearbook" TRACED: no Drive source; appears in sponsors/page.tsx:27 + components/home/YearbookStrip.tsx:6,24 (design-mock figure) → same placeholder-figures decision.
- [P2] "Talk to us about sponsors" → /contact?subject=Sponsorship (check ContactForm reads subject).

## R59 (saoc-nos-design-cb, 2026-10-16) — F8 PASS on beta (R51 P0 + #2)
- [P1 → merge with F8b] Peer wants the gap sentence "The South African Orchid Council has not yet supplied the content for this page." DELETED (reads as an editor note on SAOC's own site). CONSTRAINT: CLAUDE.md/no-invention requires unsourced pages to be VISIBLY flagged as awaiting official committee copy — the flag cannot simply go. Wording is the open question (Brad): e.g. reuse R11 chip "To be confirmed by the show committee" alone vs a sentence. Fold into F8b with the sa-exhibitors "for this page" inaccuracy.
- [P1] /wosa-conference has no route to registration — add the existing "Conference Registration" link → /national-show/conferences (existing label).
- [P2] 16-card section grid outweighs near-empty pages ~3x — re-check after F3.
- F8b wording acceptance criteria (design-cb): visitor-facing, names what is pending (not who failed to deliver); one line inside the R11 surface, no chip repeat; page-true (no "for this page" when partially sourced). Wording = Brad/committee.

## R60 (saoc-nos-design-cb, 2026-10-16) — SEO metadata sweep, 26 routes on beta
- [GO-LIVE CHECKLIST] noindex/nofollow on beta: TRACED — X-Robots-Tag set by proxy.ts:74 + robots.ts disallow-all, both keyed to the beta wall in lib/beta-public-launch.ts (SITE_PUBLIC_LAUNCH). Flipping public launch drops it; verify header absent on / and /national-show after deploy. Sits beside the Ozow sandbox toggle (R53).
- [P1] 6 SAOC pages (/about /societies /judging /events /contact /sponsors) share the default meta description → use each page's existing sourced hero standfirst.
- [P2] description length 70-155: too long vendors/apply 193, exhibitors 166, plan-your-visit 161; too short ns/sponsors 33, symposium 46, archive 56, members 64, sa-exhibitors 67 — same standfirst rule, sentence-boundary cut.
- [P2] NOS titles 63-78ch truncate → "<Page> — National Orchid Show 2027"; hub keeps "National Orchid Show 2027 | South African Orchid Council".
- Still open: Event (R47) + FAQPage (R41) JSON-LD.

## R61 (saoc-nos-design-cb, 2026-10-16) — perf, beta /national-show
- [Brad: money] Cold start TTFB 5,357ms / LCP 7,980ms (warm 240-325ms). apphosting.yaml:5 minInstances: 0 (cpu 1, 1024MiB, max 2). minInstances:1 = always-on instance cost; Brad decides. Production config → /spec route, not draft lane.
- [P1] Preloads wrong: header logo (high), reversed horizontal, footer vertical (0px), empty image: preload; hero LCP webp unprioritised. Fix: next/image priority on hero; only visible header logo eager; lazy footer/reversed; drop empty preload.
- [P2] 5 font files preloaded → only the 2 above-fold faces, rest swap.

## R62 (saoc-nos-design-cb, 2026-10-16) — /tickets/day-visitor on beta (17/32)
- [P1, Brad brief 2026-10-15] /tickets/* (and NOS checkout/return pages) render SAOC chrome — brand switch at payment. NOT in F3 scope (F3 = /national-show/* only, contract-f3.yaml goal). Needs its own feature: NOS chrome on every NOS product route.
- [P1] dates as "2027-09-23" in rows + aria-labels → "Thu 23 Sep" (weekdays from confirmed FAQ string), ISO kept in <time datetime>.
- [P2] "Estimated total: R0.00 (estimate)" double estimate → one + existing "Provisional pricing".
- [P2] photo hero + card stock photo push steppers to y≈900 → compact hero, no card photo (R53 #2).
- NOTE: F3 contract already removes the PUBLIC test-mode banner from shared ticket UI (contract-f3.yaml goal) — partially addresses R53 P0 display; the R0.01 override toggle itself still needs the go-live switch-off.

## R63 (saoc-nos-design-cb, 2026-10-16) [P2] — /national-show/* 404 renders SAOC chrome, recovery links only / and /societies. Add NOS-scoped not-found with NOS chrome + links National Show / Tickets / Plan Your Visit (existing labels). Group with R62 #1 (NOS chrome on /tickets/*) as one follow-on feature.

## Brad go-live decisions — RELAYED by saoc-nos-design-cb 2026-10-16 (peer relay; awaiting Brad's confirmation in saoc-2b chat before any dispatch)
1. Ozow test mode: Brad flips it himself at launch. 2. noindex dropped at launch (public-launch flag). 3. minInstances: 1 (apphosting.yaml — prod config + spend). 4. Remove society member counts (R45) only; "56 judges"/"1990"/"184-page" undecided — leave. 5. Hide Members from primary nav (page stays). 6. F8b gap sentence unchanged — Brad to speak to Lee-Ann. 7. Copy rule: South African English, common words. 8. Beta SHOWS labelled AI placeholders for Lee-Ann's review; production never (→ SHOW_PLACEHOLDER_PREVIEW on beta env). 9. Remove duplicate early-bird products (one per product) and duplicate Field Trip (Sanity catalogue). 10. design-cb read-only access to .claude/skills + design/design_handoff_saoc.

## Withdrawn by saoc-nos-design-cb after reading SAOC handoff README (2026-10-16)
- WITHDRAWN: 17px body on SAOC pages (R43 #2, R49 #2) — SAOC base is 16px (design_system_README l.100); 17px is NOS-only. Still open: SAOC 13px card prose below the 16px floor.
- WITHDRAWN: R42 #5 SVG arrows on SAOC — brief specifies Unicode → (l.160). NOS arrow items R36 #5, R41 #4 now optional.
- WITHDRAWN: R49 #4 "Founded" vs "EST." — EST. 1968 is brief vocabulary (l.69). R45 #2 moot (counts removed).
- STANDS: field border --rule fails WCAG 1.4.11 3:1 on form fields (token is the brief's hairline; fields need a distinct boundary).
- CONFIRMED by Brad in saoc-2b chat 2026-10-16: #3 minInstances:1, #8 beta placeholder preview, #9 remove duplicate early-bird/field-trip → dispatched as launch-weekend F9 (apphosting.yaml) and F10 (Sanity catalogue, retire via active:false).

## R64 (saoc-nos-design-cb, 2026-10-16) — SAOC handoff-cited
- R42 #2 hero scrim restated: keep brief scrim (README l.125, sage gradient 60%→25% + bone bottom pull); anchor 60% end behind centred hero text or use bottom pull under sub-copy; measure 4.5:1 per slide. Replaces "flat ≥0.55".
- [P2] Button casing → sentence case per README l.51 ("Find your society →", "Buy ticket"). Casing only.

## R65 (Brad via saoc-nos-design-cb, 2026-10-16): "Body text should be standard across both sites."
- design-cb ruling: 16px / 1.6 on SAOC + NOS; typefaces stay per site (Manrope SAOC, Karla NOS); all prior 17px asks → 16px; 12-14px prose → 16; labels/meta stay 12-13. Supersedes R14 addendum 17/1.65.
- ORCHESTRATOR NOTE: SAOC brief is 16px / 1.55 (design_system_README l.100). 1.6 is a new value in neither source; recommend standardise on the brief's 16/1.55 (no invention). Pending design-cb reply / Brad.
- Implementation: one token change per site if possible; touches NOS (F3 in flight) — land after F3.
- R65 SETTLED: 16px / 1.55 both sites (README l.100 verbatim), lands after F3. design-cb informing NOS Site.
- R65 split agreed w/ NOS Site: they take critique-r6 (nos-theme.css :165/:307 cleared, NOS 17px→token, 12-14px prose→16, titles untouched) AFTER F3 lands; SAOC side = globals.css:230 (1.65→1.55), home/MissionBlock, YearbookStrip, ui/PageHero, NOS hub page.tsx:510, tickets/page.tsx:188/199.
- [hygiene] launch-weekend check files (e.g. f8/check-d-gap-logic.mts) exist untracked in the main tree, not on origin/main — F8 shipped without its contract check committed. Commit the launch-weekend checks/contracts in one chore commit.
- F10 follow-ups (Codex r2, non-blocking): catalogue check (a) exempts allowlisted QA-fixture/test-show slugs without checking `demo`; (b) a duplicate Field Trip under a different live workshop slug would pass. Strengthen check-catalogue.mts.
- r6 (NOS Site) also owns: presenters --pc-bio-lh 1.68→1.55, all NOS 16px leading-relaxed→1.55, shared VenueCard incl. /contact card (17→16/1.55). Removed from SAOC side.

## R68-R70 (NOS Design, Brad-flagged "squashed/zero design effort", 2026-10-16) → launch-weekend F12
- R68 hub hero re-layout (h1 "National Orchid Show"), R69 grouped "Explore the show" index replaces 16-card wall, R70 symposium (h1 "National Orchid Show Symposium", theme line from Drive) + shared show-page template on a 1280 grid. Architect dispatched (contract on top of F3 bf2faf26). Dev after F3 lands. Theme line verified in Drive (2.1 About + Spec V3).
- R67 already satisfied in F3 (A27 PASS, bf2faf26).
- F12 add (Brad direct, 2026-10-16, screenshot): keep SAOC top utility bar (email + "Join a society") on NOS pages; replace "19th National Show · Sept 2027" pill with link back to SAOC home, label "saoc.co.za", href "/". SAOC pages unchanged.

## F14 (Brad direct, 2026-10-16, screenshots): SAOC home craft pass — "zero design effort"
- NavCards ("Four ways into SAOC"): no hover/animation, flat blocks. ShowBand (flagship show): unbalanced photo inset, dead space, half-empty countdown, 3 buttons no hierarchy, "Book Tickets" casing.
- Architect dispatched with impeccable/frontend-design/web-design-guidelines/accessibility; bounded by handoff motion rules (README l.140-145: 150ms ease, buttons darken + lift 1px, brass underline links) + tokens. Placeholder figures untouched.
- Codex F3 verdict: FAIL — P1 hub price teaser can show expired early-bird price checkout rejects (cheapest-admission.ts:29); A6 scope violation (verify-nos-content-state.ts outside allowlist) → architect ruling; all other 13 FAILs AGREED stale/pre-existing → F3 architect re-pinning.
- [Brad decision, placeholder class] Home YearbookStrip shows "Editor: Lindiwe Khumalo", "ISSN 1816-0336", "184 pages", "2025 yearbook" — TRACED: only in design mock data (design_handoff_saoc/src/data.js), not in Drive. An invented editor name + ISSN presented as fact. Recommend remove/withhold until Lee-Ann supplies real yearbook details.
- PartnersSection (home "In collaboration with"): added to F14 design pass. Provenance gap: SANBI + Kirstenbosch NBG trace only to design mock (Drive mention is a template with wrong venue/dates); only WOSA confirmed. No partner logos exist. Ask Lee-Ann for real partner list + logos.
- F3 re-pin 4133064f: A12 ticket-card stock photos exempted for F3 (pre-existing); removal belongs to next tickets feature (R31-A2 + R53 #2) which flips ticketCardPhotos.exempt back to false. F1-R8 = real main defect (NOS mobile menu scroll not restored, 60→0, NosHeader.tsx) → F15 fix on main.
- F13 Codex (full diff): FAIL on check-strength only — NOS CTA assertion in check-f13.mjs:96-101 not visibility-checked at mobile. Ruled non-blocking (F13 does not touch NOS chrome; ticket-reachability/check-national-show-header-cta covers it). Tighten later.
- R72 (saoc-nos-design-cb, measured on 3002 = F2-r36; re-measure on main before contracting). SAOC non-NOS wide sweep:
  1. [P1] No shared left axis: header logo at x413 on a 2056 screen, but SAOC body sections start at 381–405. Fix: body sections use the header's shared container class, the same mechanism as R71 for NOS. Centred heroes and CTA bands are exempt.
  2. [P2] /judging: prose ends at x1149 on a 2056 screen, so the right 45% is empty. Proposed 4fr/7fr eyebrow+h2 | prose (≤60ch) at ≥1024, the R70 #5 pattern. Not in the SAOC handoff, so it rests on the craft-floor rule; design call under Brad's design autonomy.
  3. [P2] Prose under 16px (judging 6, home 4, members/sponsors/contact 2 each). Folded into the SAOC side of R65 (16/1.55).
  Queue: after F14 lands, because F14 also edits globals.css and the home sections. One feature, one dev.
- F14 on main 28614dfe (home NavCards/ShowBand/YearbookStrip/PartnersSection). Critique pass 2 scored 37/40, with P0/P1/P2 all at 0. Accepted P3s: the partners row wash and rules hang 12px past the axis, and the yearbook keeps a ~240px gap with the 4/5 photo.
- NOS F3 gate (7480ac48): sales-closed path NOT proven. NOS_SALES_CLOSED=1 can't pass because the page reads the live Sanity salesState, which is open. Follow-up: a closed-state fixture or test dataset, never a live CMS toggle. A21 CLS was flaky on /national-show/about (0.124) in that run, though it passed in the default run.
- SEO (saoc-nos-design-cb read of main ef040964). Canonical and hub Event JSON-LD both PASS. Gaps, queued as one SEO feature after F12:
  1. R41 FAQPage JSON-LD on /national-show/faq.
  2. BreadcrumbList on every /national-show/* page (Home › National Show › Page).
  3. Event offers (ZAR, from resolveEffectivePrice; availability; validFrom) only while sales are open.
- Audit server: main ef040964 on :3011 from .tmp/sandbox/wt-audit-main (PID 7276, has a copied .env.local). Stop it by PID, then remove the worktree and safe_delete the .env.local once the R31/R71 audit is done.
- F16 contract on spec/lw-f16 at 1e5a5c20 (tickets: audience index, typographic rows, admin-only test strip). The dev is dispatched after F12 lands. Open items:
  - [Brad] Live Sanity VIP is R300, below Weekend Pass R380; memory says R625/R500 was settled on 2026-09-08. Also, F16 sees weekend-pass-early-bird R360 still active, but F10 retired "early-bird-weekend-pass". Verify that the slugs and prices match intent.
  - The hub advertises sold-out early-bird pools because it doesn't read Firestore counts.
  - VendorStandPaymentForm still shows the public test-mode strip to vendors.
  - /conferences still shows the "Conferences tickets" label and Joint mentions (conferences/page.tsx:17,32).
- R73 (saoc-nos-design-cb) naming sweep: "SAOC National Show" → "National Orchid Show". Brad's ruling covers the hub h1 and the symposium; extending it to builder-written UI and transactional copy is a consistency call.
  - Change (swap the event name only):
    - pages: national-show/tickets/buy/page.tsx:41, (marketing)/tickets/page.tsx:41, national-show/vendors/page.tsx:57, vendors/payment/page.tsx:28,:63, vendors/register/page.tsx:41,:73, national-show/page.tsx:531;
    - emails: lib/confirmation-email.ts:115, lib/vendor-payment-confirmation.ts:54, lib/vendor-stand-payment-notice.ts:42;
    - the Ozow itemName at api/vendors/stand-payment/initiate/route.ts:233.
    - tickets/page.tsx:23,:113 is already in F16.
  - Leave: Lee-Ann's legal text (VendorTerms/Declaration/PaymentFieldset:75; vendors/apply:12,:28 if they match docs/leeann-source/2027-vendor-registration-form). Verify this when contracting, and list the legal naming for Brad and Lee-Ann.
  - Flag only: nav-config.ts:136 "19th SAOC National Orchid Show" (Brad's own reference #35) stays.
  - Queue: one small feature after F16, because it touches the F12 hub page and is outside F16's contract.
- F12 audit (saoc-nos-design-cb on 2effaec3): R68–R71 PASS. On all 17 routes every h1 and free-standing h2 sits on the logo edge at 2041/1280/390, with no horizontal scroll.
  - The "broken hero photos" was a FALSE ALARM. My audit server ran raw `next build`, which skips scripts/generate-image-variants.mjs; `pnpm run build` runs it. Beta serves /images/_opt/orchid-dark.jpg-2048.webp and orchid-violet.jpg-2048.webp with 200 image/webp, verified with curl through the beta auth. Future audit servers must use `pnpm run build`.
  - P2s, folded into the R73 naming feature (F17) after F16:
    (1) the symposium sub-nav label "SAOC Symposium" becomes "Symposium" (source: nav-config);
    (2) the sponsors "Become a sponsor" panel is inset 32px inside the axis (double inset); put it on the axis;
    (3) symposium: in public mode (placeholders off), the beta-only TBC note's rule and empty grid row must not render.
- STANDING REVIEW SERVER for saoc-nos-design-cb: worktree .tmp/sandbox/wt-review (detached on main, has a copied .env.local), served on :3012 with `next start` after `pnpm run build`, flags SITE_PUBLIC_LAUNCH=true SHOW_PLACEHOLDER_PREVIEW=true. Rebuild after every push to main: stop the PID, then `git -C .tmp/sandbox/wt-review checkout --detach origin/main`, pnpm install, pnpm run build, start. Currently at 2effaec3.
- R74 (saoc-nos-design-cb, :3012 sweep on 2effaec3). Hub below the hero, footer and the 390 flows PASS, except:
  1. [Brad to confirm] The peer quotes Brad: "hide the members link for now until the portal is ready". That is NOT traced. My only recorded Brad instruction (2026-10-13) is an "in progress" holding page after the NOS Site is done. Header and mobile nav still show "Members", and the footer shows "Members Portal". No action until Brad confirms.
  2–6, folded into F17 after F16 (with the R73 naming and the F12-audit P2s):
    - (2) Don't render ShowSectionNav on the hub only; it duplicates the Planning rows and the Explore index.
    - (3) nav-config labels to sentence case (same words), covering the mega and mobile menus.
    - (4) 240px dead gap between two adjacent bone sections on the hub ("Planning a visit" pb120 + "Ten judging groups" pt120).
    - (5) Footer WOSA link: the arrow is orphaned on line 2; glue it with a nbsp.
    - (6) The mobile-menu "Show Sponsors" description is internal builder copy; replace it with "The sponsors behind the National Show." (nav-config builder copy).
  7. PARKED: one-row 390 mobile header (≤72px).
  - F16 already covers the /tickets/early-bird 7px h-scroll from the w-screen test strip. R62 (SAOC chrome on /tickets/*) is still open.
  - R74 #1 update: saoc-nos-design-cb gives the source as Brad typing directly in its session on 2026-10-16, verbatim "Let's hide the members link for now until the portal is ready." It came in the same message as "Remove the duplicate early bird products" and "We will keep one server instance always running". It is NOT in this repo's backlog (grep finds only my entry). Plausible, and consistent with the holding-page plan (hide the nav link now, /members holding page later). It goes into F17 once Brad confirms in my chat.
- F16 on main 41a7a08f (tickets: audience index, typographic dual-price rows, admin-only test strip, no card photos). Critique 33→37/40. contract-f16 A1–A9 and A11–A14 PASS; the F12 axis check passes on tickets; e2e 149/3.
  - A10 waiver: check-f3-container and the check-f3-imagery "h1 left 100" lines are STALE against F12. I proved this by running check-f3-container on main 2effaec3 (:3012) before F16: ~383 failures, because the content width is 1320/1216, not 1080. They are superseded by F12-A15 (the axis authority). F17's architect must formally retire them in supersession.json.
  - [P1 follow-on, before the early-bird pool sells out] Codex: admission rows always link to the early-bird SKU (lib/admission-rows.ts:96). Once the pool sells out, /tickets/early-bird shows Sold out and offers no route to the regular ticket. Fix: the sold-out early-bird page links to its regular sibling, or the hub reads Firestore sold counts. Not launch-blocking, since sales start at launch.
- F16 audit (saoc-nos-design-cb, :3012 at 41a7a08f): R31 #1a/#1b, rows, test strip, copy and axis all PASS. Fixes are added to F17 as scope E:
  - E1 [P1] Each dual-row price gets a visible CMS-name caption and its own Buy action to its own SKU. This also closes the F16 Codex P1 (no regular-ticket route after the early-bird sell-out).
  - E2 [P2] All row actions use the outline style.
  - E3 [P2] The "Provisional pricing" note moves above the rows.
- R75–R76 (saoc-nos-design-cb, inner-page sweep on :3012). Queued as F18 after F17; design calls accepted under Brad's design autonomy, no new copy.
  - R75 [P1] /national-show/about is a wall of text.
    - Paragraph 1 becomes the lede.
    - 4fr/7fr grid: a sticky column-1 pull-quote of the theme line (verbatim from para 2) plus the hub facts list from Sanity.
    - Paragraphs 2–6 at 60ch, 16/1.55, full ink (drop the 80% alpha).
    - One 21:9 orchid-violet image break between paras 3 and 4.
    - Closing Tickets + Plan your visit pair, then ShowSectionNav. Find out why it's missing on /about.
  - R76 [P1] Show pages with no supplied body (programme today; audit the others) need a designed holding state built from existing parts only:
    - hub facts from Sanity;
    - related-page cards using nav-config titles and descriptions;
    - the existing "Be the first to know" block;
    - no orphan rules; the TBC note on beta only.
  - R76b [P2, Lee-Ann report] Hero ledes from content/show-pages/*.json "summary" are spec V3 "Purpose" builder briefs (12-workshops, 05, 11-programme, maybe 01). Render no lede where it reads as a brief, and keep it as meta only where it reads publicly. List them for Lee-Ann.
  - Plan-your-visit PASS.
- RESOLVED (Brad, 2026-10-16): the live Sanity ticket prices are Brad's latest and correct (VIP R300, Weekend R380/R360 EB, Day R150/R120 EB). Never re-raise pricing. The older R625/R500 notes are superseded.
- R74 #1 CONFIRMED by Brad in my chat (2026-10-16): "Hide the members link". Added to F17 as scope F: remove it from nav-config and from the header, mobile menu and footers. The /members route stays for the later holding page.
- R77 (saoc-nos-design-cb, :3012 at 41a7a08f):
  - #1 [P1 regression, curl-verified]: "Explore the show" renders only on the hub (4 hits). /about, /symposium and /faq have 0. Fix it in F17 scope G1: inner routes yes, hub no, plus an assertion.
  - #2 [P1]: the exhibitors key-dates caption wraps one word per line. Fix it in F17 scope G2.
  - Queued for F18:
    - #3 exhibitors TBC rows say everything twice (keep the chip, drop the duplicate sentence where a chip exists);
    - #4 the workshops and conferences catalogues move onto the F16 row component (price as R200, steppers per row, sticky running total, the admission-transfer note moves to /tickets);
    - #5 the international-guests schema preview is covered by the R76 holding state;
    - #6 sponsors card-in-card becomes one panel on the axis.
- F17 contract at 01ee165d (scopes A–F; G being added). For Brad and Lee-Ann:
  - Her own vendor form mixes "SAOC National Orchid Show" and "SAOC National Show" in the legal text, which is left unchanged.
  - Live Sanity ticketsPage still holds the old event name; Brad can edit it in Studio, and F17 doesn't mutate the CMS.
  - The hub's "premier competitive" sentence is builder copy.
  - The "The sponsors behind the National Show." descriptor is my wording, made under design autonomy.
- R78 (saoc-nos-design-cb, final eye pass; all 17 NOS routes are now swept). For F18:
  1. [P1] Build R75 as a shared long-form prose template, applied to /about, /what-to-expect, /vendors and /sa-exhibitors:
     - paragraph 1 as the lede;
     - a 4fr/7fr grid with a sticky column 1 (facts list, plus an optional verbatim pull-quote);
     - one image break using an existing asset;
     - the closing CTA pair, then the explore index (NosShowIndex, which F17 restores on inner routes).
     Lee-Ann's headings stay verbatim (R7 casing).
  2. [P2] /faq:
     - the TBC chip moves after the question (inline, small);
     - the + becomes a 20px icon, centred, with the whole row as the ≥44px button;
     - in public mode, unanswered questions are not rendered (part of the R76 audit).
  3. [P3] /archive: the beta TBC card spans the column; R76 covers public mode.
- F17 SHIPPED 2026-10-16: main 76ad8b98 (pushed). A1–A20 green, e2e 148/3 skipped, Codex PASS, critique 33→37/40. :3012 rebuilt (PID 35327). F17 worktrees/branches removed. Follow-up: check-labels-static diffs vs stale base d2071be5 → retire/rebase in F18 item 9. F18 architect dispatched (spec/lw-f18, wt-lw-f18-spec).
- F17 audit (design-cb, 76ad8b98): PASS. P2: the hub still renders NosShowIndex (R74 #2), so it was added to F18 (hub-absent assertion).
- R79 (design-cb, SAOC home on :3012). Queued as F19 (SAOC) with R72 axis/judging + R65 type, after F18:
  - P1 #1: the hero scrim is a uniform 75–85% sage, which hides the carousel. Per design_system_README l.125 / R64 it should be a diagonal top-left 60%→25% plus a bone pull at the bottom, with h1 and CTAs ≥4.5:1 on all 4 slides.
  - P2 #2: CTA "Find Your Society" → "Find your society" (README l.51).
  - P2 #3: "Upcoming society shows" lists only the national show. Use the existing "What's on" eyebrow as the h2, or hide the section when there are no society shows. No invented label.
  - P2 #4: yearbook band, meta and actions sit directly under the copy (gap 32) instead of justify-between; the image carries the height.
  - #5: FOR BRAD, still live on home: "56 accredited judges", "1990", "184 pages" (unsourced).
- F18 contract c6294195 (spec/lw-f18, 19 assertions). Split: F18a (items 1-5, 7, 8, hygiene, hub index removal) then F18b (catalogue rows A8/A9/A14), both with the same dev. Lead rulings: break photos only in [data-nos-image-break] on the 4 long-form routes; vendors pending chip and sponsors marker beta-only; exhibitors regex predicate; red A12 checks are reported, not edited. check-labels-static was rebased to a structural check (fixed).
  - FOR LEE-ANN: 9 hero summaries dropped as builder briefs (pages 01, 02, 05, 06, 07, 11, 12, 13, 15; 07 has no Drive source); /vendors and /sa-exhibitors share the same copy; the /sa-exhibitors heading duplicates its h1; mixed naming in legal text; WOSA "held alongside" is unsourced.
  - Gap: e2e/journeys/ is untracked in the main checkout.
- R80 (design-cb, 390 check on :3012 at 76ad8b98):
  - #1 [P1, NOS]: at <768 the hub hero stacks copy first and the orchid image last (image at y1041, 281px tall), so the first screen is all type. Fix: image first (order -1, ~300px, object-position on the bloom), then h1/lede/CTAs (Tickets ~y680), then countdown and facts. Also check nos-hero-photo inner heroes at 390. Plan: architect amends this into F18b scope once F18a ships, because the hub page is mid-edit in F18a.
  - #2 [P2, SAOC]: home hero at 390 has ~4px between h1 and lede (needs the 16-20 heading-to-lede gap), and the CTAs stack at unequal widths (both full-width or centred at equal width). Goes to F19 with R79.
- R81 (design-cb, /tickets/day-visitor on :3012, desktop): goes to F18b with R62 (NOS chrome on /tickets/*, still open).
  - P1:
    1. Per-day rows show ISO dates; show "Thu 23 Sept 2027" (SA English) and keep ISO for data only.
    2. The disabled Buy button gives no reason; add a hint tied by aria-describedby, or validate on click. The suggested hint text "Choose at least one ticket" is UI microcopy with no source; flag it to Brad if it's used.
    3. The hero scrim renders flat grey; use the NOS inner-hero treatment after R62.
  - P2:
    4. The estimated total sits above the selectors and repeats "estimate"; move it next to Buy, add aria-live.
    5. The price shows "R150.00" vs "R150"; drop zero cents.
    6. The "Tickets per day" label should use the 14px sentence-case form-label role.
- TEAM VOTES (Brad 2026-10-17: full autonomy, 3-way vote between saoc-2b, design-cb and nos-site-77; majority ships):
  - VOTE 1 CARRIED, C (2-0 so far): unsourced home figures (56 judges, 1990, 184 pages, yearbook editor/ISSN) show on beta with the "awaiting committee confirmation" marker and are hidden in the public build. Goes to F19.
  - VOTE 2 CARRIED, B (2-0; saoc-2b switched from A for the accessibility reason): Buy stays enabled. On click with qty 0, show "Choose at least one ticket" inline (aria-describedby) and move focus to the first quantity field. v13 HANDOFF overrides this if it specifies otherwise. Goes to F18b.
- design-cb unowned sweep, assigned:
  - Members links: already clean on main (git grep).
  - Real stock feed for the v13 pool and per-day counts, the stub-photo mapping for all products, and 404s/redirects for retired ticket/catalogue URLs: F18b.
  - Beta SEO check (sitemap, canonical, OG per route, Event JSON-LD): nos-site-77 SEO lane.
  - "Register" vs "Buy ticket", vendor T&Cs naming and R76b ledes: VOTE 3.
  - VOTE 3 CARRIED 3-0, all A: (b) "Buy ticket" on every paid product, including the symposium and workshops; (c) Lee-Ann's vendor T&Cs legal text stays verbatim, with the naming mix listed for her; (d) builder-brief ledes dropped in public (F18a) and listed for Lee-Ann.
  - VOTE 1 final 3-0 C. VOTE 2 final 2-1 B. On v13 cards the stepper starts at qty 1 (HANDOFF §3.3) and a card not on sale shows no CTA; B applies only to a checkout screen that can reach qty 0.
- R1–R82 status table: .agent/memory/project/specs/launch-weekend/r1-r82-status.md (45 DONE, 17 IN FLIGHT, 7 NOT STARTED, 5 PARTIAL, 3 SUPERSEDED, 1 WITHDRAWN, 4 UNTRACED: R24, R28, R30, R50).
  - NOT STARTED, assigned:
    - R47 events, R49 about, R55 contact, R58 sponsors, R61 → F19;
    - R54 conferences, R59 wosa registration link → F18b;
    - R33 plan-your-visit tel/map, R34 exhibitors jump nav → nos-site-77.
  - R53 Ozow test toggle hardening plus a gate assertion is P0 launch-gate. Plan: a separate small payment-safety feature (F21) after F18b, saoc-2b lane. It touches payment libs, so it gets the full chain and is not votable.
- F18a SHIPPED 2026-10-17: main 47cf7f1b (pushed). All F18a assertions green, Codex PASS, critique 33→37. The plan-your-visit 0px gap was a load artefact: identical DOM on main. :3012 rebuilt on 47cf7f1b.
- Autonomy set to `autonomous` (workspace default) on Brad's instruction, 2026-10-17. Quota: use all of it, Sonnet for build, never Opus for docs/maintenance.
- design-cb R1–R82 review:
  - R24 and R28 verified DONE (git grep).
  - R30 open parts (hub "Day Pass from R{min}" line, ticket-close band) → F18b.
  - R50 re-measure/build → site-77. R61 → site-77. R58 neutral h1 + empty state → F19.
  - R31 SUPERSEDED by R83 (v13 tickets). R14 addendum 17/1.65 SUPERSEDED by R65 16/1.55.
- F18a audit (design-cb, 47cf7f1b): PASS with 4 P1s, sent to the F18 dev as the direct follow-up fix/lw-f18a-audit:
  1. Photo reuse across 4 route pairs.
  2. /archive has no archive content.
  3. /sa-exhibitors h2 repeats the h1.
  4. The /vendors hero lede contradicts the holding state.
  - P2s held: 13px workshops fine print, FAQ card height, /about has no lede.
  - Other lanes: R65 NOS 17/1.65 still on 5 routes, and /exhibitors banners (site-77).
- Public-mode review server: :3013 from .tmp/sandbox/wt-public (SITE_PUBLIC_LAUNCH only, has a copied .env.local). Stop it by PID and remove the worktree after launch.

### 2026-10-17 — Athanor third-party review of :3013 (47cf7f1b) triage
- Report: /Users/vetus/ai/Athanor/.tmp/sandbox/saoc-review/REPORT-F18a.md (Claude + automated a11y; Gemini/Grok need Brad sign-in).
- CLOSED: P1 #1-2 prices (R250 Sunset, R120 Early-Bird) — rendered from live Sanity = Brad's latest; content.md/provisional-figures superseded.
- ROUTED: NOS hub unsourced facts + wosa-conference holding + heading skips → F18 (fix/lw-f18a-audit amendment). SAOC unsourced facts (/, /judging, /events), R47 events count (1 of 18), R55 contact, SAOC tap targets → F19. NOS chrome tap targets → site-77 f9; what-to-expect concessions/photo norms + duplicate intro → site-77 f8. Workshops sessions + programme schedule → F18c.
- LEE-ANN QUESTIONS (to add to her doc, Part C): (a) Symposium — Elbert's bio contains "you know the species name!" verbatim from his CV: keep or edit? (b) Cape Orchid Society "founded 1947" vs "50th anniversary 2010" in the Crous bio — which is right?
- POST-LAUNCH (saoc-2b lane): R61 — every NOS route preloads Crimson Pro, JetBrains Mono, Lora, Manrope from the shared root/marketing layout; NOS uses only Fraunces + Karla. Per-route-group font split changes SAOC head; deferred. Numbers pending from site-77.
- design-cb nos-v4 pack copied to goldens/nos-v4/ (chrome v4, Brad-approved 2026-10-15). R74 #7 one-row header WITHDRAWN (conflicts decision #6). site-77 f9 = decision #2 (utility bar + Search off NOS). Search-reachable condition withdrawn.
- design-cb F18b rulings (2026-10-17): sales-closed = v13 cards render masked (no price/stepper/CTA) + one R11 "Sales closed" line + "Be the first to know"; pool banner hidden. Symposium = "National Orchid Show Symposium" end to end; Sanity ticketType rename dispatched (Dev_Son5_M1-F22_LaunchWeekend, content edit, backup first).
- LEE-ANN QUESTIONS (add to doc): ticket names — v13 design vs CMS: VIP Opening vs VIP Ticket; Sunset Cocktails vs Sunset Cocktails (Single); Day Pass vs Early-Bird Exhibition / Day Visitor. CMS names render until she answers.
- F23 (queued, saoc-2b): font split per F19 spec §8 — (saoc) route group layout holds Crimson Pro/Manrope/JetBrains Mono (+Lora); root drops them; NOS variant uses Karla. Needs ChromeFrame + UtilityBar, so runs AFTER F18b and site-77 f9 merge. design-cb P1 (v4 acceptance: NOS loads only Fraunces + Karla).
- Security re-check 2026-10-17: the Spec V3 mailbox passwords are only in gitignored content/drive-source/ and in public-repo history (1d6512cb, redacted 0ec14930). HEAD and tracked files are clean. These are not the live mailbox passwords; the residual action is still Lee-Ann rotating the reused values (Brad to remind). A history rewrite on a public repo is Brad's call only.
- 17 of 18 societyEvent docs in Sanity are unpublished drafts, which is why /events shows 1. Editorial: publish only after content is confirmed.
- Merge order note (2026-10-17): F18a → F18b (rebase) → site-77 r6 / F19. Whichever of site-77 f9 and F19 lands second re-captures f9-baseline.json (SAOC head/markup) and F19 nos-baseline.json/fonts-baseline.json as needed.
- F23 font numbers (site-77, r6 build, 8 NOS routes): 5 font preloads per route (Crimson Pro x2, JetBrains Mono, Lora, Manrope). Unused bytes 152.8/121.5 KB (390/1280) on most routes, 305.6/242.9 KB on symposium. Total font traffic 293.6 KB / 8 requests typical, 375.3 KB hub/about, 528.1 KB / 13 requests symposium. Manrope is still visible on NOS at 390 after the utility-bar removal, so F23 must find where. Acceptance: NOS loads only Fraunces + Karla (design-cb v4).
- F23 findings (F19 dev, 2026-10-17): Lora rides every marketing route via components/chrome/SaocLockup.tsx (Lora() loader, imported by Header/Footer in the shared (marketing)/layout.tsx). The split needs SaocLockup to read --font-lockup-loaded set in a (saoc) layout :root <style>. Side effect: /tickets/* and not-found keep SAOC chrome outside (saoc), so they lose the faces unless tickets/ moves too. The route move breaks path-pinned checks (scripts/checks/verify-show-page-m4.ts, contracts/contract-b5-judging.yaml and others).
- DECISION NEEDED (Brad, production config): the vote-1C pattern ("shown on beta with marker") cannot work on the deployed beta today. withholdPlaceholderProse() (lib/data/show-pages.ts:488) needs SHOW_PLACEHOLDER_PREVIEW=true plus both BETA_BASIC_AUTH_* set when the page is built (pages are prerendered). apphosting.yaml has no SHOW_PLACEHOLDER_PREVIEW, and the wall credentials are RUNTIME-only. So deployed beta withholds exactly like public, which fails closed (safe). Enabling the marked preview on beta needs apphosting.yaml to add SHOW_PLACEHOLDER_PREVIEW and BUILD availability for the two wall secrets. That's production config and secrets, so it's Brad's go. Local review builds (:3012) work when the creds are set at build time.

- [2026-10-17] F23+ candidate (design-cb): /judging lists the six awards twice (code list + cards); proposal keep cards, drop list — content removal, needs 3-way vote. Also: footer emblem lazy-load hides it in full-page captures (capture-shots scroll/eager).

- [2026-10-17] F24 SEO metadata (design-cb rulings, FINAL; dispatch after 05:30 lean window + after F19/batch2/F18b merge to avoid conflicts): P1 home title duplicated -> title {absolute:"South African Orchid Council"}; P2-1 NOS inner template "%s — National Orchid Show | SAOC" (hub keeps "National Orchid Show | South African Orchid Council"); P2-2 FAQ title = h1 "Frequently asked questions"; P2-3 descriptions <70 fall back to lede cut at sentence <=155, >160 cut at last sentence <=160, never mid-word. Codi reruns sweep script after.

- [2026-10-17] PROD BLOCKER (data, Brad-only — deletion not votable): live Firestore holds test ticket orders (pool 3 sold, VIP 2 sold) that count toward public sold totals. Before go-live either Brad approves purging them, or a feature excludes test-flagged orders from sold counts (no deletion). Flagged by design-cb 2026-10-17.

- [2026-10-17] 3-way vote item (design-cb): tickets audience card "Trade vendor showcase, application and gated registration." (nav-config.ts:260 descriptor) — "gated" is internal wording, not visitor language. Predates F18b; needs a vote (copy change).

- [2026-10-17] VOTE r7 venue naming DONE (b) 3/3 (saoc-2b, site-77, design-cb): Sanity showVisitorInfo.publicTransport -> "Public transport options to The Hangar, Stellenbosch Flying Club have not been confirmed." (rev b293KmNbo0z5K9RnfbYJ6n; backup .tmp/sandbox/venue-vote/backup-20261017.json). Postal addressLines "Stellenbosch Airfield, R44" left unchanged per design-cb.

- [2026-10-17] Sanity webhook did NOT refresh beta after a showVisitorInfo publish (manual POST /api/revalidate on beta fixed it). Check the Sanity webhook config/secret for beta.saoc.co.za before prod. Also vote item (design-cb): workshops SESSIONS_NOTE first sentence ("the products below are the sellable…") contradicts the page; proposal withhold it on public, keep "Per-session bookings are not yet available for purchase."

- [2026-10-17] F24 scope add (design-cb P1, vote 1C): static unsourced "21 societies" on public — app/(marketing)/societies/page.tsx:93 hero lede and media-kit/page.tsx:97; withhold on public via withholdPlaceholderProse(), show marked on preview.

- 2026-10-17 06:55 — r7 (fix/nos-critique-r7 @ 8e1d31d7) merged to main (ff from 1f8ad3de). Merged before Codex round 5 (usage limit until 10:42) because --gold is a live P1 fix; Codi PASS + Opus interim QA PASS. Codex round 5 runs post-merge on main; findings → r8 with queued P3s. F18b told to merge 8e1d31d7 and not define --gold.
- [2026-10-17] POST-SUNDAY cleanup: boot guards fail on 2 dead SAOC specs (git b7af130c, June): specs/gate-timeout-fix/contract-f1.yaml ("mapping values are not allowed here") and specs/mission-slug-collision-fix/contract-f1.yaml ("expected a single document"). Not a harness defect (athanor-59 verified). Repair the YAML or archive both specs out of specs/.
- [2026-10-17] r8 queue (site-77): design-cb r7 live check on :3013 @8e1d31d7 PASS on gold disclosures. P2: chip wraps at 375px; ruling ≤419 letter-spacing 0.02em. P3: chip not tightened at exactly 700 on exhibitors/what-to-expect (699 breakpoint). F18b .nk-disclosure told to follow same rule.
- [2026-10-17 07:20] r8 fix/nos-critique-r8 @6bffbe7c (on main 8e1d31d7; F1 chip tracking ladder, F2 getting-there lede, F3 --green-1/2, F4 attraction ids/h3, F5 emergency gold band + tel links). Gates f1-f5 green, Codi PASS, Opus interim PASS. HOLD for Codex (after 10:45) — no live P1.
- [2026-10-17] r9 P1 (site-77): NOS lockup PNGs ~537KB eager per page (header 1200px @306 shown; both footer variants downloaded). Codi ruling: next/image header w/ sizes; single lazy <picture> footer; check <=80KB lockup bytes + 1 footer req at 1280/390. Post-F18b: Codi re-measures /national-show/tickets LCP.
- [2026-10-17] r9 fix/nos-critique-r9 @4c9187bd (stacked on r8): F1 lockup delivery 537KB->~33-38KB DPR1 (DPR2/3 390=85KB report-only, Codi accepted); F2 research chips "Not yet confirmed"; F3 fractional media gaps; F4 emergency filter null-safe. Gates green, Codi PASS, Opus PASS. HOLD for Codex with r8. Merge order r8->r9.
- [2026-10-17 12:10] Codex: r7 round5 PASS (closed); r9 4c9187bd PASS; r8 6bffbe7c FAIL P2 (ShowStatusLine.tsx:79 note aria-label missing when exhibitor pendingLabel blank; not live). site-7d fixing r8 (opus retry1) + rebasing r9; hold both. Conflict risk: F18b also edits ShowStatusLine.tsx chip ladder/shortOnNarrow.
- [2026-10-17] F18b 81490e7a Codex P2s (latent, not live — verified Sanity read-only): (a) sunset-cocktails pooled count sums only active SKUs; couple SKU inactive — if it ever had sales, hub over-counts. (b) after early-bird cutoff hub sells early-bird slug at regular price; checkout 409s if no regularPrice — live early-bird SKUs (early-bird, weekend-pass-early-bird) have earlyBirdCutoff null so never triggers. Fix both post-launch or before setting any cutoff. PROD CHECK: Sanity active ticketTypes include fictional-test-show-general-admission + qa-fixture-ticket — confirm not rendered on prod show.
- [2026-10-18] F18b MERGED: main ff 8e1d31d7 -> 81490e7a (Codi PASS on :3014, A1-A38 green ex A15, e2e 148/0, Codex no P0/P1; P2s latent, logged above). :3013 rebuilt on 81490e7a. F24 architect dispatched (spec/lw-f24). Votes V1 "gated registration" (nav-config.ts:260) + V2 workshops SESSIONS_NOTE sentence 1 sent to design-ad + site-7d (saoc-82: V1 b, V2 a). r8/r9 awaiting re-stack on 81490e7a.
- [2026-10-18] VOTE V1 (b) + V2 (a) CARRIED 2/3 (saoc-82, site-7d; design-ad pending): V1 nav-config.ts:260 "gated registration" -> "application and registration."; V2 workshops SESSIONS_NOTE sentence 1 withheld on public, foot kept. Folded into F24 contract.
- [2026-10-18] r8 restack ac3a4261 Codex rd2 FAIL P2 (latent in main F18b): StatusMarker shortOnNarrow shows "To be confirmed" on plan-your-visit research badges <360px; site-7d fixing in r8 (pending-only narrow pair, pending markup byte-identical).
- [2026-10-18] r8 (812dbaa2) + r9 (d05c85a5) restacks MERGED: main ff 81490e7a -> d05c85a5. Gates green, Codex PASS both. Backlog: nos-structure.css var() fallbacks for undefined tokens (--fs-sm l.771, --nk-field l.882, --fs-lg l.1347, --fs-base l.1354/1535/1572) pre-existing from F18b. Stale refs fix/nos-critique-r8/r9 on origin can be ignored.
- [2026-10-18] site-7d re-measure on d05c85a5: R50 status line, weekday string, sibling h2 (public), A1 facts strip, 60ch all DONE. OPEN: R50 P1 what-to-expect dates card must precede R11 disclosure -> site-7d r10 F2 (after token fallbacks r10 F1). Codi obs: ~230px gap at 1280 between dates card and host/venue aside.
- [2026-10-18] CORRECTION: --nk-field (nos-structure.css:882) is NOT a defect (set inline per .nk-stub in keepsake/parts.tsx:64). Real gaps --fs-sm/--fs-base/--fs-lg -> r10 F1 defines from nos-v4 plan-your-visit.html :root (identical to fallbacks, no visual change).
- [2026-10-18] r10 (81552296) MERGED: main ff d05c85a5 -> 81552296 (F1 --fs-sm/base/lg defined, no visual change; F2 what-to-expect dates card first). Open w/ Codi: question-marker short tag; .nk-chip 12.8px vs nos-v4 12px (site-7d recommends keep).
- [2026-10-18] F24 Codex P2s accepted (degraded states, no copy to cut): sponsors desc stays 33ch once sponsors exist (no lede passed); plan-your-visit desc stays 161ch if Sanity planIntro absent; sa-exhibitors stays 67ch if show summary absent. Revisit when Lee-Ann supplies copy. e2e note: local e2e needs empty BETA_BASIC_AUTH_* or the wall blocks every page.
- [2026-10-18] F24 MERGED: main ff 81552296 -> b7ce1bcc (A1-A14 green, e2e 148/0, Codex P1 rejected (computed live-region count), 3 P2 accepted). Follow-up: content/national-show-routes.json:248 purpose still says "gated registration" (nav descriptor is documented as trimmed prefix of purpose) — align with V1 deletion in a later small change. Codi has not visually reviewed F24 (societies lede withheld; preview marker below hero; workshops foot-only disclosure verified by screenshot).
- [2026-10-18] F24 follow-up: workshops/page.tsx duplicates the chip-fit class ladder as a local const because ShowStatusLine.tsx does not export CHIP_FIT_CLASSES. Export it + import in workshops (drift risk if Codi changes the ladder). Small, post-launch or next site-7d round.
- [2026-10-18] F24 hygiene 26fde668 merged (stale gated pins repointed). PRE-EXISTING (not F24, verified on 81552296): vendor-p1-targets/check-labels-static obsolete (expects old "Exhibitors and Vendors" rename; main has "Trade Vendors") — retire/supersede; check-descriptor-provenance archive ("Previous editions." vs purpose "...and their champions.") + symposium ("National Orchid Show Symposium" vs "SAOC Symposium" — check Drive copy); check-featurerail-blurb-provenance (featureRail.blurb missing vs menu-system-layout4 f7 golden). Routed to site-7d r12.
- [2026-10-18] CORRECTION (d): main label is still "Exhibitors and Vendors" (not "Trade Vendors"); check-labels-static fails only on its title pin (F24 911fd349) — re-pinned in r12. r12 decisions: archive manifest synced to "Previous editions."; symposium manifest -> "National Orchid Show Symposium" (F18 ruling); featureRail blurb check RETIRED (blurb removed deliberately in F8, e2e asserts absence).
- [2026-10-18] Sweep (site-7d) on 221fd6f4: both sites clean on overflow/console/status/h1/title+canonical uniqueness/64 links; SAOC 0 axe. r12 adds: F2 /tickets/vip h3-under-h1; F3 NOS (+SAOC if same) 404 meta doubled suffix/canonical/noindex; F4 sourced meta descriptions for /about /societies /judging /events /contact /sponsors + /tickets/*. Target size bar = WCAG 2.2 AA (2.5.8), no AAA ruling.
- [2026-10-18] Re-sweep 26fde668: 0 WCAG 2.5.8 AA target failures both sites; CLS <0.01 everywhere except /national-show/tickets@375 0.059 (nk-fan, nk-facts) P3 noted; SAOC 404 missing <main> + title same as home -> r12 F3.
- [2026-10-18] V1/V2 now 3/3 (design-ad concurs). Conferences public tracker CLEAN on 81490e7a (closed). Tickets LCP pending warm re-measure.
- [2026-10-18] Codi rulings: question marker gets NO short tag (pending-only, already on main since r8); .nk-chip stays 12.8px (--fs-xs floor). No code change. Gaps (what-to-expect ~230px, ShowContentState) pending Codi live check.
- [2026-10-18] Codi live check b7ce1bcc PASS (emergency band, R11 chips all widths, lockups <=80KB, tickets LCP 1.24s warm, F24 templates, V1/V2, societies count). Findings -> site-7d r12: F5 P1 phones download both lockups (~62KB/view; confirm true 390); F4 add /societies /about /tickets/* descriptions + title casing per h1 (R64) + symposium desc -> lede (update F24 goldens); F6 doubled section gap after disclosure (<=96@1280, <=64@390).
- [2026-10-18] POST-LAUNCH P3: /tickets/<missing slug> soft 404 (HTTP 200; tickets/[slug]/loading.tsx streams before notFound()). Neutralised for SEO by r12 F3 noindex/no canonical. True 404 needs slug check before streaming boundary.
- [2026-10-18] r12 F5 lockup double-download NOT reproduced on fresh load (real viewports/DPRs: 1 header + 1 footer); Codi repro = load-1280-then-resize (normal picture reselection) -> F5 becomes regression-guard check only. F6 gap confirmed 230@1280/144@390, fixing. LongFormPage p->p 1.5em vs Codi 1em: awaiting Codi ruling (site-wide scope?).
- [2026-10-18] PROD BLOCKER (Brad at cutover): Sanity ticketTypes qa-fixture-ticket (R0, "Do Not Purchase") and fictional-test-show-general-admission (R10) are ACTIVE with public 200 pages -> set inactive (not delete) before prod; check e2e/QA dependence on qa-fixture first. (field-trip R200 is the REAL product.) r13 queued: titles follow h1 WORDING (NOS about/symposium/international-guests/archive/vendors payment+status; SAOC /about /judging /contact /societies). Symposium desc: word-boundary cut + ellipsis, documented single-route exception to F24 D3/A3.
- [2026-10-18] r12 (5f8d2311) MERGED: main ff 26fde668 -> 5f8d2311 (F1 provenance, F2 ticket h2, F3 404 meta/main/notFound in generateMetadata, F4 descriptions + R64 casing + symposium cut, F5 lockup guard, F6 40px gap). /societies description stays default (no source). Next: r13 title wording.
- [2026-10-18] r13 (9d16cf96) MERGED: main ff 5f8d2311 -> 9d16cf96 (titles follow h1 wording: international-guests, vendor stand payment, /about, /judging, /contact; exceptions / and /societies sentence h1s; NOS about/symposium/archive pending Codi re F24 T3).

- 2026-10-18 r14 merged ab7c549c (ff from 9d16cf96): F1 tickets-hub single section unit (Codi ruling 3); F2 /societies description = Lee-Ann About l.9 verbatim (saoc-82 ruling (a), no source on page). Codex PASS (site-7d). Next: Codi visual pass r13+r14.
- 2026-10-18 r15 SAOC org visual pass (site-7d): 17 routes, 0 code P0. PROD GO-LIST += (a) /privacy /terms /refunds are AI-drafted, need legal review or Brad accept; (b) /refunds provisional figures need Brad/Lee-Ann confirm. Vote: withhold society estimates on public carried 2/3 (saoc-82, site-7d) -> r15 F1. r15 F2 focus ring, F3 contrast started; F4 404 chrome, F5 sponsors CTA, media-kit files, event-row affordance held for Codi. POST-LAUNCH: /about committee absent-section wording (lib/data/show-pages.ts:577).
- 2026-10-18 P0 beta /national-show/tickets 500: standalone bundle missing semver/functions/valid.js (firebase-admin/auth chain), rev saoc-prod-build-2026-10-18-008. Fix in progress (Dev_Son5_M1-F18_LaunchWeekend-3, fix/p0-standalone-semver). Open Q to Brad: backend is named saoc-prod; confirm beta != prod.
- 2026-10-18 P0 fix ready: fix/p0-standalone-semver 0fdffebb (outputFileTracingIncludes semver/**; serverExternalPackages did NOT work). Repro 500->200 on local standalone; Codex PASS. Merge HELD pending Brad confirm beta.saoc.co.za != prod (backend named saoc-prod). POST-LAUNCH: tickets/page.tsx:30 imports viewerIsVerifiedAdmin (firebase-admin) on public hub for an admin-only banner -> lazy import behind cookie check.
- 2026-10-18 r15 READY+HELD: b82b90ab (F1 withhold society estimates/21-count on public, F2 header ring-primary, F3 contrast; R3 check fixed). F2b READY+HELD: e330bd72 on r15 (18 focus rings -> primary; SaocLockup excluded w/ R5 guard; .nos-theme vendor/confirmation rings suppressed by NOS reset). Codex PASS both. Merge order on Brad beta!=prod: 0fdffebb -> r15 restack -> F2b restack. Codi held: 404 chrome, sponsors CTA, media-kit files, event-row affordance. Codi session stuck waiting all session; NOS visual pass not started.
- 2026-10-18 athanor-52 friction reply: rollouts curl + app/** globs fixed in harness 3.8.38/3.8.40 (post-launch update). Boot-guard YAML failures are OUR spec files (gate-timeout-fix, mission-slug-collision-fix contract-f1) - fix post-launch. Subagent "Unknown skill" workaround: brief subagents to Read .claude/skills/<name>/SKILL.md directly.
- 2026-10-18 P0 fix 0fdffebb merged to main (Brad re-sent beta 500 screenshot = go; beta is dev site per memory). Awaiting App Hosting rollout + beta curl confirm.
- 2026-10-18 P0 CONFIRMED on beta: /national-show/tickets 200 after rollout of 0fdffebb (~7 min); /, /societies, /contact, /admin/login 200.
- 2026-10-19 r15 (4a662f8c) + F2b (cea06daf) merged to main by ff to cea06daf. App diff == Codex-passed trees + 0fdffebb. Stale r15 branches pruned. Next: beta rollout confirm; Codi held items still blocked on Codi session.
- 2026-10-19 r15+F2b CONFIRMED on beta (~7 min): ring-primary live; tickets, /, /societies, /refunds, /contact, /national-show 200. Note: /societies on beta has 0 "estimate" hits, so beta behaves as public mode for this (contradicts "beta unchanged" assumption) - verify SITE_PUBLIC_LAUNCH on App Hosting if it matters.
- 2026-10-19 Codi unstuck: NOS visual pass started on :3013 (ab7c549c). Rulings: T3 (a) short titles kept; LongFormPage p->p stays 1.5em. Four held items (404 chrome, sponsors CTA, media-kit files, event rows) resent; Codi never received them. Results -> r16.
- 2026-10-19 Codi NOS full pass (34 routes x2): 0 P0, 0 ship-blocking. r16 dispatched to site-7d: F1 NOS (violet vendor submits->royal, confirmation back-link 24px, sentence-case vendor h1s, drop exhibitors back link, programme gets hub ticket cards); F2 SAOC (404 full chrome+band+sentence case, sponsors CTA->primary); F3 (media-kit -> Eulophia emblem/lockup files, retire line-art; What's on rows link to /events/<slug> w/ STOP if any 404).
- 2026-10-19 Sanity edit (r16 F1, Codi sentence case): showExhibitorInfo.title "Exhibitor Information" -> "Exhibitor information"; rev uEiB3idUVUWG4MN1Q0V3PI -> b293KmNbo0z5K9RnfmAhlk; backup .tmp/sandbox/sanity-backup-r16/showExhibitorInfo.json. No draft existed.
- 2026-10-19 r16 merged 5c093d6e (ff from cea06daf): F1 NOS consistency, F2 404 chrome + sponsors CTA, F3 media-kit emblem files + event-row links. Codex R3 PASS. r15 branches pruned. BACKLOG (post-launch): app/sitemap.ts:95 + event-link.ts:8 build /events/${slug} unguarded.
- 2026-10-19 r16 CONFIRMED on beta (~8 min): media-kit emblem live; 9 key routes 200, unknown route 404, exhibitors h1 "Exhibitor information". All visual-pass fixes (both sites) now live on beta. Remaining = Brad prod go-list only.
- 2026-10-19 BRAD: "push the site to beta.saoc.co.za for my review, old site stays at saoc.co.za". Beta already serves main 5c093d6e (r16 confirmed live), behind the password wall. NOT flipping SITE_PUBLIC_LAUNCH (it would lift the wall + noindex). No DNS change. Prod cutover + payments/test-orders/legal decisions deferred until after Brad review.
- 2026-10-19 BRAD: ticketing stays in TEST mode for his beta review. Verified apphosting.yaml carries only PAYFAST_SANDBOX_* and OZOW_SANDBOX_* credentials (no live keys) -> no real charges possible.
- 2026-10-19 Brad review CLOSED ("fix the items, check vendor doc; review after"). Dispatched: site-7d r17 (F1 exhibitor card -> vendor flow, F2 NOS footer vertical monotone + remove SAOC para/eyebrow, F3 NOS hero diagnosis table first); Codi rulings (footer logo variant, sub-page heroes, hub crop, exhibitor CTA label) + PDF/email system design; Dev F18: Sanity price audit + cocktails R800 (capacity 200 kept, Q to Brad); Arch F31: Ozow 6-status contract; Analyst F30: Lee-Ann vendor doc diff + vendor listing plan. Review notes: .agent/memory/scratch/brad-beta-review-2026-10-19.md
- 2026-10-19 Sunset Cocktails (Single) Sanity price 250 -> 800 (rev jsBdKVrXo1p7SIHX1tbosL -> rqa7QJaZ4YFDhltyPMvwSS; backup .tmp/sandbox/sanity-backup-r17/). Beta renders R800 (webhook ~2-3 min). Audit: all other active ticketTypes match lib/provisional-figures.ts on price/regularPrice/capacity/releasedQuantity/earlyBirdCutoff; only extras = 2 test fixtures. Capacity 200 kept; Brad Q 100 vs 200 open.
- 2026-10-19 Analyst F30: Lee-Ann vendor form 7 Oct edit = no field changes vs 26 Aug snapshot (only a stray "P" typo + curly apostrophe). Pre-existing deviation: marketing-permission wording not verbatim -> r17 F4 (labels only). Vendor Listing.xlsx = internal outreach tracker (~35 vendors, contacts = personal data), NOT a listing shape, never seed public page. Listing plan: publish approved+PAID only via admin "Publish to listing" -> Sanity vendorNursery (reuses /vendors, sa-exhibitors, international-guests), allowlist projection, absent consent = don't publish. Brad Qs: paid vs approved; Sanity publish vs Firestore; page title; exhibitor/trader split. Lee-Ann Qs (7) pending her questions doc.
- 2026-10-19 CORRECTION: vendor marketing-permission wording is ALREADY verbatim on main (63237d28; VendorMarketingFieldset.tsx:26-34 = snapshot l.183-184). Analyst read the stale local working tree (branch feat/conference-workshop-tickets), not origin/main. r17 F4 closed. LESSON: brief read-only agents to read origin/main (git show origin/main:<path>), not the working tree.
- 2026-10-19 F31 Ozow 6-status contract done (contract-f31.yaml, 9 assertions). Today: non-Complete ITNs write nothing; Pending tickets lose seat at 30 min; vendor Pending -> re-initiate mints new attemptId -> later Complete rejected as stale (double-pay risk). Decided (saoc-82, revertible constant): Pending/PendingInvestigation hold 72h; vendor re-initiate blocked while pending. Dev_Son5_M1-F31 implementing on fix/f31-ozow-statuses. Live sandbox protocol runs after deploy.
- 2026-10-19 CLEANUP: 45 stale worktrees removed (archive of unsaved diffs in .tmp/sandbox/archive-2026-10-19/; unpushed detached commit pinned as branch backup/wt-nos-f3-chk; feat/vendor-invite + feat/footer-single-wosa branches kept). :3013 server stopped. Remaining: wt-f31 (active). Main working tree still on stale feat/conference-workshop-tickets (392 behind) - switch held for Brad (autonomy.json local edits + his branding consolidation). Brad rule: sprint-start sync, one starting point.
- 2026-10-19 Codi r17 rulings: footer = WHITE monotone vertical (200px >=701 / 160px <=700, centred, REG/NPO 24px below); about/faq heroes stay typographic (approved 5-photo map; photos there = request for new rights-cleared photography); hub bloom at 390 intended; exhibitor CTA -> "Apply to exhibit". Brand split for PDF/emails confirmed (NOS show mail, SAOC contact, light admin variant). Routed to site-7d; r17 F3 closed.

- 2026-10-19 r17 F2 footer CORRECTED by Codi (supersedes white 200/160): NOS-2027-logo-reversed-gold-vertical.png (one-ink = "monotone", 13.7:1 on #211A57), 360px >=701 / 280px <=700, gap to REG/NPO = calc(0.25 * emblem width) (~63/~49px) per brand PDF p.08 clear space. Relayed verbatim to site-7d before F2 build.
- 2026-10-19 r17 F2 addendum (Codi): REG/NPO restyle KEPT — "unchanged" = text+position only. Karla 700 12px .14em uppercase #F3F2D6 on royal (13.69:1), label role, triple-space separator kept. Relayed to site-7d.
- 2026-10-19 F31 Ozow 6 statuses MERGED: main 5c093d6e -> 39b15ec0 (FF, secrets scan 0, Codex PASS on 7b05e3db, post-PASS diff = 2 check files only). A1-A9 green incl. lint 0 errors (f12 shebang fixed). Pending/PendingInvestigation + PayFast PENDING hold 72h; vendor re-initiate 409 during hold. NEXT: confirm beta rollout, then live 6-status Ozow sandbox protocol. Worktree .tmp/sandbox/wt-f31 to remove after.
- 2026-10-19 r17 F1 Codex P1 ACCEPTED as product gap (option a): exhibitor CTA -> /national-show/vendors/apply per Brad, but the form requires business name, product category and >=1 stand, so a non-trading orchid exhibitor cannot complete it. LEE-ANN QUESTION QUEUED: which vendor-form fields are optional for non-trading exhibitors? Any field change = its own contract later.
- 2026-10-19 F31 LIVE on beta: build-2026-10-19-002 = 39b15ec0, rollout SUCCEEDED 13:00Z; smoke 6x200 + 404. QA_Son5_M1-F31 dispatched for the live 6-status Ozow sandbox protocol (restores gateway/toggle, lists test doc ids). r17 told to rebase onto 39b15ec0 (no file overlap).
- 2026-10-19 LESSON (site-7d): spec-check builds ran bare `next build`, which skips scripts/generate-image-variants.mjs; public/images/_opt is gitignored, so on fresh worktrees all loader hero/card images 404d in BOTH baseline and gate. r15/r16 visual nonreg was therefore blind to photo regions. Fix: checks run the generator before the build; baseline re-captured at 39b15ec0. Verified beta _opt images return 200 (beta builds run pnpm build), so nothing shipped is affected.
- 2026-10-19 r17 MERGED: main 39b15ec0 -> 430940a6 (FF; r17 diff identical to Codex-PASS 4c69202c; secrets 0). Codi approved full-row footer layout. F1 "Apply to exhibit" -> /national-show/vendors/apply + SearchOverlay; F2 gold vertical lockup 360/280, 0.25-emblem gap, REG/NPO label role. TODO after live: delete fix/nos-critique-r17 (4c69202c) and -restack branches.
- 2026-10-19 Codi delivered ticket PDF + 12-email system for Brad review (files in SAOC NOS Design project: .agent/memory/project/design/ticket-email-system/; SPEC.md, ticket-pdf-mock.pdf, email families A-D). Adds vendor-stand-forfeiture-notice to family B. 10 placeholders (SPEC §5) -> Lee-Ann doc after Brad OKs writes; 8 copy flags (SPEC §6). Route to site-7d ONLY after Brad approves.
- 2026-10-19 F31 LIVE QA (signed server-side Ozow notify to beta @39b15ec0): Cancelled/Error/Abandoned logged only, no write PASS; Pending/PendingInvestigation hold +72h with gatewayPending PASS; forged Complete fail-closed (server confirm rejected) PASS. GAPS: real sandbox Complete->paid live round trip, vendor side live, buyer pages, capacity at expiry, inbox. Settings unchanged (ozow, sandbox on). PROD GO-LIST: 6 test orders SAOC-2027-{RCPFZXBRMC5H,CDHTRXE6X6KE,CWY59YY1ZBXJ,AYVNX075WTC4,7ZR3M6TQYZ2C,D1GGZB4AYWTG}; 2 Pending hold seats until 2026-10-22.
- 2026-10-19 r17 LIVE on beta (430940a6): 5 pages 200, 404 ok, tickets page has "Apply to exhibit" x2 + reversed-gold-vertical lockup. Remote branches fix/nos-critique-r17 + -restack deleted (4c69202c superseded, restack merged).
- 2026-10-19 Brad: (1) Lee-Ann questions doc = no permission needed -> Analyst F32 appending dated block (PDF/email placeholders, copy flags, exhibitor optional fields, listing consent/fields, ticket names). (2) Vendor listing: APPROVED vendors for now (ask Lee-Ann re paid), data in SANITY editable by Brad+Lee-Ann, ONE listing -> Arch F30 writing contract. (3) Sunset Cocktails capacity -> 100 (Brad sheet; 200 was unsourced F2 estimate): Sanity single+couple patched 200->100 with ifRevisionID, backup .tmp/sandbox/sanity-backup-r18/before.json. TODO: lib/provisional-figures.ts SUNSET_COCKTAILS_POOL_CAPACITY still 200 (fallback constant) - fold into next dev. (4) Main tree moved to main (abd58f59): logs merged 0 lines lost, launch-weekend specs committed, stale code archived .tmp/sandbox/archive-2026-10-19/main-tree-move, old HEAD pinned backup/main-tree-conference-workshop-2026-10-19. BLOCKED: .claude+.grok autonomy.json and .agent/profile.json (newer "autonomous" 2026-10-16 copies in archive keep/) - classifier denied copy as self-modification; now at origin "high". (5) Brad asked why 72h Ozow hold - answered.
- 2026-10-19 Lee-Ann questions doc: "Questions — 19 October 2026" appended (verified prefix-identical before/after, 5238->7188 chars): PDF/email 9 placeholders, 8 wording flags, exhibitor optional fields, listing a-d. Skipped as already asked: ticket names (Part C), Vendor Listing sheet internal? (Part B s4).
- 2026-10-19 F30 vendor listing: contract committed d46b7377 (10 assertions). Design: lib/vendor-listing.ts isVendorListingEligible = approved; admin POST publish-listing -> Sanity vendorNursery-<id> createIfNotExists only (re-publish never overwrites Studio edits); public fields name/country/website/bio only; marketingPermission full|listing-only = consent, blank needs admin ack. Orchestrator defaults (Brad full autonomy): Q7 logos/photos added by editors in Studio for v1; Q8 published vendors also appear on sa-exhibitors/international-guests (same type) - accepted. Lee-Ann Qs Q1-6,Q9 overlap the 19 Oct doc section. Dev_Son5_M1-F30 dispatched on feat/f30-vendor-listing.
- 2026-10-19 F30 MERGED: main d46b7377 -> cf573d3c (FF, secrets 0, A1-A10 PASS, Codex PASS no findings). 8 files. Main tree fast-forwarded. TODO after live: publish 1 named test vendor + delete in Studio (contract note) - needs an approved test submission; docs/vendor-listing.md not yet written.
- 2026-10-19 CI RED on main since 18 Oct (Brad reported via email; last green ef040964 16 Oct). Local repro at 19ede2ea: ratchet FAIL (f2 A1-5 + f8 A1,2,4 scripts archived by me in main-tree move; f12-A10 missing; f16 YAML parse error), lint 0 errors now. Dev_Son5_M1-F33 dispatched on fix/f33-ci-green. Twice-daily health-check cron set (08:13/17:13, session-only 7d).
- 2026-10-19 F33 CI fix MERGED (d5da6126): sole CI failure was the ratchet; restored f2/f8 check scripts from archive (also cleared f12-A10, which shells to f8), quoted f16 YAML line 53. Local: lint 0 err, tsc, build, e2e 148 pass (with CI env), ratchet PASS. Baselined parse errors left: gate-timeout-fix + mission-slug-collision-fix contract-f1. Local e2e fails with .env.local copied in (beta wall?) - not CI.
- 2026-10-19 CI GREEN on main again: runs 39281206269 (d5da6126) + 39281220490 (158c1e26) success.
- 2026-10-19 F30 review fixes MERGED 340895db: Codi R-F30 P2 button state from listingDocumentId + plain status text, P2 consent confirm plain wording, P3 website link mt-auto; SUNSET_COCKTAILS_POOL_CAPACITY 200->100 (4 check pins updated). A7 WAIVED by orchestrator for lib/provisional-figures.ts only (authorised extra item). Codex R2 PASS. Merged feature branches deleted.
- 2026-10-19 Codi R-F30 re-check at 93940e04: code PASS on all 3; live /national-show/vendors has no overflow at 1280/390 but renders an EMPTY grid (0 vendorNursery docs published). Card alignment check deferred until the first real vendor is published; tell Codi then. Note: do not ask peers to use SAOC .env creds (Codi standing rule).
- 2026-10-19 Codi live PASS on beta 93940e04 (Canary, 1280/390, no overflow): r17 footer (gold vertical 360/280, gap 36/28 = 0.25x measured emblem, REG/NPO label role), "Apply to exhibit" CTA 50px target; r16 404 chrome, sponsors CTA, media kit 3 files, event row links. Open: F30 cards await the first published vendor; r15 focus-ring watch needs a keyboard pass.
- 2026-10-19 r15 focus-ring watch CLOSED (Codi, beta 93940e04): 8 header controls + 8 NOS menu links show a 2px violet #7E3F97 ring on keyboard focus, no royal ring, no clipping. Nothing to fix.
- 2026-10-19 Codi checkout review (/tickets/early-bird at 390, beta 93940e04): all 4 P2s from 10-17 landed. New: P2 aria-live wraps the submit button; P3 card h2 duplicates the h1; P3 no breadcrumb on the checkout step. Routed to site-7d as r18.
- 2026-10-19 site-7d main-tree sync: tree now on main 93940e04; old HEAD pinned backup/main-tree-feat-nos-hero-lockup-20261019; 0-loss merges staged in its .tmp/sandbox/archive-20261019/main-tree-move/keep/. BLOCKED: the rsync restore of keep/ was denied by the auto-mode classifier [Modify Shared Resources] -> needs Brad to run it via ! in the site-7d session. Harness: do NOT commit 3.8.31 from the site-7d tree (its main harness differs in ~93 paths incl. floor hooks); leave to the harness owner.
- 2026-10-19 Codi ticket-state review -> site-7d r19 (cancelled CTA alignment, confirmation not-found pattern, page titles). COPY FLAG (pre-launch, needs owner): cancelled message "Your reservation has been left open as reserved — you are welcome to try again whenever you are ready" (app/(marketing)/tickets/cancelled/page.tsx:37 fallback; Sanity copy.cancelledMessage may override). Reservations actually expire (expiresAt ~15-30 min; F31 QA observed), so "whenever you are ready" is inaccurate. Not reworded (no-invention).
- 2026-10-19 Codi NOS footer sign-up review -> site-7d r20: border alpha .36->.55 (1.4.11), autocomplete/name=email (1.3.5), visible "Email address" label (reuses aria-label text).
- 2026-10-19 r18 MERGED main 93940e04 -> 5c30b171 (FF; gate 5/5 + R6 line-break check; Codex R3 PASS; secrets 0): checkout live region on Total only, card title <p>, breadcrumb with nk-crumb units (no orphan dash), aria-current on last crumb (hub too). r19 (43c9758b) asked to restack onto 5c30b171.
- 2026-10-19 r18 LIVE on beta (a4807791, CI success): /tickets/early-bird + /tickets/saoc-symposium 200 with breadcrumb + aria-current (checkout route is /tickets/<slug>, not /national-show/tickets/<slug>).
- 2026-10-19 Codi r18 live PASS (a4807791, 1280/390): live region, heading outline, breadcrumb (separator and crumb wrap as a pair). Checkout review closed. Open: r19 restack, r20 footer sign-up.
- 2026-10-19 Codi P2 doubled section gap: workshops at 390 fixed (64px); what-to-expect at 1280 still 262px (adjacent same-tone .nos-section 120+120) -> added to site-7d r20.
- 2026-10-20 Codi plan-your-visit P2 (no map link) NOT REPRODUCED: Sanity nationalShow + show-19-2027 venue.mapsUrl already = the golden OSM URL; beta /national-show/plan-your-visit HTML has 2x openstreetmap + 2x "Open in a map". No change made. Pin = airfield reference point, not entrance: owner to confirm before go-live.
- 2026-10-20 Codi r19 code pre-check PASS (3 rulings). Flag: ConfirmationPoller router.refresh() on 404 could loop if server isBookingNotFound throws -> site-7d told to add a one-shot ref guard + Codex before merge.
- 2026-10-20 Codi RULING r20-footer (per Brad direction "NOS Footer should follow the same layout as the SAOC footer"): supersedes r17 layout; SAOC Footer.tsx grid (4x280 at 1280), gold vertical lockup 248px in col 1, REG/NPO left under it 32px gap, NOS tokens only; acceptance height within +-40 of 476px, cols x 32/344/656/968. Folded into site-7d r20 with the sign-up fixes and the doubled gap.
- 2026-10-20 01:13 SAST BLOCKED: machine DNS down since ~00:55 (scutil --dns has no nameservers; github/beta curl 000). Blocks pushes, next build (Google Fonts), rendered checks, CI and deploys. site-7d suspects the MacOS Tweaks session (killed a site-7d process at 00:48). Escalated to Brad via push notification; no agent touches system or network settings.
- 2026-10-20 Codi F18a recheck: CLOSED photo reuse + sa-exhibitors h2=h1. -> site-7d r21: programme heading outline (P2), sentence-case headings (P3). OWNER/LEE-ANN FLAGS (pre-launch): /sa-exhibitors lede duplicates the /vendors h2 word for word; /national-show/programme still shows the "PLACEHOLDER COPY ... AI-generated" banner (R51 go-live blocker, needs approved copy).
- 2026-10-20 r21 spec a715a89a (local, spec only). MY QUEUED SANITY EDITS, to run AFTER the r21 gate passes, with backup + ifRevisionID, verified against live data: showPage-11-programme intro heading unset; showPage-11-programme how-the-programme-will-work heading -> "How the programme will work"; showPage-04-south-african-exhibitors title -> "South African exhibitors"; its overview heading -> "South African exhibitors"; its directory-coming heading -> "Exhibitor directory". Codi notes out of scope: OG image text, nav label, workshops/conferences "Programme" h2.
- 2026-10-20 Codi symposium review: OWNER/LEE-ANN BLOCKER pre-launch: Sanity conferencePresenter "elbert-wijaya" bio contains the author draft note "(for example, Dendrobium sp. with blue flowers, you know the species name!)", publicly visible. Supply the species name or remove the parenthesis. QUEUED for Lee-Ann questions doc once DNS is back. P3 bio toggle label -> site-7d r22 ("Show less" when expanded, my ruling as a UI control label).
- 2026-10-20 Codi intl-guests + wosa-conference (390): P2 h2=h1 + P3 casing folded into site-7d r21. GO-LIVE BLOCKER (R51): "PLACEHOLDER COPY ... AI-generated" notices remain on 3 NOS pages: programme, international-guests (x2), wosa-conference (x3). Need approved copy from Lee-Ann.
- 2026-10-20 r21 addendum 2 d47756c9. MY POST-GATE SANITY EDITS now 9: (6) showPage-05-international-guests-and-exhibitors title -> "International guests and exhibitors"; (7) its intro heading unset; (8) its who-will-appear heading -> "Who will appear"; (9) showPage-07-wosa-conference about-the-conference heading -> "About the conference". Plus the earlier 5. Verify against live data, back up, ifRevisionID, after the r21 gate.
- 2026-10-20 Codi /national-show/exhibitors review (390) -> site-7d r23: status sentence pill -> body text in disclosure; key-date TBC pill -> short nowrap "To be confirmed"; sticky "On this page" at <=700 (my ruling, no new copy). Note: the page still says "Exhibitor entries are not yet open ... Contact the council", while exhibitors now apply via the vendor form (r17 F1). Copy consistency question for Lee-Ann.
- 2026-10-20 Codi FAQ review (390): r23 widened, short nowrap TBC pill at the StatusMarker component for all routes <640. LEE-ANN/OWNER flag: FAQ entries "Where exactly is the show being held?" and "How do I get to the show from Cape Town International Airport?" carry the TBC pill although their answers state the confirmed venue (The Hangar). The per-entry Sanity flag contradicts the rest of the site; confirm and unflag. The price entry is rightly flagged (provisional).

- [ ] LEE-ANN FLAG (Codi 2026-10-20, /events): hero lede promises events "across South Africa's affiliated orchid societies" but only 1 event (National Show) is loaded. Either society events need loading into Sanity, or the lede needs her adjustment. Add to her doc once DNS is back.

## NOS/SAOC critique queue — state at session wrap 2026-10-20 (saoc-82)
BLOCKER: Mac DNS/system resolver broken since ~00:55 20 Oct (host resolves, git/gh/curl fail) + Chromium mach error 141 (post-logout). Brad to fix network settings (possibly the MacOS Tweaks session). Twice-daily health check could not run (no GitHub/Firebase reach); last known: main a4807791, CI green, beta healthy.
site-7d queue, merge strictly in order, each: Codex → push → CI + rollout → Codi live check:
- r19 fix/nos-critique-r19-restack: gate 5/0 + Codex r2 PASS — READY TO PUSH on DNS.
- r20 SAOC-layout footer / signup a11y; r21 programme outline + sentence case (then 9 Sanity heading edits, listed above); r22 "Show less"; r23 exhibitors notice / sticky TOC / StatusMarker short tags.
- r24 9c66e6ee: CTA pairs full width ≤700 (archive, hub, archive/[year]); baselines after r23.
- r25 b328cfc2: SAOC brass button --radius-1 2px (UtilityBar pill excluded per Codi) + /judging Contact link 44px.
- r26 21eaa9a8: DownloadTicketButton + VendorRegisterForm submit → NOS Button primary.
- r27 14218649 (stacked on r26): NOS Button disabled state opacity .6 / not-allowed; r26 must merge first.
- r28 c521de30: /societies note → p-sm sans; chips full names, scrolling row <480, ≥24px peek, scrollLeft nudge.
- r29 (arrow only, SHA pending): EventCard → glyph as SocietyCard.
- r30 (ruled, to spec): formatShowDateRange cross-month/year (Codi dash rule), EventCard block start-date for cross-month, single TZ Africa/Johannesburg.
Lee-Ann doc flags pending DNS: listed above + /events lede vs single event.
Cron c8d8059d (health checks) is session-only — re-create next session.
- [ ] 2026-10-20 LEE-ANN DOC APPEND BLOCKED (DNS). Queued "Questions — 20 October 2026": (1) Brad: access to the responses of Google Form https://docs.google.com/forms/d/e/1FAIpQLSc_Wh63oPJDoNQ9PCK7Tzz0a1C-NDf41QxX0RMVWx9iYqJTRw/viewform (add Brad as collaborator, or share the responses Sheet); (2) /events lede vs the single listed event. The Elbert bio question is probably already in the doc (Part B, index ~1051), so it is skipped unless a re-read shows otherwise. ALSO: gws deleted its credentials.enc (keyring auth failure), so Brad must run `gws auth login` after DNS is fixed. Then re-run via Analyst F32.
- [ ] 2026-10-20 Codi route 30 /members ruling (1 P2: SuggestionForm per-field errors; 2 P3s; full text at the comms.md tail): queue for site-7d after r30. NOTE: after the restart, the session listed as "SAOC Site" is Codi. Site-7d is now the session named "NOS Design" (confirmed 2026-10-20).
- [ ] 2026-10-20 HARNESS HAZARD: `make update-template` (and `make sync-clones`) clone-syncs CLAUDE.md and GEMINI.md from AGENTS.md. SAOC's AGENTS.md holds stale architect-agent text (2.5KB, since 2026-06), so the sync overwrote the 17.6KB SAOC CLAUDE.md developer guide. Reverted with `git checkout -- CLAUDE.md GEMINI.md` before commit cbda2c43. It will recur on every update until AGENTS.md carries the real guide. That needs Brad: AGENTS.md is floor-protected. File upstream: clone-sync must refuse to shrink a target by more than about 50%.
- [ ] 2026-10-20 vendor-invite M1/F1 AWAITING BRAD SIGN-OFF: rebased onto cbda2c43, pushed as origin/feat/vendor-invite-r2 @ 69c1d6d6 (old remote feat/vendor-invite 3609ac46 is stale; a force push was denied by the floor). A10 fix (review table re-syncs rows) in ce85e48b. Contract updated: A2 now checks the transactional create; A12/A13 triad checks added. Gate: 11 PASS, A12/A13 ERROR until it is on beta. After sign-off: merge, deploy beta, run BrowserAgent and the gws manifests, re-gate, then the docs chain step.
- 2026-10-20 HEALTH CHECK (~17:40 SAST):
  - CI main green: cbda2c43 run 39446514738 success. The 10-19 CI reds were fixed by later runs.
  - RED: Refresh llms-full.txt fails daily because its direct push hits GH006 protected main (required check "build"). Dispatched Dev_Son5_M1-F1_HealthCheck to switch it to a PR flow.
  - App Hosting saoc-prod latest rollout build-2026-10-20-001 SUCCEEDED (13:14Z).
  - Cloud Logging: 0 ERROR entries in 12h.
  - Beta smoke: all 6 routes as expected (5x200, 404).
  - FIRESTORE: 29 orders stranded `reserved` past expiry (expiries 08-18 x4, 08-19 x1, 08-22 x8, 09-14 x1, 10-06 x1, 10-07 x10, 10-19 x4). These are sandbox test checkouts, and no reconcile-orders alert was logged in 12h. Check whether the Cloud Scheduler job is running, and clean these up before prod (extends the earlier "6 sandbox orders" item).
- 2026-10-20 CI: required check "build" never reported, because the CI job was named "ci". Fixed by PR #8 (3ca3fcf5), which renamed the job to build. refresh-llms now opens a PR instead of pushing to main. Bot-authored PRs need (a) a human to approve the pull_request run (first-time-contributor policy) and (b) a manual merge, since allow_auto_merge=false. BRAD DECISION: enable auto-merge and loosen the Actions approval policy for the bot, OR add a PAT/App token, OR accept a daily manual approval and merge. Also: admin pushes bypass the build check; consider "Do not allow bypassing".
- 2026-10-21 09:04 HEALTH CHECK: clean. CI main green (latest 1c9fa99f); rollout build-2026-10-20-004 SUCCEEDED; 0 ERROR logs in 12h; beta smoke 6/6 as expected. Unchanged: 29 sandbox orders stranded `reserved` (no new ones since 10-19); cleanup item stands.

### Health check 2026-10-21 (PM)
- CI main green (latest 10 runs green; CI 39569312765 and refresh-llms 39561200337 succeeded 2026-10-21). Only old reds remain, all from before #8.
- App Hosting rollout-2026-10-20-004 SUCCEEDED; 0 ERROR logs in 12h; beta smoke 6/6 (5×200, 1×404).
- Firestore: 29 sandbox orders stranded `reserved` past expiry, unchanged and none new since 10-19.
- **reconcile-orders never runs:** the Cloud Scheduler API is NOT enabled on saoc-webapp (PERMISSION_DENIED listing jobs), so no job exists. That explains why there are no alerts. Enabling it is a GCP project config change, so it needs Brad's OK.
- [ ] 2026-10-21 NEW LEE-ANN SOURCE: "SAOC /3. Societies/All Society data and history.docx" (Drive 1cSEjn8Dg-WXOKq-ZWEYKiDpy5dc3yULW, 2026-10-21 17:16Z). It covers 12 societies with contacts, meetings, committee, socials and history, and is synced to content/drive-source v1.0. NOS Site gap report: .tmp/sandbox/society-gap/gap-report.md in the NOS Site tree.
  - Sanity `society` has no fields for email, phone, committee or socials, so adding them is a schema/design decision.
  - 5 societies have no page.
  - 15 site societies are not in her doc.
  - Founding years conflict with our placeholders; hers win.
  - Questions were appended to the Lee-Ann doc as "Questions — 21 October 2026" (gws working again). That covers the queued 10-20 items (Form access, /events lede) and the society items. Build is queued after the r-queue, pending her answers.
- [ ] 2026-10-21 Hygiene: wt-f31 removed (merged). Memory PR #12 merged as 2e6765ec. NOS Site PR #13 (memory/specs) conflicts with #12, and its E2E failed on a next/font/google fetch, so it needs a rebase and re-run.
  - Brad decides: branding/ working-tree changes (r1–r4 emblem PNGs deleted, Eulophia-speciosa-emblem.png and National Show 2027/Word Templates/ (23MB) added) are his, uncommitted and untouched by me.
  - Also Brad: NOS Site's feat/nos-hero-lockup (15 unapplied commits) and its stash "main-tree-move 20261019" (archive folder gone, so the stash may be the only copy).
- [ ] 2026-10-22 Codi ROUTE 31 /about @390 (beta 1c9fa99f, Layout PASS); queued after /members.
  - P2: national committee shows 6 identical "To be confirmed" h3 cards. Replace with ONE list of the 6 roles plus one R11 note, "Names to be confirmed". When a name lands: name = h3, role = label, no pill.
  - P3: drop the duplicate "1968 / Founded" stat (keep "28 July 1968", leaving 3 stats).
  - P3: raise stat labels from 10px to the handoff label size (min 11px).
  - OWNER: committee names (Lee-Ann).
- [ ] 2026-10-22 Codi RULING soc-detail (/societies/[slug], source = Lee-Ann "All Society data and history" v1.0); queued after route 31. Order under the hero:
  1. Meet them: day/time/venue; SA times without seconds; email as mailto, phone as tel.
  2. Committee dl: Chair/Secretary/Treasurer; merge rows when one person holds both roles.
  3. Online: links only for real URLs, never guessed.
  4. About: verbatim history replaces the generic copy and pill; annual show as a fact row.
  - Never print "Not supplied"; omit empty rows and groups.
  - SocietyDetailsCallout only when meeting AND contact are both missing.
  - Directory cards: add a meeting-day line.
  - DATA: Cape founded 1957 (not 1947); drop the estimate where the source gives the year.
  - BLOCKERS before build:
    - The Sanity `society` schema lacks contact, committee and social fields (schema change, needs a contract).
    - POPIA consent for the personal emails and phones, asked in Lee-Ann doc 21 Oct (e).
  - Owner flags: "Pietermaritzberg" typo; 12 of 21 societies supplied.
- [ ] 2026-10-22 Codi ROUTE 33 /contact @390 (beta 2980ec06, PASS); queued after soc-detail.
  - P3: info@saoc.co.za standalone link is 24px tall → min-h-11.
  - P3: ContactForm validates only the message (l.33). Add per-field name/email checks matching the /members ruling; SuggestionForm reuses ContactForm's wiring.
  - P3: input radius 4px → --radius-1 2px, riding r25.
  - OWNER: info@saoc.co.za is "Not confirmed by SAOC" but used site-wide. Asked in Lee-Ann doc as 21 Oct item (i).
- [ ] 2026-10-22 Codi ROUTE 34 /refunds @390 (beta 1373a12d, Layout PASS); queued after route 33.
  - P3: use the compact hero (no image) on /refunds, /terms and /privacy; the 480px photo hero pushes the policy below the fold.
  - P3: reuse the r23 "On this page" disclosure (page is 5079px, 9 sections).
  - GO-LIVE BLOCKER (Brad/Council): refunds, terms and privacy say "drafted with AI assistance" with no lawyer review, yet checkout sells under them. Legal sign-off is needed before real ticket sales (sandbox only today). Asked in Lee-Ann doc as 21 Oct item (j).
- [ ] 2026-10-22 BRAD (relayed by Codi, verbatim): "Don't test with Payfast use OZOW Lee-Anns choice."
  - Firestore read shows checkout is ALREADY on Ozow: adminSettings/activePaymentGateway=ozow (since 2026-09-02) and ozowSandboxTestMode enabled (since 2026-08-24). No code or spec change is needed.
  - Rule from now: all test payments (E2E, contract checks, manual) go through Ozow test mode, never PayFast sandbox. Team notified.
  - CLAUDE.md's "PayFast (sandbox)" stack row is stale (floor-protected; Brad/Route 1 to fix).
  - Codi wants to review checkout payment step, redirect copy and confirm/failed states at 1280/390 on the next render.
