# F8 — media kit: "Mark only" and "National Show 2027" behind a picker (MK-1..MK-3)

The committee-gated SAOC /media-kit is 21,157px tall at 390 (backlog L2820). Two sections list every file: "Mark only" (25 cards) and "National Show 2027" (16 logos + emblem). The
Duotone section already solves this with DuotonePicker (a radio group of inks, one panel visible, hash-synced). Same files, same labels, no new copy or assets; section zips stay.

## Specification
1. MK-1 components/media-kit/OptionPicker.tsx (new, 'use client'): props `{ legend: string; name: string; hashPrefix: string; defaultId: string; options: ReadonlyArray<{ id: string; label: string }>; panels: Record<string, ReactNode> }`.
   Copy DuotonePicker's structure and classes (useSyncExternalStore on hashchange, history.replaceState + dispatched HashChangeEvent, `label > input.peer sr-only + span` chip with
   `min-h-[44px] border border-rule bg-parchment px-3 py-2 peer-checked:border-primary peer-checked:bg-bone` and the same focus-visible outline), but with NO swatch and no hex: the options
   are text only. The `<legend>` is `sr-only` (the visible heading is the section's). Selection lives in the hash as `#<hashPrefix>-<id>`; every panel is rendered, wrapped in
   `<div data-option={id} className={selected ? <panel grid classes> : 'hidden'}>`. Do not touch DuotonePicker.tsx.
2. MK-2 Mark only. Options (id: label, in this order): colour: "Full colour"; greyscale: "Greyscale"; indigo: "01 Indigo"; prussian: "02 Prussian"; viridian: "03 Viridian"; violet:
   "04 Violet"; teal: "05 Teal"; plum: "06 Plum" (the manifest's rendition_label / ink_label, already approved wording). hashPrefix `mark-only`, defaultId `colour`, legend "Mark only".
   Panel for an option = that option's existing cards, unchanged KitCard props: its mark(s) from `kit.marks` (Greyscale has two: greyscale and greyscale-reversed, grounds as `markGround` now),
   its light chip and its dark chip from `kit.chips.light` / `kit.chips.dark` (layout="chip", same title). So 3 cards per panel, 4 for Greyscale. Keep the zip, and the "Vector masters..." paragraph below.
3. MK-2 National Show 2027. Options: full-colour: "Full colour"; full-colour-reversed: "Full colour reversed"; grayscale: "Grayscale"; ink-olive: "Ink olive"; ink-purple: "Ink purple"; ink-violet: "Ink violet";
   reversed-gold: "Reversed gold"; reversed-white: "Reversed white" (variant_label). hashPrefix `national-show`, defaultId `full-colour`, legend "National Show 2027". Panel = the colourway's horizontal card then its vertical
   card (KitCard, ground via `nosGround` as now). The emblem card (`kit.nationalShowEmblem`, png + svg) stays after the picker, outside it. Keep the zip.
   The hash `#national-show-<id>` is distinct from the section anchor `#national-show` (jump nav), so deep links to the section still work; same for `#mark-only`.
4. Extract the page body to app/(marketing)/media-kit/MediaKitPageBody.tsx (server component, no props; everything currently inside `MediaKitPage` after the gate). KEEP IT IN THAT DIRECTORY:
   contracts/checks/media-kit-complete/check_manifest_page.py and check_layout_static.py scan only app/(marketing)/media-kit and components/media-kit. page.tsx keeps
   `await requireMediaKitAccess('/media-kit')` first and then renders `<MediaKitPageBody />`; the body does not call the gate.
5. MK-3 fixture: app/media-kit-fixtures/page.tsx (new): `export const dynamic = 'force-dynamic'`; `if (process.env.MEDIA_KIT_FIXTURES !== '1') notFound();` then `<MediaKitPageBody />`.
   No gate call, no admin session, no bypass added anywhere; flag only set by the rendered check, in no deploy or example env file.
6. Target: page height at 390 under 9,000px. Docs: docs/polish-wave-2-f8-media-kit-pickers.md naming MK-1..MK-3, the text-only decision and that the NOS-host media kit is unchanged.

## Regression checks (run in the worktree root; they read relative paths)
python3 contracts/checks/media-kit-complete/check_manifest_page.py, check_layout_static.py and check_inventory.py must stay green. If a pinned string moved, fix the code, not the check.
(check_layout_browser.mjs is stale: it predates the admin gate and cannot reach /media-kit; do not run it, do not edit it.)

## Checks
f8-kit-static.mjs and f8-kit-rendered.mjs (flagless 404; at 4 viewports radios, labels, defaults, per-choice card counts 3/4 and 2+emblem, hash, deep link, every manifest href still in the DOM; <9000px at 390).
