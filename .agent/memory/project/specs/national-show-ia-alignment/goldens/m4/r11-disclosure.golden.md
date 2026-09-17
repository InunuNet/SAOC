# Golden — R11's disclosure block and R12's no-second-nav rule

Extends `goldens/m4/notice-visibility.golden.md` (`N1`–`N10`), which is unchanged and still
binding. This file adds the R11 *form* — chip, sentence, rail — and R12's chrome boundary.

---

## R11 — the disclosure block

**Ruling (design lane, relayed by Brad 2026-09-10):** every non-Council block carries a
**chip**, then **one sentence**, then a **dashed 2px rail down the full height of the block it
governs.** Warning tokens for AI-generated, muted tokens for researched-but-unconfirmed.
**Never error/red tokens.**

The rail is the part that carries meaning `N1`–`N10` could not. A notice at the top of a page
says "something here is unconfirmed" and leaves the reader to guess how far it reaches. A rail
running the full height of the block **shows the extent of the claim.** Once a page mixes
council-supplied and placeholder blocks — which every NOS page will, one block at a time over
months — extent is the whole question.

### `N11` — structure and order

Inside the disclosure, in DOM order: a **chip** element with non-empty text, then **exactly
one sentence** (one terminal `.`, `?` or `!` in the disclosure's own text), then the **rail**.

One sentence is a hard count, not a style note. Two sentences is where a disclosure becomes a
paragraph and a reader skips it.

### `N12` — the rail is a rail

Computed `border-<side>-style: dashed` and `border-<side>-width: 2px` on the rail element, on
exactly one side. Not a `background-image` gradient imitating dashes, not a repeating
pseudo-element: the same real-DOM standard `N6` already sets for the text.

### `N13` — full height of the block it governs

Rendered rail box height ≥ **0.98 ×** the governed block's rendered height, measured on
composited boxes at **390 and 1280**, with the rail's top within 2px of the block's top.

0.98 tolerates sub-pixel rounding and a border-box edge. It does not tolerate a rail that
stops at the disclosure text — the failure mode the ruling exists to prevent, which at a
glance looks like a design flourish rather than a broken promise.

The **governed block** is the section the provenance value belongs to. A page with three
placeholder sections has three rails, each the height of its own section — never one rail down
the whole page.

### `N14` — the right tokens, and never error/red

| provenance | tokens |
|---|---|
| `placeholder-ai` | `--status-warning-on-light` / `--status-warning-on-dark` |
| `research` | `--status-muted-on-light` / `--status-muted-on-dark` |
| `council-draft` | `--status-muted-*` (unfinished, not unsourced — see `council-draft-provenance.golden.md`) |
| `council-supplied` | no disclosure at all |

**Never `--status-error-*`, and never a red literal.** R8/1 is the reason: status colour
carries meaning and hue is the signal. Red means *something has gone wrong*. Unconfirmed copy
on a page that has not launched is not an error — it is the normal state of a site being
built, and painting it red trains every reader to ignore red.

Two-part check, because either alone is defeatable:

- **`N14a` static** — the strings `status-error`, `#dc2626`, `#b91c1c`, `text-red-`,
  `border-red-`, `bg-red-` appear in **zero** files under
  `app/(marketing)/national-show/` and in the notice components.
- **`N14b` runtime** — the rail's and chip's computed colours equal the resolved
  `--status-warning-*` or `--status-muted-*` value for that block's provenance, and equal
  **neither** resolved `--status-error-*` value. Sampled from the composited pixel, per the
  design lane's verification standard: Tailwind v4 serialises opacity-modified colours as
  `oklab()`, so regex-parsing `getComputedStyle()` returns plausible, wrong numbers
  (InunuNet/SAOC#3).

`N14a` catches the literal; `N14b` catches a token aliased to a red value upstream.

### Hierarchy is preserved

`N10` already requires the research notice's contrast to be strictly **less** than the
placeholder notice's on any ground. R11's token assignment must not invert it: muted is the
quieter disclosure because researched-but-unconfirmed is a weaker claim than
we-wrote-this-ourselves. `N10` is unchanged and still runs.

---

## R12 — no NOS header, no second nav

**Ruling:** no NOS-specific header and no second nav on any route. **NOS identity begins BELOW
the SAOC chrome.**

The SAOC header is one lane's, one component, one place a visitor learns where they are. A
second header inside a subsection is how a site starts to read as two sites stitched together
— and it is also, concretely, a second set of landmarks for a screen-reader user to wade
through on every NOS page.

### `N15`

Across all 17 routes, measured in the rendered document:

1. **Zero `<header>` elements and zero `role="banner"`** inside the NOS content region (below
   the site chrome). The site's own `<header>` is unaffected and untouched.
2. **Exactly one navigation landmark** inside the NOS content region: `ShowSectionNav`, whose
   accessible name is `National Show section`. A breadcrumb, if one is ever added, is a
   further landmark and needs a ruling first.
3. **The `.nos-theme` scope is applied inside the layout body**, never on `<html>` or
   `<body>` — that is what "identity begins below the chrome" means mechanically, and it is
   what keeps NOS purple and Cormorant out of the SAOC header (**R1**).
4. **No colour, font-family, border-radius or box-shadow literal** under
   `app/(marketing)/national-show/` — the existing `R5`, unchanged. The identity is inherited
   from the layout's `.nos-theme` scope and never re-declared.

`ShowSectionNav` is a **section** nav, not site chrome, and is the mandated reachability
surface — so it is the one landmark R12 permits. That reading is stated here explicitly
because R12's text says "no second nav" and could be read to forbid it; forbidding it would
make every NOS page unreachable, which is plainly not what the ruling means.

**For Codi:** confirm that reading. If R12 does mean to exclude `ShowSectionNav` too, the
reachability requirement needs a different surface and that is a structural change, not a
tweak.

## What this golden does not settle

- **The chip's wording.** `showPageSettings` supplies it; the fallback strings are pinned by
  `CD4` and `notice-visibility.golden.md`.
- **Rail side, inset, and dash length.** Codi's, beyond "dashed, 2px, one side, full height".
- **Whether the rail is visible in forced-colors mode.** Worth a look; not asserted, because
  no ruling covers it and inventing one is not ours to do.
