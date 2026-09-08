# M8 golden — focus affordance in the NOS layer (R9)

Binding reference for F24. Ruling text: `.agent/memory/project/design/nos-design-rulings.md` §R9.
Where this file and a memory of the ruling disagree, the ruling wins and this file is wrong.

---

## 0. The defect this closes

R9 is not a hypothetical. Two distinct failures ship today inside `.nos-theme`.

### Defect A — `box-shadow` rings at 40% alpha (R9/1 + R9/2)

Nine call sites across six files, all rendered under `/national-show/vendors/**` and therefore
all inside `.nos-theme`:

| file:line | class |
|---|---|
| `components/vendors/VendorFormField.tsx:21` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorApplyForm.tsx:255` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorRegistrationCodeEntryForm.tsx:111` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorRegistrationCodeEntryForm.tsx:118` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorElectricalEquipmentTable.tsx:24` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorElectricalEquipmentTable.tsx:26` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorGasEquipmentTable.tsx:22` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorGasEquipmentTable.tsx:24` | `focus-visible:ring-2 focus-visible:ring-ink/40` |
| `components/vendors/VendorRegisterForm.tsx:133` | `focus-visible:ring-2 focus-visible:ring-ink/40` |

`VendorFormField.tsx:21` is the shared input class, so its single line paints the ring on
**every field** of the full vendor registration form — the longest and highest-risk form in
the section, and by R6/5 the one where restraint and clarity matter most.

Measured, at the composited pixel:

| | value | ratio |
|---|---|---|
| `ring-ink/40` over `--ivory` `#fbfaf0` | `#a4a0b3` composited | **2.43:1** — fails the 3:1 floor |
| `ring-ink/40` over `--bone` `#f3f2d6` | `#9f9ca3` composited | **2.38:1** — fails |
| the same `--ink` `#211a57` at **full alpha** | `#211a57` | **14.84:1** |

That third row is the whole of R9/2 in one number. The colour was never the problem. The
`/40` cost six times the contrast, for a visual softening nobody asked for. Opacity is not a
contrast instrument — R4 says so about scrims, R9/2 says so about rings, and this is the same
rule read from two ends.

Tailwind's `ring-*` utilities are implemented as `box-shadow`, which additionally breaks R9/1
on its own terms: a box-shadow ring is clipped by any `overflow: hidden` ancestor, does not
follow an inset border radius the way `outline` does, and disappears entirely in
forced-colors mode.

### Defect B — one ring colour for two grounds (R9/3)

`nos-theme.css:152` declares a single token:

```
--ring-focus: #7e3f97;
```

Violet on pale gold measures **6.58:1** — good. The same violet on `--primary-800` `#1a1445`
measures **2.48:1**, below the floor. Any NOS control on a purple ground gets an
almost-invisible focus ring today. R9/3 names this exactly: *the single-ring instinct is what
produced this failure.*

### What is already correct — do not "fix" it

Every NOS-owned component already uses `outline` + `outline-offset` + `var(--ring-focus)`:
`components/nos/Button.tsx:62-63`, `components/nos/SectionNav.tsx:36`,
`components/nos/NosEventCard.tsx:25-26`, `components/nos/VisitorLinkCard.tsx:20-21`,
`app/(marketing)/national-show/archive/page.tsx:108-110`, and — added by M7, missed by this
list on first writing — the masthead lockup link, `app/(marketing)/national-show/layout.tsx:64`.

These satisfy R9/1 and R9/2 as written. Their only defect is inherited from Defect B — they
read the single-colour token. **Fixing the token fixes them with no call-site edit.** A `@dev`
that rewrites these six sites has done unrequested work and increased the diff for nothing.

#### The masthead's `outline-offset-4` — resolved 2026-09-08, deliberately

The masthead link is the one site carrying `outline-offset-4`; the other five all carry
`outline-offset-2`. §2's reset is unlayered and therefore beats the utility, so it takes the
masthead to 2px along with everything else. **That is the accepted outcome. The system is
uniform at 2px offset, by decision and not by accident.**

It was put to this contract as a possible silent regression — a deliberate 4px for the larger
lockup, quietly shrunk by a rule aimed at other sites. Three checks say it was not deliberate:

- `git show 9dd8446a:…/layout.tsx` has **no outline on the masthead at all**. The whole `<Link>`
  arrived as one `+` block in M7's still-uncommitted working tree — days old, this same mission,
  not a standing design intention M8 is overriding.
- Nothing pins it. M7's contract and goldens assert only that the lockup renders in the masthead
  and colophon; no assertion reads the offset.
- The file argues for every other choice it makes — the `header`/`footer` landmark mapping, the
  `data-nos-*` handles, why the colophon lockup is deliberately not a link. The 4px is the one
  value in that block with no comment. In prose this dense, silence is evidence.

And the visual argument for a wider offset does not apply here: the masthead ground is flat
`bg-parchment`, not photography, so there is no busy edge for the ring to clear.

**Consequence @dev must carry out:** the reset supplies all four properties, so
`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
focus-visible:outline-[var(--ring-focus)]` on that link is now dead — classes that read as
intent and produce nothing. Strip them; leave `inline-block`. A class that lies to the next
reader is worse than either offset. The masthead then takes its ring from the theme, like the
nine, which is the point of the reset.

**If a genuine per-site offset deviation ever arrives**, the mechanism is
`outline-offset: var(--ring-offset, 2px)` in the reset plus a local `--ring-offset` at the
deviating site — not a second `:not()`. Do not add that token now; nothing needs it, and an
unused indirection in this file is exactly the confusion §1 already had to warn about.

---

## 1. The token set

```
.nos-theme {
  --ring-focus-on-light: #7e3f97;   /* violet, for pale grounds  */
  --ring-focus-on-dark:  #fbfaf0;   /* pale gold, for purple grounds */
  --ring-focus: var(--ring-focus-on-light);
}
.nos-theme .nos-on-dark {
  --ring-focus: var(--ring-focus-on-dark);
}
```

`--ring-focus` is retained as the consumed name **on purpose**: it is the name the five
correct call sites already read, so the ground flip reaches them without touching one line of
TSX. Same alias shape as the status tokens, same reason it is safe — see
`status-tokens.golden.md` §2, "Why the alias indirection is safe here". `.nos-on-dark` is one
class doing both jobs; @dev applies it once per dark section, not once per token family.

### Measured, across every ground the NOS layer actually paints

| ring | ground | measured |
|---|---|---|
| `#7e3f97` | `--parchment` / `--ivory` `#fbfaf0` | 6.58:1 |
| `#7e3f97` | `--bone` `#f3f2d6` | 6.07:1 |
| `#7e3f97` | `--primary-100` `#ece8f5` | 5.72:1 |
| `#7e3f97` | lilac-pale `#eae2f3` | 5.47:1 |
| `#fbfaf0` | `--primary-800` `#1a1445` | 16.29:1 |
| `#fbfaf0` | `--primary` `#211a57` | 14.84:1 |
| `#fbfaf0` | `--night` `#0e0b24` | 18.35:1 |
| `#fbfaf0` | `--primary-700` `#33296f` | 11.87:1 |

**R9/4: 3:1 is the floor, not the target.** The worst case here is 5.47:1 — 1.8× the floor.
That headroom is the point: a ring that lands at 3.1:1 is one ground-colour tweak away from
failing again, and this section's grounds are still being tuned. The assertion enforces the
3:1 floor, but a proposal that merely scrapes it should be rejected in review.

---

## 2. The reset — how the nine defective sites get fixed

**Do not rewrite the nine `focus-visible:ring-*` call sites.** Those class strings are shared
with SAOC routes outside `.nos-theme` (`components/vendors/*` renders under
`/national-show/vendors/**`, but the same components and the same idiom appear across
`components/tickets/*`, `components/admin/*` and `components/chrome/*`). Editing the string
changes SAOC surfaces this mission has no mandate over, and R8/2's reasoning applies
unchanged: do not open what is not ours.

Fix it with one scoped, **unlayered** rule in `nos-theme.css`:

```
.nos-theme :focus-visible {
  outline: 2px solid var(--ring-focus);
  outline-offset: 2px;
  box-shadow: none;
}
```

Three properties, three jobs:

- `outline` — installs the compliant affordance (R9/1).
- `outline-offset` — the honest way to say "the ring sits outside the control". R9/1 records
  that the inner pale-gold layer in the old treatment was *a spacer wearing a focus ring's
  clothes*; this replaces it with the property that actually means it.
- `box-shadow: none` — removes the `ring-*` shadow so there is one indicator, not two.

**Why unlayered.** Tailwind v4 emits utilities inside `@layer utilities`. In the CSS cascade,
unlayered declarations beat layered ones regardless of specificity, so this rule overrides
`focus-visible:outline-none` and `focus-visible:ring-2` without a single `!important` and
without raising specificity. Put it outside any `@layer` block in `nos-theme.css`.

### The double-ring hazard — check this, it is the likely regression

`NosEventCard.tsx:25-26` and `VisitorLinkCard.tsx:20-21` deliberately set
`focus-visible:outline-none` on the focused `<Link>` and draw the ring on the **inner** `Card`
via `group-focus-visible:outline-*`. The blanket reset above would restore an outline on the
Link as well, producing two concentric rings. `archive/page.tsx:108-110` follows the same
pattern and needs the same check.

The invariant, not the mechanism, is what is asserted: **exactly one visible focus indicator
per focused element.** The recommended mechanism is a carve-out on the Tailwind group marker
(`.nos-theme :focus-visible:not(.group)`), which leaves the group pattern's deliberate
delegation intact. @dev may choose another mechanism if it holds the invariant — the verifier
measures rendered rings, not selectors.

---

## 3. Non-goals

| out of scope | why |
|---|---|
| `app/globals.css` | The SAOC base layer. Same boundary as R8/2. |
| `components/tickets/CategoryTicketsPage.tsx` | Explicitly excluded by the dispatch brief. |
| `components/chrome/*` (MegaMenu, MobileMenu) | Site chrome sits **outside** `.nos-theme`, which is applied only at `app/(marketing)/national-show/layout.tsx:32` and wraps route children only. |
| `components/vendors/VendorStandPaymentForm.tsx` | Marked SAOC-owned and untouched at `app/(marketing)/national-show/vendors/payment/page.tsx:58`. Left alone. |
| rewriting the nine `focus-visible:ring-*` strings | §2. Shared with SAOC routes. |
| the five already-correct NOS outline sites | §0. The token fix reaches them. |

`components/tickets/*` and `components/admin/*` carry the identical `ring-*` defect and are
**not** fixed here. They are recorded so the audit sent to the SAOC session is complete.

---

## 4. Verification

**Focus is never inspected by reading the stylesheet** — R9's closing line, and it is load-bearing
here. Reading `nos-theme.css` would show a correct rule and prove nothing about whether an
`overflow: hidden` ancestor clips the result, whether a `ring-*` shadow still paints underneath,
or whether the ground under a given control is the one @dev assumed when applying `.nos-on-dark`.

The verifier must:

1. Tab to each focusable control under `.nos-theme`, at 390 and 1280.
2. Capture the control's bounding box **unfocused and focused**, and diff the two rasters —
   this is what proves a ring exists at all, and it is how the one-indicator invariant is
   counted (a double ring shows as two distinct changed bands).
3. Measure the ring pixel against the adjacent ground pixel at the composited level, with a
   negative control proving the metric can report a failure.
4. Assert the ring is fully opaque: identify the painted ring colour by fitting the composited
   pixel to the ground→token line (`mixFit`, from the R6 probe). A ring at `α<1` fits at a
   mix fraction below 1 and fails; a full-alpha ring fits at 1.0. This detects the `/40`
   defect class **without** parsing a colour string, which Tailwind v4 serialises as
   `oklab()`/`color()` and which returns plausible, wrong numbers (InunuNet/SAOC#3).
5. Assert `outline-width > 0` and `box-shadow` resolving to `none` on the focused element —
   as a *corroborating* structural check only, never as the contrast measurement.

Full harness contract: `verifier-contract.golden.md`.
