# F1 — AdminNav visible active-page indicator + hamburger disambiguation

## Problem

Commit 51973a9 shipped `components/admin/AdminNav.tsx` with a current-page indicator that
exists only in the DOM, not on screen. The link list already computes `active = pathname ===
link.href` and conditionally applies `active ? 'text-primary' : ''` — but every link's base
class already includes `text-ink`, and `--color-ink` (`#171917`) and `--color-primary`
(`#384138`) are close enough in luminance, at `--body-sm` (14px) weight-400 text, that a
`BrowserAgent` zoomed 5x on the 1440px screenshot could not find the active link, and a
manual review of `_admin__1440px__withcap.png` confirmed the same: Dashboard, Door Scanner,
and Vendors render in identical weight, size, and (to the eye) colour on every `/admin*` page,
at every width. The nav tells you where you can go but never where you are.

`admin-nav-menu`'s A4 (`grep -q "usePathname"`) and its A13 real-browser suite both passed
against this code, because A4 only proves the *mechanism* (deriving `active` from the route)
exists, and none of A13's sub-cases ever asked "is the active link visually distinguishable" —
only "is the right link present/reachable/tabbable". This is the project's own named defect
class (`.agent/memory/project/learned.md`'s "assertion satisfiable by something that isn't the
real property") showing up as a visual bug instead of a logic bug. See
[[admin-nav-menu]]'s golden, "The nav is presentation, not authorization" section, for the
component this extends — this feature does not change that boundary.

Second, smaller defect: at 375px and 320px, `Header.tsx`'s own hamburger (`aria-label="Open
menu"`, `<Menu size={22}>`, `h-10 w-10 border border-rule bg-ivory`) sits directly above
`AdminNav`'s mobile/minimal trigger (`aria-label="Admin menu"`, `<Menu size={20}>`, `h-10 w-10
border border-rule bg-ivory`) — same icon, same border treatment, same background, near-
identical size, stacked vertically. Both are `aria-label`-only icon buttons: a screen reader
tells them apart; a sighted user visually cannot without tapping one, and `_admin__375px__
withcap.png` / `_admin__320px__withcap.png` confirm it.

## Fix — active-link indicator

`renderLinkList()`'s active branch (`components/admin/AdminNav.tsx`, the `active ? '...' :
''` ternary) gets **two independent, redundant visual signals** instead of a colour-only one,
using only tokens already defined in `app/globals.css` — no new brand colours, per `CLAUDE.md`:

1. **Background chip** — active link gets `bg-primary-100` (`--color-primary-100`,
   `#e8e6dc`) with the existing `rounded-sm` radius; inactive links keep the current
   transparent background. `--primary-100` already exists as a token (`app/globals.css`
   `:root`) and is not new brand vocabulary — it is presently unused anywhere in the codebase
   for exactly this kind of "quiet emphasis" job.
2. **Font weight** — active link becomes `font-semibold` (weight 600); inactive links stay at
   the sans body default (weight 400, `font-sans` inherits normal). A 200-unit weight delta is
   the standard threshold Tailwind's own scale treats as a distinct step (400 → 600 skips the
   500 "medium" step entirely, so there is no ambiguous middle value a near-miss implementation
   could land on and still read as "different but not really").

Text colour (`text-primary` on active, already present) is kept as a third, lower-weight
signal — three signals is not overkill, it is what makes the fix resistant to a future edit
that removes any single one of them without anyone noticing the regression visually.

`aria-current="page"` (already present) is kept unchanged — it is correct and necessary for
screen readers, but per the dispatch brief it is invisible to sighted users and must never be
the proof this feature is fixed. The load-bearing assertion is real-browser computed style, not
a grep for this attribute (see `execution/checks/verify_admin_nav_active_state.ts`, cases
"active link background chip" / "active link font-weight").

**Concrete false state each signal individually would let through, and why redundancy closes
it:** a future PR that removes the background chip but leaves `font-semibold` still passes the
font-weight assertion; the background-colour assertion catches that regression. A PR that
removes `font-semibold` but leaves the chip still passes the weight assertion; the background
assertion catches it. A PR that leaves `active ? 'text-primary' : ''` as the *only* change
(today's shipped state) fails both — this is the concrete proof today's code does not satisfy
the new contract.

No layout shift: the chip's padding reuses the link's existing `px-3 py-2` box (no size change
between active/inactive states — only what's painted inside that box changes), so no reflow of
sibling links when the active one changes across a navigation.

## Fix — hamburger disambiguation

`AdminNav`'s trigger button (both the `bar` variant's collapsed-mobile trigger and the
`minimal` variant's single trigger — same JSX shape, both currently `icon-only`) gains a
visible text label, **"Admin"**, rendered inside the button next to the `<Menu>`/`<X>` icon,
using the existing `font-sans text-[14px]` vocabulary already used elsewhere in this
component (the sign-out button and link list both already use that exact class pair — no new
type scale). `Header.tsx`'s own hamburger is deliberately left untouched (it is not part of
this feature's file scope, and it is the "default" one — the *admin* trigger is the one that
needs to explain itself, since it's the newer, less-expected element on the page).

The button changes from a fixed `h-10 w-10` square to `h-10 w-auto` with `gap-1.5 px-3` so the
label has room — height stays exactly 40px (well under the `minimal` variant's existing
56px-max contract from `admin-nav-menu`'s A13 case 3, so [[admin-nav-menu]]'s
"no persistent bar on /admin/door" guarantee is untouched; only the button gets a few pixels
wider, not taller). Concrete false state a same-size icon swap would produce: a different icon
(e.g. a "person" glyph instead of a hamburger) still leaves two icon-only squares that read as
"two different logos", not "site menu vs. admin menu" — a sighted user still has to guess which
does what. Text disambiguates by naming the thing; an icon swap alone does not.

**Concrete false-state check:** an implementation that keeps the button icon-only but changes
its `aria-label` string (already true today — the labels already differ: "Open menu" vs
"Admin menu") passes any assertion that reads accessible names, and is exactly the state the
dispatch brief said is insufficient. The load-bearing assertion must read visible rendered
text via the DOM/computed style, not `aria-label`.

## What this feature explicitly does NOT do

- Does not touch `Header.tsx` or `MobileMenu.tsx` — the site's main nav hamburger is unchanged.
- Does not add any new color token to `app/globals.css` — `--primary-100` already exists.
- Does not change `AdminNav`'s prop surface (`variant`, `canReviewVendors`) or give it any new
  import of `getAdminSession`/`hasCapability` — it stays presentation-only, per
  [[admin-nav-menu]]'s "nav is presentation, not authorization" rule, which this feature must
  not regress.
- Does not change `/admin/door`'s variant away from `"minimal"`, and does not reintroduce a
  persistent bar there — the trigger only gets wider, never taller, never a bar.
- Does not change any keyboard focus ring behavior — `admin-nav-menu`'s A13 case 4 (tab focus
  rings visible on every interactive element) must stay green unmodified.
