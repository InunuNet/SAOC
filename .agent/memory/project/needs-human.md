# Needs human

## READ FIRST — the two things blocking real progress (2026-08-12)

Everything else in this file is detail. These two are not code problems and no agent can clear them.

1. **Firebase Authentication is not provisioned on `saoc-webapp`.** `/admin` and the door check-in
   scanner are non-functional in **every** environment — local and deployed — regardless of the
   security hardening shipped overnight in `be80580`. Fix is console-only, ~5 minutes: Firebase
   console → `saoc-webapp` → Build → Authentication → Get started → enable Email/Password, then
   create the secretary and door-staff accounts. Nothing in the codebase changes. Full detail in
   the BLOCKER section below. This blocks any door-scanning demo.
2. **The committee still owes every real number and rule.** Ticket prices and venue capacity,
   confirmed venue and dates, opening hours, parking, accessibility, photography policy,
   cloakroom, accommodation, emergency contacts — and *all* exhibitor rules (entry deadline, fees,
   staging times, ownership rule, sales terms, entry form). The site currently renders our
   researched placeholders, visibly marked as pending committee confirmation on every surface,
   which is honest but is not something to put in front of a sponsor indefinitely.

Two smaller decisions are also waiting below: which PayFast payment methods will be enabled (it
determines whether the 30-minute reservation TTL is safe), and whether the show H1 should carry
the edition ordinal.

## PayFast Sandbox credentials (2026-07-03)
Needed to test the D2/D4 PayFast checkout integration end-to-end. Free signup, no FICA required for sandbox:
1. Sign up at sandbox.payfast.co.za (or registration.payfast.io, select sandbox/test mode)
2. Get Merchant ID, Merchant Key, set a Passphrase
3. Add to .env.local as PAYFAST_SANDBOX_MERCHANT_ID / PAYFAST_SANDBOX_MERCHANT_KEY / PAYFAST_SANDBOX_PASSPHRASE
Blocks: live checkout testing against PayFast's sandbox API. Does NOT block schema rework, spec, or UI scaffolding.

## Real 2027 Show ticket pricing (2026-07-03, non-blocking)
Adult/Pensioner/Child/Member/Exhibitor tier prices and capacity not yet confirmed by Brad. Building against proposal's tier names with placeholder prices in the meantime, clearly flagged as placeholders.
**Possible lead (2026-07-15):** Caral-Anne van der Westhuizen referenced an Excel spreadsheet ("2nd tab with dropdown menus") covering cocktail-party and other ticket options during the Spec V2 tracked-changes review; Lee-Ann confirmed full ticket write-up/pricing still needs to come from the committee. Worth asking Lee-Ann for that spreadsheet directly rather than waiting for it to be rewritten.

## Scope reconciliation: Spec V2 vs signed Phase 1 proposal — DECISION MADE (2026-07-20)
Background (2026-07-15): built a full comparison (artifact, not committed to repo) of Lee-Ann's Website Development Specification V1/V2 against our 28-May proposal (R12,375 ex VAT, 8 pages + 1 Show landing page + simple 5-tier Yoco ticketing). Finding: most of what we quoted as separately-priced "Future Phases" (Membership + journal archive) read as core/confirmed scope in her spec, and an entire event-conference layer (Symposium, WOSA Conference, Workshops, SA/international exhibitor+guest databases, Plant Sales, Programme, Plan Your Visit, FAQ — 18 National Show pages total) was never quoted at any phase.

**Brad's decision (2026-07-20):** Proposal was never signed → room to negotiate, but NOT room to fold every future-phase item into Phase 1. Chosen approach: keep Phase 1 tight to roughly its original scope — absorb small polish items from Spec V2 at no cost, defer/reprice the four "root cause" items as a separately-scoped Phase 2:
1. Shared relational content database (Section 7 schemas)
2. Unified multi-category booking with waitlists
3. Members Portal + journal + awards archive
4. Symposium / WOSA Conference / Workshops event layer

Reframed around real urgency Brad surfaced: SAOC needs a **sponsor-presentable site ASAP**, and wants **National Show tickets on sale early enough to sell out by early 2027**. Sequence: (1) design sign-off → (2) core SAOC site + a Show "marker" landing page live → (3) ticketing live off that same page → (4) the four bigger items as a separately-scoped Phase 2 once the foundation is live and the committee is actively marketing.

**Provenance VERIFIED (2026-07-23).** The proposal Lee-Ann actually received = `SAOC_Website_Proposal_28-05-2026.pdf`, emailed 28 May 2026 to `saoctreasurer@gmail.com` (different address than the `2027national@gmail.com` she uses now). That sent PDF was downloaded from Gmail and diffed word-for-word against `documents/SAOC_Website_Proposal_28-05-2026.docx` on disk — identical content (PDF differs only in letterhead/pagination). The on-disk docx is the confirmed source of truth. A full page-by-page phase-map artifact was built from it: https://claude.ai/code/artifact/eb888f16-a4e8-42c7-9a1e-0c595fc85326 (all 24 Spec V2 pages → Phase 1 / Phase 2 / needs-decision with reasoning; flags that Spec V2's "confirmed by INUNU" claim on the full unified multi-category booking overstates — only General Admission for Phase 1 is confirmed).

**Yoco→PayFast — already RESOLVED in writing, not an open question.** Brad's SENT reply of 3 Jul 2026 (thread `19f177b373bd9f35`, to `2027national@gmail.com`) responding to the Secretary's formal question list already told Lee-Ann Yoco is waitlisted with no ETA, recommended PayFast with exact fees (3.2% + R2/card txn, 2.0% Instant EFT), and listed the FICA docs needed. Lee-Ann acknowledged same day and said the committee would discuss and revert — no reply since. Treat only as a "did the committee land anywhere?" follow-up, NOT a fresh item to raise.

**Draft email — UNSENT and now STALE, no agent action.** "SAOC website — how I'd sequence the build," to Lee-Ann McCleland <2027national@gmail.com>, sitting in Brad's Gmail drafts (draft id `r7069159880970212600`). It has NOT been rewritten to reflect the verified/corrected facts above, so it is now stale relative to the corrected call-prep doc (`documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md`). Brad hasn't decided whether to rewrite it or work live from the phase-map artifact on the call. Brad may edit+send, rewrite, or reply personally. **No further action from any agent until Brad decides.**

## National Show 2027 brand assets — RECEIVED, in Gmail only, not yet in repo (2026-07-20)
Scott Ormerod (scotto8635@gmail.com) sent the real 2027 National Show brand identity across 4 emails on 14–15 Jul 2026. This is **Show-specific branding only** (see separate SAOC-org brand item below — do not conflate).
- **Logo files** (PDF + PNG, includes a dark-background variant) — Gmail thread `19f606db2c0aa324`
- **Colour codes** — Gmail thread `19f60645373e12f3`: `A7A841` (Green 1), `7F7D33` (Green 2), `211A57` (Royal purple), `F3F2D6` (Pale yellow gold)
- **Fonts** — Gmail thread `19f60887904c4bd9`: Montserrat (Google Fonts) + three DaFont picks (Hey August, James Stroker, Fake Serif), all confirmed free-license by Scott
- **~8 event photography files** — Gmail thread `19f66d21479b51a4`
~~None of these attachments have been pulled into the repo yet.~~ **Pulled in 2026-07-20** → `branding/national-show-2027/`: `logo/` (5 files), `reference-photos/` (13 of Scott Ormerod's watermarked studio orchid photos), `palette-and-type/` (hex codes + font recs), and a `README.md` manifest with full provenance per asset. Folder currently **untracked in git — Brad hasn't decided whether to commit.** ⚠️ **Photo usage rights unconfirmed:** the 13 reference photos are Scott's own copyrighted work (flagged in the folder's own README) — usage rights must be confirmed before ANY public use. Real assets exist → Show-side visual design can proceed now.

## SAOC organisational brand — STILL OUTSTANDING, not yet received (2026-07-20)
Distinct from the National Show brand above — two separate identities per project scope (SAOC org vs National Show event). Lee-Ann's 14 Jul email (thread `19f5fc5d619d8026`) states: "Scott will also help me with the design for SAOC and we will get this to you asap." As of 20 Jul 2026, nothing concrete for the SAOC (non-Show) brand has arrived. **SAOC-side visual design remains BLOCKED until this arrives.**

## Placeholder "Sage & Paper" design system violates no-invented-brand rule (2026-07-20)
`design/design_handoff_saoc/` in the repo contains a placeholder "Sage & Paper" design system (deep sage green, brass accent, Crimson Pro serif, Manrope sans) invented before any real SAOC brand existed — this violates CLAUDE.md's "no invented brand assets, wait for Claude Design handoffs" rule (presumably built as an early exploratory placeholder). It covers the general 7-page SAOC site. Cannot be reconciled against a real SAOC brand until the SAOC-org brand arrives (item above). Do NOT treat it as the real brand; Show-side work uses the real assets instead.

## Legacy old-website cPanel access — RESOLVED 2026-07-20: MIGRATE (decision made, restore done)
~~Lee-Ann forwarded old-website cPanel access from "Nico" on 17 Jul (thread `19f6f9357031db8f`); keep/migrate/discard call left to Brad.~~ **Decision: migrate.** Brad pulled a full JetBackup account backup from the legacy host (i-svr.net) and restored the live site, database, and all 5 mailboxes onto Inunu's own VPS (`wh3.inunu.co.za`, cPanel user `ahsaoc`), served as a local preview at `new.saoc.co.za`. Full state + remaining steps tracked in `backlog.md` → "Legacy site migration → Inunu VPS". Legacy public site untouched; real DNS cutover still pending. Credentials in gitignored `ops-secrets.local.md` only.

## Real mailbox passwords — RESOLVED 2026-07-20: KEEP GENERATED (security decision by Brad)
~~The 5 migrated mailboxes currently use freshly generated TEMPORARY passwords; Lee-Ann asked to collect the ORIGINAL password from each user, then swap temp → real.~~ **Superseded.** Lee-Ann supplied the real originals for two mailboxes (info@ and treasurer-secretary@). They were **weak, and treasurer-secretary@'s nearly matched the legacy cPanel login password** (credential reuse). **Brad's decision: do NOT switch — keep the originally-generated random passwords on all 5 new-VPS mailboxes** rather than adopt weak/reused ones. Users' mail clients will need the new passwords entered once at cutover (small one-time cost, worth it for security). Brad intends to raise mailbox-password hygiene with the committee. Both sets — the GENERATED (in use) and the SUPPLIED (reference only, NOT in use) — are recorded in gitignored `ops-secrets.local.md`; no further action needed there. **Committee follow-up remains for Brad.** (Mail must still be re-pulled from the legacy host one final time right before DNS cutover — see backlog.)

## Sanity project downgraded to Free plan (2026-07-14, noticed in passing)
Email from Sanity.io: SAOC's Growth trial ended, project auto-downgraded to Free plan. Not yet assessed whether Free-plan limits (API CDN requests, dataset size, seats) affect the current build or CI's llms-full.txt refresh cron. Needs a look — flagging so it doesn't get lost.

## PayFast M1 spec — security review deferred (2026-07-03, late Friday)
Brad approved proceeding to @dev without a detailed walkthrough right now (tired, end of week).
Spec itself is sound (server-derived pricing, fail-closed ITN validation, contract-gated signature).
Revisit later: the architect's flagged [VERIFY] items once @dev confirms them against real PayFast
docs — signature field ordering, PHP urlencode vs JS encodeURIComponent, ITN source-IP list,
server-confirm callback path. Not blocking build, just worth a real look once it's implemented.

## National Show brand model — per-edition redesign vs stable master brand + rotating host sub-brand (2026-07-20, PENDING COMMITTEE DISCUSSION)
**Type: branding/governance decision, NOT an engineering task.** Blocked on a conversation Brad needs to have with Lee-Ann McCleland and the National Show committee.

Brad's working hypothesis (NOT a settled decision): looking at the branding history, the National Show's visual identity appears to get **redesigned from scratch for each host cycle**. The current 2027 logo is explicitly branded "WESTERN CAPE 2027" — tied to this edition's host region and its chosen orchid emblem (a *Disa graminifolia*, selected by committee vote in 2025) — rather than being a stable identity reused edition over edition. Brad suspects this per-edition full-redesign model may not be the right approach.

Brad's proposed alternative (his hypothesis, to raise with the committee): give the National Show its **own stable master brand** (a logo/identity that persists across editions), with a **rotating "host sub-brand" layer** that changes per edition depending on where the show is hosted (e.g. Cape Town, Stellenbosch, Johannesburg, KwaZulu-Natal). Master identity stays constant; host region + emblem varies per edition.

**Status: unconfirmed working hypothesis, not an architecture decision.** Brad wants to raise it with Lee-Ann and the National Show committee before concluding anything — the committee owns this call. No agent action; this is a discussion item for Brad. See related knock-on for asset folder structure in `backlog.md`.

**(2026-07-23) Related, separate branding question — quality of the current 2027 Show identity.** Beyond the master-vs-per-edition model above, Brad's own view is that the current National Show branding (Scott Ormerod's logo/colours/fonts) is somewhat lacking for a national-event brand. He wants to ask Lee-Ann/the committee directly whether the Show identity is locked or open to a proper redesign via Claude Design — framed as a *process offer*, NOT a critique of Scott's volunteer work. Added as sub-item C3 to the call-prep doc (`documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md`). Discussion item for Brad; no agent action.

## RF-11: Sanity Studio edit-pane manual browser verification — NOW ACTUALLY PERFORMABLE (contract-sanity-react-peer-fix, 2026-07-24)
`contracts/contract-sanity-react-peer-fix.yaml` RF-11 is `kind: agent_review` and cannot be machine-checked — it requires opening a real browser against the embedded Studio iframe. All 8 automated assertions (RF-01, RF-03 through RF-07, RF-09, RF-10) pass: `package.json` react/react-dom bumped `^19.0.0` → `^19.2.2`, `pnpm-lock.yaml` regenerated (resolved version unchanged at `19.2.7`, single deduped tree), `pnpm install --frozen-lockfile` clean, `pnpm type-check` and `pnpm build` both pass, `apphosting.yaml` clean.

**This React-peer fix is real hygiene but NOT confirmed to be the actual root cause** — `pnpm-lock.yaml` resolved React `19.2.7` (which already has `useEffectEvent`) throughout the entire incident history, including before the bug was ever reported. A second lead — Sanity's 2026-07-14 Free-plan downgrade breaking permissions — was also investigated and ruled out via a live API check (both a read query and a real write/mutate transaction against `production` succeeded with the project's actual token).

**Separately, a real and unrelated bug was found and fixed that was previously blocking this verification entirely: `sanity.config.ts` was `require()`-ing the ESM-only `@sanity/vision` package in a dev-only conditional, hard-crashing the ENTIRE `/studio` route with a 500 under `pnpm dev`.** That's fixed and gate-verified (`contracts/contract-sanity-vision-esm-fix.yaml`, VF-01–VF-07 green). **Practical effect: local `pnpm dev` access to `/studio` was completely broken before this session and is not anymore — RF-11 can now actually be attempted**, whereas previously the Studio route couldn't even be reached locally to test the original bug.

Still needed: run `pnpm dev`, open `http://localhost:3002/studio` with real Sanity credentials, click into any existing document (e.g. a society or event), and confirm whether the edit pane renders its fields — or stays blank/spins/errors, matching the original bug report. Check the browser console for any `useEffectEvent` error as corroborating evidence either way (shouldn't appear, given the React lead was ruled out, but worth capturing). Per README.md's closing note, do not treat the contract gate as meaningfully green until this is actually performed. Full investigation writeup: `docs/sanity-studio-p0-investigation.md`.

## 2026-07-29 — F5 (RF-11): Sanity Studio login needed to close the P0

**Blocked on:** external credentials (Sanity OAuth for project `26yfbug4`). Agents cannot
complete an interactive OAuth flow, and there is no stored token that authenticates the
*browser* session — `.env.local`'s `SANITY_API_TOKEN`/`SANITY_API_READ_TOKEN` authenticate
server-side API calls only.

**Verified so far (no auth required):**
- Dev server on port 3333, Next.js 16.2.12, Turbopack. `/studio` returns HTTP 200.
- Studio shell renders cleanly: **no `useEffectEvent` error**, no pageerror, no console
  errors beyond a routine React DevTools notice. The CORS/port problem from 07-24/07-28
  is resolved on 3333.
- Studio presents Sanity's "Choose login provider" screen (Google / GitHub / E-mail).

**NOT verified — this is the open assertion:** whether the document edit pane renders its
fields. The original crash was at `DocumentPaneInner`/`useResetHistoryParams`, which is
downstream of login, so the shell loading proves nothing about the fix.

Note: an earlier mission-file claim that "Studio loads, authenticates, renders the full
schema tree" could NOT be reproduced from an agent environment — treat it as unverified.

**What unblocks it (Brad):**
1. `! npx next dev --port 3333` (port 3333 is the only Sanity-CORS-whitelisted origin)
2. Open http://localhost:3333/studio and log in
3. Click into any society or event and report whether the edit pane renders fields or
   throws — a screenshot of either outcome closes this.

Alternatively, export a Playwright `storageState.json` from the authenticated session and
an agent can drive the rest.

### RESOLVED 2026-07-29 — Brad authenticated and confirmed the edit pane renders

Brad logged into Studio on port 3333 and opened `province-wc` (Western Cape) at
`/studio/structure/province;province-wc`. Screenshot evidence: the document edit pane
renders its fields (Name = "Western Cape", Code = "WC", Slug = "WC"), with Published/Draft
state chips and an active Publish button. **No crash, no error boundary.**

This closes RF-11. The original failure was in `useResetHistoryParams` inside
`DocumentPaneInner` — the generic document pane shared by every document type, which
crashed before rendering any fields. A populated edit pane means that path now resolves
`useEffectEvent`, confirming the Next 16 vendored-React fix end-to-end in the browser.

Also visible and worth noting for F6: the Studio structure DOES expose all six page
singletons in the left nav (Home Page, About Page, National Show, Contact Page, Judging
Page, Members Page). So the singletons are *reachable* in the UI — they simply have no
documents behind them. That distinguishes "not wired into the Studio" from "wired but
empty"; it is the latter.

Still open (minor): a live edit → publish → persist round-trip has not been performed.
The Publish button renders; persistence is not yet demonstrated.

## BLOCKER — Firebase Authentication is not provisioned on `saoc-webapp` (2026-08-11)

Found by @architect while designing `contracts/contract-ticketing-hardening.yaml`.
Verified against the real project with the service-account credentials in `.env.local`:

```
getAuth().listUsers()  -> auth/configuration-not-found
getAuth().createUser() -> auth/configuration-not-found
```

`auth/configuration-not-found` means Firebase Authentication has never been enabled for
the project — there is no Identity Platform config to talk to. Consequences, all present
today and unrelated to any code defect:

- `/admin/login` cannot sign anyone in — no ID token can be minted by any client.
- `POST /api/admin/session` can never mint a session cookie, so `/admin` and the door
  check-in scanner are unusable in every environment, local and deployed.
- Security-wise the endpoints fail CLOSED (everything is 401), so this is a
  functionality blocker, not an exposure.

**Human action (Brad):** Firebase console → project `saoc-webapp` → Build →
Authentication → Get started → enable the Email/Password provider, then create the
secretary/door-staff accounts. Nothing in the codebase changes.

Until then, the door-admission assertions (A1–A4 of the ticketing-hardening contract)
exercise `lib/checkin.ts` directly against real Firestore rather than through the
authenticated HTTP route; the auth layer itself is covered unauthenticated by A5.

---

## show-exhibitor-info — sequencing decisions the orchestrator must make (2026-08-11, @architect)

These are not blocked on a human *judgement*; they are blocked on a **merge sequence** only the
orchestrator can order, because the files belong to the `show-visitor-info` stream which is editing
them concurrently. Full reasoning:
`contracts/golden/show-exhibitor-info/exhibitorStages-reconciliation.golden.md`.

**FU-1 — link the exhibitor guide from the show landing page. DONE 2026-08-12 (@dev DEV-VISITOR3).**
`app/(marketing)/national-show/page.tsx` now links to `/national-show/exhibitors` from the
"Exhibitor information" section, below the stages summary. Added additively — the inline
exhibitor-stages section was NOT replaced (that is FU-2, and the stages block is still the only
thing carrying the pending markers). Verified in the rendered HTML of `/national-show`.

**FU-2 — delete `nationalShow.exhibitorStages`.**
The exhibitor guide never reads it (asserted, A12), so there is one source *for that page* from the
moment this ships. Removing the field itself needs `sanity/schemas/documents/nationalShow.ts`,
`sanity/queries.ts` and the landing page — and there is a harder blocker than file ownership: the
sibling contract's **A5 explicitly asserts `exhibitorStages` still exists**. Deleting it while that
contract is open turns the sibling's gate red. The two contracts would be asserting opposite things
about the same line of the same file.
*Gated on:* FU-1, **and** `contracts/contract-show-visitor-info.yaml` A5 being amended to drop
`exhibitorStages` from its field list. Amending that assertion is the orchestrator's call, not
either stream's.
*Interim state, deliberately visible:* until FU-2, the landing page shows the old portable-text blob
and `/national-show/exhibitors` shows the structured guide. Bounded and booked, not abandoned.

**FU-3 — unify `ExhibitorStatusBadge` with the visitor stream's `ConfirmationBadge`.**
Two badge components is real duplication. The exhibitor stream needs a fourth status value
(`question`) that the visitor stream's three-value model does not have, so the merged component
takes the four-value list. Same for the two `_shared.mjs` check helpers, which are near-copies.
*Gated on:* both streams landed and stable.

## A61 venue-change sweep: two cross-stream rulings needed (2026-08-12, @dev round 2)

`contracts/checks/show-visitor-info/check-show-identity-sweep.mjs` (A61) is down from 24 failing
assertions to 2. Both survivors are **content/ownership decisions, not production defects** — the
show-identity wiring itself is complete and proven (a venue swap now updates all 14 surfaces in
`show-identity-surfaces.golden.md`). @dev cannot resolve either without editing another stream's
contract or overriding a recorded team-lead ruling.

**1. `nationalShow.title` embeds the edition ordinal.**
Seeded value: `"The 19th South African National Orchid Show"`. The edition also lives in its own
`edition` field. A61 swaps `edition` to 41 and then fails `/national-show renders NO trace of "19th"`,
because the landing page renders the CMS `title` verbatim — which A56 (currently GREEN) *requires*
it to do (`check-show-identity-rendered.mjs:65`).
- Conflict: `contracts/cms-loop-f3-national-show.yaml:121` records a team-lead ruling
  "TITLE — WIRE AS-IS", deliberately choosing the ordinal-bearing title.
- Also pinned by `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json:8` and
  `scripts/seed-page-singletons.ts:212` (which this round's brief forbids @dev from editing).
- Note: `show-identity-surfaces.golden.md:8` defines a "show-identity fact" as venue name/city/
  province/dates/edition/host region/countdown — `title` is **not** on that list, and the H1 is not
  one of the inventory's 14 rows. So the golden and the check disagree here, and the golden agrees
  with the current code.
- Recommended: drop the ordinal from the seeded title ("The South African National Orchid Show").
  A56 keeps passing (the page still renders whatever the dataset holds) and the edition renders from
  `edition` everywhere. Needs the CMS stream to update its golden + seed, so it is a team-lead call.

**2. A past show legitimately held in Cape Town.**
`show` document `year: 2018, location: "Cape Town City Hall"` is rendered in the landing page's
"Past editions" list. A61 lists `OLD.city` in the **fail** set for `/national-show` with no
allowPhrases, so a venue change can never clear it — no Studio edit should rewrite a historical
record. The check already exempts city on `/national-show/archive` for exactly this reason, and
`show-identity-surfaces.golden.md` row 5 calls past/future rows "constitutional record".
- Recommended: apply the archive's existing carve-out to `/national-show`, which renders the same
  past-editions list. That is a check change, which @dev is not permitted to make this round.


---

## QA @ show-exhibitor-info (Stream D), 2026-08-12 — contract changes @qa cannot make

Full report: `.agent/memory/scratch/exhibitor-qa.md`. Verdict FAIL (narrow — the page content is
sound; the failures are in the contract, one check's coverage, and two knowingly-deferred F4 items).

**A live content incident was found and remediated during this pass.**
`showExhibitorInfo.keyDates[0].dateNote` held `EXH-DEADLINE-SENTINEL-1786483529527` and was
rendering on `/national-show/exhibitors` as the "Entries close" value for roughly 4.5 hours
(written 23:25, found 03:49). Restored to `To be set by the show committee`, verified. Dataset is
clean as of 04:10.

**1. A36 has no `timeout_seconds` and is guaranteed to be SIGKILLed mid-mutation. Fix first.**
`contracts/contract-show-exhibitor-info.yaml:313-320` inherits the 60s default from
`execution/contract.py:254`, while `check-cms-round-trip.mjs` budgets 240s/phase and takes ~140s.
Every gate run therefore kills it after the sentinel write. This is the root cause of the incident
above **and** of both leaked locks tonight; it reproduced on my own gate run. Until
`timeout_seconds: 420` lands, every `contract.py gate` on this contract risks republishing a
sentinel as the exhibitor entry deadline. The check passes cleanly given adequate time (43/43).

**2. `check-policy-language.mjs` (A33) does not scan step bodies — 7 documents are exempt.**
`contracts/checks/show-exhibitor-info/check-policy-language.mjs:84-86` collects only `title` and
`when` from `showExhibitorStep`. Proved with a control: "Entries close on 3 March at 4pm. The entry
fee is R250 per plant…" planted in `showExhibitorStep-enter.body` → A33 green, zero failures; the
identical sentence in `fees.body` → 7 failures. This is the mission's crux check with a hole in it.
Fix is one line: push `portableTextToPlain(s.body)` into `collectCopy`.

Both are contract/check edits, which this round's rules bar @qa (and @dev) from making.

**3. Lock leak affects the sibling stream too.** `_mutation-guard.mjs` has no stale-lock reaping and
no SIGTERM/SIGINT handler, so any killed run wedges the next one.
`show-visitor-info-dataset.lock` currently holds `pid 49199`, which is dead — left in place, as it
belongs to the visitor stream. Someone on that stream should clear it and check that dataset for
`SVI-` residue.

## HARNESS BUG: `--phase all` drops the CLI `--timeout-seconds` (2026-08-12, @dev round 2)

> **FILED UPSTREAM 2026-08-12: https://github.com/InunuNet/Athanor/issues/1337** — no further
> action needed from Brad on this entry; kept for the diagnosis.
> STATUS: no longer dangerous on this contract. Every mutating assertion now declares its own
> `timeout_seconds`, and declared timeouts are unaffected by this bug. It caused three dataset
> incidents on 2026-08-11/12 only because no assertion declared one at the time. Still worth
> filing upstream. Original diagnosis below, narrowed.

ROOT CAUSE FOUND, exact line: `execution/contract.py:472-476`. Under `--phase all`, the runner
rebuilds a fresh `argparse.Namespace` per phase and copies only `contract`, `phase`, `run_checks`
and `handoff` — **the CLI-level `timeout_seconds` override is not copied**, so any check without
its own declared timeout falls back to the 60s default at line 254. NARROWED 2026-08-12 after
ARCH-VISITOR3 added per-assertion timeouts: a `timeout_seconds` declared on the assertion itself
DOES survive normalization (`contract.py:137-138`) and is unaffected. The bug is only the CLI
override, so it bites any assertion that has not declared its own. `--phase <n>` passes `args` straight through and does NOT have the bug.
Observed: `--phase all --run-checks --timeout-seconds 600` recorded
`"Command timed out after 60s"` for A42/A60/A61 (see
`.agent/memory/scratch/contract-results/show-visitor-info/A42.json`), all three of which pass when
run individually.

Fix is one line — add `timeout_seconds=getattr(args, "timeout_seconds", 60),` to the Namespace at
`execution/contract.py:472`. NOT applied by me: `execution/` is shared harness code and four other
streams were running gates against it tonight. Worth a PR to InunuNet/Athanor, since every project
on this harness has the same hazard.

Why this matters beyond a wrong verdict: **killing a mutating check at 60s kills it mid-write**,
before its `finally` restore runs. That leaves the dataset swapped, a sentinel rendering on a
public page, and a stale lock that blocks every later run. That is the same failure mode as
tonight's two content incidents. Running the gate this way is not a read-only operation.

Workarounds until fixed:
- Run the four mutating checks individually
  (`python3 execution/contract.py check <contract> --assertion A61 --timeout-seconds 900`),
  then evaluate the gate **without** `--run-checks` so it reads the fresh result files.
- Never `kill` a running check — wait for it. Its `finally` block is the only thing that restores
  the dataset.

Suggested fix (execution/contract.py, harness-wide): pass the gate's `timeout_seconds` through to
`check_cmd`, and let a contract declare a per-assertion timeout so slow perturbation checks are not
governed by a 60s default.

---

## A61 rulings applied 2026-08-12 (@architect) — both items from the 2026-08-12 @dev entry above are RESOLVED

**Ruling 1 — the show title no longer carries the edition ordinal.** `nationalShow.title` is now
`"The South African National Orchid Show"` (was `"The 19th South African National Orchid Show"`)
in the live dataset, the golden and — pending @dev — `scripts/seed-page-singletons.ts`. The
ordinal is `nationalShow.edition`'s fact and still renders everywhere it should, derived from that
field, so changing the edition in Studio now updates the H1 too.

**FOR BRAD — a copy decision, not a blocker:** this is a visible change to the show's name in the
H1 on `/national-show` and on the home page. It was made for a structural reason (one fact, one
field). If SAOC wants the ordinal in the displayed name, the right fix is to compose it at render
time from `edition`, not to put it back into `title` — say the word and it can be done in an hour.

**Ruling 2 — the "Past editions" list is exempt from the venue sweep, for the city token only.**
A past show legitimately held in the current venue's city (2018, Cape Town City Hall) is historical
record. Scope and cost documented in
`contracts/golden/show-visitor-info/show-identity-surfaces.golden.md`.

**Known hazard for the orchestrator, no human action needed:** the read-only checks (A39/A41/A43…)
take no lock, so running one while a mutating check holds the lock can produce a false RED —
`check-confirmation-markers` failed once tonight purely because `check-marker-fail-closed` had
`pendingLabel` cleared at that moment. It passed on re-run. A read-side lock wait would close it.

## show-exhibitor-info round 2 — three items for the orchestrator (2026-08-12, @architect)

**FU-1 is now asserted and the exhibitor gate is RED on it (A50).**
The exhibitor guide is still unreachable from `/national-show`, which is where an exhibitor
actually starts. Round 1 booked this as a follow-up with no assertion behind it — the same shape
as the `/national-show/archive` orphan this project already shipped once. It now has
`contracts/checks/show-exhibitor-info/check-landing-links-guide.mjs` behind it, crawling real
`href` attributes, and it will stay red until the link lands.

The change is **one additive link** in `app/(marketing)/national-show/page.tsx`. That file belongs
to the visitor stream, which is editing it right now (visitor round-2 item S4 rewrites the
`EXHIBITOR_STAGES` constant at lines 132–160). Exhibitor @dev must NOT touch it — a collision there
costs more than the link is worth. *Decision needed:* assign the one-liner to whoever holds
`page.tsx` when visitor round 2 lands, or sequence it immediately after. It is not exhibitor @dev's
to take.

**FU-2 is unchanged and still correctly blocked — but the harm is now guarded.**
`contracts/contract-show-visitor-info.yaml:131` still asserts `exhibitorStages` must exist in
`sanity/schemas/documents/nationalShow.ts`, so deleting the field would turn the sibling gate red
over the same line of the same file. Verified still true on 2026-08-12; nothing has changed.

Rather than leave the window unguarded, the exhibitor contract's new **A51** guards the *content*
instead of the schema: it goes red the moment anyone publishes anything through `exhibitorStages`,
and it separately checks the rendered landing page is not restating the journey from a hardcoded
fallback. Today it is green. So the latent defect — a committee member finding an inviting empty
"Exhibitor Stages" box in Studio and filling it in — now trips a gate instead of quietly putting
two contradictory exhibitor journeys on the site. FU-2 remains the real fix; A51 makes the wait
safe rather than merely documented.

**F-9 is not what it looked like, and the real cause belongs to the CMS stream.**
@qa measured every content propagation at ~60s and never less, and inferred `/api/revalidate` was
not invalidating this route by tag. The tag wiring is in fact correct end to end — the exhibitor
page tags its reads `['showExhibitorInfo', …]` / `['showExhibitorStep', …]`
(`app/(marketing)/national-show/exhibitors/page.tsx:44-51`), and the route calls
`revalidateTag(body._type, 'max')` as well as `revalidateTag('sanity', 'max')`
(`app/api/revalidate/route.ts:25-28`). New **A52** locks that wiring in place.

The 60s floor comes from somewhere else: `sanity/lib/client.ts:14` sets `useCdn: true`, so
invalidating the Next cache only causes a re-fetch **through Sanity's own CDN**, which serves a
copy up to 60s stale. No amount of tag work will beat that. Fixing it means `useCdn: false` for
server-side reads (or a `perspective`-aware client), which is a **site-wide** change to a file the
CMS-wiring stream owns — not an exhibitor-page defect and deliberately not changed here.
*Decision needed:* whether the CMS stream picks this up. It is a real editor-experience cost
(every Studio edit appears to "not work" for a minute) but nothing is broken.

**ROOT CAUSE of tonight's three dataset incidents — fixed 2026-08-12 (@architect).** Not CDN lag.
`contracts/contract-show-visitor-info.yaml` declared no `timeout_seconds` on any assertion, so
`contract.py` applied its 60s default and SIGKILLed the mutating checks mid-window — after the
sentinel write, before the restore — on every gate run. Measured: A61 246s, A42 161s, A60 82s (all
over 60s, so this was deterministic, not a flake). All 13 node assertions now declare measured
ceilings, and `_mutation-guard.mjs` reaps locks whose pid is dead (the SIGKILL half) and releases
on SIGTERM/SIGINT/SIGHUP (the catchable half). No human action needed; recorded because it explains
the incidents.

**Ticketing: does PayFast need a delayed payment method, and if so is a 30-minute
reservation TTL right?** (@qa, ticketing-hardening round 2, 2026-08-12 — needs Brad, then
possibly Lee-Ann.)

Round 2 gave unpaid reservations a 30-minute TTL (`lib/tickets-constants.ts`
`RESERVATION_TTL_MINUTES`), which fixes the round-1 defect where an abandoned checkout held
a seat forever. The deliberate trade-off, recorded in
`contracts/golden/ticketing-hardening/reservation-expiry.golden.md`: a payment that lands
*after* the TTL is still honoured, so if the released seat was resold in the meantime the
show oversells by one. Measured 2026-08-12: capacity 50 → 51 held. Refusing a paying
attendee at the door would be worse, so this is the right call — but it assumes late
payments are rare.

That assumption depends on which PayFast payment methods SAOC enables. Card and Instant EFT
settle in minutes and 30 minutes is generous. **Manual EFT / bank transfer settles in one to
two business days**, so every buyer using it would expire, then resurrect as paid — the rare
case becomes systematic, and a popular ticket type could oversell by a lot.

*Decision needed:* (a) which payment methods will be enabled on the live PayFast account,
and (b) if a delayed method is in scope, whether the TTL should be much longer for those
buyers or delayed methods should be switched off for ticket sales. No code change is
warranted until this is answered; @qa has separately recommended a log line in the ITN so
that late-paid tickets are at least reconcilable (finding R2-1 in
`.agent/memory/scratch/harden-qa.md`).

---

## 2026-08-12 — PayFast FICA COMPLETE; what Brad still owes, re-ranked

**FICA is done.** The live PayFast merchant account is no longer blocked on paperwork. That closes
the oldest external dependency on this project. Remaining go-live work is engineering, tracked in
`backlog.md` under "Go-live: PayFast live credentials".

**Ranked by what actually gates a launch, highest first:**

1. **Enable Firebase Auth (Email/Password) on `saoc-webapp`.** Console task, minutes. Today
   `createUser()` and `listUsers()` fail `auth/configuration-not-found`, so no account can exist in
   any environment and `/admin` + the door scanner are untestable and undemoable. The admission
   logic behind them is fixed and gate-verified — this is the only thing between that and a working
   door flow. **Highest value per minute of Brad's time on the whole list.**
2. **Real ticket prices and capacity from the council.** Every figure in the dataset is an invented
   placeholder rendered with a "provisional — pending council confirmation" label. Live payments
   must not be switched on against invented prices; this ordering matters.
3. **Confirmed venue and exact dates.** CTICC/Sept 2027 is our working assumption, visibly marked
   pending. The content model now takes a venue change as a Studio edit, so this is cheap to apply
   once known — but it is on every visitor-facing page until then.
4. **Domain transfer + DNS cutover.** Gates the live PayFast switch, because `SITE_URL` must be the
   real domain before live ITNs land. Also gates SPF/DKIM/DMARC.
5. **Resend account + verified sending domain.** No confirmation emails are sent today, and the
   emailed QR ticket (mission `ticketing-pages` F5) was never built — so a buyer completes payment,
   sees a confirmation page, and receives nothing scannable. That is the gap between "can sell" and
   "can admit".
6. **Exhibitor rules from the show committee** — entry deadline, fees, staging/removal times,
   whether exhibitors may attend judging, ownership-duration rule, sales terms, insurance and
   overnight security, and the entry-form PDF. The exhibitor guide currently presents researched
   international convention, clearly marked as not-yet-SAOC-policy.

7. **Apple Developer Program membership is currently personal (Brad's), not SAOC's.** Sign In with
   Apple (mission `admin-auth-hardening` F5) depends on it for the Services ID, private key and
   Team ID. SAOC should obtain its own membership — or confirm Apple's nonprofit fee waiver
   applies — before the National Show 2027 launch. Re-pointing the integration at a Council-owned
   account is a Firebase Console → Authentication → Apple config swap only; no code change.

## Ticketing foundation F5 — buyer-account live security proof, manual procedure needed (2026-08-17, @architect via F5 contract)

The F5 contract (`buyers/{uid}` collection + hard buyer→admin refusal boundary) proves the
boundary two ways offline/automatically: (1) a real `hasCapability()` call against a freshly
self-registered buyer resolves to the empty capability set, and (2) a real HTTP round trip with
NO credentials gets `401` on both a missing session cookie and a garbage one. What it deliberately
cannot prove offline is the actual spec §8.4 scenario: a real Firebase-Auth-minted **buyer**
session cookie `POST`ing to `/api/admin/checkin` and being refused, paired with a real
**admin**-session positive control that succeeds on the same endpoint. That needs live
credentials (a real buyer sign-up + a real admin session against the deployed/dev host), so
@architect wrote it as a five-step human-run manual procedure rather than a contract assertion.
The steps live in `contracts/golden/ticketing-f5-buyers/README.md` — follow that section when
running the check.

**Open ownership question, not yet decided:** no feature in mission `ticketing-foundation`
currently owns running this manual procedure. F13 (Lee-Ann's `manager` grant, M3) covers the
staff/admin side of live HTTP verification, not the buyer side — it should not be assumed to
cover this without a deliberate call. This needs Brad (or whoever plans the mission next) to
either fold it into an existing F-item or add a new one; do not self-assign it to F13/F14 or
invent a new F-number without that decision. See the matching P1 backlog item.

## Recovery-link expiry (`RECOVERY_TOKEN_DEFAULT_TTL_MS`) (2026-08-17, non-blocking)
F6 (`lib/recovery-token.ts`) sets the lost-ticket recovery link's validity window to 180 days as a
working placeholder, not a Council-approved value. Building against that number in the meantime,
clearly flagged as a placeholder. Real tradeoff for SAOC/Brad to set: too short and a buyer who
paid can lock themselves out of their own tickets; too long and a leaked/forwarded link stays
live for months. Same class of open item as "Real 2027 Show ticket pricing" above. See the
matching P3 backlog item.
   Non-blocking for F5's code and docs. — architect, 2026-08-17

## Ticketing foundation F7 — check-in route capability enforcement must not precede the roles migration (2026-08-17, @architect via F7 contract, correcting an earlier false claim in the same review)

F7 (`checkinAttempts` audit trail) requires `app/api/admin/checkin/route.ts` to gain a real
`hasCapability(decodedToken, showId, 'scan-checkin')` check so a capability-denied scan is
reachable and loggable. **What breaks:** `scripts/admin-migrate-roles.ts --apply` has never been
run against the live Firebase project (dry-run only, standing backlog item) — zero accounts,
including `brad@inunu.net`, currently hold a `roles` claim. If the new capability check ships to
a live door device before the migration is applied, `hasCapability()` returns `false` for every
account and every door scanner is refused for everyone, with no contract gate able to catch it
(the offline checks construct their own fabricated `roles` claims and never touch the live
project's actual, currently-empty claim state). **Who notices:** door staff and the queue behind
them, at a real show, with no way to self-fix. **Order of operations that prevents it:** (1) dry
run `scripts/admin-migrate-roles.ts`, (2) Brad authorises and runs it with `--apply`, (3) verify
with `scripts/admin-list.ts` that the target accounts show a `roles` claim, (4) only then deploy
the F7 capability-enforcement change to a real door device. F13 is the natural place live roles
first get created and proven end-to-end, which suggests enforcement should not precede it — but
that sequencing decision is explicitly left for Brad, not self-assigned to F13. Full reasoning:
`contracts/golden/ticketing-f7-checkin-audit/README.md`, "Judgement call 3."
