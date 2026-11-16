# DECISION NEEDED (Brad) - "Forward" vs "Foreword"
Lee-Ann's request and her doc both say "Forward" (doc title "SAOC FORWARD"). The conventional
word for an author's opening note is "Foreword". The golden uses her spelling:
"Forward by Douglas McMurtry". Recommendation: ship her spelling, ask Lee-Ann once whether she
wants "Foreword". Changing it is one string in components/home/ForewordSection.tsx.

# Source
goldens/source-foreword.txt (6 paragraphs, blank-line separated; 5 body + sign-off "Douglas McMurtry."),
goldens/source-meta.txt. Docx fileId 1tF8g9yL1AIEqaf44ZAAJU0v4XMlJR5OL, modified 2026-10-28T06:03:43.936Z.
Reproduce verbatim: curly quotes, her wording and spelling, no edits. Whitespace is collapsed on compare only.

# Where the 1968 band lives
components/home/MissionBlock.tsx: STATS const (line 6) and the `statList` <dl> (lines 18-31, rendered line 75),
used by app/(marketing)/page.tsx:78. Not in Sanity (homePage has title, heroImages, missionText only).
The identical constant in app/(marketing)/media-kit/MediaKitPageBody.tsx:30 is a different page: leave it.

# Specification
1. MissionBlock.tsx: delete STATS, statList and its render; drop `mb-16` from the two-column grid (no band follows).
2. New server component components/home/ForewordSection.tsx, exported from components/home/index.ts, no 'use client'.
   Copy lives in new lib/data/home-foreword.ts as an array of 6 strings (template literals), exported const.
   No Sanity patch: the copy is fixed text from the Council, not a CMS field; no schema change.
3. page.tsx: render <ForewordSection /> between <MissionBlock/> and <NavCards/>.
4. Layout, existing tokens only (no new colours/fonts/hex): reuse MissionBlock's own pattern - `<section className="py-24 bg-parchment">`
   (use bg-surface/none if adjacent parchment bands would merge; check by screenshot), `saoc-container`,
   `<span className="eyebrow">Forward</span>`, h2 with MissionBlock's serif heading classes reading
   "Forward by Douglas McMurtry", body in the existing `.doc-prose` column (64ch, globals.css:733) one <p> per paragraph.
   Closest existing prose pattern: .doc-prose as used by components/ui/DocumentLayout.tsx. Last paragraph (sign-off) as plain <p>.
5. Mirror to Drive: Lee-Ann's source doc is the foreword docx (unchanged, it is the source). Post a comment on her
   request doc 1WOqmfgeDd-LYLWmUKurAf7K4nE662tdgYte6FGZVfvU via `gws drive comments create` saying the 1968 band
   was replaced by the Forward section (confirm with Brad if the comment is wanted before sending: outward-facing).
6. Screenshot desktop and mobile of the home page for the operator.
