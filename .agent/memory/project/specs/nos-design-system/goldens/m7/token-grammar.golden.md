# M7 golden — NOS token grammar reverts to SAOC's structural grammar

Authority: `.agent/memory/project/design/nos-design-rulings.md` **R1** and **R2**.
This golden is the target state. `@dev` implements against it; the contract's
assertions measure it.

---

## 1. The ruling, restated so it survives re-argument

R1: *"Inherited from SAOC, unchanged: radius 0 on cards, `--radius-1: 2px` on
buttons, elevation expressed as borders rather than shadows, JetBrains Mono
eyebrows, the 8pt spacing rhythm."*

NOS is a **subsection** of saoc.co.za, not its own site. Identity travels in
colour, type and imagery. Structure is the parent site's.

R1 also carries a retraction on record: the softer radii / shadow / Jost rules
were relayed to the build session as universal and **that relay was wrong and has
been withdrawn** — they belong to the standalone NOS brand system, not to this
subsection.

**Consequence for `nos-theme.css`.** The comment currently sitting above the
radius block asserts that 2px "reads cold and was rejected". That claim is a
record of the retracted relay, not of a live ruling. It must be replaced with a
comment citing R1, so the next reader does not restore the soft radii on the
strength of a stale note.

What does **not** change, and must still be true after this milestone: mono
eyebrows, the NOS palette, Cormorant Garamond as the display face, oldstyle
figures, and the emblem.

---

## 2. Token table — `app/(marketing)/national-show/nos-theme.css`

The block to supersede is the `:where(.nos-theme)` custom-property block currently
at lines ~165–178.

| token | before (M6) | after (M7) | why |
|---|---|---|---|
| `--radius-card` | `10px` | `0` | R1 — radius 0 on cards |
| `--radius-lg` | `16px` | `0` | R1 — no softened large surfaces |
| `--radius-button` | *(absent)* | `2px` | R1/R2 — buttons are 2px, and the value needs a name so `Button.tsx` stops reaching for `--radius-pill` |
| `--radius-pill` | `999px` | `999px` | **unchanged** — R2 reserves it for eyebrow pills |
| `--border-primary` | `1.5px` | `1px` | R1 — elevation is a 1px border, not a shadow; 1.5px is a half-pixel hairline that renders inconsistently |
| `--border-hairline` | `1px` | `1px` | unchanged |
| `--shadow-card` | two-layer purple-tinted shadow | **deleted** | R1 — elevation is expressed as a border |
| `--ease-nos`, `--dur-*` | — | unchanged | motion is not part of this ruling |

`app/globals.css` already carries the parent grammar and is **not** edited by this
milestone: `--display-xl` (line ~41), `--radius-0: 0` (~77), `--radius-1: 2px`
(~78), `--radius-pill: 999px` (~79). `nos-theme.css` is the sole override, so it
is the sole file that has to change.

`--radius-button: 2px` may instead be implemented as `--radius-button:
var(--radius-1)`. Either is acceptable; a literal `2px` in a NOS-scoped block is
not a drift risk because the contract measures the computed value in a browser,
not the token text.

⚠️ **`var()` resolves at the element that declares it, not the element that uses
it.** This cost three defects earlier in this mission. `--radius-button` must be
declared in the same `:where(.nos-theme)` block that the components inherit from —
declaring it on, say, `:root` inside a scoped stylesheet and reading it from a
`.nos-theme` descendant is a different resolution and will silently give the wrong
value.

---

## 3. Consumers that must change with the tokens

`--shadow-card` has exactly three consumers. Deleting the token without deleting
these leaves `shadow-[var(--shadow-card)]` resolving to nothing — visually correct
by accident, and dead code by the project's own standard.

| file:line | current | after |
|---|---|---|
| `components/nos/Card.tsx:18` | `'shadow-[var(--shadow-card)]'` | removed; the card's existing `border-[length:var(--border-hairline)]` carries the elevation |
| `components/nos/CycleStep.tsx:27` | `'bg-primary text-ivory shadow-[var(--shadow-card)]'` | `'bg-primary text-ivory'` |
| `app/(marketing)/national-show/archive/page.tsx:110` | long class string containing `shadow-[var(--shadow-card)]` | same string with the shadow utility removed |

`components/nos/Button.tsx:59` — base class list changes
`rounded-[length:var(--radius-pill)]` → `rounded-[length:var(--radius-button)]`,
and any `border-[1.5px]` becomes `border-[length:var(--border-primary)]`. This is
the change that R2 is about: *"Buttons are 2px. A full pill on a hero CTA
contradicts `--radius-1` and reads as a different system."*

---

## 4. Pill allowlist — the only places `--radius-pill` may survive

R2 reserves pill radius for eyebrow pills. After M7 the pill token has exactly
these consumers:

| file:line | element | allowed because |
|---|---|---|
| `components/nos/Badge.tsx:29` | badge chip | it *is* the eyebrow pill |
| `components/nos/PastEditionCard.tsx:60` | edition-year chip over the thumbnail | eyebrow pill |
| `components/nos/PastEditionCard.tsx:76` | metadata chips | eyebrow pill |
| `components/nos/CycleStep.tsx:34` | step eyebrow chip | eyebrow pill |

One further exception, explicitly allowlisted rather than silently tolerated:

| `components/nos/CycleStep.tsx:41` | `rounded-full` on an `h-3 w-3` rail node | a 12px **circle**, not a pill. Radius grammar governs panels and controls; a round dot is a shape, and squaring it would read as a bug. |

Anything else in `components/nos/` carrying a pill or a named-scale radius is a
violation. The check for this is a **browser** check (computed `border-radius`
against this allowlist), not a grep — a grep cannot see radius arriving through
a class the file does not name.

---

## 5. Banned in `components/nos/` after M7

- `shadow-[` (arbitrary-value shadow utilities)
- `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`
- `rounded-sm|md|lg|xl|2xl|3xl` (named radius scale — the NOS surfaces are 0 or 2px)
- `rounded-full` outside the single allowlisted rail node above

`focus-visible` outlines are **not** shadows and are untouched by this ban. Ring
geometry is governed by §6.

---

## 6. Focus rings are re-measured, never assumed

R2 corollary: *"changing a button from pill to rectangle moves the focus ring
relative to the label. Re-measure the ring; a ring that cleared a pill can foul a
tight corner."* R6/2 says the same for every re-skinned control.

The M7 button focus ring is therefore a **measured** assertion, not a grep for
`outline-2`: focus each hero action from the keyboard and confirm a visible
indicator on all four edges *and* at all four corners of the 2px-radius box. A
pill's ring has no corners to foul; a rectangle's does, and that is precisely the
regression R2 predicts.

---

## 7. Measurement caveat, on the record

Tailwind v4 serialises opacity-modified colours as `oklab(...)`. Regex-parsing
`getComputedStyle(el).color` for an `rgb()` triple therefore returns plausible,
wrong numbers — filed as **InunuNet/SAOC#3**. Every contrast figure in the M7
contract is measured at the **composited pixel** (screenshot sample), never from
a computed style string and never from a token value. Any verifier that parses a
colour string to produce a contrast ratio is wrong by construction, whatever
number it prints.
