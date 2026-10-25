# Polish wave 2 F8 — media kit pickers (MK-1, MK-2, MK-3)

The committee-gated SAOC `/media-kit` was 21,157px tall at 390 because "Mark only" (25 cards) and
"National Show 2027" (16 logos) listed every file. Ruled by NOS Design 2026-10-25.

## MK-1 — OptionPicker

`components/media-kit/OptionPicker.tsx`: a text-only radio group in `DuotonePicker`'s markup and
tokens (44px chips). The selection lives in the hash as `#<prefix>-<id>`; every panel is rendered and
all but the selected one are `hidden`. The selected chip is bold with a ring, so it is not colour
alone. The legend is visually hidden. `DuotonePicker` is untouched.

## MK-2 — the two sections

- Mark only: Full colour, Greyscale, 01 Indigo to 06 Plum (the manifest's labels), each panel its
  mark(s) plus light and dark chips. Hash prefix `mark-only`.
- National Show 2027: eight colourways, each panel its horizontal then vertical logo. Hash prefix
  `national-show`. The emblem card stays after the picker.
- Section zips and the "Vector masters" note stay. Same files and labels, no new copy or assets.
- Options are text only: the NOS colourways have no swatch colours in the data and none are invented.
- The NOS-host media kit is unchanged.

## MK-3 — structure and fixture

The page body moved to `app/(marketing)/media-kit/MediaKitPageBody.tsx`; `page.tsx` keeps the gate
(`requireMediaKitAccess`) and renders it. `app/media-kit-fixtures/page.tsx` renders the body for the
rendered check: `force-dynamic`, 404 unless `MEDIA_KIT_FIXTURES` is `'1'`, no gate call and no auth
bypass, and the flag is in no deploy or example env file.

## Round 2 and 3 (NOS Design) — merged Full colour · Greyscale picker

The separate Full colour and Greyscale sections are one section, `id="lockups"`, headed
"Full colour · Greyscale" (the two existing headings joined by a middle dot; the word "Lockups" is
not shown). `components/media-kit/LockupPicker.tsx` holds a family toggle (Full colour, Greyscale)
and four variant radios labelled with the manifest's `lockup_label` strings verbatim. One preview
card follows both; all eight cards are rendered and seven are hidden, so every download stays in the
DOM. Selection is written as `#lockups-<family>-<variant>`. Zero-size anchors `#full-colour` and
`#greyscale` keep the "On this page" links working and preselect the family. The section holds ONE zip link that follows the family toggle (WCAG 2.4.4): its visible text stays
"Download this section (zip)", while its href, size line and accessible name
(`aria-label="Download this section (zip) — <family>"`) switch with the family. Without JavaScript the
server renders the default family's (Full colour) zip, and a `<noscript>` link keeps the Greyscale zip
reachable; the hash preselect and the toggle need JavaScript, as the other pickers do.
Duotone and Usage are unchanged.

Measured page height at 390: 9,542px (target at most 10,500px; 11,591px before the merge). At 1440:
6,233px. Every visible preview image loads once scrolled into view.
