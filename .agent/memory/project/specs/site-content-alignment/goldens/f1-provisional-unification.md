# F1 — Provisional-content marker unification spec

Structural spec for F2 (implementation feature). No new visual treatment is
designed here — none is licensed; the handoff has no coded component for this
(see Open Question 8 below). This spec unifies the *implementation*, not the
*look*.

## What exists today (5 treatments, per research §4)

| Component | File | Status vocabulary | Root markup |
|---|---|---|---|
| `ProvisionalFigure` | `components/ui/ProvisionalFigure.tsx` | boolean (always "provisional") | `<mark data-provisional-figure="true">` |
| `ExhibitorStatusBadge` | `components/show/ExhibitorStatusBadge.tsx` | `confirmed` / `research` / `question` / anything else → `pending` | `<p data-exhibitor-marker={marker}>` |
| `ConfirmationBadge` | `components/show/ConfirmationBadge.tsx` | `confirmed` / `research` / anything else → `pending` | `<p\|span data-confirmation-badge={...}>` |
| `SocietyFacts` placeholder | `components/societies/SocietyFacts.tsx:24,53,57` | boolean (`foundedPlaceholder`, `memberCountPlaceholder`) | `<p data-placeholder="true">` inline |
| `TicketTypeCard` badge | `components/tickets/TicketTypeCard.tsx:29,67,106-108` | boolean (`provisional`) | `data-placeholder` / `data-testid="provisional-badge"` |

`ExhibitorStatusBadge` and `ConfirmationBadge` are near-duplicates: same fail-closed
shape (exactly one early return, on the literal string `'confirmed'`), same
hardcoded floor label pattern, same `TONE_CLASSES` (`border-rule bg-parchment
text-muted` / `border-ivory/30 bg-ivory/10 text-ivory/80`), same markup shell.
They differ only in prop names and status vocabulary width (3-state vs 2-state).

## Required unification

1. **One shared implementation, not three files with duplicated markup.** Collapse
   `ExhibitorStatusBadge` and `ConfirmationBadge` into a single component (or one
   sharing a common internal render function) parameterised by status vocabulary —
   **do not silently drop `question`**. `question` is exhibitor-specific semantics
   (an open question is being put to the committee, not merely "not yet
   confirmed") — a currently-`question`-status Sanity document must keep rendering
   its distinct marker after unification, not silently collapse to `pending`.
2. **Byte-identical visual output for existing call sites.** The unified
   component's rendered class string and DOM shape for every *existing* status
   value (`confirmed`/`pending`/`research`/`question`) must be unchanged from
   today's output — this is a structural refactor, not a redesign. No new colour,
   spacing, or typography token is introduced by this unification.
3. **`data-*` attribute convention carries forward, resolved not raw.** Every
   marker instance keeps a `data-*` attribute holding the *resolved* status
   (post-fallback), matching the existing `ExhibitorStatusBadge`/
   `ConfirmationBadge` pattern — never the raw, possibly-empty upstream value.
   This is what makes a marker structurally countable (see Assertion-Satisfiability
   note below); do not regress to string-matching visible copy.
4. **Fail-closed floor label, twice over, preserved.** Exactly one early return
   (`status === 'confirmed'`), and a hardcoded fallback label that survives an
   empty/cleared Sanity field — the exact defect this repo already shipped once
   (23 blank boxes, see learned.md and both components' own doc-comments).
5. **`ProvisionalFigure`, `SocietyFacts`'s inline placeholder, and
   `TicketTypeCard`'s badge are NOT required to merge into the same component** —
   they operate at a different granularity (a single inline figure / an inline
   estimate line / a pricing card badge, vs. a section-level marker). Unify their
   *status vocabulary and `data-*` convention* to the same three-value shape where
   it fits without forcing an inline `<mark>` to become a bordered block badge.
6. **A page with zero coverage renders the marker, never nothing.** Per
   no-invention.md and `feedback_contract_scoring_principles` (silence isn't
   protection): a section with `contentStatus: "provisional"` or
   `"blocked-on-leeann"` in `f1-coverage-map.json` must render a visible,
   accessible marker somewhere on its page — an assertion proving "no invented
   copy" is insufficient on its own; it must be paired with an assertion proving
   the marker is actually rendered (learned.md, "Absence-only assertions...").
7. **The flag cannot drift from the coverage map.** The unified component's status
   prop for any page built against a named section in `f1-coverage-map.json` must
   be derivable from (or checked against) that section's `contentStatus` — a page
   hardcoding `status="confirmed"` while the coverage map says
   `blocked-on-leeann` is a defect the F2 contract must catch, not something left
   to manual review.

## Assertion-satisfiability guardrails for F2's contract

Per learned.md's catalogued defect class ("a weak assertion satisfiable by
something that isn't the real property"): a check that greps a page for the
string "provisional" or "not confirmed" is satisfiable by dead code, a comment, or
an unrelated occurrence. F2's contract must count real rendered markers
structurally via the resolved `data-*` attribute values, and must pair every
absence check ("no invented figure/copy shipped") with a presence check ("the
disclosure marker is actually in the rendered output") — never one without the
other.

## Open question for Brad — do not resolve here (research §4, open question 8)

The design handoff's `SKILL.md` "Asking for missing material" section specifies a
literal `[bracket]` placeholder convention in prose, not a coded component. The
five existing components use a bordered mono-tag badge instead — consistent with
handoff *tokens* (verified: they use only handoff CSS variables, no invented
colours) but not a literal implementation of the *bracket* convention. **Is the
badge/mark pattern an acceptable engineering translation of the handoff's rule, or
does Brad want literal bracket-style copy?** This spec assumes the existing badge
pattern continues (least-change, already shipped, already token-compliant) unless
and until Brad answers otherwise — F2 must not redesign the visual treatment on
its own initiative either way.
