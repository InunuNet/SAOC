# Golden — the placeholder notice: treatment, tokens and proof (M4/F17)

## Provenance of this file

The **treatment** is Codi's ruling **R11**, recorded in
`.agent/memory/project/design/nos-design-rulings.md` and rendered on the NOS 2027 House
Style sheet: https://claude.ai/code/artifact/eae67f9e-2f8c-4484-8112-fa4a27cf95b3

**The rendered artifact is authoritative, not this restatement and not the prose relayed
alongside it** — Codi were explicit on that, and it matters here: two token names in the
relayed prose do not appear in the sheet's own declaration (see "Open" below). A later
reader resolving a conflict goes to the artifact, then to Codi, never to this file.

The **measured properties** (N1–N10) are ours. Design answers "what should it look like";
this file answers "how do we know it worked".

**Scale, in Codi's framing:** 17 documents, 16 pages to create, **15 carrying the
disclosure** — spec entry 1 is the existing landing page with real copy, and entry 14 is a
nav link with no document.

## The anatomy — one form, both states, both levels

R11, verbatim in substance: **label chip → one sentence → a dashed rail down the full
height of the block the notice governs.**

One form, not two. The two states are the same kind of statement differing in degree; two
structures would put two visual systems on one page implying two different kinds of thing.
**They differ in ink only.**

- **chip** — border `currentColor`, no fill, radius `--radius-1` (2px), 11px, 0.14em
  tracking, 1px border
- **sentence** — one sentence, body-minus-one, **never italic** (this copy lives for months
  and must stay as readable as the copy replacing it)
- **rail** — dashed, 2px, on the leading edge, running the **full height of the governed
  block**

The rail is the answer to the question this mission most needed answered — how a repeated
inline notice avoids degrading into fine print. Codi: *"That is the part I would not
negotiate — it is what stops the repeated notice degrading into fine print."* It scopes the
disclosure to its content, so a reader sees the **extent** of what is unconfirmed rather
than a note sitting above it. Dashed because provisional; solid would read as a pull-quote.

**Floor it may not go below:** chip at 11px / 0.14em with a 1px border, one sentence at
body-minus-one, and the rail. It never degrades to plain italic text.

## Token bindings

### placeholder — BOUND, verified

| ground | token | value | measured |
|---|---|---|---|
| light (parchment `#fbfaf0`) | `--status-warning-on-light` | `#714a1e` | **7.42:1** |
| light (bone `#f3f2d6`) | `--status-warning-on-light` | `#714a1e` | **6.84:1** |
| dark (primary-800 `#1a1445`) | `--status-warning-on-dark` | `#d6a164` | **7.43:1** |

Both tokens exist in `app/(marketing)/national-show/nos-theme.css:194-195` with exactly the
values Codi quoted. Text and rail both take the warning ink. Chip border `currentColor`.

**Never `--status-error-*`.** Red says something is broken. An unwritten page is not a
fault, and that misread is the one that would actually damage the Council.

### research — BOUND, all four dark grounds

Codi took the "lift the value" option and amended R11. **`--status-muted-on-dark: #a49dbe`**,
replacing the earlier `#8b84a6`. Verified independently — their figures match to two decimals:

| ground | research `#a49dbe` | placeholder `#d6a164` | research quieter? |
|---|---|---|---|
| `--primary-800` `#1a1445` | **6.62** | 7.43 | ✓ |
| `--primary` `#211a57` | **6.03** | 6.77 | ✓ |
| `--nos-purple-lift` `#241c5c` | **5.84** | 6.55 | ✓ |
| `--primary-700` `#33296f` | **4.83** | 5.42 | ✓ |
| light: `--muted` `#6a6780` on parchment | **5.18** | 7.42 | ✓ |

Hue 252.7° against `--muted`'s 247.2° — 5.5° delta, inside R8's ±15°. Light ground is
unchanged: `--muted` for text and rail, chip border `currentColor`, both states.

**Codi wrote the finding into R11 as a rule, not a note:** *a token is validated against every
ground its state can reach, not against the one that was convenient* — and named their own
`#8b84a6` as the same defect one level down from the principle they had been enforcing.

**Why "pin the notice's ground to `--primary-800`" was rejected**, worth keeping because it is
the failure we would have owned: it makes a band's colour a function of whether it carries a
notice, and the failure is quiet. Someone restyles a section to `--primary-700` a year from now
for good reasons, the disclosure silently drops to 3.53:1, and nobody connects the two changes.
One token that holds everywhere has no such coupling, and N9 then never needs to know which
ground it is on. Per-ground tokens were rejected outright — they multiply with the palette and
break R8's two-per-state shape.

### The constraint that actually chose the value

The 4.5:1 floor only ruled out everything darker. What selected `#a49dbe` is a property
**neither side specified and our assertions did not capture**: the research ink must stay
**quieter than the placeholder ink on the same ground**. Otherwise the hierarchy inverts and the
weaker disclosure reads as the stronger one — the numbers all pass and the meaning is backwards.

That is N10 below. It is cheap, and it protects the meaning rather than the number.

### Declaring the token is M4/F17 work — it is NOT done

`--status-muted-on-dark` **does not exist in `nos-theme.css`**. It is a new value that must be
declared alongside the existing `--status-error-*` / `--status-warning-*` pairs, by whoever
builds F17. `--muted` on light already exists and needs nothing.

Stated this plainly because a ruled value reads as a shipped value. R11 is closed from Codi's
side; the declaration is ours and outstanding.

## Placement

**Directly beneath the hero, full content width, before any content block.**

- Not over the hero — fights R10 and wastes the photograph.
- Not a full-bleed band at the top of the document — that is a cookie bar, and reads as a
  system error rather than an honest disclosure.

## The measured properties

Measured on **composited pixels at 390 and 1280**, never from the stylesheet. This project
has already learned that distinction: `nos-design-system`'s M8 work measures contrast at the
composited pixel because a computed style can be correct while the rendered result is not.

| id | property | how it is measured |
|---|---|---|
| N1 | **The notice is the first element after the hero, with no content block preceding it.** | DOM position, not viewport position. **Amended from the original draft — see below.** |
| N2 | Painted before body copy, not merely DOM-ordered. | Notice bounding-box top is less than the first section body element's bounding-box top. |
| N3 | Notice text ≥4.5:1 against its own composited background. | Sampled rendered pixels, not declared tokens. |
| N4 | Distinguished by more than colour — a word as well as a hue. | The chip's text is present in the accessible name and the visible text; not a bare coloured bar, and never an icon standing in for the word. |
| N5 | **Cannot be dismissed.** | No control toggles it; no `localStorage` or cookie suppresses it on a second load. |
| N6 | Announced to assistive technology before the copy. | Real DOM text — not a pseudo-element, not a background image — reachable in reading order before the first body paragraph. |
| N7 | The page reads correctly with the notice absent. | No layout gap, orphaned rule or empty container on a fully `council-supplied` page. |
| N8 | **A page with every flag cleared renders pixel-identical to the same page authored with real copy.** | Screenshot diff at both widths. Zero state is absence, not an empty slot. |
| N10 | **On any ground, the research notice's contrast is strictly LESS than the placeholder notice's.** Measured composited, both states on the same ground. Without this, a future edit could lift research above placeholder, pass every per-token check, and invert the hierarchy so the weaker disclosure reads as the stronger one. Protects the meaning, not the number. |
| N9 | A notice on a dark ground uses `--status-muted-on-dark` (research) or `--status-warning-on-dark` (placeholder), and measures **≥4.5:1 composited against the ground it actually sits on** — not against `--primary-800` by assumption. Replaces the earlier "no notice on a dark ground" form, which Codi rejected as non-durable. This is also what catches the open item above: a research notice on `--primary-700` fails at 3.53. |

### N1 was amended, and the amendment is a real improvement

The original draft said "visible without scrolling at both widths". Codi pushed back: at 390
that conflicts with placing the notice beneath the hero, and satisfying it would force a
disclosure above the show's own headline. Their reasoning — a 390 visitor scrolls
immediately, and the cost of the alternative is the first impression of the whole site.

Accepted, and the replacement is the better property on its own merits: "first element after
the hero, no content block preceding it" is DOM-checkable, deterministic, and independent of
viewport height, whereas a fold test silently changes meaning with every device. The
original bought a weaker guarantee at a real cost.

### N8 came from Codi and we did not have it

Our gate proved the notice renders. Nothing proved it **stops**. Notice and rail are one
component, so when the flag clears the padding clears with it — and the zero state is the
case that usually breaks, via an orphaned rule or a collapsed gutter. It is cheap to check
and it directly serves what we care about, since pages flip to real copy one block at a time
over months.

## Wording — ours, and it conflicts with the sheet's example

**Resolved: Codi adopted our wording and replaced their example on the sheet.** R11 now
records our text as binding, with their own note that assertions measure rendered text rather
than a fixed string.

The example they replaced read *"This wording is drafted, not confirmed by the SAOC council.
It will be replaced before the page goes public."* — which omits **"AI-generated"**, half of
Brad's three-part condition (placeholder, AI-generated, awaiting Council copy). It is recorded
because the failure mode is instructive: the example was reasonable, disclosed two of the three
things, and would have been adopted by someone aligning to the ruling in complete good faith.

The treatment is Codi's; the disclosure content is Brad's requirement and is Council-editable
through `showPageSettings`:

- `placeholderLabel`: `Placeholder copy`
- `placeholderNotice`: `This text is an AI-generated placeholder. It has not been written or approved by the South African Orchid Council, and it may be inaccurate. Final copy is still to be supplied by the Council.`
- `researchLabel`: `Not yet confirmed`
- `researchNotice`: `This information was researched by the web team and has not yet been confirmed by the South African Orchid Council.`

**The wording is not Codi's to set and is not up for alignment.** R11 rules on ink, structure
and placement; none of those touch the words. This is recorded because the failure mode is
silent and sincere: someone later "aligning to the ruling" in complete good faith would drop
the AI disclosure, satisfy every assertion we had, and fail the actual requirement.

**Assertion A43 / driver check G10 now closes that** — the resolved placeholder notice must
match `/\bAI[- ]generated\b/i`, checked against both the hardcoded fallback constant and the
value seeded into `showPageSettings`. A future edit that softens the disclosure fails the gate
instead of passing quietly. G4 pins the exact string; G10 pins the property that has to survive
any rewording, including a legitimate Council edit in Studio.

Because the copy is Council-editable, **N3 and N4 measure the rendered text, never these
strings.** A treatment that only works at one sentence length is not a treatment.

## Avoid — R11's list, kept verbatim in substance

Dismissible, animated or sticky anything · shadow, or any radius past `--radius-1` · a
background fill behind the body copy (makes real prose look like a flagged defect, and takes
contrast out of our control) · an icon standing in for the word · italicised placeholder
prose.

## Deliverable back to Codi

They rule at the pixels, not the stylesheet. Owed: rendered captures at **390 and 1280**, at
**full density**, at **one lonely inline notice**, and at **zero**.

## What none of this proves

Whether a reader **understands** the notice — that they read "AI-generated placeholder" and
conclude the page's facts are not to be relied on. No automated check answers that. Green
N1–N9 proves the notice is *perceivable*; Brad's word was *unmistakable*, which is higher.
The gap closes by showing one page to one person who has not seen it and asking what they
think it is telling them. Once, on one page, before launch.
