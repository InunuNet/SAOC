# Reboot Context
_Generated: 2026-08-11T18:00Z_

## What happened last session
Session 2026-08-11: read-only audit + client comms + mission scoping. Full Sanity dataset export (104 docs) audited — found homePage.heroImages has 4 items with _key:null (ONLY occurrence in dataset), which is the 'Missing keys' banner blocking home-page hero editing in Studio; fix is Studio's Add-missing-keys button + scripts/seed-sanity.ts generating _key. Mapped every empty content field across society/sponsor/boardMember/judge/show/societyEvent — judge type has ZERO docs, show docs are skeletons. Corrected an earlier wrong claim: /national-show/archive is NOT empty, it renders all 5 past shows and per-year pages return 200, but nothing links to them. Found live defect: footer WOSA link points to wosa.org.za which does not resolve (real site wildorchids.co.za). Studio P0 CLOSED — Brad edits documents in deployed Studio. Brad decisions: brand architecture RESOLVED (SAOC chrome site-wide incl. National Show header, Show branding below the header); POPIA deferred; Scott granted permission to redo logo assets, new Show logo exists, Brad designing SAOC org identity himself, NO branding implementation authorised yet; stop fighting the App Hosting CDN (no purge API exists) and use Sanity Presentation/draft preview for editors instead; stay with Sanity, do not migrate CMS. Ownership clarified: content flows via Lee-Ann to committee; Inunu initiates domain transfer from domains.co.za then registrar emails admin/owner contacts for approval; Brad supplies his own PayFast sandbox creds so dev is unblocked, SAOC must register its own non-profit merchant account for go-live. Wrote client status report documents/SAOC-Status-Report-LeeAnn-2026-08-11.md (fresh — old Gmail draft unretrievable, gws has no drafts subcommand, and was stale). Created mission 2026-08-11-saoc-pages-editable (5 features, 3 milestones) targeting end of week: wire all 8 originally-scoped pages into Sanity for Lee-Ann to self-edit. NO code written this session.

---

## START HERE — Brad's directive (2026-08-11)

**Wire every originally-scoped SAOC page into Sanity so Lee-Ann can edit content herself, then
start replacing placeholder content. Target: end of week (2026-08-14).**

Mission created and active: `.agent/memory/project/missions/2026-08-11-saoc-pages-editable.md`
(5 features, 3 milestones, validated). **Read that mission file — it carries the full brief,
the out-of-scope list, and the settled decisions.** Run `python3 execution/mission.py resume`.

Brad meets Lee-Ann at 10:00 on 2026-08-12 and will issue a revised priority list afterwards.
Re-read the mission against that list when it arrives; the wiring work stands regardless.

**Immediate, before anything else:** Brad may have already clicked Studio's "Add missing keys" on
`homePage.heroImages` ahead of his demo. **Check the data before touching it.** The seed-script
half of that fix (`scripts/seed-sanity.ts` must generate `_key`) is required either way.

## Dataset audit — verified via full export (104 docs), do not re-derive

Well populated: **society** (21, all fields), **award** (6), **showClass** (10), **province** (9),
and the About / Judging / Contact page singletons.

Empty fields — this list is the basis of the content request to Lee-Ann:
- **judge — 0 documents.** Directory is an empty shell.
- **show (6)** — only title/year/location/slug/status, `entries` on 5 of 6. Missing date, venue,
  heroImage, exhibitors, awards, summary, gallery, results, classes. Biggest content gap.
- **society (21)** — missing `description`, `logo`, `website`, `markBadge` on all 21.
- **sponsor (6)** — name only. Missing tier, logo, website, description, active.
- **boardMember (6)** — name + role only. Missing email, photo, order.
- **societyEvent (18)** — missing description, hostSociety, location on all 18; endDate on 5.
- **membersPage** — exists with NO fields set at all (Phase 2, don't chase).
- **nationalShow** — `showDate`, `exhibitorStages` empty.
- **homePage** — `countdownDate` empty; live countdown is fed by `nationalShow.countdownDate`.
- **aboutPage** — `boardIntroText` missing. **award** — `year` missing.

## Live-site facts (verified)

Host `saoc-prod--saoc-webapp.europe-west4.hosted.app` — all 19 routes 200.
`/national-show/upcoming` 307s to `/national-show` (intentional).

- **`/national-show/archive` is NOT empty** (corrects an earlier claim): renders all 5 past shows;
  `/archive/2012`, `/2018`, `/2024` all return 200 — but nothing links to them.
- **Live defect:** footer WOSA link on every page → `https://wosa.org.za`, which does not resolve
  at all (DNS failure). Real site is `wildorchids.co.za`. See [[project_wosa_not_ours]].
- Studio P0 CLOSED — Brad edits documents in the deployed Studio.

## Client comms — drafted, awaiting Brad's review

`documents/SAOC-Status-Report-LeeAnn-2026-08-11.md` — build status, Phase 1/2 sequencing, the
content request list, asks split by owner. Has an internal note at the top to delete before
sending. Written fresh; the unsent Gmail draft `r7069159880970212600` could not be retrieved
(`gws` has no `drafts` subcommand) and was stale anyway.

`documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md` updated this session: B6 POPIA marked deferred,
C1 SAOC brand now Brad's own in-progress work, C3 Show assets resolved (permission granted).

## Decisions — do not reopen

- **Brand architecture RESOLVED:** SAOC branding site-wide including the National Show header;
  everything below the header on `/national-show` rebrands as the Show. Chrome already lives in
  `app/(marketing)/layout.tsx`. Show tokens scope to the subtree, not `:root`.
- **Logo work NOT authorised.** Brad supplies a Claude Design prompt with assets when ready.
  Do not touch `branding/`.
- **Stop fighting the CDN.** No purge API on App Hosting. Use Presentation/draft preview for
  editors; accept public-visitor staleness. Do not restart the F1 CDN-purge investigation.
- **Sanity stays.** No CMS migration.

## Predecessor mission

`cms-loop-and-wiring` — close it out rather than continue. Its F1/F2 verification is superseded
by the CDN decision above.

---

## NEXT PUSH — ticketing pages (planned 2026-08-11 evening, NOT yet activated)

Mission on disk and validated: `.agent/memory/project/missions/2026-08-11-ticketing-pages.md`
(7 features, 4 milestones, ~15 agent calls). **Brad's intent: activate and run this after
compaction.** Activate with `python3 execution/mission.py activate <path>`.

Directive: "knock out all those ticketing pages, not placeholder pages, proper beautiful pages."

Two hard constraints that must survive into implementation:
1. **Sales default CLOSED.** Real prices were never confirmed by the council and the current
   placeholders don't even match the five categories they use. Shipping a live buy button at
   invented prices is the worst possible outcome.
2. **Beautiful = the existing Sage & Paper system in `app/globals.css`, used rigorously.**
   No new tokens, colours or fonts — the no-invented-brand-assets rule still stands.

Closes a real loop: `/admin/door` scans a QR containing the bookingRef and currently has
nothing to scan; `/tickets/confirmation` and `/tickets/cancelled` are live PayFast URLs that
404 today.

### PayFast sandbox — DONE this session, don't redo
Brad's own sandbox credentials in `.env.local` with a custom passphrase matched both sides.
Verified end to end: sandbox accepted a signed payload, minted a payment session, rendered the
payment page ("SAOC 2027 National Show Ticket / R 150.00"). `SITE_URL` added and read at request
time in the checkout route — **still absent from `apphosting.yaml`** (mission F7).

### Sibling mission status
`saoc-pages-editable` — M1 COMPLETE (F1 hero `_key` fixed + live data repaired, gate green on 4
real assertions; F2 audit done, ~75 hardcoded fields). F3/F4/F5 still pending.

**Blocker discovered, applies to BOTH missions:** `scripts/seed-page-singletons.ts` uses
`createOrReplace` with hardcoded literals for every text field across six singletons. Running it
silently reverts any editor's Studio changes. Verified no content was lost tonight (checked via
Sanity history API), but it must become preserve-existing/create-if-absent before Lee-Ann is
handed Studio.

**Awaiting Brad:** was "Judges Training" ever meant to be its own page? No route or component
exists; only a "Becoming a Judge" section inside `/judging`. Blocks a credible F3 estimate.
