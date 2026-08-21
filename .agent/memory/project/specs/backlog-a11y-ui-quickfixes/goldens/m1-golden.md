---
mission: backlog-a11y-ui-quickfixes
milestone: M1
features: [F1, F2, F3, F4, F5]
date: '2026-08-21'
---

# M1 Golden — five independent a11y/UI quickfixes

Verified against the actual current source (not the backlog's possibly-drifted
file:line references) on 2026-08-21. Two of the mission's premises turned out
inaccurate on inspection — noted below so @dev doesn't waste time hunting for
something that was never real.

## F1 — Footer dead link

`components/chrome/Footer.tsx` around line 116-123 (the "Looking for wild orchids?"
block, Col 4). **This is already fixed in the working tree** (uncommitted, per
`git status` at mission start): `href="https://wildorchids.co.za"`, no `wosa.org.za`
string remains anywhere in the file. @dev's job here is to confirm this state holds
(don't revert it) — there may be nothing left to do but verify + let it ride into the
commit.

## F2 — Invisible focus rings on cream-background buttons

**Premise correction:** the brief says "header/footer nav links already do this
correctly with a near-black outline" — on inspection, `components/chrome/Header.tsx`'s
primary nav `<Link>` (~line 111-128) and `Footer.tsx`'s nav links have **no explicit
focus classes at all** (they fall through to the bare browser default). That claim
does not hold; do not go looking for a nav-link focus pattern, there isn't one.

What **does** already exist, established and reused across the vendor registration
form (`components/vendors/VendorCheckboxField.tsx:13`, `VendorBooleanRadioField.tsx:23`,
`VendorRadioGroupField.tsx:22`, `VendorCheckboxGroupField.tsx:22`) is a near-black
focus-ring token: `focus:ring-2 focus:ring-ink/40` — `--ink: #171917`
(`app/globals.css:17`), genuinely near-black, on the cream `--ivory: #f4f3ec`
(`app/globals.css:14`) body background the brief describes. This is the token F2
must reuse — not invent a new one.

Confirmed invisible/missing-focus instances:
- `components/tickets/TicketPurchaseForm.tsx` submit button ("Buy Ticket", ~line
  86-92) — **no focus-visible classes at all** today.
- `components/tickets/DownloadTicketButton.tsx` button ("Download ticket", ~line
  105-113) — has `focus-visible:outline focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-accent`, which is a
  *different* token (brass, not the near-black one) — replace/supplement with the
  near-black ring token so it matches the rest of the site rather than inventing its
  own third pattern.

Fix: add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40
focus-visible:ring-offset-2` (or the closest idiomatic equivalent using
`ring-ink/40`) to both buttons above, and to any other button sharing the same
cream/parchment/ivory background that currently has no focus-visible ring — the
token change should fix all of them at once if scoped as a shared button class
rather than repeated per-instance, but do not refactor button components beyond
what's needed to land the fix.

## F3 — Low-contrast form error text

Confirmed current component names (unchanged from the brief): `ContactForm`
(`components/contact/ContactForm.tsx`) and `TicketPurchaseForm`
(`components/tickets/TicketPurchaseForm.tsx`).

- `ContactForm.tsx:166` — inline error `<p role="alert"
  className="font-sans text-[14px] text-[var(--accent)]">`.
- `TicketPurchaseForm.tsx:75` (`cart.cartError`) and `:81`
  (`cart.status === 'error' && cart.errorMessage`) — both `<p role="alert"
  className="font-sans text-[13px|14px] text-accent">`.

The admin pages' existing bordered-callout error pattern (13.6:1 contrast) —
`components/admin/DoorResultBanner.tsx:42-49` and
`app/admin/login/LoginFormFields.tsx:72-79` — both key on **`bg-bone` +
`text-primary-800`** inside a bordered box (`border-2 border-primary-800` in
DoorResultBanner; `border border-rule` in LoginFormFields). Reuse that same
`bg-bone` + `text-primary-800` + `border` combination for the three error
paragraphs above. Do not touch admin forms (already correct) or any other
`text-accent` usage outside these two files' error paragraphs (`CartDayPicker.tsx`,
`TicketFormField.tsx`, `DownloadTicketButton.tsx` also use `text-accent` for error
text — out of scope for F3, the mission brief names only ContactForm and
TicketPurchaseForm).

## F4 — ShowBand.tsx 375px horizontal overflow

`components/home/ShowBand.tsx:98` — `<div className="relative aspect-[4/3]
md:aspect-auto min-h-[400px]">` wrapping the `next/image fill` hero image, inside a
`grid-cols-1 md:grid-cols-2` section (line 96) with no `max-w-full`/`w-full` guard
on the image column below the `md:` breakpoint. Fix the overflow without changing
desktop (`md:` and up) visual intent — the `md:aspect-auto` branch is unaffected by
whatever bounding fix is applied below `md:`. This is a rendered-layout property;
grep cannot prove absence of horizontal overflow, hence A9's browser check below.

## F5 — PartnersSection accessible name concatenation

`components/home/PartnersSection.tsx:68-77` — the anchor's `content` fragment has a
`name` span (line 70) immediately followed by a conditional `description` span
(line 72), no whitespace/separator text node between them, so the anchor's
accessible name concatenates: e.g. "Wild Orchids of Southern AfricaPartner
organisation hosting…". Fix with a `{' '}` separator between the two spans, or an
`aria-label` on the `<a>` — whichever is the smaller, more idiomatic fix given the
surrounding JSX (a `{' '}` between the closing `</span>` of the name and the opening
`{card.description ? (` conditional is likely the smallest diff). Applies only to
the `card.website` branch (the `<a>`, lines 79-88) — the plain `<div>` fallback
(lines 89-93) has no accessible-name concatenation risk since it isn't a single
interactive element exposing one accessible name via a browser's flattening
algorithm, but fix both branches identically for consistency since they render the
same `content` fragment.
