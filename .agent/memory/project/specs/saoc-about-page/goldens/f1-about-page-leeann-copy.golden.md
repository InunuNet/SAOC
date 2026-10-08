# Golden — F1: /about rebuilt on Lee-Ann's copy (mission saoc-about-page)

Brad, 2026-10-08, verbatim: "SAOC About has copy from Lee-Ann not whats on local
host new mission use the copy, use claude design skill lets finish the about
page... Lets keep it local till approved by me then we push to beta... faster
to fix.. shorter missions..."

Pinned base commit (out-of-scope regression checks diff against this, never
the literal string `HEAD`): `67d355812974f417fc72edb75ecd5bc1deda7a11`.

## 1. Copy source (council-supplied, verbatim)

`content/drive-source/SAOC /2. About/About page - South African Orchid
Council/v1.0/content.md` — synced from Lee-Ann's Drive doc "About page - South
African Orchid Council.docx" (Drive file id
`1pNOqTdRbtSxZzClUPWX3TLae0zrU4cCI`, md5 `c939ef9c921b701d80962cccfe691684`,
Drive-modified 2026-09-03, synced 2026-10-08 by `execution/drive_docx_sync.py`).
Per `docs/rules/no-invention.md`'s per-block provenance table, every block
sourced from this file is `council-supplied`.

Shape: one bold H1-style title line, then 7 paragraphs, 8 `**bold**`-marked
spans total (the whole title, plus 7 spans inside the body — see §3).

**Do not hand-transcribe this text into the implementation or into a check
fixture.** The check script (`check-content-verbatim.mjs`) reads
`content.md` directly at runtime, strips `**` markers to get plain text, and
extracts the bold spans by regex — so the single source of truth stays the
Drive-synced file itself, not a copy that could drift from it (e.g. the
document's own typographic apostrophes in "Council's" / "Africa's" must not be
silently retyped as straight quotes by a human reading this golden). The dev
agent implementing F1 should do the same: import or fetch the paragraph text
at build/render time rather than retyping it into JSX, if practical; if the
design requires literal JSX text nodes, copy-paste directly from
`content.md` (never retype) to avoid introducing a mismatch the check can't
catch (a retype that happens to match ASCII but drops a diacritic, etc.).

## 2. Design structure (approved handoff, implemented faithfully, not revised)

Source: `design/design_handoff_saoc/src/pages-interior.jsx` `AboutPage()`
(lines ~20-168) + `design/design_handoff_saoc/screenshots/02-about.png`.
Section shell to reuse, in order:

1. `PageHero` (existing `components/ui/PageHero.tsx`) — full-bleed image,
   eyebrow pill, serif H1, optional lede.
2. A body/content section (two-col "origin story" in the handoff) — adapted
   to hold Lee-Ann's full verbatim text (see §4 decision on this slot).
3. A stats/facts band (handoff has no literal stats band on About, but Home's
   mission-block stats + the current `page.tsx`'s `HERITAGE_STATS` establish
   the site's own stats-band pattern already in use on this page — kept as a
   slot, re-sourced per §4).
4. `PhotoBand` (existing `components/ui/PhotoBand.tsx`) — unchanged caption,
   real fact.
5. "Our history" timeline slot (handoff's dark `timeline__rail` section) —
   removed for F1, see §4.
6. Board/committee section (existing `BoardGrid` + Sanity `boardMembersQuery`
   wiring) — unchanged, out of scope.
7. WOSA partnership note (existing static section) — unchanged, kept per
   Brad's explicit instruction (see §5).
8. `CTASection` (existing, reused site-wide) — unchanged, generic navigation
   pattern, not page-specific factual content.

Do not restructure routes or invent new sections beyond what the handoff's
About layout and the existing `page.tsx` already establish — implement this
shell faithfully (per `CLAUDE.md`'s Design Handoff Workflow), filling it with
Lee-Ann's copy rather than the handoff's own placeholder prose, which is
itself invented (the handoff's "28th of July 1968" origin-story paragraphs
cite specifics — "eighteen National Orchid Shows," "21st World Orchid
Conference to Sandton in 2014," "overhauled our judging system onto a
regional model in 1990" — that are NOT in Lee-Ann's `content.md` and must not
be ported over just because they live in the approved visual shell. The
design handoff is binding for layout/type/spacing/components, never for
prose.)

## 3. Exact bold spans in `content.md` (for the check script's expectation, written here for human review only — the script derives this list itself)

1. Title: "About the South African Orchid Council"
2. "South African Orchid Council (SAOC)"
3. "1968" (¶1)
4. "28 July 1968" (¶2)
5. "Cape Orchid Society, Natal Orchid Society, Transvaal Orchid Society and
   Orchid Society of the Northern Transvaal" (¶2)
6. "15 people were registered as Accredited SAOC Judges" (¶3)
7. "education, judging, exhibitions, hybridisation, conservation and the
   dissemination of orchid knowledge" (¶4)
8. The closing clause starting "bringing orchid enthusiasts together..."
   through "...valued and conserved for future generations." (¶7)

Bold spans must render as `<strong>` (or `<b>`) — real semantic emphasis, not
a CSS-only bold span — both because that is what the source document encodes
and because the verbatim check greps raw HTML for the phrase inside a
`<strong>`/`<b>` tag pair.

## 4. Per-slot gap decisions (handoff slots Lee-Ann's copy doesn't fill)

No invention: each decision below is either (a) derived strictly from a fact
stated in `content.md`, quoted exactly, or (b) an explicit removal/deferral,
named as such — never a silent fabrication. Per `docs/rules/no-invention.md`
§"Content provenance," anything not `council-supplied` must be visibly
flagged; where a slot is simply dropped rather than filled with a flagged
placeholder, that is because the dropped content would otherwise read as
`council-supplied` when it is not (the flagged-placeholder convention is for
slots where SOME on-page marker is more useful than no slot at all, e.g.
board-member names where a name must appear now and get swapped later — see
`ProvisionalFigure.tsx` / `StatusMarker.tsx` for that pattern elsewhere in
the repo. History/stats are both already covered by real facts and a removal,
not a swap-later placeholder, is the honest move here).

| slot | handoff had | decision | source |
|---|---|---|---|
| Hero heading | "A federated body of growers, since 1968." (invented paraphrase) | Lee-Ann's own title, quoted exactly: **"About the South African Orchid Council"** | `content.md` title line |
| Hero eyebrow | "Our Heritage" | kept — a structural section label (design-system pattern used site-wide: "Our mission," "Our committee"), not a factual claim | n/a (UI chrome) |
| Hero lede | "Four societies met in Bloemfontein on the 28th of July 1968..." (paraphrase, invented specifics) | **removed** — `PageHero`'s `lede` prop is optional; no short-form sentence in `content.md` can be lifted verbatim without truncation, and a paraphrase is exactly the invention this feature removes | — |
| Hero background image | `D.images.yearbook` (handoff's own asset, not in this repo) | kept **unchanged**: existing `/images/orchid-violet.jpg` (already in repo, already used on this page) | repo asset, visual decision not content |
| Body/content section | Two-col "origin story" prose (invented: Sandton 2014, 1990 regional-model overhaul, yearbook history) | **replaced in full** with Lee-Ann's 8 blocks (title already used in hero, so render the 7 paragraphs here) rendered verbatim, in source order, bold spans as `<strong>` | `content.md` ¶1-¶7 |
| Stats/facts band | Handoff: none on About; current `page.tsx`'s `HERITAGE_STATS` = 1968 / 1990 / 18 / 21 (the 1990, 18 and 21 values are NOT in `content.md`) | **re-derived to exactly 4 facts stated in `content.md`**: `1968` "Founded", `28 July 1968` "Founding date, Bloemfontein", `4` "Founding societies", `15` "Accredited SAOC Judges, Sept 1968" | `content.md` ¶1-¶3 |
| PhotoBand caption | n/a (handoff has a figure/figcaption, different image+caption) | kept **unchanged**: "Est. 1968 · Bloemfontein" — already a real fact matching `content.md`, not touched by this feature | already-correct, pre-existing |
| "Our history" timeline | Handoff's dark `timeline__rail`: 1968 / 1974 / 1990 / 2014 / 2024 / 2027 — only the 1968 entry is real, the other five are invented | **section removed for F1.** `content.md` supports only 2 dated facts (28 July 1968 founding; September 1968 by-laws + 15 judges), both already covered by the stats band and the body paragraphs — a timeline with 2 real nodes and nothing else reads as thin rather than as history, and padding it with the handoff's other 5 invented nodes is exactly the fabrication this feature exists to remove. `app/(marketing)/about/page.tsx`'s `FALLBACK_TIMELINE` constant and its `<Timeline>` render are deleted for this page (the `Timeline` component itself, `components/about/Timeline.tsx`, is not deleted — it's a generic, reusable component with no About-specific content baked in, and other pages or a future About revision may still want it) | — |
| Board/committee section | Handoff: static `D.board` array with name/role/society/tenure | kept **unchanged** — existing Sanity `boardMembersQuery` + static `staticBoard` fallback, which already carries its own "Awaiting confirmation" provenance marker (`BoardGrid.tsx:42-46`). SAOC's committee roster is a separate data source from this About-page copy brief and out of scope for F1 | out of scope |
| WOSA partnership note | n/a (handoff has no such note) | kept **unchanged** — see §5 | out of scope |
| CTASection | n/a | kept **unchanged** — generic navigational pattern reused across other interior pages (Societies, Judging, Events), not page-specific factual content | out of scope |

### Mission/pillars Sanity override

`page.tsx` currently fetches `aboutPageQuery` (`title`, `pillars` portable
text, `timelineNodes` portable text, `boardIntroText`) and falls back to
invented static prose when Sanity has nothing. For F1: the `pillars` and
`timelineNodes` CMS-override branches are **removed** along with their
invented static fallbacks — Lee-Ann's `content.md` is now the body content,
rendered as a plain server-rendered block, not CMS-editable through this
query shape. `boardIntroText` is unaffected (feeds the unchanged board
section). Re-wiring About's body copy through Sanity for committee
self-editing is a plausible future feature, not built now — name it rather
than half-build it.

## 5. Open questions for Brad (name the gap, don't resolve it silently)

1. **Conservation language vs. `CLAUDE.md`'s WOSA scope boundary.**
   `content.md` ¶1, ¶4, ¶5, ¶6 and the closing ¶7 all use the word
   "conservation" in SAOC's own institutional voice (e.g. ¶5: "the SAOC
   therefore recognises that the future of orchids depends not only on their
   successful cultivation, but also on understanding, protecting and
   conserving their natural heritage"). Per Brad's standing instruction
   (relayed in this mission's brief): this is Lee-Ann's official copy, so it
   is kept verbatim, in full, not trimmed. It is **not** the kind of content
   `CLAUDE.md`'s "SAOC is not wild orchid conservation" rule is aimed at —
   that rule is about SAOC *producing* wild-orchid-ID/habitat content
   (SAOC's own new copy), not about reproducing Lee-Ann's existing
   institutional-history text verbatim where the council describes its own
   founding concerns. The existing WOSA-redirect note at the bottom of the
   page (static, "SAOC focuses on orchids in cultivation...") stays in place
   unchanged as the scope clarifier `CLAUDE.md` asks for. Flagged for Brad's
   eyes on review, not blocking: is the existing WOSA note's wording still
   right now that the body copy above it also talks about conservation in
   SAOC's own voice? Two things can both be true (her copy mentions
   conservation; SAOC's remit is cultivation) without a contradiction, but
   it's his call whether the note needs a line adjusted.
2. **"21 affiliated societies" / "18 national shows" stats.** These are real,
   separately-verifiable facts (the live `societies` Firestore collection
   count; the national-show archive) — but they are not in `content.md`, and
   folding a Firestore-derived "today" count into a band whose other 3 values
   are drawn from Lee-Ann's 1968-founding copy would mix two different
   provenance classes into one visual unit (exactly the page-level-laundering
   failure `docs/rules/no-invention.md`'s per-block provenance section warns
   against). These stats already exist elsewhere (Home's own stats band) —
   is a *second*, differently-sourced stats band wanted on About, and if so,
   visually separated from the history band so the two provenances don't
   blur? Not built in F1; name it, don't guess.
3. **A fuller "Our history" timeline.** Removed for F1 per §4 above. If
   Lee-Ann or the committee later supplies more dated milestones (judging
   standardisation year, national-show count/locations, incorporation date),
   the timeline slot can return, following the same per-block provenance
   discipline. Not scoped into F1.

## 6. Scope

In scope: `app/(marketing)/about/page.tsx` and any new About-specific
component files created under `components/about/` or
`app/(marketing)/about/`. Nothing else.

Out of scope (checked byte-unchanged against an on-disk checksum-manifest
baseline taken 2026-10-08,
`goldens/fixtures/f1-out-of-scope-baseline-checksums.txt` — not a
git-diff-against-commit check, since `branding/` and `comms.md` already
carried pre-existing uncommitted changes and `components/chrome/**` is being
actively edited right now by the unrelated `saoc-emblem-lockup` mission; see
`check-out-of-scope-unchanged.sh`'s header comment for why): `components/chrome/**`,
`app/globals.css`, `branding/**` (Brad's active design workstream), `comms.md`.

## 7. Delivery gate

Phase 1 (this session, local draft): source/shell/node assertions only, plus
Playwright screenshots of `http://localhost:3002/about`. **No `pnpm build` in
phase 1** — the dev server at :3002 is live and hot-reloading for Brad's
review; a production build would compile into the same `.next/` directory the
dev server is using and can corrupt its running state (confirmed pattern from
the sibling `saoc-emblem-lockup` mission). No commit, no deploy, until Brad
approves the local render.

Phase 2 (post-approval only, run after Brad approves and team-lead
commits+deploys): `pnpm build` as a real build gate, `codex_qa` adversarial
review of the diff, `browser_deployed_check` against
`beta.saoc.co.za/about`. `gws_inbox_check` is **not applicable** — this
feature touches no email path, sends no notification, and has no inbox to
check; there is nothing to run, not a check that's being skipped.
