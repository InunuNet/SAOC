# F1 — Consolidated question list for Lee-Ann / Brad

Deliverable, not a footnote. 11 items — @analyst's 7 (Q1-Q7), plus 4 added by
@architect (Q8-Q11). None of these are guessed at anywhere in this contract or
its goldens; every affected coverage-map entry is marked `provisional` or
`blocked-on-leeann` and cites the relevant question id.

1. **Show contact routing.** Her own doc (`2027 Show Contact information.docx`)
   lists 5 candidate audiences (visitors, Symposium, WOSA Conference, Vendors,
   Workshops/outings) and asks herself "Or... do we just have one? Enquiries
   at....." with no answer. Cannot build `/national-show` contact copy without
   this. (coverage map: `nos-18-contact`)
2. **Sections 8, 9, 10, 14, 16.** Confirmed genuinely absent from Drive, not a
   listing bug (independently re-verified). Reserved for future content, or
   simply renumbered away? (coverage map: `numberingGaps`)
3. **International Exhibitors (folder 5).** Completely empty, no doc, yet already
   has a dead nav entry (`/national-show/exhibitors/international`). Is this
   coming, or should the nav entry be removed until it exists? (coverage map:
   `nos-5-international-exhibitors`)
4. **RESOLVED, not a question for Lee-Ann.** SAOC Symposium doc content — the
   earlier "native Google Doc, wrong fetch subcommand" characterisation was
   incorrect. Re-verified 2026-09-09: `Symposium Theme` is a real `.docx`
   (`mimeType application/vnd.openxmlformats-officedocument.wordprocessingml.document`),
   fetched fine with the same `drive files get alt=media` route as every other
   `.docx` in the tree. Snapshotted at
   `docs/leeann-source/symposium-theme_2026-09-09.md`. (coverage map:
   `nos-6-saoc-symposium`)
5. **FAQ doc is truncated in Drive, confirmed unrecoverable on our side.**
   Verified 2026-09-09: our download of `17.1 Frequently asked
   questions.docx` (`1soLx8vKPs1jQBnYFTu88_LWxjzRFTHsf`) is byte-identical to
   Drive's own reported md5 (`27f4911dc51dfada43b242104b627c0e`, 23731 bytes)
   and has a valid `PK\x03\x04` magic number with 16 readable local file
   headers, but the End-of-Central-Directory record is missing — the zip
   stream ends mid central-directory, so no reader can extract it. This is not
   a tooling or re-download problem; the source file itself is an incomplete
   write on her end. Ask her to re-save/re-export, or supply as a native
   Google Doc instead of an uploaded `.docx`. (coverage map: `nos-17-faq`)
6. **Website Information Form completeness.** Its stated deadline (14 Aug 2026)
   had already passed when screenshots were captured (1 Sep 2026) — unknown how
   many of the 21 societies actually responded. Gates how much of
   `/societies/[slug]` can be real vs. still-placeholder per society. (coverage
   map: `saoc-3-societies`)
7. **Programme (folder 11) and Workshops (folder 12), both empty**, despite the
   700-line ticketing spec (13.1) containing workshop/field-trip line items. Is
   that spec doc the intended source for Programme/Workshops page copy too, or is
   dedicated copy still coming? (coverage map: `nos-11-programme-of-events`,
   `nos-12-workshops`)
8. **Provisional-content presentation vs. the design handoff's letter.** The
   handoff's `SKILL.md` specifies a literal `[bracket]` placeholder convention in
   prose; the five shipped components use a bordered mono-tag badge instead
   (token-compliant, but not a literal implementation of the bracket rule). Does
   the badge pattern satisfy the design system, or does Brad want literal
   bracket-style copy? See `f1-provisional-unification.md`. Design-system
   compliance call, not an engineering one — do not pick without him.
9. **`/media-kit` status.** Not one of Lee-Ann's 20 named sections at all (unlike
   Sponsors, which is #15 with just an empty folder) — our own invention with no
   coverage mandate either way. Keep as a value-add, or fold into
   Sponsors/About?
10. **The unfinished Show Contact doc, restated as its own item** (distinct from
    Q1's routing question): the doc itself is explicitly incomplete prose, not
    finished copy — confirming this is the correct current state (not a partial
    upload or an access issue on our end) before treating `/national-show`
    contact as fully blocked.
11. **Unnumbered top-level spec doc** in the National Show Drive folder (present
    alongside the 13 numbered subfolders — the "14 folders, 13 numbered + 1"
    count). What is it, and what page/section, if any, does it correspond to?
    Not yet characterised by any research pass. (coverage map:
    `unnumberedEntries[0]`)
