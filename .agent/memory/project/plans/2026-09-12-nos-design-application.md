# PARKED — NOT AUTHORISED TO START (Brad, 2026-09-10)

> **Brad: the current mission ends at the merge to `main`, and there is NO NEW MISSION after it.**
> This file is a RECORD of everything the design lane has ruled, so none of it is lost — it is NOT a
> queued mission and must not be started without Brad opening it explicitly.
> Additional hard blocker: Claude Design hit its weekly limit; `programme`, `symposium` and
> `wosa-conference` have no design until the reset on **Sunday 13 September 2026**.

# (When authorised) apply the final NOS design rules to the seventeen pages

**THE BRIEF IS ON DISK: `.agent/memory/project/design/nos-brief.md`** — received from Codi 2026-09-10.
Read it before this plan. It supersedes this file wherever the two differ, and it corrects two things
recorded here: `Card.jsx` is a SOURCE to derive from, never the thing itself (R19/5 requires the
disclosure surface be distinguishable from a card); and NO image from the canvas's `assets/photos/`
may ship until provenance is confirmed, not just the `uploads/scott-ormerod-*` set.

**`programme`, `symposium` and `wosa-conference` are NOT designed and must NOT be derived from the
rulings.** Codi owes designs for those three — ask when the Sanity blocker clears.

**The rulings ledger artifact `78b83703-…` is DEAD (Brad deleted it). Do not cite or fetch it.**


Written 2026-09-10. **Do not start until M4 is merged to `main`** (see
`2026-09-11-m4-closeout.md`; standing rule: a mission is not finished until it is on `main`).

## WHAT WE HAVE, AND THE GAP THAT MATTERS

**We have the RULES, in prose:** R14 (type), R15 (hero scrim near-black), R16 (never repeat a
photograph), R17 (canvas wins over R1/R2 — 10px controls, 16px cards, purple-tinted shadow, not
borders), R18 (empty listings), R19 (disclosed extent is a surface, not a stripe), the R3 reversal
(the lockup IS the h1), R13's span tie-break and clause 7. All recorded in
`.agent/memory/project/design/NOS-DESIGN-FINAL-2026-09-10.md`.

**We do NOT have the design brief itself.** The canvas is Claude Design project
`262aba20-788b-4930-b724-255600ffd9d3` — `readme.md` is the grammar, `guidelines/*.html` are binding,
`tokens/*.css` is vocabulary only, `ui_kits/event-website` is the handover kit. **This session has
never opened it.** Codi's standing instruction is explicit and was learned the hard way:

> "Read the canvas first, always. Do not re-derive a design system from prose — that mistake was made
> once here and Brad's verdict on the result was *horrible*."

Codi's own standing correction says the same about their own method: they once derived a hero from
R10's prose instead of opening the canvas, and it "satisfied the numbers and discarded the canvas's
judgement."

### THE CANVAS IS REACHABLE FROM THIS SESSION — verified 2026-09-10

Use the **`DesignSync`** tool (deferred; load with `ToolSearch("select:DesignSync")`).
`get_project` on `262aba20-788b-4930-b724-255600ffd9d3` returns:
**"National Orchid Show 2027 — Design System"**, type `PROJECT_TYPE_DESIGN_SYSTEM`, owner InunuNet,
`canEdit: true`. Read methods do not prompt. **`DesignSync` read-only: never write to this project** —
it is Codi's authority and our lane does not edit the design system.

**It is NOT the local `design/design_handoff_saoc/` bundle.** That one is the SAOC MAIN SITE handoff —
sage/parchment/brass, Crimson Pro + Manrope, `ui_kits/website`. The NOS canvas is royal purple,
Fraunces + Karla, `ui_kits/event-website`. Do not confuse them; building NOS from the local bundle
would produce the wrong design system entirely.

**Canvas inventory (read what you need, not all of it):**
- `readme.md` — THE GRAMMAR. Binding. Read first.
- `guidelines/*.html` — binding. `brand-logo`, `brand-photography`, `brand-reproduction`,
  `brand-voice`, `colors-core`, `colors-purple`, `colors-accents`, `colors-semantic`,
  `spacing-radii-shadows`, `spacing-scale`, `type-display`, `type-body`, `type-pairing`, `type-scale`.
- `tokens/*.css` — VOCABULARY ONLY, not the system: `colors`, `effects`, `fonts`, `spacing`,
  `typography`.
- `components/` — `actions/Button`, `actions/IconButton`, `brand/Logo`, `brand/EmblemBadge`,
  `brand/Icon`, `display/Card`, `display/Badge`, `display/EventCard`, `display/SectionHeading`,
  `forms/Input`, `forms/Select`, `forms/Checkbox`. Each has `.jsx`, `.d.ts` and a `.prompt.md`.
  **`display/Card.jsx` is the anatomy R19's disclosure surface and R18's panel are built from.**
- `ui_kits/event-website/` — `Hero.jsx` (the R10/R15 scrim source of truth), `Programme.jsx`,
  `Visit.jsx`, `SiteHeader.jsx` (**RETIRED by R12 — ships nowhere**), `SiteFooter.jsx`, `index.html`.
- `styles.css`, `assets/logo/*` (8 colourways), `assets/photos/*`.
- `uploads/scott-ormerod-orchid-*.jpg` — **rights UNCONFIRMED and watermarked (R15/4). Do not use.**

**So the first task of this mission is to obtain and read the canvas — not to start building from the
rules file.** The rules ANNOTATE and CONSTRAIN the canvas; they are not a specification it can be
regenerated from. If the canvas cannot be read from this session, that is a blocker to raise with
Brad, not a thing to work around.

**Also still missing: the verified rulings mirror.** Two transports failed (checksum 707 vs 709; then
a safeguard killed the base64 courier as obfuscated-payload transfer). `nos-design-rulings.md` in this
tree is STALE (2026-09-08, R1-R10 only) and NOT AUTHORITATIVE. Codi has asked Brad to authorise
writing that one file directly into this workspace. **Until a checksum-verified file lands, do not
re-cite the M4 contract by rule number** — citing rules against an unverifiable text is the failure
the checksum exists to prevent.

## WORK, once the canvas is in hand

1. **Rebuild `components/nos/ShowPageProse.tsx` per R19. Rebuild, do not patch** — "patching a
   component toward a rule it was never built for is how a design system accumulates fossils."
   The governed block sits on its OWN SURFACE: low-tint canvas ground, no new colour, 16px radius,
   purple-tinted shadow at its LIGHTEST step. No border on any edge, dashed or solid. Chip ATTACHES
   to the surface head. Closing sentence sits INSIDE the surface at the foot, quiet weight — outside
   it, it is fine print again, which is the exact failure R11 named. Distinguish from a card (lighter
   shadow) and a pull-quote (full measure, and the chip). **NEVER NEST — one surface per governed
   extent**, never one per paragraph.
   Unchanged from R11: the exact wording, the placeholder / AI-generated / awaiting-Council triad,
   both state inks across all four dark grounds, and **assertions measure RENDERED TEXT, never a
   fixed string** (the Council edits it in Sanity).
2. **Build the R18 empty-listing panel** for `/sa-exhibitors`, `/international-guests`, `/sponsors`.
   A dated promise, never a void and never a placeholder record. No "no results" (that is
   search-failure anatomy). No skeletons/ghost cards/shimmer (they lie about state). **No imagery**
   (R16). Real structure stays; **the grid itself must not render** — an empty grid is "absence with
   a class name". One panel where the grid would sit: WHAT will be listed in the page's own nouns,
   then WHEN — or the gate in words ("...once entries close"). **Never a count.** A next action only
   where one really exists: `/sponsors` yes; `/sa-exhibitors` only if exhibitor entry is live;
   `/international-guests` **no button**. R18 does NOT stack with R11 — if the intro prose is itself
   placeholder, R11 applies to that prose in its own anatomy.
3. **Split `lib/grid-columns.ts` into two families (R13/7).** The cap of 4 governs **text-bearing
   cards** (a label needs ~280px; five across 1280 leaves ~230px). **Small uniform tiles** — sponsor
   and affiliate logos, photo thumbnails — take **5 or 6**, and 4 looks sparse. The orphan rule binds
   at whatever c is chosen. Do not let one helper flatten sponsor logos onto the section-link grid.
   **Keep the span tie-break — CONFIRMED to stand:** when no c avoids the orphan, keep the content
   ceiling and let the final card span the remainder; never a partial row, never centred; binds at
   c >= 3; c = 2 exempt by ruling.
4. **Fix the hub's `lg:grid-cols-5` — it IS a defect.** `components/nos/JudgingGroupCard.tsx` renders
   a code badge, an uppercase group label, a serif name AND a 13px description paragraph: text-bearing
   by any reading, so the cap is 4. n = 10 → 10 mod 4 = 2, clean, no orphan. (An earlier call in this
   lane to leave it alone was wrong on the merits, not merely deferred on cost.)
5. **R15 hero scrim** — near-black `#0B0A14`, NOT purple. One horizontal layer, NO vertical layer;
   0.94 at the text column / 0.44 midline / 0.18 at x=75% / clear at the edge. Photograph stays AS
   SHOT — remove any blanket `opacity` on the `<img>`; a wash is a filter by another name. Keep
   `/images/orchid-dark.jpg` until Lee-Ann supplies a cleared replacement. **If a headline fails
   4.5:1, the CROP moves, not the alpha — and that escalates to Codi.**
6. **R16 past editions** — the live hub repeats ONE photograph across five past editions
   (2024/2021/2018/2015/2012). On a real council's site that reads as fabricated. Set them
   typographically. **No image beats a false one.**
7. **R14 type** — display **Fraunces** (optical-size axis low at display sizes), body **Karla**.
   Cormorant Garamond and Jost are RESERVED TO THE WORDMARK and load nowhere else. The lockup ships
   as artwork: pick one of eight colourways at
   `/Users/vetus/ai/SAOC/branding/National Show 2027/Logo`. **Never re-typeset, never re-tint.**
8. **R3 reversed** — the supplied lockup IS the `<h1>`, with the full show name as `alt` so the
   accessible name matches what a sighted reader sees. Do NOT typeset the show name above or below it.

## HARD CONSTRAINTS
- **R12** — no NOS header, no second nav. NOS identity begins BELOW the SAOC chrome. The canvas kit's
  own `SiteHeader.jsx` is RETIRED and ships nowhere. `ShowSectionNav` is a content pattern, not
  furniture, under four conditions: never sticky/fixed, no emblem or lockup, links set as content,
  full-bleed only at the FOOT of a page (position decides, not width).
- **R8** — status colour is DECLARED, never borrowed from a palette token. Never the error tokens for
  a disclosure: nothing is broken.
- **R9** — focus is a solid `outline` + `outline-offset`, never `box-shadow`. Full alpha always.
  Violet `#7E3F97` on pale gold; pale gold `#fbfaf0` on royal purple. 3:1 is the FLOOR, not the target.
- **R7 / no-invention** — copy is not invented; provenance is per-BLOCK with four values
  (`council-supplied`, `council-draft`, `research`, `placeholder-ai`).
- **Verification standard** — contrast measured at the COMPOSITED PIXEL with a negative control, at
  390 and 1280, before and after. Tailwind v4 serialises opacity-modified colours as `oklab()`, so
  regex-parsing `getComputedStyle()` returns plausible WRONG numbers. Never inspect a stylesheet and
  call it evidence. `127.0.0.1:8765` is dead — never cite it.
- **Escalate, never re-derive.** New design questions go to Codi. An architect does not invent a
  ruling and a dev does not improvise one.
- Delivery is a PR from `nos-site`, cross-lane review, one approval, merge. No pushes to `main`.
