# MobileMenu focus trap — F1

## The defect

`components/chrome/MobileMenu.tsx` renders the mobile nav drawer as a plain
`role="dialog" aria-modal="true"` overlay (`components/chrome/MobileMenu.tsx:35-40`) with no
focus management at all: opening it does not move focus into the drawer, `Tab`/`Shift+Tab`
walk straight through the drawer's own controls and out into whatever is behind the overlay
(header search button, primary nav, page content, footer), and closing it (via the X button,
backdrop click, or a nav link) does not return focus to the hamburger trigger that opened it.
The background page is not `inert`/`aria-hidden` either, so a screen reader user tabbing or
using virtual-cursor navigation is exposed to content that is visually covered by the
overlay. Flagged real by @qa during `backlog-a11y-ui-quickfixes` (2026-08-21/22).

`components/chrome/SearchOverlay.tsx` is a sibling overlay with the same `role="dialog"`
shape. It is NOT a complete focus-trap reference: it focuses its input on open and closes on
Escape, but it does not cycle Tab within itself, does not return focus to a trigger, and does
not mark the background inert. It is not a golden pattern to copy for those parts — do not
extend its behavior beyond what already works (initial-focus-on-open, Escape-to-close), and
do not add trap logic to it — it is out of scope for this feature.

## No focus-trap dependency exists

`package.json` has no `focus-trap`, `focus-trap-react`, `@radix-ui/*`, `@headlessui/*`, or
`react-aria` dependency. Adding one for a single drawer is a larger change than this defect
warrants. The fix is a hand-rolled `useFocusTrap` hook, colocated with the project's one
existing hook at `lib/hooks/useCountdown.ts` (i.e. `lib/hooks/useFocusTrap.ts`).

## Fix shape

- `lib/hooks/useFocusTrap.ts` — a hook taking (at minimum) an `active: boolean` flag and a
  ref to the trap container, that:
  - on activation, moves focus to the first focusable element inside the container (the
    drawer's close button, since it is the first focusable element in DOM order — see
    `mobile-menu-spec.golden.md`);
  - on `Tab`/`Shift+Tab` while active, cycles focus only within the container's focusable
    elements (wraps from last to first and first to last — never lets focus leave the
    container while active);
  - on `Escape` while active, calls a close callback;
  - on deactivation, returns focus to a previously-focused/trigger element reference.
- `components/chrome/MobileMenu.tsx` — wires the hook to its outer `role="dialog"` container,
  applies `inert` (with an `aria-hidden="true"` fallback for browsers/test environments
  without `inert` support) to sibling page content while `open`, and passes the hamburger
  trigger element through so focus returns to it on close.
- `components/chrome/Header.tsx` — the hamburger `<button aria-label="Open menu">`
  (`components/chrome/Header.tsx:161-168`) needs a ref threaded down (or an equivalent
  mechanism) so `MobileMenu`/`useFocusTrap` can return focus to it on close. This is the only
  change permitted in `Header.tsx` — no other markup, styling, or desktop nav/search/CTA
  behavior changes.

## What this contract does NOT do

- Does not touch `components/chrome/SearchOverlay.tsx`, `components/chrome/MegaMenu.tsx`, or
  `components/chrome/nav-config.ts`.
- Does not add a focus-trap npm dependency.
- Does not change the drawer's visual design, animation, or the `/contact` link added by
  `contact-mobile-nav-fix`.
- Does not change desktop nav, desktop search, or the desktop Contact CTA in `Header.tsx`.

## Verification posture

Per this project's `coding.md`, DOM attribute presence (grepping for `inert` or `tabIndex`)
does not prove the trap works — it must be proven by real keyboard input. This feature's
gating assertion is an **automated** Playwright script
(`contracts/checks/mobilemenu-focus-trap-f1/check-focus-trap.mjs`), not a one-off manual
BrowserAgent pass: it uses `page.keyboard.press('Tab' | 'Shift+Tab' | 'Escape')` against a
running dev server, matching the house pattern already used in
`contracts/checks/show-visitor-info/check-faq-keyboard.mjs`. This makes the a11y proof
repeatable at the contract gate instead of a one-time human judgment call.
