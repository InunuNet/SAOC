# NOS design system — FINAL (received 2026-09-10 from Codi, saoc-nos-design-9d)

Brad instructed this. Scope: **the NOS subsection only**, never SAOC generally.

## Where the rules live — read in this order
1. **THE CANVAS IS THE DESIGN.** Claude Design project `262aba20-788b-4930-b724-255600ffd9d3`.
   `readme.md` is the grammar (binding); `guidelines/*.html` binding; `tokens/*.css` are VOCABULARY
   ONLY, not the system; `ui_kits/event-website` is the handover kit.
   **Read the canvas first, always. Do NOT re-derive a design system from prose** — that was done
   once here and Brad's verdict was "horrible."
2. **Rulings file** annotates and constrains the canvas. Canonical copy is in Codi's workspace.
   **OUR MIRROR `.agent/memory/project/design/nos-design-rulings.md` IS STALE (2026-09-08)** —
   missing R14-R17 and the R3 reversal. Never edit the mirror to match what got built; the mirror
   never leads. Replacement text requested 2026-09-10.
3. Approved reference renders — home restyled:
   `https://claude.ai/code/artifact/d068d657-558e-4d1a-ab8d-c9e8dbbc0a51`
   foundations: `https://claude.ai/code/artifact/24038fdc-defd-45d4-86ac-5512bd3baf1c`

## Scope boundary
NOS is a subsection, not its own site. SAOC chrome (header, primary nav, footer) is inherited
UNCHANGED; NOS identity begins BELOW the SAOC header. R12 retired the canvas kit's own SiteHeader —
it does not ship. Never push NOS radii, shadow, palette or type into SAOC pages.

## The delta our mirror is missing
- **R17 (new)** — where R1/R2 contradict the canvas, **THE CANVAS WINS**. R1/R2 predate the canvas.
  Radii: **10px controls/small surfaces, 16px cards/panels — NOT 2px, NOT 0**. Elevation:
  **purple-tinted shadow, NOT borders**. Still standing from R2: pill radius is reserved to eyebrow
  pills (never a CTA); a primary action is a button and never decays into an underlined text link;
  any radius change re-measures the focus ring. Still standing from R1: NOS identity travels in
  colour, type and imagery; structure and chrome stay SAOC's.
- **R3 — REVERSED.** The supplied lockup IS the h1. The wordmark already reads NATIONAL ORCHID SHOW,
  so a typeset headline duplicated it. Put the artwork inside the h1 with alt text so it stays a real
  heading. Do NOT typeset the show name above or below the mark.
- **R14 — Type.** Cormorant Garamond and Jost are **RESERVED TO THE WORDMARK** and appear nowhere
  else; the lockup ships as artwork so neither face loads on a content page. Display face is
  **Fraunces** (keep the optical-size axis low at display sizes). Body face is **Karla** — chosen
  because anything geometric reads as Jost and pulls the eye back to the wordmark. Eight official
  colourways at `/Users/vetus/ai/SAOC/branding/National Show 2027/Logo`, two orientations each.
  **Never re-typeset and never re-tint the lockup.**
- **R15 — Hero scrim is NEAR-BLACK `#0B0A14`, not purple.** A royal-purple wash over a magenta
  Phalaenopsis drove both to the same hue and turned the bloom to mud — the fault was the ground, not
  the photograph. ONE horizontal layer, no vertical layer, alpha 0.94 at the text column / 0.44 at the
  midline / 0.18 at x=75% / effectively clear at the edge. **The photograph stays as shot** — a live
  monochrome wash is a filter by another name and fails the brand photography guideline. Keep
  `/images/orchid-dark.jpg` until Lee-Ann supplies a cleared replacement. If a headline fails 4.5:1,
  **R4 applies: the crop moves, not the alpha**, and that escalates to Codi.
- **R16 — Never print the same photograph for different things.** The live page repeats one identical
  image across five past editions (2024/2021/2018/2015/2012); on a real council's site that reads as
  fabricated and the cost is trust. **Set past editions typographically. No image beats a false one.**
  This is R7 applied to pictures.

## Standing rules that bite on every new page
- **R13** — a card grid's column count follows the item count; never orphan a single card on its own
  row. Five cards → 3 columns; ten cards → 4 columns, not 5.
- **R11** — unconfirmed copy is disclosed in ONE anatomy at TWO WEIGHTS, with this EXACT wording:
  "This text is an AI-generated placeholder. It has not been written or approved by the South African
  Orchid Council, and it may be inaccurate. Final copy is still to be supplied by the Council."
  **Assertions measure RENDERED TEXT, never a fixed string.**
- **R9** — focus is a solid outline. Opacity is not a contrast instrument.
- **R8** — status colour is functional and DECLARED, never borrowed from a palette token. Binding a
  state to `--muted` or `--primary-800` inherits whatever that name resolves to in whichever layer
  renders it, and it fails silently.
- **R7** — copy is not invented.

## How to work
Start from the canvas; change only the thing under discussion. **New design questions escalate to
Codi — they are not resolved at the keyboard, and an architect does not re-derive a ruling.**
`127.0.0.1:8765` is no longer maintained; never cite it as live evidence.

## CONFLICTS WITH WHAT WE HAVE ALREADY BUILT — resolve before the next page ships
1. **Our `ShowPageProse` R11 implementation is a chip → one sentence → dashed 2px rail.** R17 says
   2px radii are stale and elevation is shadow not borders, and R11 now specifies exact wording and
   "one anatomy at two weights". Our built form predates both. **Do not assume it still conforms.**
2. Our M4 contract cites R11/R12/R13 against the stale mirror. Re-cite against the replacement text.
3. R13 as restated here matches the span tie-break we encoded (final card spans the remainder,
   never a partial row, never centred, c>=3, c=2 exempt by ruling) — confirm with Codi that the
   tie-break survives, since this restatement does not mention it.

---

# ANSWERS + R18 (received 2026-09-10, Codi / saoc-nos-design-9d)

## Mirror transfer — INBOUND, verify before use
Courier sends the replacement in ordered parts headed
`NOS RULINGS MIRROR REPLACEMENT — PART n OF N — lines A-B of 709`. Concatenate in order.
Landed file MUST be **exactly 709 lines**, sha256
`cd4efc0f4b4b6ed01790f288f29cc6c1c4c504b18cb8f4ea51debbe502f7cee7`.
Verify with `wc -l` and `shasum -a 256`. **If either check fails: do not use the file, do not repair
it, report the mismatch to Codi.** Longer than promised because R18 and an R13 renumbering went in.
R13 had two clauses numbered 6; the cap-of-4 clause is now clause 7. No wording changed.
Destination: `.agent/memory/project/design/nos-design-rulings.md` (replaces the stale 2026-09-08 mirror).

## Answers to the three conflicts
1. **`ShowPageProse` — ASSUME NON-CONFORMING. REBUILD, DO NOT PATCH.** The dashed 2px left rail dies
   twice: R17 retires 2px and retires borders as elevation, and a **dashed rule is the
   missing-thing/drop-zone anatomy — the wrong semantic** before the radius argument even starts.
   R11's final form specifies exact wording + one-anatomy-two-weights, which ours predates.
   "Patching a component toward a rule it was never built for is how a design system accumulates
   fossils."
2. **R13 span tie-break STANDS.** Keep D67/D86/D87/D88. It is clause 6 of R13 in the new text.
   When no c avoids the orphan: keep the content ceiling, final card spans the remainder — never a
   partial row, never centred. Binds c >= 3; c = 2 exempt by ruling; c = 1 cannot arise.
   **GENERAL PRINCIPLE: a ruling is retired only by explicit supersession, never by absence from a
   recap.** A summary omitting a rule does not supersede it.
3. **Re-cite the M4 contract once the file lands.** A green gate against stale citations is not
   conformance.

## R18 — THE THREE EMPTY LISTINGS (`/sa-exhibitors`, `/international-guests`, `/sponsors`)
**An empty listing is a DATED PROMISE. Never a void, never a placeholder record.**
This is NOT R11 — R11 discloses copy that exists and is unverified; R18 covers records that do not
exist at all. The canvas had no treatment; this is the treatment.

- **The routes still ship.** A linked page that 404s is worse than an honest empty one, and the
  section nav counts them.
- **No "No results found."** That belongs to a search/filter that returned nothing — it tells the
  reader their query failed. Nothing failed; the content has not landed.
- **No skeletons, no ghost cards, no shimmer.** A greyed grid asserts a shape and a count that do not
  exist; shimmer claims the page is loading. Both lie about state, and the second is a lie the
  browser will never resolve.
- **No imagery.** R16 forbids a borrowed photograph standing in for a record; a decorative orchid
  dropped in to fill the hole is the same act with a thinner excuse. Typographic until real records exist.
- **Real structure stays visible** — h1, intro, section nav, anything not record-dependent. **What must
  NOT render is the grid:** an empty grid with no children is not structure, it is absence with a class name.
- **Where the grid would sit, ONE PANEL.** Canvas card anatomy — 16px radius, purple-tinted shadow,
  **never a dashed outline**. Two elements in order: (a) WHAT will be listed, in the page's own nouns
  ("South African exhibitors", "our international guests", "the 2027 sponsors"); (b) WHEN — or, if no
  date is known, **the gate in words**: "...once entries close", "...as sponsors are confirmed".
  **R7 binds: an invented date is invented copy. Never a count** — "40+ nurseries expected" is a
  promise nobody made.
- **A next action ONLY where one exists.** `/sponsors` has a conversion job → button.
  `/sa-exhibitors` takes the exhibitor-entry action IF that route is live. `/international-guests`
  gives the reader nothing to do → **no button**. A CTA manufactured to balance a layout is the R2
  corollary inverted.
- **Filtered-to-zero is a DIFFERENT component.** If these pages grow filters, "no matches — clear
  filters" is a distinct state with a distinct action. **Never reuse the R18 panel:** one says
  "not yet", the other says "not with those filters".
- **R13 does not apply at n = 0.** The panel is not a card in a collection. When the first real record
  lands the grid returns and R13 governs from n = 1.
- If a page's own intro prose is itself AI placeholder, **R11 applies to that prose in its own
  anatomy, independently of the R18 panel. Do not stack the two.**

---

## MIRROR TRANSFER FAILED VERIFICATION — 2026-09-10. The mirror is NOT landed.

All 4 parts were received and transcribed to `.tmp/sandbox/mirror-sync/part{1..4}.md`.
Assembled result: **707 lines**, sha256 `27fb4501ef3ee5c055d96b59899fb45a9d1721bb3a5e6afeb910ac2223c9a6fd`.
**Expected: 709 lines, sha256 `cd4efc0f4b4b6ed01790f288f29cc6c1c4c504b18cb8f4ea51debbe502f7cee7`.**

Per Codi's instruction the file was NOT used and NOT repaired. The assembled draft is parked as
`.tmp/sandbox/mirror-sync/UNVERIFIED-DO-NOT-USE-assembled.md`. `.agent/memory/project/design/nos-design-rulings.md`
still holds the STALE 2026-09-08 mirror (R1-R10 only) and remains NOT AUTHORITATIVE.

Likely cause is on our side, not theirs: the parts arrived as chat messages and were transcribed by
hand, so whitespace at the part boundaries is not byte-faithful. Saved part line counts were
180/197/211/118 against declared ranges implying 181/198/212/118. Re-transfer should go to a FILE,
not through message text, if that is possible for them.

**Until a checksum-verified mirror lands: cite R11-R18 by number against Codi's copy, never ours.**

### CONTRADICTION FOUND while reading the parts — needs Codi's ruling before ShowPageProse is rebuilt
- **R11 clause 1** (in the transferred text): "A dashed 2px rail on the leading edge... Dashed,
  because provisional... **This is what stops the notice degrading into fine print, and it is the
  part not to negotiate.**"
- **Codi's message the same day**, answering our conflict #1: the dashed 2px rail "dies twice over:
  R17 retires 2px and retires borders as elevation, and a dashed rule specifically is the
  missing-thing/drop-zone anatomy — the wrong semantic". And **R18 clause 5** independently says
  "never a dashed outline (a dashed box is the drop-zone/missing-file anatomy, and R17 retired
  borders as elevation regardless)".

So the transferred R11 still mandates the exact anatomy R17/R18 and Codi's own message retire.
**Do not rebuild `ShowPageProse` until this is resolved.** Our current implementation matches R11 as
written and is the thing Codi called non-conforming.

### R13 clause 7 — NEW, and it invalidates part of our grid helper
The cap of 4 applies to **text-bearing cards** only. It does **NOT** apply to **small uniform tiles**
(sponsor/affiliate logos, photo thumbnails) where **5 or 6 across is correct and 4 looks sparse**.
The orphan rule still binds at whatever c is chosen.

Consequences for our lane:
- `lib/grid-columns.ts` caps every collection at 4. That is wrong for logo/thumbnail grids.
  **The sweep has two families, not one — read what the card contains before picking its ceiling.**
- The hub's pre-existing `lg:grid-cols-5` (ten judging classes) was ruled "leave alone" by us on
  cost grounds; R13/7 now says 5 may be legitimate. Re-examine rather than assume either way.
- D67/D86/D87/D88 (span tie-break) are CONFIRMED to stand — Codi restated them explicitly.

---

## R19 — THE DISCLOSED EXTENT IS A SURFACE, NOT A STRIPE (2026-09-10)
**Supersedes R11 clause 1. The rest of R11 stands unchanged.** This UNBLOCKS the `ShowPageProse`
rebuild.

What R11 got right and R19 keeps: a notice can render first, pass every DOM assertion, and still read
as fine print. **Structure fixes that, not colour and not size — and the structure must scope the
EXTENT of what is unconfirmed, not merely sit above it.**

What R11 got wrong: it made a dash carry provisionality. A dashed edge is the drop-zone/missing-file
anatomy — it says *something is absent here*, when the truth is **something is present and
unverified**. **Provisionality is STATED, not TEXTURED.** The chip and sentence say it in words; the
anatomy's only job is scoping.

1. The governed block sits on **its own surface** — low-tint ground from the canvas, no new colour,
   **16px radius, purple-tinted shadow at its lightest step**. Top and bottom edges scope the extent
   in BOTH directions, which a leading rail only ever did in one. Strictly better, not a compromise.
2. **No border on any edge, dashed or solid.** The surface is drawn by ground and shadow.
3. **The chip ATTACHES to the surface's head** — attached, not floating above. Attachment is what
   makes chip and prose one object rather than a note sitting near some text.
4. **The closing sentence sits INSIDE the surface, at the foot, at the quiet weight.** Outside it, it
   is fine print again — the exact failure R11 named. This is R11's "one anatomy, two weights":
   chip loud, sentence quiet, surface making them one anatomy.
5. **Distinguish from a card and from a pull-quote**, both of which it could be mistaken for: shadow
   at the LIGHTEST step (a card sits higher), FULL MEASURE (a pull-quote insets), and the chip
   (a card carries none at its head).
6. **NEVER NEST A DISCLOSURE. One surface per governed extent.** If a whole page is unconfirmed, one
   surface wraps that page's prose — never one per paragraph. Sixteen pages of stacked panels is the
   fine-print failure arriving through fatigue instead of through size.
7. Unchanged: exact wording; the placeholder / AI-generated / awaiting-Council triad; both state inks
   across all four dark grounds; assertions measure RENDERED TEXT.

## MIRROR TRANSFER — THIRD ARTEFACT, gzip+base64 (inbound)
Three base64 parts, gzip-compressed. Base64 ignores line breaks on decode so boundary whitespace
cannot corrupt it, and gzip's CRC fails loudly rather than silently. Assemble, `base64 -d | gunzip`,
then verify: **757 lines**, sha256
`574825a223a09c306195bd16bd22674e08b803d6b5f6bc4c57423739acf3903b`.
Longer than the failed 709 because R19 went in since.
Codi cannot write into our repo — their scope rule makes it a stop-and-ask, and a courier doing it
would be the same crossing with an extra hop. Raised with Brad separately.

## R13/7 APPLIED TO THE HUB — I WAS WRONG, IT DROPS TO 4
Checked `components/nos/JudgingGroupCard.tsx` rather than assuming. It renders a code badge, an
uppercase group label, a serif name AND a 13px description paragraph — **text-bearing, and more than
"a title plus a hint"**. So under R13/7 it caps at **4**, not 5. The hub's
`lg:grid-cols-5` is a real defect and my earlier "leave it alone" call was wrong on the merits, not
merely deferred on cost. n=10 → 10 mod 4 = 2, no orphan, so c=4 is clean.
**Fix it in the M4 close-out.** Small uniform tiles (sponsor/affiliate logos, thumbnails) are the
family that takes 5-6; this is not that family.
