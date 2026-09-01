# Golden: vendor-stand-early-bird-pricing — decision record

Mission `vendor-stand-early-bird-pricing`, M1/F1. Adds the early-bird/regular tier axis to
`lib/vendor-stand-pricing.ts`. Additive to a shipped, green mechanism —
`vendor-gated-registration-flow` M3 (F26-F32, checks A55-A63 in
`contracts/contract-vendor-gated-registration-flow.yaml`). Read that golden's "Initiate —
server-derived amount, transactional idempotency" and "Settlement" sections first; this
document only records what changes on top of it.

**REVISION 2026-09-01, urgent (demo tonight):** Brad supplied real figures mid-mission. All
six prices and the cutoff rule are now confirmed — nothing is council-blocked any more. This
revision supersedes the original "everything ships null" version of this document. @dev
implements against THIS version. See "What changed and what was cut for tonight" at the
bottom for exactly what is in scope now vs. deferred.

## Confirmed figures (Brad, 2026-09-01)

- **R1450 per stand, standard tier.** A booth of size N is N stands (per M3's own "booth size
  already encodes the multi-stand case" — size 2 = two stands combined, size 3 = three), so
  price is **derived** as `N × R1450`, never stored as three independent standard figures.
- **Early-bird = 20% less than standard**, i.e. exactly 80% of the standard price. Derived,
  not a second independently-maintained figure.
- **Cutoff = 90 days before the show opens.** The show opens Thursday 16 September 2027, so
  the cutoff is 18 June 2027 — but this must be **derived from the show's actual start date**
  (see "Cutoff derivation" below), never hardcoded as a literal date, because the show dates
  have already moved once on this project (the 18–21 September placeholder still being
  purged — see `.agent/memory/project/provisional-figures.md`).

| booth size | standard | early-bird |
|---|---|---|
| 1 | R1450 | R1160 |
| 2 | R2900 | R2320 |
| 3 | R4350 | R3480 |

All six cells are confirmed. None are provisional or invented — every one follows arithmetically
from the two confirmed numbers (R1450/stand, 20% discount) and the confirmed booth-size
semantics M3 already established.

## Money arithmetic — integer cents, one confirmed rate, never stored redundantly

```typescript
// Confirmed 2026-09-01 (Brad). Integer cents -- R1450.00 = 145000 -- so no arithmetic in the
// payment path ever depends on IEEE-754 float rounding.
export const VENDOR_STAND_PER_STAND_RATE_ZAR_CENTS = 145000;
export const VENDOR_STAND_EARLY_BIRD_DISCOUNT_PERCENT = 20;

function standardPriceZarCents(boothSize: VendorStandBoothSizeValue): number {
  return VENDOR_STAND_PER_STAND_RATE_ZAR_CENTS * boothSize; // exact, integer x integer
}

function earlyBirdPriceZarCents(boothSize: VendorStandBoothSizeValue): number {
  // Integer cents throughout: (cents * 80) / 100 is always exact for every boothSize in
  // {1,2,3} against this rate (145000*80/100 = 116000, etc.) -- Math.round is defensive, not
  // load-bearing, in case a future rate change ever produces a fractional cent.
  return Math.round((standardPriceZarCents(boothSize) * (100 - VENDOR_STAND_EARLY_BIRD_DISCOUNT_PERCENT)) / 100);
}
```

Six independently-typed price constants were the ORIGINAL plan (see git history of this file
if curious) specifically to avoid computing money at payment time. Brad's follow-up correction
supersedes that: since the six figures are not independent facts but one confirmed rate times
a known multiplier and a known discount, storing them independently is now the drift risk
(six hand-maintained numbers can silently disagree with each other) rather than the safety
net. One confirmed rate, multiplied by an integer, discounted by an integer percentage, in
integer cents throughout — that removes the drift risk by construction rather than by
convention. `resolveVendorStandPrice`'s public return `amount` stays a rand `number` (dividing
by 100 once, at the boundary) — no other call site (route, gateway, admin display) needs to
know cents exist.

**A2's assertions**: `amount_earlyBird × 100 === amount_standard × 80` (exact-80%-of-standard,
proven per booth size) and `amount_sizeN === amount_size1 × N` at the same tier (proven for
N∈{2,3}) — both derived-relationship checks, not fixed-value checks alone, so a future rate
change can't silently break the *relationship* even if someone updates the base rate.

## Tier decision — reuses `isWithinEarlyBirdWindow`, unmodified

```typescript
export type VendorStandPricingTier = 'earlyBird' | 'regular';

export type VendorStandPriceResolution =
  | { ok: true; amount: number; tier: VendorStandPricingTier }
  | { ok: false; reason: 'not-configured' | 'invalid-booth-size' };

// Still pure -- no Date.now()/new Date() call anywhere in this file. `now` AND `cutoffIso`
// are REQUIRED parameters, both supplied by the caller. This is the load-bearing property for
// "anti-spoof" below: the pricing module has no clock and no cutoff of its own, so nothing
// inside it can be fooled -- only a caller that wrongly threads a client-supplied value into
// either parameter could spoof it, and there is exactly one production caller.
export function resolveVendorStandPrice(
  boothSize: unknown,
  now: Date,
  cutoffIso: string | null,
): VendorStandPriceResolution {
  if (!isValidBoothSize(boothSize)) {
    return { ok: false, reason: 'invalid-booth-size' };
  }
  // A null cutoff (the show window couldn't be resolved -- see "Refuse-on-missing-cutoff"
  // below) refuses before any tier decision is even attempted. This is now the ONLY
  // 'not-configured' path -- the six prices themselves can never be null again (they are
  // confirmed constants), so this is where M3's "never guess, never fall back" discipline
  // now lives.
  if (cutoffIso === null) {
    return { ok: false, reason: 'not-configured' };
  }
  const tier: VendorStandPricingTier = isWithinEarlyBirdWindow(now, cutoffIso) ? 'earlyBird' : 'regular';
  const cents = tier === 'earlyBird' ? earlyBirdPriceZarCents(boothSize) : standardPriceZarCents(boothSize);
  return { ok: true, amount: cents / 100, tier };
}
```

`isWithinEarlyBirdWindow(now, cutoffIso)` is `lib/checkout-reservation.ts`'s existing F1/F4
export, **imported and called unmodified** — not reimplemented. Its semantics ("inclusive
through the end of the cutoff date's calendar day, in whatever offset the ISO string
carries") turn out to be exactly what's needed for the SAST boundary below, with zero changes
to that function — see "SAST boundary" next.

## Cutoff derivation — from the show's real start date, SAST-boundary-correct, in one place

```typescript
export const VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW = 90; // confirmed, Brad 2026-09-01

// South Africa Standard Time -- UTC+2, no daylight saving, ever. This is the ONE place the
// offset is applied. See "SAST boundary" below for why it must be explicit rather than bare
// UTC.
const SAST_OFFSET = '+02:00';

/**
 * Pure. `showStartDate` is supplied by the caller (resolved from the active show's
 * ShowWindow -- see "Where showStartDate comes from" below), never fetched here. Returns an
 * ISO 8601 string with an EXPLICIT +02:00 offset -- never bare UTC/'Z' -- so that when this
 * string is handed to isWithinEarlyBirdWindow(), the boundary it computes lands at SAST
 * midnight, not UTC midnight.
 */
export function deriveVendorStandEarlyBirdCutoffIso(showStartDate: Date): string {
  const cutoff = new Date(Date.UTC(
    showStartDate.getUTCFullYear(),
    showStartDate.getUTCMonth(),
    showStartDate.getUTCDate() - VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW,
  ));
  const yyyy = cutoff.getUTCFullYear();
  const mm = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cutoff.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T00:00:00${SAST_OFFSET}`;
}
```

### SAST boundary — the whole fix is one explicit offset, nothing else

Firebase App Hosting containers run UTC. If the cutoff were expressed as a bare UTC-midnight
boundary (what `isWithinEarlyBirdWindow`'s own "+1 day" logic assumes when handed a plain
`'2027-06-18'`-shaped string, since `new Date('2027-06-18')` parses as UTC midnight), the
computed boundary would be **2 hours later than intended**: a vendor paying between
22:00–23:59:59 UTC on 18 June (i.e. midnight–01:59:59 SAST on the 19th) would wrongly still
get the early-bird rate.

The fix is not a new comparison function — it's that `deriveVendorStandEarlyBirdCutoffIso`
emits the cutoff date with an **explicit `+02:00` suffix** (`'2027-06-18T00:00:00+02:00'`)
instead of a bare date. `isWithinEarlyBirdWindow`'s existing, unmodified "+1 UTC day, exclusive"
math then does exactly the right thing: `new Date('2027-06-18T00:00:00+02:00')` is
`2027-06-17T22:00:00Z`; adding one UTC day gives `2027-06-18T22:00:00Z` — which **is** midnight
SAST on 19 June, the correct exclusive boundary. No timezone library, no per-request TZ
config, no user-facing zone display — one explicit offset, applied once, in
`deriveVendorStandEarlyBirdCutoffIso`, with the reasoning captured in that function's comment.
A1's checks assert both the derived ISO string's literal offset AND the actual boundary
instant (last qualifying vs. first non-qualifying), specifically to catch a regression to the
naive bare-UTC boundary.

**Deliberately NOT built:** any general timezone-handling subsystem, a per-show or
per-vendor zone setting, or any display of the cutoff in a particular zone. South Africa has
one zone, no DST, ever — building more than this one explicit offset would be solving a
problem this project doesn't have.

### Where `showStartDate` comes from — reuses the existing show-window abstraction

`lib/show-window-lookup.ts`'s `resolveShowWindowLookup(NATIONAL_SHOW_ID, now)` (already used
by F6/F7's admin capability checks, `lib/tickets-constants.ts`'s `NATIONAL_SHOW_ID`) resolves
to a `ShowWindowLookup` function; calling it with `NATIONAL_SHOW_ID` returns the active show's
`ShowWindow { startDate: Date; endDate: Date } | null`. The initiate route:

1. `const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);`
2. `const showWindow = lookupShowWindow(NATIONAL_SHOW_ID);`
3. `const cutoffIso = showWindow ? deriveVendorStandEarlyBirdCutoffIso(showWindow.startDate) : null;`
4. `const priceResolution = resolveVendorStandPrice(boothSize, now, cutoffIso);`

This is the SAME `now` the route already derives from `new Date()` for token-expiry
verification — reused, never a second clock read, never body-derived. Reusing this existing
abstraction (rather than a bespoke Sanity query) means this feature inherits its established
caching/failure posture for free.

## Refuse-on-missing-cutoff — where M3's refusal discipline now lives

The six prices can no longer be null (they're confirmed constants), so M3's original
"refuse when a price is null" path is gone. Its discipline survives in the one input that
genuinely can still be absent: **no active show published in Sanity** → `lookupShowWindow`
returns `null` → `cutoffIso` is `null` → `resolveVendorStandPrice` refuses
`{ok:false, reason:'not-configured'}` → the route returns the SAME `HTTP 503` +
council-blocked-shaped message M3's A55 already proved, **before any Firestore write or
gateway call**. This is a real, live operational failure mode (a demo/staging environment
with no active show configured, or a show accidentally deactivated), not a fabricated test
case — A4 proves it end-to-end.

## Anti-spoof — unchanged posture, now protecting real money

Exactly as originally briefed: the request body allow-list stays `{token, boothSize}`; `now`
and `cutoffIso` are both server-derived (from `new Date()` and the Sanity-backed show window,
respectively) and never read from the request body. A3 proves four plausible spoof field
names (`now`, `timestamp`, `clientNow`, `purchasedAt`) are silently ignored and produce results
identical to an honest request, plus a static assertion that no such body key is read anywhere
in the route.

## Two unrelated 90-day figures — kept as separate constants

The T&Cs cancellation clause (M3, `lib/vendor-stand-forfeiture-notice.ts`) also says "90 days".
`VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW` (this feature) and whatever constant backs
the forfeiture notice's "90 days before the opening of the show" wording are **two unrelated
rules that happen to share a number today** — a payment-pricing rule and a cancellation-policy
rule. They must NOT be collapsed into one shared constant; a future change to either (e.g.
Council extends the cancellation window to 120 days without touching pricing) must not
silently change the other. `lib/vendor-stand-pricing.ts` must not import from
`lib/vendor-stand-forfeiture-notice.ts` or vice versa for this value.

## What Council still owes us

Nothing pricing-related. All six prices and the cutoff RULE (90 days) are confirmed. The only
remaining external dependency is operational, not a missing fact: an active show document
must exist in Sanity with a real `startDate` for the cutoff to be derivable at all — see
"Refuse-on-missing-cutoff" above for what happens when it doesn't.

## What changed and what was cut for tonight (urgent demo)

Cut from the original scope, to be added back as a follow-up rather than blocking tonight's
demo — flagging explicitly per the team lead's instruction, not silently dropped:

- **Backward-compatibility check for pre-existing `vendorStandOrders` documents** (a legacy
  order with no `tier` field settling correctly through the unmodified settlement handler).
  The design requirement itself is UNCHANGED from the original brief — `VendorStandOrder.tier`
  is still additive/nullable, `lib/vendor-stand-payment-notification.ts` must still never read
  `.tier` — @dev should still build it this way. What's cut is the standalone RED check
  proving it; there are no real `vendorStandOrders` documents in production yet tonight (the
  mechanism has never successfully priced a real payment), so the risk of skipping this one
  check tonight is low. Recommend adding it back as a same-shaped check tomorrow.
- **The "refuse holds independently per null tier" scenario** from the original brief is
  MOOT under the new design — there is no longer a "one tier null, one tier populated" state
  possible, since both tiers are derived from one confirmed rate. Not cut, superseded.

Everything else in this document is the full, current spec — not a placeholder.

## RED checks — proof these properties do not hold against current code

All four checks were run against HEAD (`vendor-gated-registration-flow` M3 code, unmodified)
and confirmed failing, with real captured output recorded in
`contracts/contract-vendor-stand-early-bird-pricing.yaml`'s A1-A4 descriptions.

- **A1** — `check-tier-selected-either-side-of-cutoff.mjs`: tier selection, including the
  SAST boundary instant, and `deriveVendorStandEarlyBirdCutoffIso` tracking a moved show date.
- **A2** — `check-price-derived-from-per-stand-rate.mjs`: price = confirmed R1450/stand ×
  booth size at standard tier; early-bird exactly 80% of standard; both as derived
  relationships, not just fixed values.
- **A3** — `check-timestamp-spoof-cannot-buy-early-bird.mjs`: a forged client timestamp cannot
  obtain the early-bird rate.
- **A4** — `check-refuses-when-cutoff-unavailable.mjs`: a genuinely missing cutoff (no active
  show configured) still refuses, before any write, exactly as M3's original null-price
  refusal did.

## Harness note: `fixture-show-window-lookup.mjs` extended

`contracts/harness/route-runner/fixture-show-window-lookup.mjs` was a permanent
`() => null`-returning stub with no check exercising its return value behaviourally. Extended
with `setShowWindowFixture(window)` so A3/A4 can configure the active show window the initiate
route resolves. Default behaviour (no window configured) is unchanged from before this
mission — every pre-existing consumer of this fixture is unaffected.
