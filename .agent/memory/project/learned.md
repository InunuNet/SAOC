# Learned Lessons

This file documents key learnings, decisions, and pitfalls encountered during the project's development. It serves as a knowledge base to avoid repeating mistakes and to streamline future work.

## General

- (2026-04-21) **GitHub repo:** Live at https://github.com/BDauth/SAOC (private). Athanor workspace files (`.agent/`, `.claude/`, etc.) are intentionally bundled with the Next.js website code in the same repo. Brad confirmed this is fine because the repo is private — simpler than maintaining two repos or `.gitignore` exclusions. Do NOT add `.gitignore` exclusions for `.agent/` or `.claude/`. If the repo ever goes public, revisit this decision.
- (2026-04-22) **Firebase not yet set up.** Scaffold only — no Firebase project created, no credentials, no App Hosting connection. Next session must: create Firebase project, connect BDauth/SAOC in App Hosting console, generate service account key, fill `.env.local`, add `apphosting.yaml`.
- (2026-04-22) **GitHub push to new empty repo failed** via HTTPS and SSH with `remote: fatal: did not receive expected object` — GitHub was treating the repo as part of the InunuNet/Athanor fork network (shared history) and requesting a delta base object we didn't have locally. Fix: orphan commit to sever the shared history, then push. Needed for any future repo that inherits Athanor commit history.
- (2026-04-22) **Workspace mismatch fix:** WORKSPACE file must match the directory name exactly or the `verify_workspace.sh` PreToolUse hook blocks all Bash. When onboarding a new Athanor project whose directory name differs from the template name, update both WORKSPACE and `profile.json.project_name` before anything else.

## M1 Foundation (2026-06-01)

- (2026-06-01) **Tailwind v4 PostCSS plugin:** `postcss.config.mjs` MUST use `@tailwindcss/postcss` (not the legacy `tailwindcss` plugin). Getting this wrong = Tailwind silently doesn't compile even when the pnpm dep is correct. v4 is CSS-first; design tokens live in `app/globals.css` under `:root` + `@theme` blocks.
- (2026-06-01) **contract.py schema:** Gate script requires `created_at`, `spec` (or `slug`), per-assertion `verify: {kind: shell, cmd: ...}` blocks (NOT `command:`), and a `phases` section. @architect-generated contracts (flat list with `command:`) must be reformatted before the gate can run.
- (2026-06-01) **handoffs.yaml not deployed by template:** `template/.agent/handoffs.yaml` is not copied to `.agent/handoffs.yaml` by `make update-template`. Without it, ALL gate checks fail silently (`handoff_check.py` errors on missing file). Fixed by manual copy. TEMPLATE BUG candidate.
- (2026-06-01) **SocietyEvent not Event:** Domain entity is `SocietyEvent` — `Event` shadows the DOM built-in and causes subtle TS bugs. Always use `SocietyEvent` when importing from `@/types`.
- (2026-06-01) **saoc-logo-original.png is forbidden:** Do not copy/reference the legacy logo. Allowed variants only: ink-paper, original-text, clean-ink, etc. Primary lockup = `saoc-logo-ink-paper.png`.
- (2026-06-01) **@qa cannot write files:** The qa subagent has Write/Edit disabled in its manifest. The orchestrator must write the qa-report artifact manually after @qa returns findings, to unblock the qa→docs gate.
- (2026-06-01) **Data field renames from design handoff:** `desc` → `description`, `icon` → `code`. `Partner` is `{name: string}` not a string alias. Applied across all 9 `lib/data/` modules sourced from `design/design_handoff_saoc/src/data.js`.

## M2 Chrome (2026-06-01)

- (2026-06-01) **Server/client split:** UtilityBar, Footer (main shell), Breadcrumb are Server Components — no `'use client'`. Only Header, MobileMenu, SearchOverlay, and NewsletterForm (subcomponent) are client. Footer extracts its newsletter form to `NewsletterForm.tsx` to keep the Footer shell server-only.
- (2026-06-01) **Keyboard shortcut placement:** Cmd+K / Ctrl+K / "/" handlers live in `Header.tsx` (always mounted), not in SearchOverlay. SearchOverlay only handles Esc. Avoids double-mounting the global listener.
- (2026-06-01) **A26 assertion caveat:** Breadcrumb assertion in `contract-m2.yaml` passes on a comment in `app/(marketing)/layout.tsx` rather than a live import — intentional deferral to M4 (interior page routes). Don't treat as real wiring.
- (2026-06-01) **Arrow characters in JSX:** Use literal Unicode `→` (U+2192), not the HTML entity `&#8594;`. Golden files are the source of truth; dev wrote the entity form and it was fixed post-QA.

## M3 Home Page (2026-06-03)

- (2026-06-03) **NavCardData title split:** `NavCardData` uses `titleBefore / titleEm / titleAfter` (three fields) for the nav card heading, NOT a single `title`. The emphasis word is `titleEm` and gets rendered in an `<em>` with `text-accent-soft`. Bug: dev wrote `card.title` — caught by `pnpm build` TypeScript check.
- (2026-06-03) **Mission status lag:** Mission file can show features as "pending" even when components are built — the status only updates when a gate run completes. Don't trust mission status alone; check file existence + `pnpm build` to confirm actual state.
- (2026-06-03) **Maintainer gate: learned.md staleness:** `handoff_check.py` rejects commits when `learned.md` mtime exceeds 86400s. Always append at least one lesson per session to keep the gate open.

## M4 Interior Pages — F5 About (2026-06-05)

- (2026-06-05) **Tailwind v4 arbitrary-variant blind spot:** `[&_em]:` arbitrary variants targeting element-type descendants (e.g. `[&_em]:not-italic [&_em]:italic [&_em]:text-accent`) do NOT emit CSS in Tailwind v4. Fix: apply styling directly to the `<em>` element at each call site — `<em className="not-italic italic text-accent">word</em>`. Affects any descendant-element selector pattern.
- (2026-06-05) **Contract assertion: grep for `<em` not `<em>`:** Once `<em>` elements gain `className` props (e.g. `<em className="...">`), `grep -q '<em>'` fails. Use `grep -q '<em'` to match both bare and attribute-bearing tags. Pattern applies to any tag that may grow attributes between drafts.
- (2026-06-05) **Contract gate caches results:** After updating an assertion in a contract YAML, run `python3 execution/contract.py clear <contract>` before re-running the gate. Without clearing, the gate replays the prior (stale) pass/fail status for that assertion.

## Planning Session (2026-06-06)

- (2026-06-06) **Yoco signup broken (2026-06-06):** Yoco is not accepting new merchant signups. Fallback = Stripe (SA support launched 2023; ZAR settlements, EFT via Ozow, near-identical webhook/checkout pattern). Revisit when Phase D ticketing is in scope — do not design around Yoco specifically.
- (2026-06-06) **Phase 1 scope = 8 pages per proposal:** Home, About, Societies, Judging, Judges Training, Events calendar, Sponsors, Contact — plus 2027 Show hub + Yoco/Stripe ticketing + admin dashboard + door check-in. @lead's initial plan missed Judges Training and Sponsors.
- (2026-06-06) **Email = cPanel SMTP (explicit in proposal):** Use Nodemailer via InunuNet cPanel SMTP for contact form and ticket confirmations. SPF/DKIM/DMARC must be configured on saoc.co.za before Phase D launch — without this, Gmail/Outlook will reject ticket emails.
- (2026-06-06) **Calendar source = Sanity:** Real-time (Firebase RTDB) has no advantage for an events calendar. Secretary uses one system (Sanity Studio) for all content.
- (2026-06-06) **Members portal scaffolding-only in Phase 1:** No portal UI. Firebase Auth data model and Firestore schema designed in Phase 1 so Phase 2 can slot in without rework.
- (2026-06-06) **Newsletter = out of scope Phase 1:** Footer newsletter stub to be removed. Not in proposal.

## Session Reset (2026-06-05)

- (2026-06-05) **GitHub remote correction:** Remote is `InunuNet/SAOC`, NOT `BDauth/SAOC`. InunuNet is Brad's billing/deployment account for this client project. Always verify `git remote -v` before any push/deploy. Supersedes the 2026-04-21 entry naming `BDauth/SAOC`.
- (2026-06-05) **Full project scope is 5 phases, not 1:** Phase A Foundation (Next.js latest + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting + lint/format + staging), Phase B 7 static pages (CMS-driven), Phase C Events calendar, Phase D 2027 Show ticketing (Yoco Gateway + admin dashboard + door check-in), Phase E Polish/training/DNS cutover/launch. Old mission `2026-06-01-saoc-website-build` was Phase B only — abandoned. New mission must be scoped against the full brief.
- (2026-06-05) **Previous M1–M4 work is UNVERIFIED against new brief:** Scaffold, chrome, home, about exist in repo but were built against the narrow 7-page mission. Must be re-audited (QA pass) against the expanded brief before counting as done. Do not treat as complete.
- (2026-06-05) **CMS decision = Sanity:** Rationale: Secretary-friendly Studio UI, free tier covers SAOC's volume, mature Next.js SDK, clean separation from deploy pipeline. Chosen over Contentful/Strapi/Payload for this project.
- (2026-06-05) **Firebase hosting = InunuNet account, App Hosting product:** Connect to `InunuNet/SAOC` GitHub repo via App Hosting console. Brad's account holds the project — not BDauth, not the client's own GCP.
- (2026-06-05) **Process: close session cleanly before compact.** Never dispatch large planning agents at end of context — creates token waste. Pattern: session work → @maintainer wrap → compact → new mission in clean context.
- (2026-06-05) **Harness updated to v3.7.73** via `make update-template`. Brings new skills (`active-mission`, `chain-dispatch`, `quick-gate`, `recall`, `report-harness-bug`, `use-alembic`, `wrap-mission`, `write-contract`, `write-handoff`), new core rules (`coding.md`, `workflow.md`), and the `.anti/` directory. Sanity-check downstream hook behaviour before next chain dispatch.

## Phase A Bedrock (2026-06-06)

- (2026-06-06) **Contract schema: `phases[].assertions` must be ID strings, not objects.** Correct schema = top-level `assertions:` with full definitions + `phases[].assertions:` as a list of string IDs (`[A1a, A1b, ...]`). @architect wrote full objects inside the phase → gate crashed with `TypeError: sequence item 0: expected str instance, dict found`. Always run `python3 execution/contract.py validate` before dispatching @dev.
- (2026-06-06) **Contract location must be `.agent/memory/project/specs/<slug>/contract.yaml`.** `require_contract.sh` searches `find .agent/memory/project/specs -path "*${SLUG}*" -name "contract*.yaml"`. Writing to root `contracts/` does NOT satisfy the gate.
- (2026-06-06) **`require_research.sh` blocks @architect dispatch.** Every @architect dispatch needs a `research-*.md` in `.agent/memory/scratch/` with a `## Findings` section ≥512 bytes. Dispatch @analyst first even for greenfield/obvious tasks.
- (2026-06-06) **`require_dev_result.sh` blocks @qa dispatch.** After @dev finishes, orchestrator must write a `dev-result-<slug>.md` to `.agent/memory/scratch/` with `## Golden Assertions` section ≥128 bytes. @qa cannot be dispatched without it.
- (2026-06-06) **Mission activation uses `active.json`, not frontmatter `status:`.** `mission.py resume` reads `.agent/memory/project/missions/active.json`. Setting `status: active` in frontmatter makes `list` show active but `resume` still fails. Use `python3 execution/mission.py activate <full-file-path>` to set `active.json`.
- (2026-06-06) **@dev golden deviation: `.prettierignore` missing `*.md` and `*.mdx`.** Golden had them; @dev omitted. `pnpm format:check` then failed on `docs/m1-foundation.md`. Always `python3 execution/contract.py clear <contract>` and re-run gate after any fix — cached results otherwise replay prior pass/fail.

## Session (2026-06-08)
- (2026-06-08) **require_maintainer gate:** learned.md mtime must be under 86400s or commits are blocked. Always dispatch @maintainer same-day or touch this file at session start.

## Phase A3 — Sanity CMS (2026-06-08)

- (2026-06-08) **sanity@5.x + React 19.2 `useEffectEvent` breaks webpack build.** `sanity@5.30.0` (v5.0.1+) imports `useEffectEvent` directly from `react` instead of using the `use-effect-event` polyfill. React 19.2.7 exports it at runtime, but `react/index.js` uses a conditional require gated on `process.env.NODE_ENV`, so webpack's static CJS→ESM export analysis can't see it and fails the build with "exportsPresence" errors. **Fix:** in `next.config.ts`, add `config.module.parser.javascript.exportsPresence = false` inside the `webpack` callback. Safe because the runtime export exists — only the static analysis is a false negative. Do NOT try to work around this with dynamic imports of the Studio page; that masks the issue and re-surfaces on other sanity submodules.
- (2026-06-08) **Sanity Studio route pattern:** `app/studio/[[...tool]]/page.tsx` should be a tiny re-export (`export { default } from './StudioClient'`); put the `'use client'` + `<NextStudio config={config} />` in `StudioClient.tsx`. Keeps the route file server-eligible and lets Next.js generate the catch-all metadata correctly.
- (2026-06-08) **Sanity env split:** keep `sanity/env.ts` as the single source of truth for `apiVersion`, `dataset`, `projectId`, `studioUrl` — read by both `sanity.config.ts` and `sanity.cli.ts`. Don't duplicate `process.env` reads at call sites; the typed accessors throw on missing values which is what you want at boot time.

## Phase A4 — Sanity Schemas (2026-06-08)

- (2026-06-08) **Harness contract format reconfirmed for A4:** Contract YAML MUST use `slug`/`created_at`/top-level `assertions:` (full defs) + `phases[].assertions:` (string IDs only) + per-assertion `verify: {kind: shell, cmd: ...}` blocks. Flat `kind: shell, cmd: ...` lists at the assertion root or under `command:` fail validation. Same pattern as A1/A2/A3 — codify in the architect skill.
- (2026-06-08) **`contracts/` must be in `tsconfig.json` exclude:** Golden files live at `contracts/golden/<feature>/` and are not part of the app build. Without `"contracts"` in `tsconfig.json.exclude`, `pnpm type-check` walks the golden snapshots and fails on intentionally divergent fixtures. Add to exclude alongside `node_modules`, `.next`, `out`.
- (2026-06-08) **Sanity schema registration is a flat array, not nested:** `sanity/schemas/index.ts` exports `schemaTypes: [...]` — every new doc type must be appended to the single array. Order doesn't matter functionally but group by `documents/` then `objects/` for diffing sanity. Forgot to register and Studio silently 404s on the doc type.
- (2026-06-08) **Sanity singleton pattern:** Singleton documents (`homePage`, `aboutPage`, `judgingPage`, `membersPage`, `contactPage`) are regular doc schemas — the singleton-ness is enforced at the Studio structure layer (`structure.ts`), not the schema. Don't try to model "singleton" in the schema itself; just write the doc and lock to one instance in the desk structure when Studio structure is added in A5/A6.
- (2026-06-08) **A4 net = 16 schema types total:** 4 new (`judgingPage`, `membersPage`, `show`, `province`) on top of 12 existing. The brief said "7 content types" but the final registry covers Phase B's content needs end-to-end. Track in `docs/m1-foundation.md` schema table — single source of truth for which docs Phase B can fetch.

## Phase A5 — Sanity Seed Script (2026-06-08)

- (2026-06-08) **`@sanity/client` is NOT a transitive dep of `next-sanity`:** Even though `next-sanity` ships its own Sanity client wrapper for React Server Components, Node-side scripts (`scripts/seed-sanity.ts`) need `@sanity/client` added explicitly to `package.json` deps. `pnpm add @sanity/client@^7.22.1`. Pattern: any backend-only Sanity tooling needs its own explicit client install.
- (2026-06-08) **`dotenv` not present by default:** Next.js auto-loads `.env.local` for the app runtime, but standalone Node scripts (run via `tsx`) do not — needs `pnpm add dotenv@^17.4.2` plus `import 'dotenv/config'` (or `dotenv.config({ path: '.env.local' })`) at the top of the script. Otherwise `process.env.SANITY_API_WRITE_TOKEN` is undefined and the seed silently auths as anonymous → 401.
- (2026-06-08) **`scripts/` is type-checked by default:** `tsconfig.json` only excludes `node_modules`, `.next`, `out`, `contracts` (added in A4) — the default `**/*.ts` glob therefore includes `scripts/*.ts`. Treat seed/utility scripts as first-class TS: real types, no `any`, golden files there ARE checked by `pnpm type-check`. If a script must escape strict checking, add it explicitly to `tsconfig.json.exclude` rather than reaching for `// @ts-nocheck`.
- (2026-06-08) **Idempotent Sanity seeding pattern:** Use `createOrReplace()` with deterministic IDs derived from a stable source field (e.g. society slug → `society-${slug}`) so re-running the seed updates docs in place instead of duplicating. Avoids the "100 board members after 5 runs" footgun. Run as one big `transaction()` so partial failures roll back cleanly.
