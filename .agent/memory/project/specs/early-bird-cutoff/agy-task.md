# Task for Gemini Hydrogen: early bird ends on a date, not a count

You edit files only. You cannot run commands, so do not try to run tests; a separate gate runs them afterwards.
Work in the repo given to you (a worktree of origin/main). Read the files named here, then edit exactly two.

## Why
Early bird tickets must end on the Sanity `earlyBirdCutoff` date, not when 500 tickets sell. Today the Weekend Pass and Day Pass
cards say "early-bird left" with a number, and a sold count decides whether the early-bird card or the regular card shows.
New rule: the early-bird card shows while the cutoff has not passed (or the cutoff is null); after it, the regular card takes the slot.
No count is shown for the early bird. Write no new wording of any kind.

## Files you may edit (only these two)
1. `lib/data/ticket-card-view-models.ts`
2. `lib/data/ticket-hub-source.ts`

## Do not touch (anything else)
Everything under `components/`, `app/`, `sanity/`, `emails/`, `scripts/`, `contracts/`, `tests/`, `docs/`, plus `lib/ozow.ts`, `lib/payments/`,
`lib/provisional-figures.ts`, `lib/checkout-reservation.ts`, `lib/data/ticket-presentation.ts`, and every checkout, payment, webhook,
email and PDF file. Do not create files. Do not edit tests, check scripts or goldens: they are read-only.

## Read first (read-only)
- `.agent/memory/project/specs/early-bird-cutoff/spec.md` (findings)
- `.agent/memory/project/specs/early-bird-cutoff/goldens/expected-output.json` (the exact result your code must produce)
- `.agent/memory/project/specs/early-bird-cutoff/goldens/check-early-bird-cutoff.mts` (the check that will run on your edit: build mentally against it)
- `lib/checkout-reservation.ts` lines 355-390 (`isWithinEarlyBirdWindow`: true through the whole cutoff day UTC; null cutoff means true)

## Edit 1: lib/data/ticket-hub-source.ts
- Change the existing import `import { resolveEffectivePrice } from '@/lib/checkout-reservation';` to also import `isWithinEarlyBirdWindow`.
- In `toTypeInput`, add to the returned object: `earlyBirdOpen: isWithinEarlyBirdWindow(now, t.earlyBirdCutoff ?? null),`
- Change nothing else in the file.

## Edit 2: lib/data/ticket-card-view-models.ts
1. In `TicketTypeInput` add the optional field `earlyBirdOpen?: boolean;` with a one-line comment: absent means open; set by the hub from `earlyBirdCutoff`.
2. In `buildPassCard`: remove the `pool` parameter. Replace `poolOpen` with `const earlyBirdOpen = earlyBird?.earlyBirdOpen !== false;`
   and use it for the slot choice: `const type = earlyBirdOpen ? (earlyBird ?? regular) : (regular ?? earlyBird);`
3. In `buildPassCard`, the early-bird branch (`isEarlyBirdSku`) no longer needs `pool`: when `isEarlyBirdSku`, set `scarcity = null` and
   `state = resolveTicketCardState({ priceUsable, remaining: null, total: 0, earlyBirdRemaining: null })`. Keep the existing `else if (productId === 'day')`
   and final `else` branches exactly as they are. Keep `days`, the `allDaysSoldOut` override, and the return object as they are.
4. Delete `buildPool`, the `POOL_LABEL` constant, and the `pool` argument at both `buildPassCard(...)` call sites.
   In `buildTicketCardViewModels` return `pool: null` in both return statements (the closed-sales one already does).
5. Keep `POOL_SKUS` (still used by `ownScarcity`), the `EarlyBirdPool` interface and the `pool: EarlyBirdPool | null` output field
   (components import the shape). Remove any import or constant that becomes unused so lint stays clean.
6. Update the header comment sentence about "the shared early-bird pool is counted once" to say early-bird availability comes from the
   cutoff flag. No other prose changes.

## Expected behaviour (must match expected-output.json)
- Before the cutoff, with any sold count (even the full 500): Weekend card is `weekend-pass-early-bird` at 360, Day card is `early-bird` at 120, state `available`, no scarcity, `pool` null.
- On the cutoff day through 23:59 UTC: same as above.
- From 00:00 UTC the next day: Weekend card is `weekend-pass` at 380, Day card is `day-visitor` at 150.
- Null cutoff: early bird stays on sale in any year, with no count.
- Per-day counts on the Day card, VIP, Sunset and other cards are unchanged.

## When finished
Reply with the two file names and a two-line summary. Do not claim tests passed; you cannot run them.
