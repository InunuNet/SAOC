# Athanor Issue Backlog

## SAOC Project — Active (Phase 1 scope only)

_Last compacted: 2026-07-10 by session (machine-reboot wrap-up). Full history: git log on this file._

- [x] **[P1] Response to Lee-Ann McCleland (SAOC Secretary) — SENT** — Response to her 11 proposal-evaluation questions (`documents/Inunu - Additional info request.docx`) drafted, fact-checked (PayFast recommended over waitlisted Yoco, Quicket cost comparison sourced, security claims verified against the actual codebase), and sent from brad@inunu.net 2026-07-01. Covered: security, payment security, refunds, ticketing costs vs Quicket, membership scope, journal archive, judges platform, CMS ease of use, Next.js scalability, ownership transfer, support model, non-renewal consequences. **Now WAITING on the Council's decision — no action pending on our side.**

- [x] **DONE (compacted 2026-07-10) — Phase 1 platform build + polish + AI/CI.** Full detail in git log. Covers:
  - **Phase A Foundation** (Next.js + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting + lint/format + CI); **Phase B** 8 CMS-driven static pages; **Phase C** events calendar (month-grouped, ICS export — note member-only event submission form built as C5 is Phase 2 scope, shipped but not linked); **Phase D partial** 2027 ticketing D1/D3/D5/D6 (Resend email, Firestore ticket model, admin dashboard, door check-in); **Phase E** SEO + Secretary training + launch checklist (E4 22/22, E5 19/19, E6 14/14).
  - **Chrome wiring** (real UtilityBar/Header/Footer in layout); **Design-verify pass** (full globals.css token set, radius-0, editorial polish); **AI/LLM optimization** (llms.txt + llms-full.txt + robots.ts AI allowlist + NGO JSON-LD); **llms-full.txt nightly GROQ cron** (`.github/workflows/refresh-llms.yml`, needs GitHub secrets `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` before cron fires); **Inner-pages design polish** (mission 2026-06-30, done 2026-07-01, commit 0488cc8).
  - **PayFast ticketing M1** (F1 schema rework, F2 checkout initiation route, F3 ITN webhook handler; 3 rounds adversarial QA fixed 2 real payment-security bugs — spoofable X-Forwarded-For IP trust + non-atomic idempotency race; docs/payfast-integration.md; gate 33/33; **left UNCOMMITTED intentionally**).
  - **CI fix 2026-07-10**: removed pnpm version pin conflict in `.github/workflows/ci.yml` that failed every CI run since 2026-06-30 (commit 5c75473, pushed to main).

- [ ] **[P1] Scope reconciliation: Lee-Ann's Spec V2 vs signed Phase 1 proposal — needs Brad↔Lee-Ann conversation before more National Show build work.** Full comparison built 2026-07-15 (see `needs-human.md`). Signed Phase 1 (R12,375 ex VAT) = 8 SAOC pages + 1 Show landing page + simple ticketing. Spec V2 treats a full 24-page platform (Members Portal w/ journal+awards archive, Symposium, WOSA Conference, Workshops, exhibitor/guest databases, unified multi-type booking) as one undifferentiated scope, with only cosmetic polish (Section 9) deferred. Most of our quoted "Future Phase 2" (membership+journal) now reads as core; the entire event-conference layer was never quoted at any phase. **Do not build the Section 7 shared schemas or National Show's 18 pages against the full spec until this is resolved** — either Spec V2 gets re-priced/re-scoped as the real Phase 1, or it stays a staged roadmap per the original proposal.

- [ ] **D2/D4: PayFast ticketing — M1 DONE, M2 BLOCKED.** Mission `2026-07-01-payfast-ticketing.md` ACTIVE, paused at the M1/M2 boundary (checkpoint M1/F3). Gateway = PayFast (Yoco waitlisted with no ETA; PayFast recommended + committed, verified against PayFast dev docs — Subscriptions API, Refunds API, hosted redirect + Onsite Beta, PCI DSS Level 1).
  - **M1 DONE (uncommitted):** F1 Firestore schema reworked off the old Stripe-shaped field to PayFast's model; F2 checkout initiation route; F3 ITN webhook handler. Documented in `docs/payfast-integration.md`. Gate green 33/33.
  - **M2 BLOCKED:** F4 buy-flow UI, F5 confirmation page + email (Resend), F6 sandbox verification. Blocked on TWO external inputs, both logged in `needs-human.md`: (1) **PayFast Sandbox credentials** (free signup at sandbox.payfast.co.za, no FICA — Merchant ID/Key/Passphrase into .env.local); (2) **real 2027 Show ticket pricing** (adult/pensioner/child/member/exhibitor tiers + capacity). Resume: `python3 execution/mission.py resume` → `/spec` for F4.
  - **Live merchant account (separate, Brad):** gather non-profit FICA docs (NPO/PBO/Section 21 registration, proof of address, bank-issued proof of account), register at registration.payfast.io. Only blocks going LIVE, not sandbox development.
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before launch. Setup guide: docs/email-dns-setup.md. Brad to add DNS records once Resend domain verified.
- [ ] **Domain transfer** — saoc.co.za to Inunu Net registrar. Brad to initiate. R172.50 once-off.
- [ ] **DNS cutover** — point saoc.co.za to Firebase App Hosting. Requires domain transfer complete + SPF/DKIM/DMARC in place.
- [ ] **Live PayFast test transactions + cross-browser dry-run** — Phase 1 launch gate. Run after D2/D4 (PayFast M2) complete and live FICA-verified credentials are in place.
- [ ] **Auto-refresh llms.txt + llms-full.txt via Alembic** — Alembic-based script BUILT (`scripts/refresh-llms.ts`, `pnpm refresh-llms`): crawls 7 routes through Alembic → regenerates `public/llms-full.txt`. ⚠️ Alembic blocks `localhost` hostnames by design, so the script only works against the live external URL (`https://saoc.co.za/<page>`) — usable only POST DNS-cutover, and NOT usable in CI (GitHub Actions can't reach local Alembic). `public/llms.txt` (index + descriptions) stays hand-authored. Production automation moved to the GROQ item below. Depends on live domain. Docs: `docs/llm-optimization.md`.
- [ ] **Home page UI drift audit + fix mission** — Local version has drifted from the design reference (Claude Design HTML) across multiple sections. Confirmed gaps as of 2026-06-30: (1) ShowBand / flagship event section — hosted version looks correct, local has regressed; (2) EventsStrip — hosted version shows events from Firestore but `hostSociety` field may not be populated in Firestore docs, causing blank society name column — verify Firestore `events` docs have `hostSociety` reference set; (3) YearbookStrip image — hosted renders better (Next.js Image optimization + WebP in prod), local dev shows un-optimised; no code change needed, observation only; (4) Footer — code is correct (`max-w-[1280px] mx-auto` on inner grid), "sprawled" appearance on hosted is viewport-width perception at 1920px+ — no code change needed. Audit all remaining home sections against `design/Claude Design HTML/SAOC%20Website%20(standalone).html`. Do NOT fix sections ad-hoc — run a full audit first, write contract + goldens for all diffs, then implement in one mission pass. Approach: open design HTML, screenshot each section, compare to local dev, list every deviation, then chain to @architect.

- [ ] **Sanity v6 major upgrade** — `sanity@5.31.1 → 6.3.0` (and likely `next-sanity@11 → 13`). Pre-mission research required: review v6 changelog + migration guide, check next-sanity v13 breaking changes, verify Firebase App Hosting SSR compatibility, confirm React 19 peer dep story, identify any schema or Studio API changes. Do NOT upgrade without a research pass — this is a major version with likely breaking changes across both packages.

- [ ] **Secretary CMS controls (phase 1)** — Scope-narrowed: start with only what the secretary actively needs to edit, build up slowly to avoid risk. Phase 1 target fields: hero headings/lede on key pages (home, about, national-show), upcoming show details (date, venue, ticketing link), news/announcements block, contact details. Do NOT attempt full-site editability in one mission. Each phase ships, verifies, and stabilises before the next. Seed must pre-populate all new fields from current hardcoded values so the secretary starts with real content rather than blank forms.

- [ ] **Assess Sanity Free-plan downgrade impact** — SAOC's Sanity project auto-downgraded to the Free plan when the Growth trial ended (email 2026-07-14). Impact on the build, Studio, and the nightly llms-full.txt GROQ cron NOT yet assessed. Check Free-plan limits (API CDN requests, dataset size, seats, API-token count) against current usage; confirm the `SANITY_API_TOKEN` GROQ cron still works under Free-tier quotas. Low effort, do before it silently breaks something. Detail in `needs-human.md`.

## Autonomous routines (cloud — claude.ai RemoteTrigger, NOT in this repo)
_Not local cron; not visible in the repo. Managed via the `/schedule` skill. Listed here so future sessions know they exist, don't duplicate them, and understand overnight no-op runs._
- **`trig_01Ry4fkFgbZCoW9CgUtqfh8D`** — "SAOC — nightly template sync + mission progress", daily 01:00 UTC. Prompt updated 2026-07-15 with an explicit **scope freeze**: it must NOT autonomously build the Section 7 shared schemas or any un-built National Show page while the Spec V2 scope reconciliation is unresolved.
- **`trig_01PNsrRuno8EzxpaZP8dArv1`** — "SAOC — Athanor harness/template watch", every 6 hours.
- Disabled 2026-07-15: `trig_01Ue5oZh2nhRoKDXdURaFWu1` (stale one-time Gmail-draft reminder, already fired).

## Blocked (awaiting Brad)
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
- [ ] **[athanor-upstream] sync-autonomy v2** — `set-autonomy LEVEL=high` should propagate to `.claude/settings.json` permissionMode. Filed 2026-06-16.
- [ ] **[athanor-upstream] mission.py slug fix** — cross-date slug scan fix needs upstreaming via `make update-template`. Filed 2026-06-16.

## Deferred (auto-tracked)
- [ ] [dev 2026-06-18] Factory loop script needs error handling — Out of scope for this task _(priority: low, handoff: 20260618T075409-dev.json)_

_Last compacted: 2026-07-10 by session. Dismissed: check_own_comms + quota-monitor + qa-guard informational pulse noise — all informational, no action required. Full history: git log on this file._

## New Mission Queued (not started) — WOSA website rebuild
- [ ] **[P1] Rebuild wildorchids.co.za (WOSA) — design-faithful shell, Sanity-backed** — Brad's prior developer (TK) failed to deliver; already paid, can't claim money back since nothing was delivered, so this is a from-scratch redo with a new approach. Requirements as stated 2026-07-01:
  - Visit the LIVE site at wildorchids.co.za and extract every design item (layout, colours, typography, spacing, imagery treatment, components) — copy faithfully, do not reinterpret or invent.
  - Target stack: Next.js, React, TypeScript, Firebase — same as SAOC — but content must be Sanity.io-editable on the backend (matches the CMS pattern already proven on this SAOC project).
  - Build LOCALLY first — no deploy yet. This phase is a placeholder/shell only.
  - Explicitly OUT of scope for this phase: full orchid genera/species taxonomy, full province listings, and other large structured content sets — those are data-migration work for a later phase.
  - Sequence: (1) design fidelity + shell first, get that nailed down, (2) THEN plan data migration separately.
  - Token-conscious: Brad flagged limited budget for this — plan carefully before executing, avoid wasted exploration.
  - NOTE: per CLAUDE.md scope boundary, WOSA is wild-orchid conservation, a separate org from SAOC — this is almost certainly a new/separate project directory, not inside this SAOC repo. Confirm target repo location before starting.
  - Status: NOT STARTED. Queued for a fresh session with full context budget (this session was near its context limit when the request came in — starting fresh avoids burning tokens on session recap instead of the actual design audit).
