
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
