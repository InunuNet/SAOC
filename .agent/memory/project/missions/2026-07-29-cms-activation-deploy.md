---
schema: athanor.mission/v1
slug: cms-activation-deploy
goal: Ship the Next 16 fix to production so the Studio actually works for the client,
  then make the CMS genuinely usable — pin the page singletons so they cannot be duplicated,
  seed them from the existing hardcoded copy, populate the content gaps blocking route
  coverage, and prove end-to-end that a Studio edit changes the live site
created_at: '2026-07-29T18:30:00.000000+00:00'
started_at: '2026-07-30T07:24:51.199930+00:00'
last_active_at: '2026-08-05T21:34:38.129452+00:00'
status: paused
cost_estimate:
  features: 6
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M3
  feature: F6
  ts: '2026-07-30T21:11:17.142770+00:00'
features:
- id: F1
  name: Fix the home-page hydration bug (useCountdown / ShowBand) before shipping
  status: done
  inline_brief: lib/hooks/useCountdown.ts uses a Date.now()-derived lazy useState
    initializer, rendered by components/home/ShowBand.tsx on the home page. Server
    and client compute different values, so any load slower than ~1s throws a React
    hydration error and React discards the subtree. Reproduced by @qa 2026-07-29 with
    Playwright under a 3s _next/** throttle - 2 pageerrors on /, numerals 31 vs 32
    and 30 vs 31. Pre-existing since 2026-06-01, NOT caused by the Next 16 upgrade.
    Fix with useSyncExternalStore + a frozen getServerSnapshot, exactly as components/show/ShowCountdown.tsx
    was fixed in M2 - that file is the reference implementation. Do NOT use suppressHydrationWarning.
    Reproduce the bug first and prove the harness detects it before fixing; it does
    not reproduce on sub-second localhost loads. This ships before the deploy so production
    does not receive a known bug.
  completed_at: '2026-07-29T18:38:34.642417+00:00'
- id: F2
  name: Deploy Next 16 to Firebase App Hosting and verify production
  status: done
  inline_brief: 'Deploy and confirm the fix reaches real users. apphosting.yaml already
    pins runConfig.runtime nodejs22 and package.json declares engines.node >=22 (added
    in M2, never exercised by a real deploy). F2 of the previous mission verified
    App Hosting supports Next 16 via the adapter''s SAFE_NEXTJS_VERSIONS gate (>=16.1.0;
    we run 16.2.12) - if the build is rejected it fails loudly with an explicit CVE
    message, not silently. After deploy verify against saoc-prod--saoc-webapp.europe-west4.hosted.app
    (already CORS-allowed): the site renders, and critically the deployed /studio
    opens a document without the useEffectEvent crash. Watch build memory - runConfig.memoryMiB
    is 512 and Turbopack is now the default builder. This is the highest-value feature
    in the mission; everything proven so far is local-only.'
  started_at: '2026-07-30T07:24:51.199737+00:00'
  completed_at: '2026-07-30T20:49:22.413185+00:00'
- id: F3
  name: Pin the page singletons in a custom desk structure
  status: done
  inline_brief: sanity.config.ts uses stock structureTool() with no custom desk structure,
    so none of the six page types are true singletons. An editor can create a second
    homePage document and the site would silently render an arbitrary one - the GROQ
    takes [0] from an unordered result. Add a desk structure pinning each of homePage,
    aboutPage, nationalShow, contactPage, judgingPage, membersPage to one fixed document
    ID, so clicking the sidebar entry opens that document directly instead of an empty
    list with a Create-new button. Also resolve the scope decisions flagged below
    before touching membersPage. Do this BEFORE anyone else edits content - it prevents
    a failure mode that is confusing to diagnose after the fact.
  completed_at: '2026-07-29T19:05:53.432917+00:00'
- id: F4
  name: Seed the six page singletons from existing hardcoded copy
  status: done
  inline_brief: Create one document per singleton, populated from the copy currently
    hardcoded in the components, so the site becomes genuinely CMS-driven without
    changing anything visible. Every page already has graceful per-field fallbacks
    (verified in F6 of the previous mission), so this is a migration, not a content-writing
    project - do not invent copy. See docs/f6-page-singletons.md for the field-by-field
    mapping of what each schema expects and what the front end currently hardcodes.
    Then fix docs/secretary-cms-guide.md sections 7 and 12, which currently instruct
    the secretary to open documents that do not exist. The dataset is placeholder
    content on a pre-production site, so creating documents is safe.
  completed_at: '2026-07-30T20:50:31.311366+00:00'
- id: F5
  name: Populate content gaps - event slugs and hostSociety
  status: done
  inline_brief: Two content gaps with real consequences. (a) 0 of 18 societyEvent
    docs have a slug - confirmed visually in Brad's Studio walkthrough - which is
    why /events/[slug] could not be live-verified in the M2 regression pass (59 of
    62 routes verified, not 62). The Studio has a per-document Generate button. (b)
    0 of 18 have hostSociety, so no host label renders on any event row; the code
    side is already correct at components/ui/EventRow.tsx:48-52. Host assignment needs
    domain knowledge - which society runs which event - so it may need Brad or the
    secretary rather than an agent. Afterwards, re-run the M2 route checks and confirm
    the three previously-skipped routes now render live.
  completed_at: '2026-07-30T20:54:12.021620+00:00'
- id: F6
  name: Prove the CMS end-to-end - a Studio edit changes the site
  status: skipped
  inline_brief: The assertion that actually matters to the client, and the one thing
    still unproven after the previous mission. Edit a field in the deployed Studio,
    publish, and confirm the change appears on the deployed site - exercising the
    full path including the revalidate webhook (app/api/revalidate/, whose revalidateTag(...,
    'max') calls were only ever verified manually with a temporary secret). Note SANITY_REVALIDATE_SECRET
    is EMPTY in .env.local, so the automated check for this silently SKIPs and a SKIP
    reports as PASS - set a real secret in the deployed environment or this proves
    nothing. Verify against the deployed site, not localhost.
  notes: 'Skipped: Superseded by mission cms-loop-and-wiring F1 — root cause diagnosed
    (missing CDN purge on revalidate), fix carried into the new mission'
milestones:
- id: M1
  name: Ship it - get the fix in front of real users
  features:
  - F1
  - F2
  gate: contract
- id: M2
  name: Make the CMS safe and real
  features:
  - F3
  - F4
  gate: contract
- id: M3
  name: Close the content gaps and prove the loop
  features:
  - F5
  - F6
  gate: contract
---










# Mission: CMS activation and deploy

## Why this mission

The previous mission (`studio-next16-upgrade`) fixed the Sanity Studio P0 — Next 16.2.12's
vendored React exports `useEffectEvent`, and Brad confirmed in a live browser that the document
editor renders fields across eight document types.

**But none of that has reached production.** The deployed site still runs the old Next 15 build,
so the Studio is still broken for anyone who isn't running it locally. And even with a working
editor, the site's page copy is not CMS-driven: all six page singletons have zero documents, so
every page renders hardcoded fallbacks while `docs/secretary-cms-guide.md` tells the secretary
to open documents that do not exist.

This mission closes both gaps: ship the fix, then make the CMS something the client can actually
use.

## Milestones

### M1 — Ship it

**F1 — fix the home-page hydration bug first.** `lib/hooks/useCountdown.ts` has the same
`Date.now()`-in-lazy-initializer defect that `ShowCountdown.tsx` had. It is pre-existing (since
2026-06-01), not caused by the upgrade, and it is on the site's primary entry page. We should not
deploy a build carrying a known bug when the fix is already proven — `ShowCountdown.tsx` is the
reference implementation.

**F2 — deploy and verify.** The highest-value feature in the mission. Everything proven so far is
local-only.

**M1 gate:** the deployed Studio opens a document without crashing, and the deployed home page
throws no hydration errors under throttling.

### M2 — Make the CMS safe and real

**F3 — pin the singletons.** Do this before anyone else edits content. Stock `structureTool()`
pins nothing, so a duplicate `homePage` would silently change what the site renders.

**F4 — seed the singletons** from existing hardcoded copy, then correct the secretary guide.

**M2 gate:** each singleton opens directly to one fixed document; the site renders CMS content
rather than fallbacks; the guide matches reality.

### M3 — Close the content gaps and prove the loop

**F5 — event slugs and hostSociety.** Slugs unblock 3 routes that M2 could not live-verify.

**F6 — prove the loop end-to-end.** Edit in the deployed Studio → published change appears on the
deployed site. This is the assertion the client would care about, and it is still unproven.

**M3 gate:** a real edit-publish-appears round-trip on production, plus 62 of 62 routes live.

## Decisions needed from Brad (blocking parts of M2)

These are content/product calls, not engineering ones. F3 should not touch `membersPage` until
the first is answered.

1. **Is a Members page planned?** The `membersPage` schema is registered but no query or route
   consumes it — orphaned. Build the page, or remove the schema?
2. **Is a Judges directory planned?** `Judge` is a registered document type with zero documents,
   found in Brad's walkthrough and missed by the F6 assessment. Same question.
3. **Two dead editable fields** — `homePage.countdownDate` and `contactPage.formRecipients` are
   editable in the Studio but nothing in the code reads them. Wire them up, or remove them?
   Fields that look editable but do nothing will confuse the secretary.
4. **WOSA as a `sponsor`.** "Wild Orchids of Southern Africa" exists as a sponsor document, but
   per `CLAUDE.md` WOSA is a separate partner organisation, not an SAOC sponsor. Deliberate, or
   mislabelled seed data?
5. **National Show content** — ties into the open question about National Show brand architecture
   (master brand + rotating host sub-brand), still pending a committee conversation.

## Constraints

- **Never modify Sanity CORS settings.** Local dev runs on port **3333** — the only whitelisted
  localhost origin. `pnpm dev` hardcodes 3002, so use `next dev --port 3333`.
- **Never run `pnpm build` while a dev server is running** — they share `.next`.
- **Never kill a dev server without checking whether Brad is using it.** This happened during the
  previous mission and interrupted a live Studio session.
- **Serialise tree-mutating agents.** Two agents on one working tree corrupted a gate run last
  mission (Athanor#1321). Only one agent may run builds/servers/gates at a time.
- **`rm -rf` is blocked** by the security hook — use `find <dir> -mindepth 1 -delete`.
- **Do not write durable artifacts to `.agent/memory/scratch/`** — `brain.py wrap-up` deletes it
  at mission close (Athanor#1323, fix pending). Anything that must survive goes in `docs/` or
  `.agent/memory/project/`.
- **Rendered-output and behavioural assertions over source greps.** A check that cannot fail when
  the system is broken is not a check — negative-control every new check script.
- **A SKIP that reports as PASS is a hole in the gate** (Athanor#1322). Watch for it in F6
  especially, where `SANITY_REVALIDATE_SECRET` being empty makes the key assertion skip silently.
- The dataset is placeholder content on a pre-production site — safe to create and edit documents.
  Keep using reversible methods anyway.
- **Scope freeze** still in force on Section 7 schemas and un-built National Show pages pending
  the client scope conversation.

## Notes

- Deploying is outward-facing and affects a real hosting environment. Confirm with Brad before
  the first deploy rather than assuming the mission brief is standing authorisation.
- `docs/next16-upgrade.md` documents the upgrade and its honest limits; `docs/f6-page-singletons.md`
  has the field-by-field singleton mapping F4 needs.
- Backlog also carries pre-existing prettier drift across ~160 files (`pnpm format:check` fails),
  unrelated to this mission.
