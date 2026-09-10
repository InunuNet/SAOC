# SAOC Backlog

Organised by **priority and subject**, not by session. Rebuilt 2026-08-19 from a 2,677-line
session diary (pre-cleanup copy: `archive/backlog-2026-08-19-pre-cleanup.md`).
_Last compacted: 2026-09-06 by backlog_trim.py. Full history: git log on this file._

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

---

## Next up (queued, not yet a mission — dispatch as soon as current mission closes)

- [ ] **[P1] A14 re-verification after deploy** (site-content-alignment M1-M2, 2026-09-10) —
  confirm `/national-show/about` and the reconciled `/national-show/what-to-expect` are live on
  `https://beta.saoc.co.za`; four routes (`/programme`, `/symposium`, `/wosa-conference`,
  `/exhibitors/international`) still 404 by design, gated on Lee-Ann.

- [ ] **[P1] Send Lee-Ann the 11 questions** in
  `.agent/memory/project/specs/site-content-alignment/goldens/f1-questions-for-leeann.md`
  (2026-09-10) — including that her **FAQ .docx is truncated at rest in Drive** (file id
  `1soLx8vKPs1jQBnYFTu88_LWxjzRFTHsf`, md5 matches our download, valid PK header, 16 local file
  headers, End-of-Central-Directory record absent) and needs re-uploading, plus the unfinished
  Show Contact doc and the unknown National Show sections 8/9/10/14/16. M3 is blocked until she
  answers.

- [ ] **[P2] Brad's unruled design question** (site-content-alignment, 2026-09-10) — the handoff's
  `SKILL.md` prescribes literal bracket-placeholders + sage/mono "TBD" blocks; shipped components
  use bordered mono badges instead. Unresolved; do not decide it.

- [ ] **[P2] `/national-show` renders zero status markers** (site-content-alignment, 2026-09-10) —
  cause untraced (correct fail-closed suppression vs. a wiring break). @qa flagged rather than
  assumed; needs investigation.

- [ ] **[P3] `prettier --check` warns** on the 4 files touched by site-content-alignment F3
  (2026-09-10); not wired into CI.

- [ ] **[P3] A15 assertion-shape audit** (site-content-alignment, 2026-09-10) — check every
  contract in this repo for assertions missing required fields (e.g. `codex_qa` without `target:`)
  that would error rather than evaluate. See [[learned.md]] "green means nothing" defect class.

- [ ] **[P1] TWO unparseable contracts — their assertions have never run**
  (found 2026-09-08 via F7's new contract-suite runner, mission ticketing-complete).
  (a) `.agent/memory/project/specs/gate-timeout-fix/contract-f1.yaml` — ambiguous compact mapping.
  (b) `.agent/memory/project/specs/mission-slug-collision-fix/contract-f1.yaml` — a heredoc `---`
  misread as a YAML document separator; found only when the baseline was regenerated, i.e. the
  first sweep missed it. Both fail YAML parsing, so every assertion they declare has silently
  never executed and never will. It is not counted as `missing` (no absent check script) and not
  as `fail` (nothing runs), so no signal exists anywhere today. Fix the YAML, then confirm the
  assertions actually pass — they have never been evaluated, so treat all of them as unverified
  rather than assuming they were green before the parse broke. F7 has added parse-error to the CI
  ratchet (baseline `{count: 3, parseErrorCount: 2}`) so a third cannot appear silently, but that
  does NOT fix these two files. Worth a sweep
  for the same defect class: any other contract that parses but whose assertions have never been
  executed is equally invisible.

- [ ] **[P2] `ticketing-purchase-pages-f3/check-seed-category-field.mjs` hardcodes a stale product
  total** (found 2026-09-08 by the F2 dev, mission ticketing-complete). OWNER, corrected: the
  script is run by `.agent/memory/project/specs/ticketing-conferences-and-events/contract-f3-purchase-pages.yaml:209`
  — a DIFFERENT, earlier mission that also numbered a feature F3. It is NOT ticketing-complete's
  contract-f3.yaml, which is clean. Do not confuse the two.
  It asserts `ALL_PRODUCTS.length !== 15`. Already stale at HEAD before any F2 change — HEAD has
  14 real products (counted by listing `slug:` lines, not `grep -c`, which overcounts by matching
  the interface's own `slug: string;` declaration); the working tree now has 13 (4 admission +
  6 conference + 3 workshop-field-trip), with `field-trip-single`/`field-trip-all-outings` retired
  and `field-trip` in their place. Drifted twice in one mission and caught nobody.
  RECOMMENDED FIX (architect, 2026-09-08): drop the count assertion entirely rather than deriving
  it. Nothing downstream needs a count to be true — a count only proves someone remembered to bump
  a literal. What the check actually exists to prove is that `buildTicketTypeDoc` stamps `category`
  onto every product using the real builder. Assert instead: every product's built doc carries a
  `category` matching its own `product.category`; no two products across the three arrays share a
  slug; and `RETIRED_FIELD_TRIP_SLUGS` never appears as a live slug. All three survive any future
  product addition or retirement with no magic number to maintain.
  Same shape as the stale `ticketing-workshops-f2` capacity check.

- [ ] **[P2] Focus ring fails the 3:1 non-text contrast floor on two vendor forms** (measured
  2026-09-08 by the NOS session, branch `nos-design`, composited-pixel measurement via Playwright
  + pngjs — NOT a `getComputedStyle()` regex, which returns plausible wrong numbers because
  Tailwind v4 serialises opacity-modified colours as `oklab()`, see InunuNet/SAOC#3).
  Three text inputs paint focus as a two-layer `box-shadow` instead of an `outline`: an inner
  pale-gold ring that is invisible on the pale-gold ground (acting only as a spacer), and an outer
  royal-purple `#211a57` at 40% alpha. Composited that is `0.4×(33,26,87) + 0.6×(251,250,240) =
  (164,160,179)`, measured `#a3a0b3` — **2.43:1 against a 3:1 floor**. Size and position are
  correct; the alpha is what sinks it.
  Affected: `/national-show/vendors/apply` (`businessName`, `tradingName`) at 390 and 1280;
  `/national-show/vendors/register` (`code-entry-business-name`) at 1280.
  Useful adjacent signal: `/national-show/tickets`' "Get visitor tickets" anchor uses a real
  `outline: 2px solid rgb(126, 63, 151)` and passes cleanly — so TWO different focus mechanisms
  coexist across these surfaces. Likely predates the NOS restyle. Whatever the alpha ruling is,
  the split itself is worth resolving. Pending a Codi ruling; the fix is ours, not the NOS
  session's.
  NOT THE SAME AS `CategoryTicketsPage` — measured separately 2026-09-08 and it PASSES:
  composited lede contrast 11.44:1 (/national-show/workshops @390), 10.29:1 (@1280),
  7.37:1 (/national-show/conferences @1280), against a 4.5:1 floor at 17px. The 'olive body
  text on purple' concern did NOT reproduce — hue recovered geometrically (pale-gold fit
  off-line 0.4-0.5 vs olive fit 254-300), so it is pale gold at ~0.85 alpha. Do not
  re-investigate. Caveat carried: that lede buys its appearance partly with opacity, which is
  acceptable for decorative text but is the same mechanism ruled out for functional/focus
  states. Cite the r6-probe.mjs run, never r6-verify.mjs — the latter regex-parses
  getComputedStyle() and its numbers for this component are wrong.

- [ ] **[P0] No enforcement for the "never cd" rule — agents keep prompting the operator**
  (2026-09-08, Brad raised it twice in one session, explicitly refusing to approve more).
  Agents open Bash blocks with `cd <project-root>`, which makes the following command's target
  statically unresolvable while a `Read()` deny rule is configured, forcing a manual approval
  modal that stalls the mission and everything queued behind it. The rule is ALREADY stated in
  `.claude/agents/<role>.md` (qa.md:47), `.claude/rules/sandbox.md`, and
  `.agent/rules/_core/sandbox.md` — three places — and 2 of 2 QA subagents violated it anyway.
  Prose is empirically insufficient; only a `PreToolUse(Bash)` hook would fix it.
  CANNOT BE FIXED LOCALLY: `check_autonomy.sh`'s `floor_glob_match()` protects `.claude/hooks/*`,
  `.claude/settings.json`, `CLAUDE.md` and `AGENTS.md`, so the guard can neither be written nor
  registered. Filed upstream: InunuNet/Athanor#1416.
  MITIGATION IN PLACE until upstream lands: (a) Rule Zero prepended to `.claude/rules/sandbox.md`;
  (b) every Agent dispatch brief must open with the prohibition — this is now mandatory practice,
  recorded in the brain. Blocked on: upstream.

- [ ] **[P0] Harness `backlog_trim.py` deletes open items without archiving them** (found
  2026-09-08, mission ticketing-complete). `execution/backlog_trim.py:126-141` archives closed
  `[x]` items to the brain, but open `[ ]` items past `MAX_OPEN=50` are removed with no archive
  and no titles recorded — only a `> Truncated N items` marker. This file already carries
  **5 such markers, 248 items destroyed** (127/5/9/104/3), one of them a standing P1 that was
  only noticed missing because an architect went looking for it by name. The cutoff is by file
  *position*, not priority, so newly-appended P0/P1 items die first. **This file is at 57 open
  items against MAX_OPEN=50 right now — the next `make backlog-trim` deletes 7 items off the
  bottom.** Do not run it until upstream lands a fix; curate by hand instead. Filed upstream as
  InunuNet/Athanor#1413 (never patch `execution/` in place — `make update-template` reverts it).
  Blocked on: upstream. Deliberately placed at the TOP of the open items, because the bottom is
  the kill zone.

- [ ] **[P1] Migration script write-polarity — decision needed, not fixed overnight** (found
  2026-09-08, `ticketing-complete` overnight session). Six scripts default to WRITING to the
  live Sanity `production` dataset on a bare no-flag invocation: `scripts/fix-venue-never-
  changed-copy.ts`, `scripts/migrate-ticket-type-category.ts`, `scripts/migrate-show-sales-
  fields.ts`, `scripts/fix-vip-and-weekend-pass-pricing.ts`, `scripts/fix-show-dates-2027.ts`,
  `scripts/fix-visitor-info-dates-confirmed.ts` (all gate on
  `const DRY_RUN = process.argv.includes('--dry-run')`). `fix-vip-and-weekend-pass-
  pricing.ts:70-79` builds the write-capable client before it even reads the flag. Three other
  scripts already use the safer polarity (`--apply`-to-write): `seed-fictional-test-show.ts`,
  `seed-demo-ticket-type.ts`, `swap-active-show.ts`. Decision needed: flip the six to `--apply`
  polarity, or delete the spent ones. Deliberately NOT fixed overnight — several of the six may
  already have been run against live data, so changing them now without checking could mask
  that history. See `learned.md` 2026-09-08 entry for detail.

- [ ] **[P2] `POST /api/contact` needs a test-mode guard or mocked mailer before automated
  coverage** (found 2026-09-08, `ticketing-complete` overnight session). The route sends a real
  Resend email and writes a real `contactSubmissions` doc on every successful POST, with no
  test-mode gate. Manually proving the new suggestion form end-to-end mailed a non-existent
  address at a reserved domain and left a live queue document (since deleted by exact id).
  Bounces accrue against a sending domain currently mid-migration on domain + Resend DNS. Add a
  mocked mailer or a test-mode guard on the route before any Playwright/automated coverage of
  `ContactForm` or `SuggestionForm`.

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

- [ ] **[P0] Triad-coverage classifier is dodgeable by URL-shaped assertions** (mission
  `verification-triad-gate`, M2/F2 close-out, 2026-09-06). `is_ui_workflow_contract()` in
  `execution/verify_triad_coverage.py` classifies a contract as UI/workflow by keying on the
  literal substring `app/` in its assertion commands. A contract that verifies the deployed
  site by URL instead of file path — e.g. `curl -sf https://saoc.co.za/national-show | grep -q
  "National Show"` — contains no `app/` substring, so it classifies EXEMPT, exits 0, and skips
  the triad entirely. Reproduced independently by @maintainer and @qa. This is the mission's
  own premise only partially delivered: the contracts most needing browser/inbox verification
  (they check the live site, not local files) are exactly the ones that slip through the net
  F2 just built. Needs its own feature: classify on URL-shaped assertion targets too, not just
  `app/` paths.

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

- [ ] **[P1] `contracts/cms-loop-f1-cdn-purge.yaml` A1 mutates the real Sanity dataset**
  (found during `verification-triad-gate` M2/F2, 2026-09-06). It re-invokes F6's
  `check-studio-edit-reaches-site.mjs` verbatim, which writes a sentinel value into
  `aboutPage.boardIntroText` on the live dataset with fallible cleanup. It poisoned the live
  dataset during this mission's gate runs and needed a manual restore (`unset`, verified ALL
  CLEAR by the residue guard). Any future gate run of this contract carries the same risk.
  Needs the sentinel-write step reworked to a draft/throwaway document or otherwise made
  non-destructive to real content. See also `project_contract_checks_mutate_live_content` in
  the auto-memory index — this is a second occurrence of that defect class.

- [ ] **[P2] `CLAUDE.md`'s "Verification triad gate" section is now factually stale and no
  agent can fix it** (verification-triad-gate M2/F2 close-out, 2026-09-06). It still reads "...
  is not yet wired into any gate path ... still voluntary, not enforced", which became false
  with commit `aa2f74f3`. `execution/hooks/check_autonomy.sh:301` hard-denies writes to
  `CLAUDE.md` at every autonomy level, so this needs Brad. Exact replacement text is already
  drafted and queued in `.agent/memory/project/needs-human.md` — just needs him to paste it in.
  Filed upstream as Athanor#1399 (the protected-path design has no route for correcting factual
  staleness in an agent-maintained instruction file).

- [ ] **[P1] Upstream PR to InunuNet/Athanor: `template/execution/contract.py` does not carry
  the F2 triad-coverage gate preflight** (mission `verification-triad-gate`, M2/F2 decision 5,
  2026-09-06). `template/execution/contract.py`, `quick_gate.sh`, and `improvement_loop.sh` are
  this project's seed copy of the upstream Athanor harness, not a second production gate path
  for SAOC's own contracts, so F2 intentionally did NOT duplicate the fix there. Per project
  convention `feedback_harness_issues_pr_upstream` (fix locally + PR upstream, not just report),
  this needs a PR to InunuNet/Athanor porting the same triad preflight (`_run_triad_coverage_
  preflight()`, `TRIAD_ENFORCEMENT_EXIT_CODE`/`TRIAD_PREFLIGHT_ERROR_EXIT_CODE`, the baseline +
  hash-pin re-arm-on-edit mechanism) into the template harness so future Athanor-seeded projects
  get triad enforcement out of the box, not just SAOC.

- [ ] **P0 — Working-process review (INTERACTIVE — Brad at the keyboard, not agent work)**
  (added 2026-09-02, team lead, on Brad's instruction). This is the next thing this project
  does, ahead of all feature work. It is a working session with Brad, not something to dispatch
  to @architect/@dev/@qa.
  **Problem statement, in Brad's words:** the project is not landing production work, and is
  producing "half-baked" output instead.
  **Evidence, from the 2026-09-02 overnight session, recorded factually:**
  1. A feature reached a 10/10 contract gate, five Codex GPT-5.5 passes, and a full chain run
     (@architect → @dev → @qa → @docs → @maintainer) while never once being deployed or opened
     in a browser. "Gate green" and "works" turned out to be nearly uncorrelated.
  2. The single highest-value defect of the night — admin notification emails linking to a
     Firebase `*.hosted.app` URL instead of `beta.saoc.co.za` — was invisible to every automated
     check by construction. The assertions verify links are built correctly FROM `SITE_URL`;
     `SITE_URL` itself was wrong. It was found in ninety seconds by reading a delivered email
     with the `gws` CLI, which Brad had explicitly asked for at the start.
  3. Brad's original instruction specified E2E testing with Codex AND adversarial browser
     agents. Five Codex passes were run; no browser agent was run until Brad intervened. The
     cheap check was over-substituted for the expensive one that would have caught the real
     problems.
  4. Four consecutive Codex passes each found another instance of ONE defect class because each
     fix was scoped to the file the previous reviewer happened to name. A sweep was only ordered
     on the fourth round.
  5. Two agents were dispatched onto the same nine files simultaneously and corrupted each
     other's work, because a mission file's stale status line was read as a liveness signal.
     This repeated a lesson already recorded in memory as `feedback_verify_liveness_by_artefact`.
  6. Three separate maintainer commits silently deleted 103 backlog item headers over roughly a
     week — including a P0 security finding — and `make backlog-audit` reported clean every
     time, because it only inspects lines that already look like items. Tracked work became
     invisible prose and nobody noticed.
  7. An agent reported completing a backlog repair it had not performed; the orchestrator
     committed an earlier maintainer's edits without reading the diff, which is how one of the
     103 header deletions shipped.
  **Agenda for the session (things to decide, not conclusions):**
  - Should "deployed and observed working" replace "gate green" as the definition of DONE?
  - Where does the chain add value, and where is it ceremony? It ran in full for a feature
    whose real defects it could not see.
  - Is the agent count buying anything? Roughly forty agents ran in this session.
  - What is the minimum evidence standard before reporting completion to Brad — given several
    agents this session reported work they had not done?
  - Which checks are load-bearing versus theatre? Six F5 checks were silently dead since M2 and
    nobody noticed.

- [ ] **[P2] Restore the deferred legacy-order check for stand pricing tiers** (deferred
  2026-09-01 under demo time pressure, by @architect, explicitly flagged rather than dropped).
  `vendor-stand-early-bird-pricing` shipped A1-A4 but cut the standalone RED check proving a
  pre-existing `vendorStandOrders` document with no `tier` key still settles and renders
  identically. The deferral reasoning is sound — stand payment has refused since it shipped
  (prices were null), so no real stand order can exist yet to break — but that stops being true
  the moment the first vendor pays, which is now days away, not months.
  `VendorStandOrder.tier` was still built additive/nullable and the settlement handler was left
  untouched, so the property is believed to hold; it is simply unproven. Write the check before
  any real stand payment settles.

- [ ] **[P2] Register Society — society profile intake + registration flow** (added 2026-09-01,
  Brad). **Field set captured 2026-09-01** from Lee-Ann's Google Form, transcribed from
  screenshots Brad supplied, at `docs/leeann-source/society-website-information-form_2026-09-01.md`.
  Read that file first; it is the source of truth for the profile half and records every
  observation below with detail.
  **The form is narrower than the ask.** It is Lee-Ann's "Website Information Form" — an intake
  asking *already-affiliated* societies for the content of their own website pages (society name,
  public email and cellphone, meeting day/time/venue, four committee members each with a
  head-and-shoulders photo, logo, website, Facebook, Instagram, history, comments). It contains
  nothing about affiliation, constitution, membership, fees or council approval. So the profile
  content model is specified; **the registration/approval half is not, and must not be inferred
  from the form.** Ask Lee-Ann what a society actually has to submit to affiliate, before any
  architect pass on that half.
  Open questions the form itself cannot answer, all flagged in the capture: no province/city/slug
  field though our `Society` type requires all three; exactly four committee roles enumerated
  (Chair/President, Secretary, Treasurer, Liaison for communication) with no path to a fifth
  beyond a Comments note; only 3 of 20 questions required, so submissions will be sparse and every
  field needs a real empty state; socials are Facebook + Instagram only, unlike the vendor form's
  five platforms; and the form leans on Google identity for attribution, which ours will not have.
  Do not replicate the form's upload limits — it allows 1 GB per image (and inconsistently 10 MB
  for the Secretary photo alone). Impose one sane image cap with MIME validation, mirroring
  `planProofOfPaymentUpload()`/`planMarketingAssetUpload()` in the vendor flow.
  Likely shape: public form -> Firestore collection -> committee review under `/admin`, i.e. the
  pipeline already built and proven for vendors (`vendorApplications` -> approval -> gated full
  registration). Reuse that architecture rather than inventing a second one; the vendor mission's
  goldens are the pattern.

---

- [ ] **[P3] Leftover "previous venue's values" comment at `scripts/seed-show-visitor-info.ts`
  ~line 105 (in `patchNationalShow()`), plus the still-open `nationalShowVenuePatch.venue.
  directionsNote` field** — flagged by @qa during `venue-never-changed-copy-fix` (2026-08-24) as
  real but out of that mission's scope. Not the same line as the protected line-163 comment
  (that one is deliberately preserved as historical record under `contract-venue-prose-residue.yaml`
  A10 — dev-only, never rendered). Route to whoever owns `venue-prose-residue` follow-up work;
  not urgent.

- [ ] **[P1] @docs Haiku tier defect / sync-regeneration risk.** Standing decision (2026-09-02,
  recorded in `learned.md`'s resolved-contradiction entry near the top of the file): no Haiku for
  any role on this project, @docs included — Sonnet 5 is the floor.
  **Current state, precisely:** `.claude/agents/docs.md:3` was hand-corrected from `model: haiku`
  to `model: sonnet` on 2026-09-02. But the template source `.agent/agents/docs.md` still
  declares `model_tier: local` with no `model:` line at all, and `.gemini`/`.grok` mirror that
  pattern with their own tier names (`flash`, etc). **This means the hand-edit is not the real
  fix and can silently regress**: if `make sync` regenerates `.claude/agents/docs.md` from that
  `local` tier the same way it apparently did before, `model: haiku` comes straight back with no
  failure signal — and because the fix "already landed" in every session's notes (including this
  one), nobody would think to re-check it. That is the worst shape a defect can have.
  **The actual work:** locate the tier→model mapping `make sync` applies for the Claude provider
  (not found in the search pass so far; likely under `execution/` or in the sync script itself)
  and correct the `local` tier there, so the rendered file cannot regress. A hand-edit of
  `.claude/agents/docs.md` alone is NOT the fix — it's what's in place today as an interim
  patch only.
  **Verification step:** after any `make sync`, re-check `.claude/agents/docs.md:3` still reads
  `sonnet`. Until the mapping itself is fixed, treat that line as unstable — do not assume it
  stays fixed just because it was corrected once.
  `dev-fast.md` and `qa-fast.md` also carry `model: haiku` in frontmatter but are deliberately
  excluded from this fix: both are documented OpenRouter free-tier fallbacks scoped to
  non-critical ghost-task work, a different mechanism entirely — do not "fix" them alongside
  this item.
  **Practical impact (why P1, not P3):** if this regresses, @docs would silently run on the
  same model that, on this project, reported two documentation items as "already correctly
  documented" when neither existed anywhere except the line it had just written (`learned.md`,
  "Do not report a task as already satisfied without running the check that proves it"). Until
  the mapping is fixed, spot-check @docs output against the actual source
  before trusting it, same as before this item existed.

---

## Blocked on the council / Lee-Ann

- [ ] **[P1] Ticket prices and capacities — estimate now, correct later (Brad's standing
  instruction, already the pattern used for the ticketing admission products in
  `lib/provisional-figures.ts`/F4).** Do not leave figures blank waiting on the council; put in
  our best estimate, flagged provisional, same discipline as F4. Conference tickets (SAOC
  Symposium/WOSA/joint, 6 entries) fully shipped as of 2026-08-21 — data model (F1), purchase
  pages (F3), nav (F4), and checkout (F5) all done; `ticketing-conferences-and-events` (Mission
  Two) is now complete end to end. Workshops/Field Trips/Cocktails category likewise fully
  shipped as of 2026-08-21 (F2 estimation, F5 checkout closes the pooled-capacity fix F2
  deferred) — 4 real priceable products (Sunset Cocktails single/couple, Field Trip
  single/all-outings) now enforce their REAL physical ceilings (200/200/60/60) via
  `planPooledCapacity()`'s pool-key/headcount-weighted math, not the F2 interim's conservative
  resized constants (100/50/30/30). A non-sellable `WORKSHOP_PRICING_STRUCTURE` placeholder
  remains since individual workshop sessions genuinely cannot be priced without a
  council-confirmed session list — do not invent specific workshops. Still outstanding: vendor
  fees (exhibit/food), venue/workshop capacity figures generally, and the real workshop session
  list itself. Her form answers (pricing artifact) are still empty as of 2026-08-21 — do not
  wait for them to start estimating the remaining categories.
- [ ] **[P1] Refund and cancellation terms — draft real content ourselves for her to review/adjust
  (Brad's direction, 2026-08-21), do not wait for her answer first.** `/refunds` exists
  (`app/(marketing)/refunds/page.tsx`, 109 lines) but is deliberately figure-free — no cancellation
  windows, refund conditions, or cooling-off period. Draft reasonable estimated terms, flag them
  clearly as pending her confirmation. When real/adjusted figures land, POLICY-10 (the digit+unit
  ban) must be revisited — it currently bans the very figures being added.
- [ ] **[P1] POPIA Information Officer — placeholder decision made 2026-08-21, needs implementing
  and formal confirmation.** Brad's call: name **Lee-Ann McCleland** (Fynbos Pottery Studio) as
  Information Officer on `/privacy` for now — she can correct it later if the council wants someone
  else. Not yet applied to `app/(marketing)/privacy/page.tsx` (still names `secretary@saoc.co.za`
  by project convention). Still outstanding regardless of who: under POPIA the officer must be
  formally registered with the Information Regulator; naming her on the page is not that
  registration, just interim contact-page accuracy. Confirm her contact details (email/role) before
  publishing — the screenshot this decision came from only confirms the name, not an email address.
- [ ] **[P1] All three policy pages carry an "AI-generated draft, not legal advice" notice** and
  need professional legal review before the council relies on them.
- [ ] **[P1, commercial — Brad's call] Spec V3 scopes TWO websites**, not one: a permanent SAOC
  org site (6 pages) and a dedicated 2027 Show site (18 pages). V3 §6 also marks as "Confirmed by
  INUNU" several items never priced in the accepted 28-May proposal — unified multi-category
  checkout, filterable exhibitor/guest databases, the relational awards archive, the Members
  Portal. **Do not restructure routes; this needs a scope+price conversation first.**
- [ ] **[P1] Spec V3 §8 is a 13-question list for INUNU** (CMS, filtering, bookings,
  notifications, archiving). Several already have answers in our codebase. Worth a written reply.
- [ ] **[P1] Stellenbosch visitor travel content.** Every CTICC-anchored travel section was
  *cleared* rather than rewritten (correct — inventing airfield transport detail is the banned
  failure mode). `airportRoutes`/`accommodation`/`attractions` are empty; `publicTransport`,
  `parking`, `accessibility` and two intros are neutralised to "not confirmed". Owed: real
  Stellenbosch-area content. There is no scheduled public transport to the airfield, so arrival
  is drive/e-hail only, which changes the shape of the advice. Pre-change values backed up at
  `.agent/memory/scratch/venue-change-2026-08-12/before.json`.
- [ ] **[P1] Ticketing source document changed on 2026-08-26 (same day as the vendor doc) and is
  NOT yet mirrored locally.** Lee-Ann replaced the vendor registration source in place on
  2026-08-26 (same Drive file id, content replaced — `docs/leeann-source/2027-vendor-registration-form_2026-08-26.md`
  is now canonical, the 25 Aug snapshot superseded and marked as such in
  `docs/leeann-source/README.md`). The ticketing document changed the same day but has not been
  re-pulled into `docs/leeann-source/` — this is a live risk of the exact "built against a
  superseded document" failure the vendor mission just had to work around twice. Re-mirror it
  before starting or resuming any ticketing work.
- [ ] **[P1, council-blocked] Two vendor-registration contradictions between the written source
  document and Lee-Ann's voice note remain unresolved — do not guess, ask her directly.**
  (1) Cancellation window: the written T&Cs say 90 days, the voice note says 2 months. (2)
  Tables/chairs: priced as a line item in the written document, described as "no extra charge"
  in the voice note. Both found during `vendor-gated-registration-flow` (2026-08-31); the code
  currently follows the written document for both since it's the more authoritative source, but
  this needs her explicit confirmation, not a permanent default.
- [ ] **[P2] Two vendor-registration form ambiguities need Lee-Ann's answer before the relevant
  M2 feature (F5, Gas/Cooking/Heat Equipment + Food Vendors cluster) is built:** (1) should food
  certifications be collected as a pick-list of specific certification types, or as one blanket
  attestation checkbox; (2) can a non-food vendor legitimately declare gas/heat equipment (the
  source document's structure implies gas questions are food-vendor-only, but nothing confirms
  that a non-food vendor with e.g. a heater or generator is excluded from disclosing it).
- [ ] **[P2] Vendor Terms & Conditions document does not exist.**
  `VendorPaymentFieldset.tsx:49` makes vendors agree to a document with no page, route or text
  behind it — an agreement checkbox binding to nothing. Content is Lee-Ann's to write; do not
  draft placeholder legal text. Once supplied, the page + linked label is ordinary work.
- [ ] **[P2] National Show brand model.** Brad's unconfirmed hypothesis: a stable master brand
  across editions plus a rotating per-edition host sub-brand, instead of a full redesign each
  cycle. If the committee agrees, `branding/national-show-2027/` may need restructuring into a
  stable parent with per-edition subfolders. **Do not restructure anything now.**
- [ ] **[P2] Secure organisation-owned document custody.** Institutional records sit in
  individuals' Drives, thumb drives and personal email. Critical sub-point: accounts must be
  registered to SAOC as an organisation, not to whoever created them — especially the payment
  merchant account, the domain, and any Google/Microsoft tenant. Section E of the call-prep doc.
- [ ] **[P2] Real Show copy has arrived and is not yet loaded.** `About - 2027 National Show.docx`,
  `What to Expect.docx`, `South African Exhibitors.docx` — first client-approved copy, replaces
  our labelled placeholders. Confirms the theme: "From Wild Origins to Cultivated Excellence."
- [ ] **[P2, security] Spec V3 circulates SAOC mailbox passwords in plaintext** in a shared Drive
  doc. Values are already stale (the VPS migration replaced all five). Tell Lee-Ann the doc should
  not carry credentials at all.
- [ ] **[P3] `show@saoc.co.za` has been unused since 2020**; Lee-Ann suggests archiving. V3 also
  asks for per-area show addresses (symposium, WOSA, bookings) so committee members get their own
  area's registration notifications.
- [ ] **[P3] Hero lede copy authority unresolved.** The design reference and
  `components/home/Hero.tsx:84-86` differ. May be an intentional later revision, not drift — do
  not change without confirming which is authoritative.

---

## Blocked on Brad (human action, not dispatchable)

- [ ] **[P1] Ozow — mission `ozow-payment-provider` DONE (F1-F4, all gated, M4 gate passed
  2026-08-23); one external item remains for Brad.** Ozow is now a fully working second
  `PaymentProvider` alongside PayFast — adapter, checkout wiring/provider registry, and a real
  `confirmNotification()` fix (F4: `GetTransactionByReference` needs an explicit `IsTest=true`
  query param for sandbox transactions, which the code never sent — see `learned.md` "Ozow F4").
  The originally-logged "unprovisioned merchant account" blocker was WRONG (see `learned.md`) —
  real causes were a SiteCode misconfiguration (fixed) and this F4 bug (fixed). **Still open,
  external and genuinely Brad's to resolve:** a real Ozow-side R0.01 transaction cap on the
  sandbox account — support ticket needed with Ozow to raise/remove it before a full-value live
  purchase can be proven end to end (Ozow support email still unsent). PayFast's own live-purchase
  path remains regression-proved unaffected. **Demo-readiness gap now closed** — mission
  `ozow-sandbox-toggle` (F1, gated 2026-08-24, 12/12 PASS) shipped an admin-toggleable
  `ozowSandboxTestMode` flag (`/admin/settings`) that forces only the amount sent to Ozow's
  `initiate()` to R0.01 while leaving cart/display/order/PayFast untouched, with a visible TEST
  MODE banner; this replaces the manual, revert-dependent live-Sanity-price-edit workaround as
  the documented demo method (`docs/payment-seam.md`). The R0.01 sandbox cap above is a separate,
  still-open, vendor-side issue — do not conflate the two. See
  [`contracts/golden/ozow-m1-f3/README-addendum-blocked.md`](../contracts/golden/ozow-m1-f3/README-addendum-blocked.md)
  and `contracts/golden/ozow-m1-f4/README.md` for the full investigation. Outstanding follow-ups
  from `docs/payment-gateway-research-2026-08.md` §10 still apply once live: PayFast Clause 9.8
  fund-hold commitment in writing before sales open; PCI-DSS/ISO 27001 certificates verified via
  IAF CertSearch; POPIA operator agreement; attorney review of the refund policy; disclosure to
  the council of our conflict of interest (we built the custom system) and the thin-evidence
  spots. Card payments must be explicitly activated on whichever provider's merchant account — not
  always on by default — or international attendees cannot pay at all (confirmed again in the
  pricing artifact's payment note to Lee-Ann).
- [ ] **[P1] Go-live: live payment credentials.** In order: obtain live Merchant ID/Key/Passphrase;
  store in Secret Manager with `printf '%s' | --data-file=-` (**never `echo`** — see the secret
  corruption class); flip `lib/payfast.ts` off the sandbox constants; point `SITE_URL` at the real
  domain (**gated behind DNS cutover** — live ITNs will not land otherwise); re-verify the ITN
  signature path against a live transaction via the documented re-pin ceremony.
  **Do not go live before council-confirmed prices are in.**
- [ ] **[P1] DNS cutover.** Nameservers still point at the old cPanel host. Sequence:
  re-pull mail from the legacy host one final time immediately before cutover (the 2026-07-20
  restore is a snapshot) → switch nameservers → only THEN add any further Resend DNS records.
  Adding them before the switch loses them silently with no code change to blame.
- [ ] **[P1] Run `scripts/install-dev-domain.sh` once from Terminal.app**
  (`cd ~/ai/SAOC && sudo bash scripts/install-dev-domain.sh`) — sudo cannot prompt in an agent
  shell. Until then the working URL is `https://dev.saoc.co.za:3333`.
- [ ] **[P1] A 53 MB zip sits in git history** from commit `5b67fdf`
  (`branding/National Show 2027/Old NOS 2027 Assets.zip`). Repo is 171 MB. Removal needs a history
  rewrite + force-push, so it needs Brad's explicit permission and a quiet moment.
- [ ] **[P1] Live `roles`-claim migration has never been run.** `scripts/admin-migrate-roles.ts`
  is dry-run by default; no account holds a `roles` claim, including `brad@inunu.net`. Running
  `--apply` is human-gated. `app/api/admin/checkin/route.ts`'s capability check stays deliberately
  deferred until it has.
- [ ] **[P1] Firestore test-data cleanup — deletion is Brad's call, not an agent's.** Live
  collections carry test residue: ~15 `@harden-check.invalid` fixture docs in `tickets`, two
  `contactSubmissions` diagnostic records, and the sandbox order/ticket documents from proving
  purchase end to end. Blocks A5/A34 in `contract-payfast-m1-lock-cleanup-fix.yaml` and
  `contract-door-test-qr-seeder.yaml` (both go green once cleared). Note the leak count has gone
  both up and down across sessions (5 → 12 → 17 → 15) — record the number, do not narrate a trend
  from it; measure under controlled conditions before drawing a conclusion.
- [ ] **[P1, security] Rotate `FIREBASE_ADMIN_PRIVATE_KEY`** (leaked into a session transcript via
  a redaction pattern that only matched single-line pairs, missing the multi-line key body)
  **and `SANITY_REVALIDATE_SECRET`** (visible in verification screenshots) before launch.
- [ ] **[P2] Admin "mark paid" route — Brad wants it, wants to discuss before it is built.**
  Use case: a buyer pays by EFT, no ITN arrives, the order sits reserved forever. This is also the
  only sound resolution for a paid-but-ITN-failed order — nothing Firestore records can
  distinguish that from an abandoned cart (see
  `specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md`), so a human deciding is the answer.
  Questions to settle: who may do it (its own capability, not general admin); what evidence is
  recorded (bank reference, acting uid, timestamp, immutable); does it send the confirmation email
  and QR; does it decrement capacity (it must, or manual sales oversell); can it be reversed.
  **Do not build unattended.**
- [ ] **[P2] Semantic feedback colours do not exist in the brand.** `app/globals.css` has
  primary / accent / parchment / ivory / bone / ink / muted / rule only — no success green, no
  error red, nothing that reads as bright at a door in daylight. Brad's door check-in spec
  requires "bright green" and "bright red", which the current palette cannot satisfy. Either he
  adds two semantic tokens, or he decides explicitly to use primary/accent (muted, arguably fails
  the requirement). Do not invent colours. **Update 2026-08-24:** the door check-in
  success/failure banner shipped anyway (`door-checkin-success-feedback` mission) by reusing
  existing tokens (bg-primary/text-ivory success, bg-bone/border-primary-800/text-primary-800
  failure) rather than waiting — so this no longer *blocks* that feature, but the underlying gap
  (no bright semantic green/red) is still open and Brad's original "bright" requirement is still
  arguably unmet.
- [ ] **[P2] Design template for ticket branding** — needed before the three ticket surfaces can be
  unified (see Ticketing below).
- [ ] **[P2] Design bundle for mission `national-show-design-alignment`** (4 features, validated,
  blocked). Cannot start until the assets arrive.
- [ ] **[P2] Microsoft and Apple sign-in providers are DEFERRED (2026-08-17).** Code shipped in F5;
  neither provider is enabled for `saoc-webapp`. Microsoft needs an Entra app registration (needs
  a directory), Apple needs a Services ID + signing key. A green gate proves the code path, not
  that the provider is on.
- [ ] **[P2] Domain owner contact details.** Apply Lee-Ann's correct registrant details at
  domains.co.za — "Update Pending" may be gating registry changes.
- [ ] **[P3] Manual Sanity dashboard usage check** — manage.sanity.io → Settings → Usage. Confirm
  CDN/API/bandwidth totals and that role display doesn't conflict with Free's 2-role cap. Not
  retrievable via the token API. 5-minute task.
- [ ] **[P3] Decide whether the legacy `public_html_1` / `public_html_2` copies are worth keeping.**

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
- [ ] **[P2] `scripts/migrate-ticket-type-category.ts` has only ever run `--dry-run`.** The 5 live
  admission `ticketType` docs in production Sanity still have `category: null`. A server warning logs
  for each during Admission ticket page renders (spotted during `ticketing-flow-redesign` F2 QA,
  2026-08-24). This is protected by F3's admission-only null-category read-time fallback in the GROQ
  query, so it is not urgent, but the docs should be backfilled with a real category for real
  eventually rather than relying on the fallback indefinitely. Recommend: `scripts/migrate-ticket-type-category.ts --apply`
  to clear the warning.
- [ ] **[P2] Day Visitor's chosen day is not shown on the ticket confirmation page.** Verified
  2026-08-21: `chosenDay` is correctly captured and persisted (`"2027-09-18"` confirmed in
  Firestore against a real purchase), but `/tickets/confirmation` only shows
  "day-visitor · R150.00" — no date. A buyer has no way to see which day they're confirmed for
  after checkout. Minor completeness gap in F5 (ticketing-f5-day-attendees), not a data-loss bug.
- [ ] **[P1] Verify the reserved-seat release path actually fires.** `buildReservationDocs` now
  writes `expiresAt` onto the position document as well as the order (`lib/checkout-reservation.ts`
  lines 56 and 81), which was the missing field that made lazy expiry-release unreachable — every
  reserved position hit the "no `expiresAt` → fail closed" branch unconditionally, so
  `RESERVATION_TTL_MINUTES = 30` was inert and abandoned carts held capacity forever. **The write
  is fixed; the release path itself has still never been observed running.** Verify it, do not
  assume. Note the interaction: once seats DO release, a paid-but-stranded order's seat becomes
  resellable. Also note what this episode showed — the no-oversell WRITE path is genuinely well
  proven (5 concurrent requests at the last seat, real server, real Firestore) while nothing
  verified the RELEASE path, which is where the defect sat.
- [ ] **[P1] QR code image does not render in the confirmation email.** Gmail shows the
  broken-image placeholder with its alt text. Generation is fine — it renders on the confirmation
  page and in the downloaded file. Likely cause: the email references the QR by URL or data: URI;
  Gmail proxies remote images and strips data: URIs. Robust fix is a CID-attached inline image
  (Resend supports attachments with a content id). **"It renders in my browser preview" is not
  proof of a fix** — this defect only exists in the real client, so any assertion must check what
  the delivered email contains, and the fix needs a real send to a real Gmail inbox.
- [ ] **[P1] Door check-in: the successful scan produces no visible feedback.** Brad's live mobile
  test — the scan WORKED (ticket reached `checked-in`, duplicates correctly refused) and the UI
  showed him nothing. Leading hypothesis, unverified: the result panel renders below the fold, same
  as the "Check In" button, so on the first successful scan the confirmation rendered off-screen.
  If so, "no feedback" and "below the fold" are ONE defect. **Rule out in this order before
  designing:** (1) does the admitted state render at all, or only the failure/duplicate branches;
  (2) if it renders, does it persist or is it cleared when the scanner loop resumes; (3) where does
  it land relative to the viewport at 375px and 320px immediately after a scan.
  **Brad's required behaviour, explicit:** SUCCESS is visually assertive and unmistakable at a
  glance, then the page RESETS clearing the previous ref so the next person can be scanned.
  FAILURE HOLDS the entered reference for inspection, with a bright red "Check-in not accepted"
  AND the specific reason — already checked in / unpaid / wrong show / unknown reference — because
  the reason determines the steward's next action. Blocked on the semantic-colour decision above.
  Accessibility: colour alone must not carry the verdict; pair with icon and text, meet contrast on
  parchment, assume a colour-blind steward in bright sunlight.
  Verify on a real phone with a real unscanned ticket — a DOM assertion cannot see this, and the
  existing suite never asserted that a successful scan shows the operator anything.
  `[verify against new brief]` — the verdict taxonomy changes when check-in becomes per-day.
- [ ] **[P2] Manual entry should take only the unique suffix.** Staff should never type
  `SAOC-2027-`; show it as a fixed affix. Must still accept a full pasted reference and normalise
  it (a scanner app, an email copy-paste and a typing steward must all work) — Brad's input had a
  stray space and still resolved, so some normalisation exists; find it before adding a competing
  second one. Uppercase-normalise too; phone keyboards autocapitalise inconsistently.
- [ ] **[P2] Downloaded ticket must be a PDF, not a PNG.** Currently
  `saoc-ticket-<ref>.png` (`components/tickets/DownloadTicketButton.tsx`). A PDF carries page size
  and vector text. **Watch:** the QR must stay crisp and scannable at print size — a downscaled or
  JPEG-compressed QR fails at the door, which is the one thing the artifact exists to do. Any
  contract needs a real scan test of the generated PDF, not "a PDF was produced".
- [ ] **[P2] Uniform branding across the three ticket surfaces** — confirmation page, downloaded
  artifact, confirmation email. All three are currently plain/unstyled with no SAOC identity.
  BLOCKED on Brad's template. Email has a hard constraint the others don't: clients strip `<style>`
  blocks, ignore most modern CSS, and Gmail clips over ~102KB — so table layout, inline styles, and
  a logo delivered as a CID attachment the same way the QR fix will be.
  nothing sets it, `components/admin/StatusPill.tsx` has no style for it (renders through the
  neutral fallback, indistinguishable from an unrecognised status), and no gateway refund call
  exists. A refund today means refunding in the gateway dashboard and hand-editing Firestore with
  nothing linking the two. PayFast exposes a Refunds API (same MD5+passphrase auth as the ITN), so
  this is buildable. Needed before high refund volume.
  a colliding `bookingRef` silently overwrites instead of failing. **Verified 2026-08-21: the main
  checkout path no longer uses this** — `buildMultiReservationDocs()`/`writeMultiReservationPair()`
  (multi-line-item-cart mission) use `transaction.create()` (fail-loud on collision), confirmed by
  reading the code. `createOrderWithPosition()` is now ONLY used by the admin comp-ticket route
  (`app/api/admin/tickets/comp/route.ts`) — narrower blast radius than originally scoped, still a
  real gap there, lower urgency (comp tickets are a low-volume admin action, not public checkout).
  and `Ticket`**, deliberately, and nothing detects divergence between the copies. **Confirmed still
  true 2026-08-21** against a real live purchase (both fields present and populated on the order
  doc and on each of its two position docs). The position copies were meant to be removed with a
  backfill once checkout/ITN stop writing them.
  is called in checkout (`app/api/tickets/checkout/route.ts:739`) and `recoveryToken`/
  `recoveryTokenExpiresAt` are confirmed present on a real order doc. Still genuinely open: the
  guest-order-claiming backfill (a guest's existing orders' `buyerUid` backfilled when they later
  register) — not re-verified, may still be owned by nobody.
  council-approved value. Real security/usability tradeoff: too short locks buyers out of tickets
  they paid for, too long keeps a leaked link live for months.
  wired (`app/api/admin/checkin/route.ts:60` → `recordCheckinAttempt`), but the paused mission
  `prove-ticket-purchase-works-end-to-end-b` M1 gate observed no document after a live scan.
  Agent-actionable: query Firestore directly, do not queue a human scan. If the write genuinely
  fails, it fails silently — `lib/checkin-audit.ts:143` logs and swallows. Must survive the Stage 5
  per-day check-in rewrite: re-verify after it lands.
  **DONE 2026-08-25** — built read-only `scripts/verify-checkin-audit-write.ts`, cross-referencing
  checked-in tickets against `checkinAttempts` admit records (bookingRef-primary join, orderId
  fallback). Live run against real Firestore (verified twice): 0 orphans — the write path works
  correctly right now. No production code changed; a regression-locked verification tool now
  exists for future checks. Gate 6/6 pass, QA + Codex GPT-5.5 found and fixed 3 real bugs in the
  script's own join logic mid-mission. See `docs/verify-checkin-audit-write.md`.
  retired `'general' | 'member' | 'vip'` union and a 6-digit `bookingRef`. Reality: free-form
  string keyed by Sanity slug, 60-bit Crockford base32 refs.

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

- [ ] **[P0] `execution/codex_qa.sh` reports quota/transport failure identically to a real
  adversarial FAIL** (found 2026-09-08, mission `ticketing-complete`, F2/A13; a peer session
  filed the same defect independently the same night as Athanor#1419 via the stdin entry
  point — this is a second, independent confirmation via the `<file_path>` argument form, so
  the fix needs to cover exit-code classification generally, not just one call shape). When
  OpenAI quota is exhausted, the wrapper exits 1 and prints the literal token `FAIL`,
  indistinguishable from a genuine Codex GPT-5.5 adversarial verdict — the quota error message
  is emitted twice before the `FAIL` token, so a classifier keyed to a fixed line position
  would still miss it. Consequence: **the mandatory cross-model Codex pass on
  `contracts/checks/ticketing-complete-f2/check-no-migration-apply-invocation.mjs` (A13) did
  NOT run** — quota exhausted, resets 17:01 on 2026-09-08 — yet A13 is landed and gate-green.
  Per `.claude/rules/workflow.md` ("No feature is DONE without a Codex GPT-5.5 pass"), F2/A13
  is not actually DONE until this pass is re-run and genuinely passes; re-run it once the quota
  resets, before closing F2.

- [ ] **[P2] F6 nav rebuild gate is red at exit 6, feature otherwise complete** (found
  2026-09-08, mission `ticketing-complete`). The nav rebuild itself is implemented, and both
  `codex_qa` (A20) and `browser_deployed_check` (A21) triad assertions were added honestly.
  `gws_inbox_check` was deliberately NOT added — a nav rebuild sends no email, so there is no
  truthful `message_id` to assert against — which the triad-gate preflight (see the Athanor
  #1420 entry above) currently has no way to express as a legitimate exemption rather than a
  gap. Not resolvable via `execution/triad-baseline-exempt.txt`, since that is a one-time
  2026-09-06 rollout snapshot of pre-existing contracts, not an open-enrollment exemption list
  for new ones. Blocked on Athanor#1420 landing an applicability escape (an explicit way for a
  contract to declare "this triad kind does not apply here" instead of the classifier guessing
  from assertion text) — do not work around it locally by force-adding a fabricated
  `gws_inbox_check`.

- [ ] **[P2] F8's hardcoded `:3002` route-origin fix is designed but not landed** (mission
  `ticketing-complete`, F8, 2026-09-08). @architect specced the fix: a new
  `contracts/checks/_shared/verify-server-identity.mjs`, an edit to
  `verify-walkthrough-routes.mjs` to use it, a negative-control script proving the guard fires
  on a wrong-server response, and two new contract-f8.yaml assertions (A25/A26). None of the
  four are written yet. Separately, **9 other check files share the same hardcoded `:3002`
  origin exposure** (not yet enumerated by path) — the F8 fix should be the reference pattern
  for cleaning those up, not a one-off.

- [ ] **[P3] Clone drift — `make sync-clones` overdue.** `CLAUDE.md` has drifted from
  `AGENTS.md`; the `GEMINI.md` symlink and `rules.md` are missing from at least one clone
  target. Found during the 2026-09-08 `ticketing-complete` wrap-up. Housekeeping only, not
  mission-scoped — run `make sync-clones` and commit separately.

- [ ] **[P3] `.claude/settings.json` hook-entry de-duplication is drafted but uncommitted, and
  is template-sync churn, not mission scope** (found 2026-09-08, mission `ticketing-complete`).
  Roughly 86 lines of working-tree diff replace hook entries duplicated in both the old
  `[ -f X ] && bash X || exit 0` form and the newer `[ -f X ] || exit 0; bash X` form with the
  single newer form — correct, and aligned with `.claude/rules/hooks.md`'s guidance on hook
  file shape. This is `make update-template` output reconciling drift, not something the
  ticketing-complete mission touched or should carry in its commit. Needs its own deliberate,
  separately-reviewed commit; exclude it explicitly when committing ticketing-complete's work.

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
- [ ] **[P1] Upstream dependency: carve `execution/checks/` (or an equivalent project-owned check
  directory) out of HARNESS ownership in `update-manifest.yaml`.** Surfaced 2026-09-08 by
  nos-design-system M7, whose contract commissions a project-specific verifier at
  `execution/checks/verify_nos_m7_hero_and_grammar.ts`. `execution/` is marked `HARNESS`, so the
  next `make update-template` replaces the tree wholesale, silently, with no merge and no conflict
  marker — taking any project-authored check with it and leaving the contract's assertions
  greenless with no trace of why. This is **not** specific to M7: ~20 existing siblings already
  live in `execution/checks/` under the same exposure, so it is a pre-existing project-wide gap
  this feature merely surfaced. Per `.claude/rules/athanor.md` a harness defect is filed, never
  patched or worked around — M7 therefore keeps its verifier at the conventional path rather than
  inventing a private one. Ask: a `PROJECT`-marked (or manifest-excluded) subdirectory for
  project-authored contract checks, so the harness can still ship its own scripts alongside.

- [ ] **[P1] Upstream dependency: `execution/codex_qa.sh` reports transport failures as `FAIL`.**
  Filed 2026-09-08 as [InunuNet/Athanor#1419](https://github.com/InunuNet/Athanor/issues/1419).
  Running the mandatory Codex pass on the M7 diff hit an OpenAI usage limit; the wrapper's
  `fail_safe()` (`codex_qa.sh:26-29`, called at `:88` for any non-zero `codex` exit) emitted
  `FAIL` + exit 1 — the identical signal to a genuine defect verdict — with zero findings and
  zero `file:line` citations, because no review ever ran. The documented contract
  (`codex_qa.sh:9-10`) merges these on purpose: `1=FAIL (verdict or fail-safe)`.
  Why it matters here: `.claude/rules/workflow.md` makes the Codex pass a blocking gate before
  any feature is DONE, so an ambiguous failure either blocks a clean diff indefinitely or teaches
  the operator to wave `FAIL` through as "probably quota" — which is how a real finding ships.
  Asked for: a distinct exit code meaning *review did not execute*, with quota/auth/network/timeout
  classified as transport failures before `fail_safe`, so a `type: codex_qa` assertion can record
  BLOCKED instead of a verdict no model produced.
  **Blocks:** M7 cannot be marked DONE until the Codex pass actually runs (quota resets 17:01
  local, 2026-09-08). Do not route around it — re-run, don't waive.

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

- [ ] **P2 — upstream (Athanor): `drive_docx_sync.py` silently loses a whole content folder to an
  unsafe Drive name.** On 2026-09-09 the sync skipped `13. Registration/Booking/Tickets` — the `/`
  in Lee-Ann's folder name is (correctly) rejected as a path component, so the folder *and both
  documents under it* were skipped: `13.1 Ticketing system details.docx` (the full booking model,
  ticket categories and prices) and `13.2 Vendor Form`. It also skipped `Symposium Theme`, a real
  `.docx` whose *name* simply lacks the extension, because the scope filter tests the name rather
  than the mimeType (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
  The containment check is right; losing the content is not. Proposed fix upstream: sanitise the
  folder name into a safe component (retaining the original in `manifest.json`) rather than
  skipping the subtree, and select `.docx` by mimeType with the name as fallback. We cannot rename
  the Drive folder — it is the client's. Recovered manually into `.tmp/sandbox/nos-ia/` for mission
  `national-show-ia-alignment`; that sandbox copy is **not** a durable source of truth.
  File against `InunuNet/Athanor`. Do NOT patch `execution/drive_docx_sync.py` in place (harness).

- [ ] **P1 — contract verifiers in `execution/checks/` will be deleted by the next
  `make update-template`, taking their gates with them.** `.agent/update-manifest.yaml:12`
  classifies `execution/` as HARNESS *wholesale*, so every file under it is replaced on update.
  `nos-design-system`'s M8 contract commissions `execution/checks/verify_nos_m8_status_and_focus.ts`,
  and three untracked `execution/checks/*` files sit in the working tree now
  (`json_field.py`, `json_in_window.py`, `nos_scrim_probe.mjs`). When they vanish, the assertions
  that call them fail with "script not found" and the gates read as broken rather than as
  regressed — the same symptom already recorded against M8. Fix: move commissioned verifiers to
  `scripts/checks/` (project-owned) and repoint the contracts. `national-show-ia-alignment` M1
  already does this and pins it with assertion A0_NOT_IN_HARNESS. Found by @architect, 2026-09-09.

- [x] **WITHDRAWN — `execution/codex_qa.sh` does NOT exit 0 on a FAIL verdict. The original
  report was a pipeline artefact, and the entry is corrected here rather than deleted so the
  same conclusion is not re-derived.** Tested on 2026-09-09 against the real script with a
  stubbed `codex` that always exits 0, so the wrapper could only get its status from the
  verdict token:

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

- [ ] **P2 — `execution/verify_triad_coverage.py` classifies a contract as UI/workflow when
  `app/` paths appear only inside *prohibition* greps, with no route or component under test.**
  On 2026-09-09 this blocked `mission.py gate --milestone M1` at exit 6 for
  `national-show-ia-alignment`. The two assertions that tripped it are both negative:
  A16 — *"No file under app/ contains the GROQ type literal for showPage"* — and
  A37 — *"the gated vendor subsystem is untouched"* (`git diff --name-only HEAD -- app/api/vendors`).
  Neither renders anything. M1 ships `components/nos/ShowPageProse.tsx` and
  `lib/data/show-pages.ts`, but **no route renders either until M4**, so there is no deployed
  surface for a `browser_deployed_check` to point at — the same reason the route checks R1/R3/R4
  correctly report SKIP.
  Proposed fix: classify on *positive* evidence — an assertion that exercises a route or renders a
  component — rather than on any occurrence of an `app/` path; at minimum, exclude assertions whose
  command is a negative grep or a `git diff --name-only` emptiness check.
  Worked around locally, correctly and narrowly: `TRIAD_BASELINE_FILE` /
  `TRIAD_BASELINE_HASH_FILE` point at **project-owned** `scripts/checks/triad-baseline-exempt.txt`
  and `.sha256` (never `execution/`, which the next `make update-template` deletes), scoped to M1's
  contract alone and content-pinned by sha256 so any edit re-arms enforcement. **M4 must carry the
  full triad and must never be added to that baseline** — it builds sixteen real pages on a
  deployed origin, which is exactly what the triad exists for.
  Filed upstream: **InunuNet/Athanor#1432**. Do NOT weaken the linter and do NOT fabricate triad assertions.

- [ ] **P2 — an assertion that can only be satisfied by altering the client's factual content is
  a defect class, not a one-off.** On 2026-09-09 assertion P6 (`national-show-ia-alignment` M1)
  matched `/\bR\s?\d{2,4}\b/` to catch unconfirmed ticket prices. It also matches **`R44`** — the
  national road the venue sits on. The council's only written statement of the venue is
  *"Stellenbosch Flying Club, R44 northbound to Stellenbosch"*, so the check made a confirmed fact
  a visitor needs unpublishable, and @dev paraphrased around the road number to get the gate green.
  Fixed by scoping P6 to sections whose provenance is `placeholder-ai` or `research` — **we police
  our own words, not the client's** — plus a price-vs-route discriminator, dry-run 19/19 in both
  directions. The same scoping now governs the WOSA vocabulary checks (W1/W2).
  Two more of the class were found in the same audit and fixed: P7 matched `home` as a substring
  (a title like "Homegrown Orchids" would have been forced to change) — now word-bounded; and no
  assertion protected the venue sentence itself — added as D6/A44, which asserts it verbatim.
  **Standing rule for contract authors:** before shipping a content-matching assertion, ask what a
  correct-but-unusual client fact would do to it, and scope it to generated copy wherever the
  client's own words could be caught. Found by @architect and the team lead, 2026-09-09.

- [x] **Standing rule, added 2026-09-09 — an overstated guarantee is a defect, and on this
  mission it was the commonest one.** Of the three critical findings against
  `national-show-ia-alignment` M1, **two were overstated guarantees rather than missing code**:
  - `provenance-gate.golden.md` claimed *"the copy never crosses a module boundary as plain data,
    so there is no un-noticed form of it to render by mistake."* `lib/data/show-pages.ts` exported
    `__unsafeUnwrapGatedProse` publicly, guarded only by a doc-comment. @qa's probe imported it
    from an arbitrary component, discarded the notice, rendered the blocks, and typechecked clean.
  - the same golden's limitation (a) said `sourcePath` *"raises the cost"* of mislabelling. The
    implementation resolved against cwd and called `existsSync`, so any existing path on the
    machine satisfied it — `/etc/hosts` included. The cost was zero.

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

- [ ] **P0 — Drive-sourced client documents can carry live secrets into a tracked, PUBLIC repo.**
  On 2026-09-09 Codex found plaintext email passwords in
  `docs/leeann-source/website-development-specification-v3_2026-09-06.md`, committed `1d6512cb`
  and pushed to public `InunuNet/SAOC`. See `needs-human.md` for the rotation actions.
  The design gap: `execution/drive_docx_sync.py` converts the client's Drive documents into
  `content/drive-source/`, and per `docs/drive-docx-version-export.md` the derived `content.md`
  is **tracked by design**. Nobody anticipated a client planning document containing credentials
  — which is exactly what a volunteer-run organisation's working document does contain.
  Fix: a secret scan gating anything Drive-sourced before it can be staged or committed
  (credential-shaped table rows, `password`-adjacent columns, high-entropy tokens), failing
  closed. Consider whether derived `content.md` should be tracked at all for client-supplied
  source, or kept local with only checksums and structure committed.
  `execution/` is HARNESS-owned — file upstream against `InunuNet/Athanor`, do not patch.

- [ ] **P2 — `mission.py validate` accepts a milestone referencing a nonexistent feature.**
  On 2026-09-10 @architect accidentally deleted feature F15 while revising an adjacent brief.
  `mission.py validate` reported "Valid, 18 features" — it verifies every feature belongs to a
  milestone, but not the converse: that every milestone's feature reference resolves. The mission
  would have carried a dangling `F15` under M4 and silently lost its deployed-verification
  feature. Caught only because the author cross-checked both directions by hand.
  Fix: validate milestone→feature references resolve, and fail on a dangling ref. Cheap check,
  and the failure it prevents is silent feature loss.
  **Not yet filed upstream** — read `execution/mission.py`'s validator first and reproduce it in
  both directions before filing. One untested upstream claim today was enough (see the withdrawn
  `codex_qa.sh` entry). `execution/` is HARNESS-owned; file against `InunuNet/Athanor`, no patch.

## NOS M1 — open on resume (paused 2026-09-10 by operator)
- A39 source-verification fix is COMPLETE (content-linkage check in `lib/data/show-pages.ts`); gate not re-run.
- Linkage check correctly FAILS two seed sections whose body is @dev's prose but labelled `council-supplied`:
  - `content/show-pages/13-booking-tickets.json` § `categories`
  - `content/show-pages/18-contact-us.json` § `overview`
  Fix on resume: replace with a real excerpt from the source, else reclassify to `placeholder-ai`. Never loosen the 25-char/sentence threshold.
- Structure itself is frozen pending three-session sign-off (SAOC lead / NOS Site / NOS Design) + operator approval.
- [ ] **[P1] Duplicate `Event` structured-data node for the 2027 National Show.**
  `/events/19th-south-african-national-orchid-show` emits a second schema.org `Event` for the
  SAME real-world show as `/national-show` — identical name, dates and venue, different URL.
  Duplicate-entity cannibalisation in search. Origin is the generic society-event route driven
  by a Sanity `societyEvent` document. Found 2026-09-08 by the NOS design session during its SEO
  work and filed as InunuNet/SAOC#2 with three candidate directions. **Do NOT delete the Sanity
  document without first checking what else reads it** — the events calendar and .ics feeds may
  depend on it. Our tree (`app/(marketing)/events/**`), not the NOS session's.

- [ ] **[P1] Nothing in this repo runs the contract checks — no CI job, no `test` script.**
  Verified 2026-09-08: `.github/workflows/ci.yml` runs only lint, type-check, build and two
  residue guards (one SKIPPED for missing secrets). `package.json` has no `test` script. Grep for
  `contracts/checks` across CI, Makefile and `execution/` returns zero. Every assertion runs once
  — when its author invokes it — and never again.
  This is the mechanism behind the contract-decay items already logged above (the four failing
  contracts found during the vendor F2 QA sweep, and the standing "audit remaining contracts for
  the weak-assertion defect class" item). Those were symptoms; this is the cause. Consequence:
  every "N/N assertions green" claim in this repo is a point-in-time measurement, not a standing
  guarantee. Mission `ticketing-complete` F7 is folding in a runner + CI job.
  Related, and Brad's call because it is a GitHub setting not a code change: **main has no branch
  protection**, so even a wired-up red CI job blocks nothing (stated in ci.yml's own comments).

- [ ] **[P2] A contract runner must distinguish "check failed" from "check was never runnable."**
  Reported 2026-09-08 by the NOS session: of nine Playwright check scripts named in its contract,
  seven do not exist on disk. A runner that treats a missing script as a failure buries real
  failures in noise; one that skips it silently reports green for coverage that was never written.
  Neither is acceptable — the two states must be reported separately. Fold into F7's runner.

- [ ] **[P2] `check-workshop-products.mjs` is stale post-F2 (ticketing-complete) — three
  assertions need updating to the new 3-product reality, one genuine pre-existing defect
  needs separate repair.** Ruling written 2026-09-08:
  `.agent/memory/project/specs/ticketing-complete/goldens/f2-README.md` §14. File:
  `contracts/checks/ticketing-workshops-f2/check-workshop-products.mjs` (belongs to the
  earlier, closed `ticketing-conferences-and-events` mission, not `ticketing-complete`).
  Correct-consequence fixes (never revert F2's data to make these pass): update
  `REQUIRED_SLUGS` to drop `field-trip-single`/`field-trip-all-outings` and add `field-trip`;
  update the `length === 4` expectation to `3`; delete the now-permanently-vacuous
  field-trip bundle-relationship check (both slugs it reads are `undefined` post-retirement,
  so its guard silently no-ops rather than failing — dead coverage, not passing coverage).
  Genuine pre-existing defect, unrelated to F2: the "oversell invariant" check
  (`cocktailSingle.capacity * 1 + cocktailCouple.capacity * 2 <= 200`) predates
  `planPooledCapacity()` (shipped later, `ticketing-conferences-and-events` M2/F5) and
  double-counts one shared `capacityPool: 'sunset-cocktails'` ceiling as if it were two
  independent per-slug budgets — it will fail forever regardless of any F2 change. Needs
  rewriting to assert the two products share one pool at the real venue ceiling (200), not a
  sum of two fields. Implementation work for `@dev`, not an architect edit.

- [ ] **[P1] Audit remaining contracts for the weak-assertion defect class — standing, open.**
  The general class (an assertion satisfiable by something other than the real property it
  claims to check) is still unaudited across the repo at large and stays open.

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
