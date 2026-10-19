# nos-critique-r20 F2: adjacent same-tone sections share one rhythm unit

BASE: `origin/main` `a4807791`. Branch `fix/nos-critique-r20`. Ruling: Codi, FINAL, P2 craft floor (spacing rhythm), relayed by the lead on
2026-10-20. The scope is separate from F1 and F3. Goldens: `f2-edits.json` (the exact rule block, routes, target), `f2-footprint.json`,
`f2-baseline.json` (BASE pairs).

## The defect

/national-show/what-to-expect at 1280 has a 262px gap between the Accessibility card and the next section. Two adjacent default-tone
`NosSection`s each carry the section rhythm `clamp(72px, 9vw, 120px)` (nos-structure.css:31-34): the first as its padding-bottom, the
second as its padding-top. So the gap is 120 + 120, plus the cards' own spacing. The workshops page at 390 is already fixed, at 64px, and
must neither regress nor collapse twice.

## How tone is expressed (verified in code)

`components/nos/NosSection.tsx` `TONE_CLASSES`:

| tone | classes |
|---|---|
| default | none |
| gold | `nos-section-gold` |
| royal | `nos-section-royal nos-on-dark` |
| black | `nos-section-black nos-on-dark` |

There is one exception. `components/show/VisitDisclosure.tsx:309` paints a default-tone `NosSection` gold with `className="bg-[var(--gold)]"`.
That section is its own ground, so a `bg-` utility excludes it from the default-ground match.

Existing collapses this rule must not double:
- the hub's explicit `.nos-section-joined` (F17, nos-structure.css:540);
- the r12 status-disclosure rule (551-563, which also sets the leader to 40px);
- the r14 tickets-hub rule (568-570).

Each of them already sets the follower's padding-top to 0. The new rule also sets 0, so the result is the same and no gap shrinks twice.

## The rule (exact, `f2-edits.json` `css`)

One rule block, in its own place directly after the r14 rule (BASE line 570). It sets `padding-top: 0` on the follower of two adjacent
sibling `.nos-section`s on the same ground:
- default ground: neither section carries a tone class or a `bg-` utility;
- gold + gold;
- royal + royal;
- black + black.

Different-ground neighbours keep both paddings. No token, no colour, no other rule is touched. One rhythm unit remains: the leader's
padding-bottom, which is 120px at 1280 and 72px at 390.

Not chosen:
- a bare `.nos-section + .nos-section`, because it would also collapse different-ground neighbours, where both paddings sit on different
  colours and read as two bands;
- a `:has()`-based ground comparison, because CSS cannot compare computed backgrounds;
- per-page `nos-section-joined` classes, because they need page edits and drift with every new page.

## Checks

- **A3, static (`f2-static.mjs`):** nos-structure.css equals BASE plus exactly this block; docs F2.
- **A4, rendered (`f2-rendered.mjs`):** both modes, at 1280 and 390, on the 15 NOS content routes (golden `routes`), checking every
  adjacent section pair.
  - P1, same tone: the follower's padding-top is 0 and the gap is BASE minus the follower's BASE padding-top. A pair already collapsed at
    BASE keeps its gap, which covers the workshops page.
  - P2, different tone: unchanged.
  - P3: the same pairs as BASE, and no overflow.
  - P4: what-to-expect at 1280 loses exactly one 120px padding after "Accessibility".
- **A5, nonreg:** puts each removed band back (its BASE height, in the follower's ground) and holds every other pixel and box above the
  footer to BASE. That covers the hub, about, workshops and what-to-expect.
