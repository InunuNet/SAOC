# Golden: F2 — exhibitor "not yet open" messaging

## `app/(marketing)/national-show/exhibitors/page.tsx`

A static (non-Sanity-driven) notice, rendered as real JSX between `<PageHero>` and
`<ExhibitorKeyDates>`, containing the literal phrase **"not yet open"** (case-insensitive)
in reference to exhibitor ticket sales. Matches this page's existing pending-status voice
(compare `ConfirmationBadge.tsx`'s fallback labels "To be confirmed" / "Not yet confirmed") —
plain, factual, no invented date, no invented process step. This is a fixed conditional in
the component tree, not a comment, not a `<Metadata>` string, not a data-fetch-only value.

## `app/(marketing)/national-show/tickets/page.tsx`

The `OPTIONS` array's `id: 'exhibitor'` entry:
- `body` no longer reads as an action-now instruction — must NOT contain the literal string
  `"Register your entries"`. Must contain wording establishing sales are not yet open (e.g.
  "not yet open" / "opens closer to the show" — same voice family as the exhibitors-page
  banner).
- `cta: 'Exhibitor entry'` and `href: '/national-show/exhibitors'` — unchanged. This is a
  copy-only fix; the destination was already correct.

## Guardrails (both files)

No invented specific date is introduced by this change — the new/changed text must not
contain a 4-digit year or a day-of-week name (that would be a fabricated commitment no one
has made; the honest claim is only "not yet open").
