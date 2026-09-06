# F1: Refund & Cancellation Terms for `/refunds` — Golden Spec

Mission `refunds-cancellation-terms`, F1. Full design record for @dev. Read this before
touching `app/(marketing)/refunds/page.tsx`, `lib/provisional-figures.ts`,
`contracts/contract-policy-pages.yaml`, or `contracts/checks/policy-pages/*.mjs`.

## 1. Why this exists

Brad's standing direction (2026-08-21, project memory `project_popia_deferred`): draft
reasonable estimated terms ourselves, clearly flagged provisional, rather than leave a
policy page empty waiting for council/Lee-Ann. `/refunds` today (109 lines, unchanged by
this feature except as specified below) states three times that terms are "pending
council confirmation" and supplies no figures at all. This feature replaces that
deferral with real, invented-and-disclosed numbers, using the same mechanism already
proven for ticket pricing (`lib/provisional-figures.ts` / `TicketTypeCard`'s
`provisional` prop) — not a new bespoke flagging scheme.

## 2. The provisional-figure mechanism (mandatory shape)

Add to `lib/provisional-figures.ts` (same file, new export — it is already the project's
single source of truth for provisional numbers; do not create a second file):

```ts
export interface RefundCancellationTier {
  /** Minimum days' notice before the event start date for this tier to apply.
   *  null on the "less than X days" tier. */
  minDaysNotice: number | null;
  /** Maximum days' notice (exclusive) — null = no upper bound. */
  maxDaysNotice: number | null;
  /** Percentage of the ticket price refunded under this tier. */
  refundPercent: number;
}

export const PROVISIONAL_REFUND_POLICY = {
  /** Applies to admission, conference, and workshop/field-trip ticket products only.
   *  Vendor stand bookings are explicitly out of scope — see §5. */
  appliesTo: ['admission', 'conference', 'workshop-field-trip'] as const,
  cancellationTiers: [
    { minDaysNotice: 30, maxDaysNotice: null, refundPercent: 90 },
    { minDaysNotice: 14, maxDaysNotice: 30, refundPercent: 50 },
    { minDaysNotice: null, maxDaysNotice: 14, refundPercent: 0 },
  ] as RefundCancellationTier[],
  /** Full refund when SAOC cancels the event/activity outright. */
  organiserCancellationRefundPercent: 100,
  /** Conference (named-registrant) products only: free transfer to another named
   *  attendee up to this many days before the event, as an alternative to cancelling. */
  conferenceTransferWindowDays: 7,
  /** Always `true` in this file today — literal, not computed. Same convention as
   *  `ProvisionalAdmissionProduct.provisional`. */
  provisional: true as const,
} as const;
```

Do not compute these numbers anywhere else or re-type them in the page component — the
page imports this constant.

## 3. Figures being invented — and why (for Lee-Ann / council review)

None of these numbers come from any SAOC document. Per the research pass
(`.agent/memory/scratch/research-refunds-cancellation-terms.md` §5), CPA s16's 5-day
cooling-off does not apply to self-initiated checkout (only direct-marketing-originated
sales); CPA s17 entitles SAOC to charge a "reasonable" cancellation fee capped below
100% of the booking, but supplies no day-thresholds or percentages. The specific values
below are ours, chosen as conventional/defensible event-industry defaults, not a legal
opinion and not a council decision:

| Figure | Value | Basis |
|---|---|---|
| Early cancellation window | 30+ days before the event | Conventional "plenty of notice" threshold |
| Early cancellation refund | 90% (10% fee) | CPA s17 allows a reasonable fee < 100%; 10% is a modest administrative fee |
| Late cancellation window | 14–29 days before the event | Mid-tier notice band |
| Late cancellation refund | 50% | Reflects reduced resale likelihood, still CPA s17-consistent |
| Final window | <14 days before the event | Below this, resale is unlikely; no refund |
| Final window refund | 0% (no refund) | — |
| Organiser-cancellation refund | 100% | If SAOC cancels the event, the buyer did nothing wrong — full refund regardless of notice |
| Conference transfer window | 7 days before the event | Named-registrant products (`requiresAttendeeNames: true`) support name-swap as an alternative to a fee-bearing cancellation |

Every one of these numbers is a placeholder pending council confirmation — see §4.
Lee-Ann/council can adjust any single row without touching code structure: edit
`PROVISIONAL_REFUND_POLICY` in `lib/provisional-figures.ts`.

**Word form required for day/hour/week figures — see §8 for the full reason.** The
day-threshold figures (30, 14, 7) must render in the page's prose as spelled-out words
("thirty days", "fourteen days", "seven days"), not digits — a digit-based day figure
trips the pre-existing POLICY-09 script (A12) regardless of the provisional marker.
Percentage figures (90%, 50%, 100%) render as digits as normal — the legacy script's own
`%`-boundary bug exempts them (§8), so digits are correct and expected there. Do not
"fix" that asymmetry; it is load-bearing.

## 4. Rendering requirement: the `ProvisionalFigure` marker

New component, `components/ui/ProvisionalFigure.tsx`:

```tsx
export function ProvisionalFigure({ children }: { children: React.ReactNode }) {
  return (
    <mark
      data-provisional-figure="true"
      className="bg-primary/10 font-medium text-ink no-underline"
    >
      {children}
      {' '}
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted align-super">
        provisional
      </span>
    </mark>
  );
}
```

Every rendered figure derived from `PROVISIONAL_REFUND_POLICY` (each day threshold, each
percentage, the transfer-window day count) MUST be wrapped individually in
`<ProvisionalFigure>` — e.g. `<ProvisionalFigure>30 days</ProvisionalFigure>`, not one
mark wrapping an entire paragraph with several figures pooled inside it (the contract's
A4 assertion checks each mark's own text contains a real figure; a single giant wrapper
around a whole paragraph would technically pass A4 but produces a worse reading
experience and is not what this spec asks for — @qa should flag over-broad wrapping).

The literal word "provisional" must be **visible text** inside the `<mark>`, not a CSS
`::before`/`::after` or `title` attribute (same rule as `TicketTypeCard`'s badge — must
survive `renderToStaticMarkup()`).

**This is a positional constant re-check, not a live import requirement**: the check
script parses rendered HTML, so it is agnostic to whether the page imports
`PROVISIONAL_REFUND_POLICY` directly or via a data-fetch layer — but importing it
directly (Server Component, no client fetch) is the correct implementation per
CLAUDE.md's "No client-side data fetching for static content" rule.

## 5. Vendor stand exclusion (mandatory copy)

The page MUST NOT contain the strings "90 days", "2 months", or "two months" anywhere
(these belong exclusively to the vendor registration terms —
`docs/vendor-gated-registration-flow.md:435,668` — and restating either risks
contradicting a council-approved document, since the two numbers already disagree with
each other and only the written 90-day figure is binding).

The page MUST explicitly state that vendor stand bookings are a different product with
their own separate terms, and point the reader to vendor registration (e.g.
`/national-show/vendors` or the vendor registration flow) rather than to `/contact` only.
Suggested copy (adapt to house style, keep the meaning intact):

> This policy covers admission, conference, and workshop/field-trip tickets. Vendor
> stand bookings are a separate product with their own cancellation terms, set out in
> the vendor registration agreement — see vendor registration for details.

## 6. Scope: what changes on `/refunds`, what doesn't

Keep unchanged:
- The "Draft pending legal review" banner (lines 22-29 today) — this feature's figures
  extend that existing disclosure frame; do not add a second disclaimer mechanism.
- "Refunds" section's statement that refunds return to the original payment method via
  the originating gateway (still true, still stated).
- The "How to request a refund or cancellation" section and its links to `/contact`,
  `/terms`, `/privacy`.
- Footer "Last updated" line — update the month/year when this ships.

Replace/expand:
- "Terms pending confirmation" section — no longer says nothing is decided; instead
  states the provisional tiered structure per product family, each figure wrapped per §4.
- "Cancellations" section — organiser-cancellation (100%, provisional) and
  buyer-initiated cancellation (tiered, provisional) both stated with real structure.
  Conference-specific transfer option added here or as its own subsection.
- New content, one subsection per product family:
  1. **Admission tickets** — tiered cancellation schedule (§3 rows 1-6).
  2. **Conference tickets** — same tiered schedule, PLUS the free transfer option
     (named-registrant products only).
  3. **Workshop, field trip, and cocktail tickets** — same tiered schedule (pooled
     capacity products; a cancellation frees a shared pool slot, not a fact this page
     needs to explain mechanically, just that the same refund tiers apply).
  4. **Vendor stand bookings** — explicit exclusion per §5.
- "Exceptional circumstances" section — keep case-by-case language; may note SAOC can
  waive the standard fee at its discretion, no new figures required here.
- Do NOT add any digit+unit figure for refund *processing time* (e.g. "7-10 business
  days") — gateway choice is undecided (`project_payment_gateway_decision`) and PayFast
  is poll-only with no webhook; timing varies by gateway and method. Use qualitative
  language only ("processing time varies by the payment method and gateway used").
- Do NOT state a specific refund processing fee in Rand — gateway fees (PayFast R2/txn,
  Ozow ~R3/txn) are operational facts, not committed policy, and the gateway itself is
  undecided. State qualitatively that gateway fees may be deducted from the refunded
  amount.

## 7. `/terms` — no change required, must stay unchanged

`app/(marketing)/terms/page.tsx:83-85` already cross-links to `/refunds`. This feature
must not touch `/terms` and must not introduce a second, independently-maintained refund
figure there. A5/terms-consistency assertion (A10) fails the build if it ever does.

## 8. POLICY-10 revision — exact design

**CORRECTED 2026-09-06** — the first version of this section contained a real modelling
error that cost @dev two implementation attempts. The corrected facts are below; the
wrong claim ("the legacy script keeps passing once real figures land") is struck from
the record, not repeated.

The original POLICY-10 (`contracts/contract-policy-pages.yaml:117-125`,
`contracts/checks/policy-pages/check-refunds-no-fabrication.mjs`, kept unmodified and
now covering POLICY-09's structural half only) bans ANY digit+unit refund figure on
`/refunds`, full stop — correct while the council had supplied nothing, wrong now that
this feature adds real (estimated, disclosed) figures. It is NOT being deleted; A12
requires it to keep passing exactly as-is.

**What actually makes A4 (new mechanism) and A12 (legacy ban) both satisfiable at once —
this is the part that was wrong before:**

The legacy pattern is `\b\d+\s*(?:day|days|hour|hours|week|weeks|%|percent)\b`. Its
shared trailing `\b` (see the bug note below) means it reliably matches **digit-based**
day/hour/week figures ("14 days") but — because `%` is a non-word character — it fails
to match digit-based **percentage** figures in realistic prose ("50% refund", "50%.").
So the two figure types need OPPOSITE treatment in the actual page prose:

- **Percentages** ("90%", "50%", "100%") — render as digits. The legacy bug exempts
  them; A12 will not fire.
- **Day/hour/week thresholds** ("30 days", "14 days", "7 days") — MUST be rendered as
  **spelled-out words** ("thirty days", "fourteen days", "seven days") in the page's
  actual prose. A digit-based day figure ("30 days") WILL trip A12's ban, mark or no
  mark — the mark only protects against the NEW check (A4), not the legacy one.

`PROVISIONAL_REFUND_POLICY` in `lib/provisional-figures.ts` still stores these as plain
numbers (`minDaysNotice: 30`, not the string `'thirty'`) — that's correct, it's a data
source, not display text. The page component is responsible for converting the number
to its spelled-out word form when rendering (a small `numberToWords()` helper, or a
literal lookup table for the handful of values actually used — either is fine, @dev's
choice, not part of this contract's assertions either way).

**Revision, in tandem, not deletion:**
1. `contracts/checks/policy-pages/check-refunds-no-fabrication.mjs` keeps its current
   logic UNCHANGED (A12 proves this) — it still runs and still passes, precisely because
   day/hour/week figures are spelled out and percentages hit its `%`-boundary bug.
2. Add a NEW script, `contracts/checks/policy-pages/check-refunds-provisional-figures.mjs`
   (already written by @architect — do not rewrite its logic, only wire it in).
   `FIGURE_PATTERN` in this script recognises BOTH digit-based figures ("30 days", "90%")
   AND spelled-out day/hour/week figures ("thirty days") as real figures — it has to,
   since the page will use spelled-out words for day/hour/week and digits for percent,
   and the check must treat both as genuine content worth disclosing, not treat one form
   as invisible. The three properties (no bare figure outside a mark; at least one mark
   exists; every mark contains both a real figure — digit OR spelled-out — and the
   visible word "provisional") are unchanged from the original design.
3. In `contracts/contract-policy-pages.yaml`, change POLICY-10's `command:` to invoke
   the new script instead of the old inline regex, and update its `description:` to
   explain the narrower, mechanism-bound property (not "no digit anywhere"). POLICY-09
   is unchanged.
4. Keep the old inline-regex command available for historical/audit reference in a code
   comment in the yaml (one line), but it must not remain the active `command:`.

**Known pre-existing bug in the legacy script (flag only, do NOT fix — @dev correctly
declined this backport):** the original pattern
`(?:day|days|hour|hours|week|weeks|%|percent)\b` has one shared trailing `\b` — since
`%` is a non-word character, `\b` immediately after a matched `%` only succeeds when the
NEXT character is also a word character with no space (e.g. "50%refund"). Realistic
prose ("50% refund", "50%.", "50%" at end of a sentence) is NOT caught by the original
pattern. Verified with `node -e` against the literal regex. **This bug is now
load-bearing**: it is the only reason digit-based percentages can appear on the page at
all without tripping A12. Fixing it in `check-refunds-no-fabrication.mjs` would
immediately re-break A12 against the percentages this feature needs to state. The new
script's own `FIGURE_PATTERN` does not repeat the bug (it treats `%`/`percent` as a
first-class figure type) — that asymmetry between the two scripts is intentional and
must not be "fixed" into symmetry.

## 9. Negative-control fixtures (already RED-verified by @architect)

`.agent/memory/project/specs/refunds-cancellation-terms/goldens/fixtures/`:
- `positive-provisional.html` — every figure correctly wrapped and disclosed → script
  exits 0.
- `negative-fabricated.html` — bare "14 days"/"50%" refund, no mechanism at all → exits 1
  (this is the classic fabrication case, must still fail).
- `negative-mark-no-figure.html` — a `<mark data-provisional-figure="true">` exists but
  wraps irrelevant text while the real figure sits bare elsewhere → exits 1 (proves the
  mechanism can't be gamed by wrapping something unrelated).
- `negative-mark-no-word.html` — figures correctly wrapped in the mark, but the literal
  word "provisional" is missing from the mark's own text → exits 1 (proves the marker
  must actually disclose, not just structurally isolate).
- `negative-no-mechanism.html` — page says "provisional" in prose generally but has no
  `data-provisional-figure` mark and no figures at all → exits 1 on the "no mechanism"
  check (this fixture is for structural completeness testing, not fabrication; it fails
  because A4 requires the mechanism to exist once real content ships — for a NO-FIGURE
  page this check would be moot, but this contract requires figures per §3, so absence
  of the mechanism entirely is a failure state for this feature).
- `negative-mark-stray-number-word.html` — added after `FIGURE_PATTERN` was extended to
  recognise spelled-out day/hour/week thresholds. A mark visibly saying "provisional"
  that contains a number WORD not adjacent to a unit ("two important cases") must still
  fail → exits 1 (proves the word-form extension didn't loosen the anti-vacuity property
  into accepting any stray number word as a "figure").

All six fixtures were run against the actual script by @architect before handoff
(see `.agent/evidence/refunds-cancellation-terms/functional/01-architect-red.txt` and
`02-architect-red-word-figures.txt` for the post-correction re-verification).

## 10. What's explicitly left to @dev

- Exact prose wording (this golden gives structure + required facts + exact numbers,
  not final copy).
- Whether `PROVISIONAL_REFUND_POLICY`'s tiers are rendered as prose sentences, a table,
  or both — no UI mockup exists for this page; keep consistent with the page's existing
  typographic style (`font-sans text-[16px] leading-relaxed text-ink/80` body copy
  pattern already used throughout `page.tsx`).
- The exact vendor-registration link target (there may be more than one live vendor
  entry point — `/national-show/vendors`, `/national-show/vendors/apply`, etc.; check
  current routes before linking).
- Updating the "Last updated" footer month/year.
- Applying the recommended (not required) regex fix to the old script per §8.
