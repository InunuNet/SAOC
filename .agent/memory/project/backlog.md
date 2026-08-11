# Athanor Issue Backlog

## SAOC Project — Active (Phase 1 scope only)

_Last compacted: 2026-07-10 by session (machine-reboot wrap-up). Full history: git log on this file._

- [x] **[P1] Response to Lee-Ann McCleland (SAOC Secretary) — SENT** — Response to her 11 proposal-evaluation questions (`documents/Inunu - Additional info request.docx`) drafted, fact-checked (PayFast recommended over waitlisted Yoco, Quicket cost comparison sourced, security claims verified against the actual codebase), and sent from brad@inunu.net 2026-07-01. Covered: security, payment security, refunds, ticketing costs vs Quicket, membership scope, journal archive, judges platform, CMS ease of use, Next.js scalability, ownership transfer, support model, non-renewal consequences. **Now WAITING on the Council's decision — no action pending on our side.**

- [x] **DONE (compacted 2026-07-10) — Phase 1 platform build + polish + AI/CI.** Full detail in git log. Covers:
  - **Phase A Foundation** (Next.js + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting + lint/format + CI); **Phase B** 8 CMS-driven static pages; **Phase C** events calendar (month-grouped, ICS export — note member-only event submission form built as C5 is Phase 2 scope, shipped but not linked); **Phase D partial** 2027 ticketing D1/D3/D5/D6 (Resend email, Firestore ticket model, admin dashboard, door check-in); **Phase E** SEO + Secretary training + launch checklist (E4 22/22, E5 19/19, E6 14/14).
  - **Chrome wiring** (real UtilityBar/Header/Footer in layout); **Design-verify pass** (full globals.css token set, radius-0, editorial polish); **AI/LLM optimization** (llms.txt + llms-full.txt + robots.ts AI allowlist + NGO JSON-LD); **llms-full.txt nightly GROQ cron** (`.github/workflows/refresh-llms.yml`, needs GitHub secrets `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` before cron fires); **Inner-pages design polish** (mission 2026-06-30, done 2026-07-01, commit 0488cc8).
  - **PayFast ticketing M1** (F1 schema rework, F2 checkout initiation route, F3 ITN webhook handler; 3 rounds adversarial QA fixed 2 real payment-security bugs — spoofable X-Forwarded-For IP trust + non-atomic idempotency race; docs/payfast-integration.md; gate 33/33; **left UNCOMMITTED intentionally**).
  - **CI fix 2026-07-10**: removed pnpm version pin conflict in `.github/workflows/ci.yml` that failed every CI run since 2026-06-30 (commit 5c75473, pushed to main).

- [ ] **[P1] Scope reconciliation: Spec V2 vs Phase 1 — DECISION MADE 2026-07-20, provenance VERIFIED 2026-07-23, awaiting Brad to send.** Full decision in `needs-human.md`. Brad decided: keep Phase 1 tight to ~original scope (absorb small Spec V2 polish free), defer/reprice the four "root cause" items as a separately-scoped Phase 2 — (1) shared relational content DB / Section 7 schemas, (2) unified multi-category booking + waitlists, (3) Members Portal + journal + awards archive, (4) Symposium/WOSA Conference/Workshops event layer. Delivery sequence: (a) design sign-off → (b) core SAOC site + Show "marker" landing page live → (c) ticketing live off that same page → (d) the four big items as Phase 2. Driver: sponsor-presentable site ASAP + Show tickets on sale early enough to sell out by early 2027.
  - **(2026-07-23) Proposal provenance now CONFIRMED, not assumed.** The proposal Lee-Ann actually received was `SAOC_Website_Proposal_28-05-2026.pdf`, emailed 28 May 2026 to `saoctreasurer@gmail.com` (a DIFFERENT address than the `2027national@gmail.com` she uses now). Brad's sent PDF was downloaded from Gmail and diffed word-for-word against `documents/SAOC_Website_Proposal_28-05-2026.docx` on disk — content identical, only PDF letterhead/pagination differs. The docx on disk is now the CONFIRMED source of truth.
  - **(2026-07-23) New phase-map artifact** (page-by-page scope comparison, all 24 Spec V2 pages mapped individually to Phase 1 / Phase 2 / needs-decision, each with reasoning, cross-referenced against the verified proposal): https://claude.ai/code/artifact/eb888f16-a4e8-42c7-9a1e-0c595fc85326 . Flags one overstatement in Lee-Ann's own Spec V2: it claims the full unified multi-category booking (General Admission + Symposium + WOSA + Workshops in one checkout) was "confirmed by INUNU" — only General Admission for Phase 1 is actually confirmed.
  - **Draft email ("SAOC website — how I'd sequence the build," to Lee-Ann <2027national@gmail.com>) sits UNSENT in Brad's Gmail drafts (id `r7069159880970212600`) and is now STALE** relative to the corrected call-prep doc — it has NOT been rewritten to reflect the verified/corrected facts. Brad has not decided whether to rewrite it or work live from the phase-map artifact on the call. No agent action — Brad edits+sends, rewrites, or replies personally. Scope-freeze on Section 7 schemas / un-built National Show pages remains in force until this is sent and confirmed.
- [x] **[P1] Pull National Show 2027 brand assets from Gmail into the repo — DONE 2026-07-20.** Collected under `branding/national-show-2027/`: `logo/` (5 files — full-res PNG, JPEG, small web PNG, alt dark colourway, print PDF), `reference-photos/` (13 of Scott Ormerod's watermarked studio orchid photos), `palette-and-type/` (colour hex `A7A841`/`7F7D33`/`211A57`/`F3F2D6` + font recs Montserrat + Hey August/James Stroker/Fake Serif), and a `README.md` manifest with full provenance per asset. **Show-specific branding only.** Two follow-ups remain (see needs-human.md): (a) folder is **untracked — Brad hasn't decided whether to commit**; (b) ~~photo usage rights unconfirmed~~ **RESOLVED 2026-07-28 (Brad):** Scott only sends photos SAOC holds full copyright over — the 13 photos in the repo are cleared for use. Do NOT use the placeholder `design/design_handoff_saoc/` "Sage & Paper" system as the real brand; the SAOC-org brand is still outstanding.

- [ ] **[branding, PENDING COMMITTEE] National Show brand model — may affect asset folder structure** — Brad's working hypothesis (unconfirmed, needs a committee conversation — see `needs-human.md`): the National Show may want a **stable master brand** persisting across editions + a **rotating per-edition "host sub-brand"** layer, instead of the current full-from-scratch redesign each host cycle (the 2027 identity is explicitly "WESTERN CAPE 2027", host-region-tied). **IF the committee agrees to that model**, it changes how future Show branding assets should be structured/named: e.g. `branding/national-show/` as a stable parent with per-edition subfolders like `branding/national-show/2027-western-cape/`. Consequence: the current `branding/national-show-2027/` folder naming may need revisiting once the model is decided. **Do NOT restructure anything now** — this is contingent on the committee decision, which is Brad's to have with Lee-Ann + the National Show committee. Blocked until then.

- [ ] **D2/D4: PayFast ticketing — M1 DONE, M2 BLOCKED.** Mission `2026-07-01-payfast-ticketing.md` ACTIVE, paused at the M1/M2 boundary (checkpoint M1/F3). Gateway = PayFast (Yoco waitlisted with no ETA; PayFast recommended + committed, verified against PayFast dev docs — Subscriptions API, Refunds API, hosted redirect + Onsite Beta, PCI DSS Level 1).
  - **M1 DONE (uncommitted):** F1 Firestore schema reworked off the old Stripe-shaped field to PayFast's model; F2 checkout initiation route; F3 ITN webhook handler. Documented in `docs/payfast-integration.md`. Gate green 33/33.
  - **M2 BLOCKED:** F4 buy-flow UI, F5 confirmation page + email (Resend), F6 sandbox verification. Blocked on TWO external inputs, both logged in `needs-human.md`: (1) **PayFast Sandbox credentials** (free signup at sandbox.payfast.co.za, no FICA — Merchant ID/Key/Passphrase into .env.local) — **(2026-07-28) Brad is waiting on the society to supply PayFast credentials; external wait, no agent action**; (2) **real 2027 Show ticket pricing** (adult/pensioner/child/member/exhibitor tiers + capacity). Resume: `python3 execution/mission.py resume` → `/spec` for F4.
  - **Live merchant account (separate, Brad):** gather non-profit FICA docs (NPO/PBO/Section 21 registration, proof of address, bank-issued proof of account), register at registration.payfast.io. Only blocks going LIVE, not sandbox development.
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before launch. Setup guide: docs/email-dns-setup.md. Brad to add DNS records once Resend domain verified.
- [ ] **Domain transfer** — saoc.co.za to Inunu Net registrar. Brad to initiate. R172.50 once-off.
- [ ] **DNS cutover** — point saoc.co.za to Firebase App Hosting. Requires domain transfer complete + SPF/DKIM/DMARC in place.

### Legacy site migration → Inunu VPS (2026-07-20) — RESTORE DONE, cutover pending
Old saoc.co.za (legacy cPanel at i-svr.net; access held by "Nico"; committee/Lee-Ann no longer directly manage it) is being migrated to Inunu's own **multi-tenant** VPS `wh3.inunu.co.za` (cPanel user `ahsaoc`, domain `saoc.co.za`, account IP `164.160.89.117`; root via `ssh wh3`, key-based). ALL work scoped strictly to `/home/ahsaoc` via `su -s /bin/bash - ahsaoc` + `user=ahsaoc`-scoped cPanel API — other tenants on the box (eastrandorchids/allwastesolutions/acruxaccounting) untouched. This is a **local-preview restore only**; the legacy public site is untouched and still live. All credentials (temp mailbox pwds, new DB pw, and the OLD plaintext DB cred `saoccoza_NicoG` found in the legacy `configuration.php`) live ONLY in gitignored `/Users/vetus/ai/SAOC/ops-secrets.local.md` — never reference their contents in any committed file.
- [x] Full JetBackup5 account backup pulled from legacy host (native cPanel "Backup" was disabled — JetBackup was the only path). Saved locally at `/Users/vetus/ai/SAOC/Old SAOC Website Backup/` (`download_saoccoza_1784561106_17043.tar.gz`, 989MB, + extracted copy) — NOT in git (large binary, out of repo scope).
- [x] Website files restored — live Joomla `public_html/` (435MB, 13,860 files). Stale duplicates `public_html_1`/`public_html_2` (old installs; `_2` has an untouched `installation/`) deliberately NOT restored.
- [x] Database restored — new DB `ahsaoc_saoc` + user `ahsaoc_saocweb` (fresh generated pw, NOT the old exposed one); old `saoccoza_SAOC` dump imported cleanly (78 tables verified); `public_html/configuration.php` repointed to new creds.
- [x] Email restored — all 5 mailboxes (info@ ngos@ president@ show@ treasurer-secretary@) recreated with TEMP pwds; old Maildir content (192MB across all 5, sizes verified vs source) restored on top so historical mail is intact.
- [x] Local preview working — cPanel subdomain `new.saoc.co.za` created (same `public_html`, not empty) + `rebuildhttpdconf` + graceful httpd restart; Brad's `/etc/hosts` maps `164.160.89.117 new.saoc.co.za` (corrected once from a stale `.116`). Serves restored Joomla site, verified end-to-end via HTTP + browser.
- [x] ~~Swap 5 temp mailbox pwds → real originals~~ **RESOLVED 2026-07-20: NOT swapping.** Lee-Ann's supplied originals were weak / reused (treasurer's ≈ legacy cPanel login pw). Brad decided to KEEP the generated random passwords on all 5 mailboxes for security; users re-enter the new pw once at cutover. Committee follow-up on password hygiene is Brad's. Detail in needs-human.md.
- [ ] Re-pull mail from legacy host ONE more time immediately before DNS cutover — today's restore is a snapshot; catches mail received 2026-07-20 → cutover day.
- [ ] Real DNS/domain cutover saoc.co.za → new VPS (NOT done; legacy i-svr.net site still live/public).
- [ ] Decide whether stale `public_html_1`/`public_html_2` are worth preserving.
- [ ] **Live PayFast test transactions + cross-browser dry-run** — Phase 1 launch gate. Run after D2/D4 (PayFast M2) complete and live FICA-verified credentials are in place.
- [ ] **Auto-refresh llms.txt + llms-full.txt via Alembic** — Alembic-based script BUILT (`scripts/refresh-llms.ts`, `pnpm refresh-llms`): crawls 7 routes through Alembic → regenerates `public/llms-full.txt`. ⚠️ Alembic blocks `localhost` hostnames by design, so the script only works against the live external URL (`https://saoc.co.za/<page>`) — usable only POST DNS-cutover, and NOT usable in CI (GitHub Actions can't reach local Alembic). `public/llms.txt` (index + descriptions) stays hand-authored. Production automation moved to the GROQ item below. Depends on live domain. Docs: `docs/llm-optimization.md`.
- [x] **Home page UI drift audit — DONE 2026-07-28 (F5, `hardening-ui-fidelity` mission).** Full re-audit against `design/Claude Design HTML/SAOC Website (standalone).html`, superseding the stale 2026-06-30 notes below. Findings: `.agent/memory/scratch/home-audit-20260728/audit.md`. 9 deviations (D1–D9) found; code fixes for D2/D3/D5/D7/D8/D9 + D1's code half contracted as F6 (`contracts/f6-home-fidelity.yaml`). Two items split out as their own backlog entries below: D1 content population, D6 hero copy authority.
- [x] **F6 home-page fidelity code fixes — DONE 2026-07-29.** Gate `contracts/f6-home-fidelity.yaml` PASS (26/26 shell assertions, verified by orchestrator). Changed `components/home/{PartnersSection,YearbookStrip,MissionBlock,NavCards}.tsx`, `components/chrome/{UtilityBar,Footer}.tsx`, `components/ui/EventRow.tsx`, `eslint.config.mjs`; `playwright` added as devDependency. Docs: `docs/home-page-fidelity.md`, `docs/m3-home.md`. See [[learned.md]] "F6 Home-Page Fidelity (2026-07-29)" for the caught defect (stale `.next` cache hid a rendering bug behind a passing grep-only assertion).
- [ ] **[content] Populate `hostSociety` on Sanity `societyEvent` documents** — confirmed via direct Sanity query 2026-07-28: **0 of 18** `societyEvent` docs have a populated `hostSociety` reference, so the home page's Upcoming Events strip always renders a blank host-society column (design reference shows e.g. "CAPE ORCHID SOCIETY" there). This is a Sanity Studio content-entry task, not a code bug — `EventRow.tsx`'s code-side fix (hide the blank span when `event.host` is falsy) is in F6. Someone with Studio access needs to set `hostSociety` on each event document once Studio editing is unblocked (see the Sanity Studio P0 item above).
- [ ] **[copy, needs decision] Hero lede copy — reference vs. local differ, authority unresolved** — Reference: "Twenty-one affiliated societies. A nationally standardised judging system. A flagship show every three years. This is where cultivated orchids are grown, studied, exhibited and celebrated." Local (`components/home/Hero.tsx:84-86`): "Uniting twenty-one affiliated societies in the cultivation, exhibition, and appreciation of orchids across South Africa since 1968." Found during the 2026-07-28 F5 audit — flagged as a content/copy deviation, not a layout bug. Do NOT change without confirming which copy is authoritative (may be an intentional later revision, not drift) — client/design-owner call.
- [ ] **[P3] Fix 375px horizontal overflow in `ShowBand.tsx:35`** — `aspect-[4/3]` causes horizontal overflow at 375px viewport width. Pre-existing, found during F6 QA (2026-07-29), NOT caused by the F6 change set.
- [ ] **Complete or remove orphan F6 rendered-check harness** — `contracts/checks/f6-home-fidelity/` has `_shared.mjs` + `utilitybar-tagline-desktop.mjs` (Playwright-based rendered checks) but `contracts/f6-home-fidelity.yaml` has no A27+ assertions invoking them — @architect died mid-session before finishing this. Either complete the harness (checks: utilitybar hidden at 375px, "EST. 1968" badge overlay renders, PartnersSection shows 6-col single row) and wire the assertions, or remove the orphan files and the now-unused `playwright` devDependency.
- [ ] **Fix `$ANTHROPIC_DEFAULT_HAIKU_MODEL` agent-model config — REPRODUCED AGAIN 2026-07-29, previous fix attempt DISPROVEN.** The `docs` agent failed to spawn again with `There's an issue with the selected model ($ANTHROPIC_DEFAULT_HAIKU_MODEL)`. A prior session had removed the env entry from `.claude/settings.json` as a candidate fix — that did NOT fix it. Root cause is the `docs` agent's own frontmatter declaring `model: haiku`; that alias fails to resolve regardless of the settings.json env var. Workaround remains an explicit model override at spawn time. Underlying config issue still open; do not re-attempt the settings.json-removal fix, it's confirmed not to work.

- [ ] **Sanity v6 major upgrade** — `sanity@5.31.1 → 6.3.0` (and likely `next-sanity@11 → 13`). Pre-mission research required: review v6 changelog + migration guide, check next-sanity v13 breaking changes, verify Firebase App Hosting SSR compatibility, confirm React 19 peer dep story, identify any schema or Studio API changes. Do NOT upgrade without a research pass — this is a major version with likely breaking changes across both packages.

- [ ] **Secretary CMS controls (phase 1)** — Scope-narrowed: start with only what the secretary actively needs to edit, build up slowly to avoid risk. Phase 1 target fields: hero headings/lede on key pages (home, about, national-show), upcoming show details (date, venue, ticketing link), news/announcements block, contact details. Do NOT attempt full-site editability in one mission. Each phase ships, verifies, and stabilises before the next. Seed must pre-populate all new fields from current hardcoded values so the secretary starts with real content rather than blank forms.

- [x] **Assess Sanity Free-plan downgrade impact — DONE 2026-07-28.** Full assessment: `docs/sanity-free-plan-assessment.md`. Verdict: OK — nothing measured is within 2x of any Free-plan cap, nothing breached.

- [ ] **[P3] Manual Sanity dashboard usage check** — manage.sanity.io → Settings → Usage: confirm CDN/API/bandwidth/asset totals + that administrator/editor/viewer role display doesn't conflict with Free's 2-role cap. Not retrievable via token API (verified 2026-07-28). 5-min human task.

- [ ] **[P3] Fix `@sanity/image-url` deprecated default export** — `sanity/lib/image.ts` fires a deprecation warning on every home-page render in dev (found during the 2026-07-28 home-page drift audit, `.agent/memory/scratch/home-audit-20260728/audit.md`). Low priority, cosmetic dev-console noise only, no functional impact observed.

- [x] **[P1, security] `dotenv@17.4.2` promotional banner — DONE 2026-07-28. VERDICT: BENIGN.** Installed tarball hash matches npm registry `dist.integrity` exactly, no install scripts, zero advisories for `dotenv` itself; banner is upstream maintainer self-promotion via `dotenv`'s rotating TIPS feature (no network call, no data collection). Fix applied: `scripts/seed-sanity.ts` now loads `dotenv` with `config({ quiet: true })`. Full detail: `docs/dotenv-supply-chain-f1.md`.

- [x] **[hygiene] React peer-dependency range tightened for Sanity Studio — DONE 2026-07-24 (uncommitted).** `package.json` `react`/`react-dom` bumped `^19.0.0` → `^19.2.2` to match `sanity@5.31.1`'s and `@sanity/vision`'s actual peer floor (Structure Tool calls `React.useEffectEvent`, a React ≥19.2.2-only API). Gate green 8/9 static assertions (`contracts/contract-sanity-react-peer-fix.yaml`, RF-01–RF-10; RF-11 is human-only, see P0 item below). **Real hygiene, but NOT confirmed root cause** — `pnpm-lock.yaml` resolved React `19.2.7` throughout the entire incident history (before the bug, after a prior failed fix `397de87`, and now), so the runtime version was never actually the problem. Full writeup: `docs/sanity-studio-p0-investigation.md`.
- [x] **[bugfix] `/studio` hard-crashed under `pnpm dev` — DONE 2026-07-24 (uncommitted).** `sanity.config.ts` was `require()`-ing the ESM-only `@sanity/vision` package inside a dev-only conditional — ESM-only packages have no CJS entry to `require()`, so this hard-500'd the ENTIRE `/studio` route locally (production builds were unaffected; webpack prunes the dead branch). Fixed via static `import { visionTool } from '@sanity/vision'` + moved the dev-only gate to the plugins array instead of the import mechanism. Independently reproduced broken-then-fixed; gate green 7/7 (`contracts/contract-sanity-vision-esm-fix.yaml`, VF-01–VF-07 — two bugs in the gate script itself, a curl exit-code concatenation bug and a dev-server process-leak-on-cleanup bug, were also found and fixed as part of this contract). This fix is a genuine standalone bug fix AND the prerequisite that unblocks local `pnpm dev` access to `/studio` for the P0 investigation below.
- [ ] **[P0, ENGINEERING — TOP PRIORITY per Brad 2026-07-28] Sanity Studio: not usable for editing AT ALL — TWO BUGS FIXED 2026-07-28, CORS/membership still open, human verification pending.** **(2026-07-28) Brad reports the symptom is broader than previously logged: he has never successfully opened Sanity Studio to edit ANY page, in any environment — "Sanity is not working at all". Back-end editing via Sanity is a core deliverable; Brad asked to prioritize research into what's wrong. Note the environment Brad tested (hosted vs localhost) is unconfirmed — prior "document list loads, edit pane blank" observation may have been a different environment/stage of the same failure.** Studio is substantially built (`app/studio/[[...tool]]/`, full schema set in `sanity/schemas/documents/*`, `sanity/lib/` client+fetch, seed at `scripts/seed-sanity.ts`). Symptom: document list loads fine, but clicking into a document to edit shows no edit form. Investigated 2026-07-24: (1) React `useEffectEvent` peer-version mismatch — ruled out, see hygiene item above; (2) Sanity Free-plan permission downgrade (project auto-downgraded 2026-07-14) — ruled out via live API check: direct read query AND a real mutate transaction against the `production` dataset both returned HTTP 200 with the project's actual `SANITY_API_TOKEN`, confirming full read/write access on Free plan. Along the way, found and fixed the separate `/studio` dev-crash above, which now unblocks local reproduction. **Next step, tracked as `RF-11` (`agent_review`, SKIP verdict, cannot be machine-checked) in `contracts/contract-sanity-react-peer-fix.yaml`, detail in `needs-human.md`:** run `pnpm dev`, open `http://localhost:3002/studio` with real credentials, click into an existing document (e.g. a society or event), and record exactly what happens — does the edit pane render fields, stay blank, spin, or error — plus any browser console errors (note in particular whether a `useEffectEvent` error appears, corroborating evidence either way). Full investigation writeup: `docs/sanity-studio-p0-investigation.md`.
  - **(2026-07-28) @analyst diagnostic pass — TWO distinct confirmed bugs + one human question. Evidence: `.agent/memory/scratch/sanity-p0-20260728/` (screenshots + dev.log).** (1) **CONFIRMED, local:** `pnpm dev` → `/studio` hard-crashes server-side on EVERY request (`TypeError: Cannot read properties of null (reading 'useSyncExternalStore')` / invalid hook call) — HTTP 200 but infinite spinner, Studio never renders. Likely cause: `next.config.ts:5` `serverExternalPackages: ['sanity','next-sanity','@sanity/vision']` (documented failure class — next-sanity#707, sanity#2819, next.js#70487); present since first Sanity commit. NOTE: prior session's RF-11 was never actually performed — it stopped at HTTP 200 without checking the dev-server console. (2) **CONFIRMED, all envs:** `app/layout.tsx:83-88` renders UtilityBar/Header/Footer unconditionally, so marketing chrome wraps `/studio` too (`app/(marketing)/layout.tsx` is a passthrough — route group isolates nothing). (3) **Deployed** (`saoc-prod--saoc-webapp.europe-west4.hosted.app/studio`) renders the Sanity LOGIN screen fine — but Sanity project `26yfbug4` has exactly ONE human member (created 2026-06-11, email not exposed at editor-token grant); if that's not Brad's account, login is a dead end = his "not working at all". (4) CORS origins UNVERIFIABLE with current editor-role token (401 on cors/read) — needs manage.sanity.io admin. **Fix path:** contract asserting (a) serverExternalPackages fix → dev `/studio` renders doc fields zero console errors (closes RF-11), (b) chrome moved to `(marketing)` layout; human-queue: confirm Brad's Sanity login email is the project member + check CORS origins. **(2026-07-28) Brad confirms he signs in as `brad@inunu.net` and will do all testing under his own account before inviting anyone. Whether `brad@inunu.net` IS the project's single human member (created 2026-06-11) remains UNVERIFIED — local Sanity CLI is not logged in (`sanity debug`: "Not logged in"), so `sanity users list` fails; Brad to run `pnpm exec sanity login` (interactive) or check manage.sanity.io/projects/26yfbug4 → Members + API → CORS origins.**
  - **(2026-07-28) Chain complete: @analyst → @architect → @dev → @qa → @docs, gate 6/6 PASS.** Both confirmed bugs FIXED (uncommitted, commit follows this wrap-up): (a) `serverExternalPackages: ['sanity','next-sanity','@sanity/vision']` removed from `next.config.ts` (cargo-culted at initial install, caused the dev-only SSR hard-crash on every `/studio` request); (b) marketing chrome moved from `app/layout.tsx` to `app/(marketing)/layout.tsx` so `/studio` and `/admin` no longer inherit UtilityBar/Header/Footer. **Still open, human-only:** (1) confirm `brad@inunu.net` is the Sanity project's single human member (created 2026-06-11) — local Studio now mounts and lands on "Connect this studio to your project," the classic missing-CORS symptom; (2) add local dev origin to CORS at manage.sanity.io/projects/26yfbug4 → API → CORS. Full writeup: `docs/sanity-studio-p0-investigation.md`.

- [ ] **[docs-accuracy] Correct `CLAUDE.md` tech-stack table — it omits Sanity (stale).** The tech-stack table in `CLAUDE.md` lists only Firestore and makes no mention of Sanity, but **Sanity Studio was part of the stack from the start** and is substantially built (schemas, `/studio` route, client libs, seed script, `@sanity/*`/`sanity`/`next-sanity` in `package.json`). This stale table already caused a wrong "Sanity = unagreed scope creep" flag in the call-prep doc that Brad had to correct. Update the table to include Sanity CMS. Low effort. _(Do not fix as part of memory-logging — tracked here for a normal doc pass.)_

- [ ] **[reference, living doc] Call-prep doc for Lee-Ann call — `documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md`.** Built by diffing Lee-Ann's Spec V1/V2 against the 28-May proposal. Contains: the decided Phase 1/2 sequencing (restated from the unsent Gmail draft), open questions (payment-gateway paperwork mismatch, Sanity Studio status, ticket pricing/capacity — still blocks PayFast M2, content-gathering ownership/timeline, one-codebase-vs-two-sites, POPIA ownership), branding questions, the committee's own Spec-V2 Section-8 questions, and a running "Log — new items" section Brad keeps appending to.
  - **(2026-07-23) Corrected this session** after Brad caught earlier work asserting from memory instead of source: (a) **sources section** rewritten with the verified proposal provenance (28-May PDF → `saoctreasurer@gmail.com`, diffed against the on-disk docx); (b) **B1 (Yoco) corrected** — Yoco→PayFast is NOT an open question: Brad's SENT reply of 3 Jul 2026 (thread `19f177b373bd9f35`, to `2027national@gmail.com`) already told Lee-Ann Yoco is waitlisted with no ETA, recommended PayFast with exact fees (3.2% + R2/card txn, 2.0% Instant EFT) and listed the FICA docs; Lee-Ann acknowledged same day and said the committee would revert (no reply since). Now framed only as a "did the committee land anywhere?" follow-up, not a fresh question; (c) **phase-map artifact linked** (see scope-reconciliation item above); (d) **new C3 sub-item added** — Brad's view that the current National Show branding (Scott Ormerod's logo/colours/fonts) is somewhat lacking for a national-event brand; wants to directly ask Lee-Ann/the committee whether it's locked or open to a proper redesign via Claude Design, framed as a process offer, not a critique of Scott's volunteer work.
  - **Brad is still adding to it — no agent action; reference only.**

- [x] **[hardening] gitignore the legacy backup dir `Old SAOC Website Backup/` — DONE 2026-07-23.** Was UNTRACKED but NOT gitignored, so a stray `git add -A` would have staged it — including `homedir/public_html/configuration.php` and `database_user/` files carrying the OLD plaintext legacy DB credential. Added both `Old SAOC Website Backup/` and `ops-secrets.local.md` to `.gitignore` (lines 40–41); verified with `git check-ignore` (IGNORED-OK) and `git ls-files` (dir not tracked). Purely closed the accidental-commit window on the legacy cred; no live-site change. Re-verified 2026-07-23: no session mailbox password value appears in any tracked file (only the DB *username* label `saoccoza_NicoG*` is referenced in memory notes, never the secret value — actual values stay in gitignored `ops-secrets.local.md`).

## Autonomous routines — RETIRED (2026-07-28, Brad)
_The cloud RemoteTrigger routines were a once-off autonomy experiment that didn't work out — there is NO permanent nightly autonomous routine. Findings were passed upstream to the Athanor template maintainer, who will iterate on autonomy; improving that is NOT this project's job. Historical trigger IDs (for reference only, do not recreate): `trig_01Ry4fkFgbZCoW9CgUtqfh8D` (nightly sync + mission progress, had a 2026-07-15 scope-freeze), `trig_01PNsrRuno8EzxpaZP8dArv1` (harness watch 6-hourly), `trig_01Ue5oZh2nhRoKDXdURaFWu1` (disabled 2026-07-15)._

## Standing rule (2026-07-28, Brad): scope = SAOC only; dogfood the harness, report upstream
- This workspace's job is the SAOC deliverables, nothing else (not WOSA, not Athanor autonomy R&D).
- Use the Athanor harness AS DESIGNED (mission → contract+goldens → @dev → @qa → @docs → gate → @maintainer) while building SAOC, and file every harness bug, friction point, or improvement idea upstream as a GitHub issue (`gh`) on the Athanor repo (`InunuNet/Athanor`) rather than working around it silently.

## F2 — Deploy: secrets do not resolve at runtime — PARTIALLY DONE, mission NOT closed (cms-activation-deploy, 2026-07-29/30)

Deploy shipped (commit `84dbf58`, backend `saoc-prod`) and the P0 (Studio editing) is genuinely
fixed for real users — `/studio/structure/{homePage,aboutPage,nationalShow,judgingPage}` all open
real document editors and all 12 marketing routes return 200, contract gate 6/6 against
production. BUT draft-mode preview and webhook revalidation are dead in production.

- [ ] **[P0, blocker] `SANITY_REVALIDATE_SECRET` / `SANITY_API_TOKEN` do not resolve at runtime.** **ROOT CAUSE REDIAGNOSED 2026-07-30 — the analysis below is SUPERSEDED and wrong.** The real cause is Secret Manager **payload corruption**, not IAM, not a stale build, not a failed rollout: both secrets were written by the same broken invocation, which stored `<~80-95 bytes of non-ASCII prose>` + `\n` + `<the real token>`. Secret Manager stores payloads verbatim with no trimming, so runtime resolves the whole contaminated blob and exact string equality against the clean value can never match — which is precisely why correct/wrong/absent all returned an identical 401. Proven structurally without printing either value: the payload's post-newline tail sha256 matches `.env.local` exactly (43 of 123 bytes for REVALIDATE; 180 of 276 for API_TOKEN). Both routes were exonerated — `app/api/revalidate/route.ts:5` and `app/api/draft/route.ts:7` read the env var INSIDE the handler, not at module scope. **`SANITY_API_TOKEN` was corrupted identically and would have failed the event-submission form the moment anything exercised it — a second latent production defect found by this diagnosis.** Fix: re-set both via `printf '%s' | --data-file=-` (never `echo`, which appends a newline; never dotenv, whose banner pollutes stdout), then force a rollout, since secret values resolve at Cloud Run revision creation. Guarded permanently by assertion A9. *Superseded original analysis, retained only as a record of the false trail:* The `grantaccess` re-run since verified via Secret Manager `getIamPolicy` REST that both secrets ARE bound to the backend's real service account — so the blocker now is getting a NEW build to actually run: `firebase apphosting:rollouts:create --git-branch main [--force]` reports success but creates nothing (likely dedupes on commit SHA against the already-failed build for `84dbf58`). A REST workaround was identified and started but not confirmed: `POST .../backends/saoc-prod/builds?buildId=<unique-id>` with `{"source":{"codebase":{"branch":"main"}}}` returned a real build operation (`build-manual-1785355696`) still in progress at session end. **Resume here:** poll that build (or a fresh one) to READY, confirm its `config.effectiveEnv` resolves both secrets, then re-probe `/api/revalidate` (correct secret → 200, wrong/none → still 401) and `/api/draft`. Full trace (auth method, exact API calls, evidence) recorded in `learned.md` under "F2 Deploy — Secrets Runtime Resolution Failure" since the original scratch investigation file is gone (`brain.py wrap-up` purges scratch).
- [x] ~~**App Hosting continuous deployment appears unarmed.**~~ **DISPROVEN 2026-07-30 by contract assertion A10.** Push-to-`main` autodeploy IS armed: the build serving 100% of production traffic (`build-2026-07-30-001`, commit `01dd63f`) was created automatically at 05:13Z with committer `github-actions[bot]`, with no manual rollout. The earlier conclusion came from the rollout-creation dedupe bug (below) masking the automatic path. Unattended/overnight deploys are NOT blocked — a commit on `main` ships on its own.
- [ ] Verify whether `SANITY_API_TOKEN` resolves at runtime once a good build is live (needs a Firebase ID token or a temporary diagnostic route) — same fix as the revalidate secret should cover it, but confirm separately since it's a different code path (`app/api/events/submit/route.ts`'s write client).
- [ ] **[security] Rotate `FIREBASE_ADMIN_PRIVATE_KEY`** (leaked into a session transcript via a non-allowlist `sed` redaction of `.env.local` — the pattern only matched single-line pairs, missing the multi-line key body) **and `SANITY_REVALIDATE_SECRET`** (became visible in screenshots during verification) before launch.
- [ ] **No admin UI lists `contactSubmissions`** — enquiries submitted via the contact form are visible only in the Firebase console, not anywhere in `/admin`. Real gap before launch; worth scoping as a small follow-up feature (a simple authenticated list/table view, same pattern as the door check-in scanner).

## Blocked (awaiting Brad)
- **RESEND_API_KEY not set anywhere (no Resend account signed up yet)** — found during F2 (`cms-activation-deploy`) apphosting.yaml env-var gap audit, 2026-07-29. `lib/email.ts` reads `process.env.RESEND_API_KEY`; `app/api/contact/route.ts` calls it inside its own try/catch and swallows the error, so this is NOT a contact-form outage — the Firestore write and HTTP 201 still succeed. Effect is silent degradation: submitters get a success response but never receive the confirmation email, in prod today and after F2's deploy. Fix: Brad signs up at resend.com, verifies the saoc.co.za sending domain, runs `firebase apphosting:secrets:set RESEND_API_KEY --project saoc-webapp`, then apphosting.yaml gets a `RESEND_API_KEY` (secret) + `RESEND_FROM_ADDRESS` (plain value) entry in a follow-up feature. Deliberately dropped from F2's contract (A5/A6 removed 2026-07-29 per team-lead) rather than declaring a `secret:` ref to a Secret Manager entry that doesn't exist, which would fail the whole App Hosting rollout.
- **PayFast live merchant account (FICA verification)**: Brad to gather non-profit docs (NPO/PBO/Section 21 registration, proof of address, bank-issued proof of account) and register at registration.payfast.io. Only blocks going LIVE — D2/D4 development can proceed now against PayFast's free Sandbox.
- **DNS records**: SPF/DKIM/DMARC + Firebase hosting A-record. Brad to add after Resend domain verified.
- **Domain transfer**: saoc.co.za from current registrar to Inunu Net.

## Phase 2 — Out of scope (do not work on until Phase 1 ships)
- Society individual pages + admin logins + federated ticketing
- Paid SAOC membership (Yoco recurring billing) + members-only area
- Digital archive of Orchids South Africa yearbooks
- Donation system, sponsorship management, Google Ad Grant
- Learning library, judges training portal, articles/video

## Hosting — Decision Pending Brad (researched 2026-06-20)
Research complete: `documents/hosting-research-2026-06-20.md`. Key findings: (1) Vercel has Cape Town `cpt1` compute but SA SSR requires Pro plan ($20/month); free plan only caches in SA. (2) Fly.io `jnb` Johannesburg is best-value SA SSR at $8–15/month, requires Dockerfile migration. (3) "Coolify on Hetzner JNB" was a misconception — Hetzner Cloud has no SA DC; Hetzner SA is now Xneelo (separate company, suitable but maintenance-heavy). **Recommendation: stay on Firebase until latency is a measured problem; if SA compute is a hard requirement, Fly.io `jnb` is best value.** Brad to confirm: (a) hard requirement vs. preference, (b) budget ceiling, (c) no migration before DNS cutover.

## Harness Upstream (Athanor → InunuNet/Athanor)
- [x] **[athanor-upstream] Triage 2 pre-existing harness test failures — DONE 2026-07-28, clean-template triage. VERDICT: SPLIT.**
  - `test_mission.py` (17/19) — **UPSTREAM BUG.** Test 8 asserts old `resume` exit-0 semantics; current `mission.py` exits 2 "MAINTAINER WRAP-UP REQUIRED" for all-done fixtures. Reproduces identically on clean Athanor main. Filed: https://github.com/InunuNet/Athanor/issues/1318
  - `test_contract_fix.py` (10/15) — **ORPHANED LOCAL TEST.** Authored locally in `e863d887` alongside a 15-line single-phase `gate_cmd` fix to `contract.py`; a later `make update-template` silently overwrote `contract.py` with upstream (fix lost; `contract.py` now byte-identical to upstream), leaving the test permanently red. Test deleted locally 2026-07-28 (recoverable at `e863d887`). Fix + clobber-friction filed upstream: https://github.com/InunuNet/Athanor/issues/1319
- [ ] **[athanor-upstream] sync-autonomy v2** — `set-autonomy LEVEL=high` should propagate to `.claude/settings.json` permissionMode. Filed 2026-06-16.
- [ ] **[athanor-upstream] mission.py slug fix** — cross-date slug scan fix needs upstreaming via `make update-template`. Filed 2026-06-16.
- [ ] TEMPLATE BUG: `execution/gh_closure_scan.py` throws `ERROR: <file> has no YAML frontmatter` and returns zero candidates (silently, exit 0) if ANY file under `.agent/memory/project/missions/` lacks frontmatter — e.g. a plain planning note like `OVERNIGHT-PLAN-2026-07-30.md`. It should skip/warn on the one bad file and keep scanning the rest of the directory, not abort the whole scan. Found 2026-07-30 during mission close on `cms-activation-deploy`; user should run /report-bug.

## Deferred (auto-tracked)
- [ ] [dev 2026-06-18] Factory loop script needs error handling — Out of scope for this task _(priority: low, handoff: 20260618T075409-dev.json)_

_Last compacted: 2026-07-10 by session. Dismissed: check_own_comms + quota-monitor + qa-guard informational pulse noise — all informational, no action required. Full history: git log on this file._

## WOSA website rebuild — REMOVED FROM THIS PROJECT'S QUEUE (2026-07-28, Brad)
- [x] **~~[P1] Rebuild wildorchids.co.za (WOSA)~~ — NOT OURS. A separate developer and session are handling the WOSA rebuild.** Standing rule from Brad 2026-07-28: WOSA is an affiliate of SAOC — the SAOC site will carry plenty of info ABOUT them (and link to wildorchids.co.za), but we do NOT build or interfere with anything on their dedicated website. No agent, mission, or autonomous routine in this workspace should pick this up. Original requirements kept below for historical context only:
  - Visit the LIVE site at wildorchids.co.za and extract every design item (layout, colours, typography, spacing, imagery treatment, components) — copy faithfully, do not reinterpret or invent.
  - Target stack: Next.js, React, TypeScript, Firebase — same as SAOC — but content must be Sanity.io-editable on the backend (matches the CMS pattern already proven on this SAOC project).
  - Build LOCALLY first — no deploy yet. This phase is a placeholder/shell only.
  - Explicitly OUT of scope for this phase: full orchid genera/species taxonomy, full province listings, and other large structured content sets — those are data-migration work for a later phase.
  - Sequence: (1) design fidelity + shell first, get that nailed down, (2) THEN plan data migration separately.
  - Token-conscious: Brad flagged limited budget for this — plan carefully before executing, avoid wasted exploration.
  - NOTE: per CLAUDE.md scope boundary, WOSA is wild-orchid conservation, a separate org from SAOC — this is almost certainly a new/separate project directory, not inside this SAOC repo. Confirm target repo location before starting.
  - Status: NOT STARTED. Queued for a fresh session with full context budget (this session was near its context limit when the request came in — starting fresh avoids burning tokens on session recap instead of the actual design audit).

## P1 — Home page hydration mismatch in ShowBand / useCountdown — FIXED 2026-07-29 (F1, `cms-activation-deploy`)

**CLOSED.** `lib/hooks/useCountdown.ts` now uses `useSyncExternalStore` with a frozen
all-zeros `getServerSnapshot`, matching the pattern proven for `components/show/ShowCountdown.tsx`
in M2. Gate `contracts/f1-countdown-hydration.yaml` PASS (3/3), including a behavioural Playwright
check negative-controlled twice (pre-fix by @architect, post-fix stash-and-restore by @qa) and
live confirmation of real ticking (415 days, seconds 01→59) and clean interval teardown on
unmount. Full writeup: `docs/f1-countdown-hydration.md`.

Original finding (2026-07-29, kept for history): `useState<CountdownParts>(() => compute(targetDate))`
— a `Date.now()`-derived lazy initializer, rendered by `components/home/ShowBand.tsx` on the
home page — computed the countdown once on the server and again independently at hydration, so
any page load slower than ~1s produced a hydration mismatch and a visible flash. Reproduced by
@qa with Playwright (3s `_next/**` throttle): 2 `pageerror`s on `/`, numerals `31` vs `32` and
`30` vs `31`. Pre-existing since 2026-06-01/06-12, not caused by the Next 16 upgrade — deliberately
left out of scope for M2.

## Low priority — `useMemo` vs `useState` trade-off in `useCountdown.ts` (F1, 2026-07-29)

@qa flagged a non-blocking, unproven concern during F1 review: `useCountdown.ts` builds its
external store with `useMemo(() => createCountdownStore(targetMs), [targetMs])`, which carries a
React spec-level allowance to be discarded and recreated (unlike `ShowCountdown.tsx`'s
`useState(createCountdownStore)`, which never discards). @qa could not get React to actually
discard the memo, and reasoned that even if it did, the `setInterval` is created inside
`subscribe()` at commit time (not inside the memo callback), so a discarded memo would be inert
rather than leaking. Counter-argument: `useState`'s lazy initializer only runs once ever, so it
would NOT rebuild the store when `targetMs` changes on a later render — since `useCountdown` is a
shared hook that must support a caller changing its target (unlike `ShowCountdown`'s hardcoded
constant), `useMemo` is the form that actually supports the hook's contract. Open trade-off, not
a defect — no action needed unless a future session observes an actual discard-related bug.

## F6 — Page singletons: assessment findings (studio-next16-upgrade, 2026-07-29)

Full assessment: `docs/f6-page-singletons.md`. Assessment only — no documents created, no
code changed, per scope freeze.

- [ ] `membersPage` schema is orphaned — registered in Sanity Studio but no query in
  `sanity/queries.ts` and no `app/(marketing)/members/` route consume it. Needs a scope
  decision from Brad: build the page (new-page work, out of scope for F6) or remove the
  schema so it stops misleading editors.
- [ ] Dead editable fields: `homePage.countdownDate` and `contactPage.formRecipients` are
  editable in Studio but nothing reads them. Either wire them in or remove them.
- [ ] No custom desk structure in `sanity.config.ts` (stock `structureTool()`) — the six
  page singletons are not pinned to a single document. An editor can create duplicate
  `homePage` (etc.) docs and the site will silently render an arbitrary one (`[0]` of an
  unordered GROQ result), with no error surfaced anywhere. ~1-2 hrs to fix with a standard
  Sanity desk-structure singleton pattern.
- [ ] Seed one document per singleton from the existing hardcoded copy (~2-3 hrs,
  mechanical migration) — makes `docs/secretary-cms-guide.md`'s promises true without
  changing anything visible on the live site.
- [ ] Populate `hostSociety` on the 18 `societyEvent` docs (~15-20 min, needs domain
  knowledge — someone who knows which society hosts which event; code side is already
  correct, see `docs/f6-page-singletons.md` §4).
- [ ] `docs/secretary-cms-guide.md` §7 and §12 currently instruct the secretary to open
  singleton documents that do not exist yet ("there is one document — click it to open").
  Guide is wrong until either the documents are seeded or the guide gets a "first time
  only, click New document" branch added (~15 min doc fix, can happen independent of
  seeding).
- [ ] Deployed Studio at `saoc-prod--saoc-webapp.europe-west4.hosted.app` still runs the
  old Next 15 build and remains broken (the `useEffectEvent` crash) until the next deploy
  ships the Next 16 upgrade from this mission.
- [ ] Pre-existing prettier drift across ~160 files (`pnpm format:check` fails) — unrelated
  to this mission, noted during the M2 regression pass.

## Content gaps observed in Studio walkthrough (Brad, 2026-07-29)

Direct visual evidence from a live authenticated Studio session on port 3333. These are
content-entry gaps, not code defects — every field below renders correctly and is editable.

**A 7th empty document type, not caught by the F6 assessment:**
- `Judge` — "No documents of this type". The schema is registered and reachable in the
  Studio sidebar, but zero documents exist. F6 enumerated the six page singletons and the
  `hostSociety` gap; it did not flag `Judge`. Needs the same scope decision as
  `membersPage`: is a judges directory planned, or should the schema be removed?

**Empty fields on existing documents (spot-checked, likely not exhaustive):**
- `societyEvent` — **Slug is empty** (confirmed on "Cape Orchid Society Autumn Show").
  This is the direct cause of `/events/[slug]` being unverifiable in the M2 regression pass
  (3 of 62 routes were compiled-and-present only, never live-rendered). Populating slugs
  would close that gap. Note the Studio has a "Generate" button per document.
- `society` — Description, Logo, Website all empty on "Cape Orchid Society" (Member Count
  is populated at 220, so the docs are partially filled).
- `boardMember` — Email and Photo empty on "David Naidoo" (Name and Role populated).
- `sponsor` — Tier, Logo, Website, Description all empty on "Royal Horticultural Society"
  (Name only).
- `show` — Date empty on "National Show 14 (2012)" (Title, Slug, Year populated).

**Populated and healthy:** 21 societies, 18 events, 6 board members, 6 shows
(National Show 14–19, incl. 19 (2027)), 10 show classes, 6 awards, 6 sponsors, 9 provinces.

Note: "Wild Orchids of Southern Africa" exists as a `sponsor` document — worth confirming
that matches the intended WOSA relationship (SAOC links to WOSA as a partner organisation;
see CLAUDE.md scope boundary).

## F3 — Pin singletons: follow-ups (cms-activation-deploy, 2026-07-29)

Full detail: `docs/f3-pin-singletons.md`. F3 shipped and @qa passed all five assertions;
these are the residual items, not defects in what shipped.

- [ ] **[Low] Check gap:** `contracts/checks/f3-pin-singletons/check-new-document-filter.mjs:17`
  hardcodes `MUST_SURVIVE = ['society', 'event']`, but `'event'` is not a real schema
  type name — the actual type is `societyEvent` (`sanity/schemas/index.ts` imports a
  binding named `event` from `documents/event.ts`, whose `defineType` declares
  `name: 'societyEvent'`). Causes no false pass today (A2 only tests set membership,
  and `'event'` never collides with the pinned-type list either way), but it means A2
  never actually exercises the real `societyEvent` name — a future regression that
  accidentally filtered `societyEvent` out of the create-new menu would go uncaught.
  Needs an @architect follow-up to fix the constant to `'societyEvent'`.
- [ ] **[Informational]** F3 protects the Studio UI only, not the write API — @qa
  confirmed `client.create({ _type: 'homePage', ... })` with a write-token client
  succeeds against the live dataset with zero resistance (test doc deleted, counts
  verified back to 0 immediately after). No write-token integration exists in this
  codebase today that would exploit this, so no action needed now — revisit if one is
  ever added (a script, migration, or third-party integration holding a Sanity write
  token could still create a duplicate of a pinned singleton type and reopen the
  `[0]`-query fragility F3 exists to close).
- [ ] **[Needs client answer]** Per the project spec
  (`documents/Website Development SpecificationV1.docx` §3.5, cross-referenced to
  §8), the real Members Portal is planned as an authenticated, member-only area with
  a Digital Journal library — separate future build, not the `membersPage` singleton
  F3 pinned as an empty placeholder. The spec leaves open how membership status will
  be verified and kept in sync with SAOC's actual membership records. This needs a
  client answer before the Members Portal itself can be built (not blocking on F3,
  which only pins the placeholder).

### [P0 BLOCKER] The CMS→site loop does not work in production — found 2026-07-30 by F6

- [ ] **A published Studio edit never reaches the public site. The App Hosting CDN edge never
  invalidates.** This is the mission's central claim failing, and it is NOT a check-script bug —
  reproduced three times, and independently re-verified by the orchestrator.
  **What works:** Studio publish writes to the dataset (confirmed by authoritative Content Lake read);
  `POST /api/revalidate` with the correct secret returns 200 `{"ok":true,"revalidated":true}` (F2's fix
  is real); `revalidateTag()` correctly marks Next's own cache stale.
  **What fails:** the CDN in front keeps serving its own cached object. Live headers on `/about`:
  `x-nextjs-cache: STALE` (Next knows) alongside `cdn-cache-status: hit`, `cache-control:
  s-maxage=31536000` (one year), and `age` climbing monotonically across a 120s poll. Next marks it
  stale; the edge serves the stale copy anyway.
  **Lead, unconfirmed:** App Hosting is presumably meant to translate `revalidateTag()` into a CDN
  purge — there are `cache-tag` response headers that look built for exactly that. Note
  `x-fah-adapter: nextjs-14.0.21` is reported against a Next **16.2.12** app; that version gap is the
  first thing for someone with App Hosting context to examine. Do not assume it is the cause.
  **Consequence for the client:** the secretary can edit, publish, and see nothing change on any
  already-cached page — the exact failure this mission exists to prevent. Everything else about the
  CMS is now correct, so this single gap gates the whole deliverable.
- [ ] **[P1] `/events/[slug]` has a second, independent propagation gap.**
  `app/(marketing)/events/[slug]/page.tsx` tags its `sanityFetch` calls `['events']` only — no
  `'sanity'` tag, and `'events'` does not match the real document `_type` (`societyEvent`) that a
  webhook payload would send. So even once the CDN issue is fixed, event detail pages likely still
  will not revalidate. Found while designing F6; deliberately NOT used as the test target so it could
  not be confounded with the CDN finding.
- [ ] Verifying the actual Sanity webhook fires end-to-end is currently impossible with the
  dataset-scoped `SANITY_API_TOKEN` — reading webhook config needs the `sanity.project.webhooks/read`
  grant (confirmed live: 401). F6 asserts the direct revalidate call instead, which is a weaker claim,
  stated as such rather than overclaimed.

### CMS wiring gaps — site-wide route audit, 2026-07-30

Source-first audit of all 18 `app/(marketing)/` routes: grepped every page for `sanityFetch`/query
imports and read what each does with the result. Method note: seeded copy was migrated FROM the
component fallbacks, so the two are byte-identical and text matching proves nothing — discriminate
via Sanity CDN asset URLs, PortableText `_key` UUIDs in the RSC payload, or source reading.

- [ ] **[P2] `/national-show/archive/[year]` has no page for any show added in the Studio.** The archive
  LIST (`archive/page.tsx:42`) is Sanity-backed via `pastShowsQuery`, so a `show` document created in
  the Studio does appear there. The DETAIL page (`archive/[year]/page.tsx:6,49`) reads only the static
  `lib/data/shows` array and calls `notFound()` otherwise — so a Studio-added show has a list entry but
  no detail page behind it.
  **CORRECTION (same day):** an earlier revision of this entry claimed the list "publishes a broken
  public link" and ranked it P1. That was wrong — verified `archive/page.tsx` links only to
  `/national-show` and `/contact`; the list cards are plain divs, not links, and the only
  `archive/${year}` hrefs are the prev/next buttons inside the detail page, themselves generated from
  the static array. So no dead link is created today. The real exposure is narrower: a visitor who
  reaches that URL directly — a shared link, or once someone wires up card links — gets a 404.
  Downgraded to P2 accordingly. Note the latent trap: whoever later makes the list cards clickable
  turns this into the visible-broken-link problem it was mistakenly described as.
- [ ] **[P2] Orphaned document types — editable in the Studio, read by nothing.** `award`
  (`AwardsGrid.tsx` reads the static `lib/data/awards` instead) and `province` (`society.province` is
  free-text, not a reference to it). Either wire them or remove them from the Studio; leaving them
  editable teaches the client that publishing does nothing. `membersPage` is also unread but is a
  deliberate placeholder with no `/members` route yet. NOT orphaned despite absence from a naive
  `_type ==` grep: `judge`, dereferenced via `judgingPageQuery`'s `judges[]->` (`queries.ts:142`).
- [ ] **[P2] Unread schema fields:** `aboutPage.title`, `aboutPage.boardIntroText`, `judgingPage.stats`
  (hero headings are hardcoded JSX). Same class as the already-recorded `homePage.countdownDate`.

**Verified Sanity-backed** (safe to tell the client she can edit): `/` (hero images, mission text,
countdown via `nationalShow.countdownDate`, events strip, partners), `/about` (pillars, timeline,
board), `/judging` (all copy + judge directory), `/contact` (code path correct; unverifiable from HTML
until F6), `/events` + `/events/[slug]`, `/sponsors`, `/societies` + `/societies/[slug]`,
`/national-show/archive` (list only).

**Verified NOT editable:** `nationalShow` title/venue/host/hero/exhibitor stages; the `/national-show`
page's own countdown (`ShowCountdown.tsx:5` hardcodes the target — note this differs from the home-page
countdown, which IS live); `archive/[year]`; `/media-kit`, `/constitution`, `/privacy`, `/terms`,
`/national-show/exhibitors` (no CMS pretense — expected, not broken).

### Seeded-but-inert content — found 2026-07-30 by post-F4 render audit

- [ ] **[P1] `/national-show` never reads the `nationalShow` singleton.** F4 seeded the document and its
  gate passed 4/4 — but the gate asserts against the **Sanity API**, not the rendered page.
  `app/(marketing)/national-show/page.tsx:7-8,89-90` calls `sanityFetch` for `showClassesQuery` and
  `pastShowsQuery` only. There is no `nationalShowQuery`. Title, venue (`'CTICC, Cape Town'`, line 151),
  hero image, exhibitor stages and the countdown target (hardcoded in `components/show/ShowCountdown.tsx`)
  are all literal JSX/constants. So the secretary can edit the National Show page in the Studio, publish,
  and **nothing will change on the site** — the exact failure this mission exists to prevent. Not a
  query/field-name mismatch (that would be a one-line fix); the page needs wiring to fetch the singleton,
  which is a code change against heavily hardcoded JSX, so it was deliberately NOT done as part of F4's
  content migration. Note this compounds the already-recorded `homePage.countdownDate` dead-field problem:
  `nationalShow.countdownDate` was documented to the secretary as the field that *does* drive the
  countdown, and it does not either — the countdown is a constant in the component.
- [ ] **[P2] `/contact` cannot be discriminated without a round-trip edit.** `contactPage`'s seeded values
  and the component fallback are byte-identical, and `contactPageQuery` (`sanity/queries.ts:149`) projects
  no `_key` for array items, so no structural marker reaches the rendered HTML. Unknown whether the page
  fetches successfully or silently falls back. F6's round-trip proof should settle it.
- [x] Confirmed genuinely fetching Sanity on the deployed site: `/` (hero images resolve to
  `cdn.sanity.io`, not `/images/*`), `/about` and `/judging` (PortableText branch taken, Sanity `_key`
  UUIDs present in the RSC payload). Discriminators recorded here because seeded copy was migrated FROM
  the component fallbacks — the two are identical strings, so text matching proves nothing.

### F2 — contradiction RESOLVED 2026-07-30

- [x] ~~**Which build is actually live on `saoc-prod`?**~~ **SETTLED.** Neither prior position was right about the
  present state — the build-resource inspection was accurate when taken (2026-07-29) but went stale overnight.
  A CI-triggered build shipped F1+F3+F2 at 05:13Z on 2026-07-30 and now serves 100% of traffic:
  `build-2026-07-30-001`, commit `01dd63f`, confirmed by two independent control planes (App Hosting traffic
  split + Cloud Run `latestReadyRevision`) and by `git merge-base --is-ancestor` against all three of `604ba3a`,
  `ffb4225`, `84dbf58`. The behavioural evidence (pinned singleton editor rendering) was therefore correct.
  Now permanently guarded by assertion A10 (`contracts/checks/f2-deploy-next16/build-identity-deployed.mjs`).
  **Lesson:** ETag is NOT a build discriminator — ISR regeneration changes it — and a single build-resource read
  in isolation is not either. Cross-check two control planes plus git ancestry.
- [ ] `firebase apphosting:rollouts:create` reports "Successfully created a new rollout!" while creating **no** new
  rollout or build resource (verified by REST GET; next sequential ids 404). Appears to dedupe on git SHA. @dev
  worked around it by POSTing directly to the App Hosting REST builds endpoint (`build-manual-1785355696`) — status
  unknown, never polled to completion.
- [ ] IAM is confirmed fixed and durable: `firebase-app-hosting-compute@saoc-webapp.iam.gserviceaccount.com` holds
  `secretAccessor` + `viewer` on both `SANITY_REVALIDATE_SECRET` and `SANITY_API_TOKEN`, verified via Secret Manager
  IAM policy REST calls. The remaining failure is getting a build that references the secrets to actually roll out.
- [ ] Production ETag is NOT a build discriminator — it changed again (`a8e4pxlfw41lfq` → `1337qsztbrz1lfq`) without a
  confirmed new rollout, because ISR prerender regeneration also changes it. A8 is weaker evidence than it looks.

## Client / governance — raised 2026-08-11

- [ ] **Secure organisation-owned document custody for SAOC** (council discussion point, not a
  build task yet). Institutional records currently sit in individuals' Google Drives, thumb
  drives and personal email. Need a role-based, SAOC-owned home for constitution, minutes,
  judging standards, show archives, brand assets, sponsor agreements, NPO/PBO and financial
  documents, photography rights, and site credentials. Critical sub-point: accounts must be
  registered to SAOC as an organisation, not to whoever creates them — applies especially to
  the PayFast merchant account, the domain, and any Google/Microsoft tenant. GitHub stays the
  home for source code only; it is the wrong tool for committee documents. Written up as
  section E in `documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md`.
- [ ] **Society-published calendar feeds aggregated into the national events calendar** (Phase 2,
  back burner). Each of the 21 societies maintains its own iCalendar (`.ics`) feed; the site
  subscribes and aggregates, so maintenance stays with the societies rather than loading SAOC
  staff. NOT web scraping — `.ics` is a stable standard published natively by Google Calendar,
  Outlook and Facebook Events. The codebase already emits `.ics` (`app/api/events.ics`,
  per-event exports), so this is the mirror image of existing work. Needs a moderation step
  before public display, and a manual-entry fallback for societies with no digital calendar.
  Validate cheaply first: ask how many of the 21 societies actually keep one. Written up as
  section F in the call-prep doc.
