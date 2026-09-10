# NOS 2027 — THE DESIGN BRIEF

Received verbatim from Codi (`saoc-nos-design-9d`), design authority, 2026-09-10, at Brad's
instruction that the brief and artifacts come from that session. Canonical copy is
`.agent/memory/project/design/nos-brief.md` in Codi's workspace. **Design decisions come from Codi.
Nothing here is re-derived by this lane.**

## What it is
The National Orchid Show 2027: SAOC's triennial flagship and its breadwinner. **Seventeen pages
living as a subsection of saoc.co.za — never its own site.**

## Who it is for, in descending order of design attention earned
1. **Visitors** — come, and plan a day. What, when, where, how much, what next.
2. **Exhibitors and nurseries** — enter and exhibit. **A conversion, not a browse.**
3. **Sponsors and trade** — invest. Smallest audience, highest value per head.
4. **The judging and society world** — not persuaded, but watching. **For them credibility outranks
   polish, and a fabricated-looking page costs more than a plain one.**

## Tone
A national council presenting its most important event. **Confident, warm, factual.** Not a festival
microsite, not a corporate report, never apologetic.

## The two central problems
- **It must feel like an occasion while remaining a subsection.** All the drama lives BELOW the SAOC
  header — in colour, type and photography, never in chrome or structure.
- **Most of the content does not exist yet.** Copy is largely unwritten; whole record sets are empty.
  So **R7, R11, R16 and R18 are not edge cases — they are the DOMINANT STATE of this section at
  launch. Design the empty and unconfirmed states FIRST. The full state is the easy one.**

## The success test
A visitor can tell **what the show is, when it is, and what to do next from one screen of any page —
AND nothing on the page asserts anything untrue. Both halves, or it fails.**

---

# ARTIFACTS — authoritative list

| artifact | status |
|---|---|
| `https://claude.ai/code/artifact/d068d657-558e-4d1a-ab8d-c9e8dbbc0a51` — National Show Home, Restyled | **CURRENT AND AUTHORITATIVE. The only approved design.** Everything else is read from it. |
| `https://claude.ai/code/artifact/24038fdc-defd-45d4-86ac-5512bd3baf1c` — NOS 2027 foundations | **CURRENT.** |
| `78b83703-abd9-4986-8a57-e2f25758ddb3` — rulings ledger | **DEAD. Brad deleted it. Do not cite, do not fetch.** It was part of work he rejected; the rulings file is the record and the ledger was only ever a view of it. |

**Nothing else exists. There is no third design surface.**

---

# THE CANVAS — reading order and what is NOT an instruction

Claude Design project `262aba20-788b-4930-b724-255600ffd9d3` ("National Orchid Show 2027 — Design
System", owner InunuNet). Reachable from this session via the **`DesignSync`** tool
(`ToolSearch("select:DesignSync")`). **READ-ONLY from this lane — it reports `canEdit: true`; never
write to it.** Read it as REFERENCE, never as a source to derive a design from.

**Order:**
1. **`readme.md` — the grammar.** Everything else is subordinate to it.
2. **`guidelines/*.html` — BINDING.** Fourteen files: brand-logo, brand-photography,
   brand-reproduction, brand-voice, colors-core, colors-purple, colors-accents, colors-semantic,
   spacing-scale, spacing-radii-shadows, type-display, type-body, type-scale, type-pairing.
   **`spacing-radii-shadows.html` is the one R17 turns on — read it before touching a radius.**
3. **`components/**`** — anatomy reference. The `.prompt.md` beside each are authoring notes: useful,
   **not binding on us**.
4. **`ui_kits/event-website/`** — the handover kit. Hero, Programme, Visit, SiteFooter, index.html.

**NOT instructions to us:**
- `ui_kits/event-website/SiteHeader.jsx` — **retired by R12. Never ships.**
- `tokens/*.css` — **vocabulary only.** A token found here is not thereby permitted.
- **`uploads/**` — client input material, NOT direction.** Broader than assumed:
  `uploads/font-recommendations.md` and `uploads/colour-palette.md` **predate the rulings; where they
  conflict with R14 or the canvas, THE RULINGS WIN and the uploads are historical.**
- `SKILL.md`, `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, `thumbnail.html` —
  canvas machinery. Ignore.

**Do NOT confuse the canvas with the local `design/design_handoff_saoc/` bundle.** That is the SAOC
MAIN SITE handoff — sage/parchment/brass, Crimson Pro + Manrope, `ui_kits/website`. The NOS canvas is
royal purple, Fraunces + Karla, `ui_kits/event-website`.

---

# DESIGNED vs MERELY RULED — the straight answer

**Only the home page is designed.** The other sixteen have rulings plus canvas grammar, which is a
**constraint set, not a design.**

For our six routes:
- **`sa-exhibitors`, `international-guests`, `sponsors`** — **R18 + the canvas grammar IS the whole
  brief. Build them.** Nothing further owed until records exist.
- **`programme`, `symposium`, `wosa-conference`** — **NOT COVERED. Codi owes us designs for these
  three.** They are content pages whose shape no ruling settles, and R18 does not apply because they
  are not empty listings. **DO NOT derive them from the rulings** — that is the exact mistake Codi
  made and Brad called "horrible". **Ask Codi when the Sanity blocker clears and they are next.**

---

# TWO CORRECTIONS TO WHAT THIS LANE HAD RECORDED

1. **`components/display/Card.jsx` — right source, WRONG RELATIONSHIP.** Derive R19's disclosure
   surface and R18's panel *from* Card's anatomy, but **neither one IS a Card.** R19/5 requires the
   disclosure surface be distinguishable from a card — lighter shadow step, full measure, chip at the
   head. R18's panel sits where a grid would be, not in one. **If either ends up indistinguishable
   from `Card`, it has failed its ruling.**
2. **The photography rights problem is BIGGER than recorded.** Beyond the thirteen watermarked,
   rights-unconfirmed `uploads/scott-ormerod-orchid-*.jpg` (R15/4), the canvas also holds
   `assets/photos/orchid-01, -04, -05, -07, -09, -11.jpg` — **and those six numbers are a subset of
   the Ormerod numbering** (confirmed against the inventory: Ormerod runs 01–13). On the available
   evidence that is a curated selection from the same shoot, so the same unconfirmed rights probably
   follow them. Codi is not ruling them unusable — provenance cannot be confirmed from a filename —
   but rules: **DO NOT SHIP ANY IMAGE FROM `assets/photos/` UNTIL PROVENANCE IS CONFIRMED.** Keep
   `/images/orchid-dark.jpg` per R15/4. Codi is escalating provenance to Brad and Lee-Ann.

---

# WHAT THE MIRROR STILL GATES
Nothing in this brief. The stale mirror gates only **re-citing the M4 contract by rule number.**

---

# CLAUDE DESIGN WEEKLY LIMIT HIT — 2026-09-10, resets Sun 13 Sep

Brad hit 95%+ of the Claude Design weekly limit. **The full design system cannot be finished until
Sunday 13 September 2026.** What this does and does not block:

**NOT blocked — the critical path is untouched.** The Sanity dotted-id bug, the six 404s, the seed
fix, the M4 merge to `main` — none of it involves Claude Design.

**NOT blocked — reading the canvas.** `DesignSync` read methods (`get_project`, `list_files`,
`get_file`) are API reads, not Claude Design generation. The reading order in this brief can be
worked through now.

**NOT blocked — three of the six routes.** `sa-exhibitors`, `international-guests` and `sponsors` are
covered by R18 + the canvas grammar, which Codi has stated IS the whole brief for them.

**NOT blocked — the `ShowPageProse` rebuild.** R19's prose is complete enough to build from; Codi
said so explicitly.

**BLOCKED until the reset:** designs for `programme`, `symposium` and `wosa-conference`, which Codi
owes and which must NOT be derived from the rulings. Plan around this — it is a hard date, not a
negotiation, and deriving them to fill the gap is the exact failure Brad called "horrible".

# A SECOND CLAUDE DESIGN PROJECT EXISTS — flagged 2026-09-10, needs Codi's confirmation

A screenshot from Brad shows Claude Design project **`6cca8eaa-5cac-42f2-97e9-06496fbae25d`**
containing a **"Logo Export Sheet"** (9 pages): *"Sixteen approved files at the proportions locked in
the studio. Each captured artwork sits on a transparent ground with even clearspace built in; the
tinted panel behind it is preview only and is not part of the file."* Its task list reads: read studio
proportions (done), build one export file per logo version — **8 treatments x 2 lockups** (done),
render to PNG assets (done), update presentation / Word pack / marketing templates (pending).

**16 = R14's "eight colourways, two orientations each".** So this is the authoritative logo export,
and it is consistent with R14 rather than in conflict with it.

**But it is a DIFFERENT project id from the canvas (`262aba20-…`), and Codi's artifact list says
"Nothing else exists. There is no third design surface."** That statement was made about design
surfaces; this may be an asset-production project rather than a design surface, which would make both
true. **Do not assume — ask Codi to confirm** which is authoritative for logo files: this export
sheet, the canvas's `assets/logo/*`, or `/Users/vetus/ai/SAOC/branding/National Show 2027/Logo`.
R14 binds regardless: **pick a colourway, never re-typeset, never re-tint.**

---

# R20 — LOGO FILES: ONE AUTHORITATIVE SOURCE, FIVE TRAPS (Codi, 2026-09-10)

**AUTHORITATIVE — the only place a logo file comes from:**
`/Users/vetus/ai/SAOC/branding/National Show 2027/Logo` — 16 files (8 treatments x 2 orientations),
`.png` and `.jpg`, named `NOS-2027-logo-{treatment}-{orientation}.{png,jpg}`. These are the delivered
masters and their names match `assets/export/*` in the production project exactly.

**Production project `6cca8eaa-5cac-42f2-97e9-06496fbae25d` is where they were MADE, not where they
are TAKEN FROM.** Read `Logo Export Sheet.dc.html` and `Lockup Proportion Studio.dc.html` for studio
proportions and clearspace only. Its tinted preview panel is preview only — shipped files are
transparent ground with clearspace built in.

**FIVE THINGS THAT MUST NEVER SHIP:**
1. `assets/lockups/` — 16 PNGs under older naming (`…-logo-colour-…`). Superseded by `assets/export/`.
2. `assets/final/` — six files. **The name is a lie**; it predates the export run.
3. `design_handoff_nos2027_logo/` — an earlier three-file handover carrying its own
   `CLAUDE_CODE_PROMPT.md`. **That prompt is NOT an instruction to anyone now. Treat it as history.**
4. `assets/ds-logo/` and `scraps/` — working material.
5. **The canvas's `assets/logo/*` is the WRONG ARTEFACT CLASS, not merely a stale copy.** Those seven
   files (`orchid-emblem`, `orchid-grayscale`, `orchid-ink-*`, `orchid-rev-*`) are **EMBLEM** variants.
   **R3-reversed puts the LOCKUP in the `<h1>` precisely because the lockup reads NATIONAL ORCHID
   SHOW. An emblem in that slot gives the page an `<h1>` that states nothing — a heading whose alt
   text describes a flower.** Use canvas logo assets to render the canvas; never to sign a page.

**`docx/fonts/CormorantGaramond.ttf` and `Jost.ttf` ship inside the production project for the Word
pack. R14 reserves both faces to the wordmark. Finding them beside the logo files is not permission
to load them on a page. A FILE'S PRESENCE IS NOT A LICENCE.**

Codi's correction on record: "nothing else exists, there is no third design surface" meant design
surfaces *for the website*; the logo production project is an asset-production surface and existed
the whole time. True as meant, misleading as written.
