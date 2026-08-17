# Production `ShowWindowLookup` — decision record

Mission `ticketing-foundation`, blocking feature F13 (backlog item, P1, escalated from P3
2026-08-17 — see `.agent/memory/project/backlog.md` line ~139). This is not a new capability;
it closes a real, verified gap in code that already exists. Everything below was read and
verified directly against the current source on 2026-08-17, not assumed from the dispatch.

## The gap, restated precisely

`lib/admin-auth.ts:142` declares `export type ShowWindowLookup = (showId: string) => ShowWindow
| null;`. `hasCapability()` (`lib/admin-auth.ts:187-206`) defaults it: `const lookupShowWindow =
opts?.lookupShowWindow ?? (() => null);`. `grep -rn 'ShowWindowLookup' lib/ app/ scripts/`
returns only the type's own declaration and its two parameter positions — no production
implementation exists anywhere. The one real call site,
`app/api/admin/tickets/comp/route.ts:76`, calls `hasCapability(session.decodedToken,
body.showId, 'issue-comp')` with **no third argument at all**, so it silently gets the `()
=> null` default.

**Consequence, exact:** `resolveRoleCapabilitiesForShow()` unions `roles['*']` (never
date-limited, always honoured) with `roles[showId]` (honoured only when `lookupShowWindow(showId)`
returns a real window AND `now` falls inside it). With the default, `roles[showId]` is refused
**always**, regardless of window. `roles['*']` still works fine. F13 grants Lee-Ann a per-show
`manager` role — exactly the always-refused case. This is a functionality hole, not a security
hole: the code fails closed, correctly, on missing data. Nothing over-grants. The fix is to make
the correct thing possible, not to loosen anything.

## What this contract builds

One new file, `lib/show-window-lookup.ts`, and one wiring edit to the single existing call site.
Full type-level spec is in the contract YAML's `features[0].name`; this document is the *why*.

## Why `showId` is not a Sanity `_id` — the identifier-space distinction that would have broken
a naive implementation

Read `contracts/golden/ticketing-f1-show-collision/README.md` in full before touching this.
Its finding, quoted because it is load-bearing here too: *"`NATIONAL_SHOW_ID` was never a
Sanity document lookup key... It exists purely to tag Firestore `tickets`/`orders` documents."*
`NATIONAL_SHOW_ID` (`lib/tickets-constants.ts`) is the literal string `'nationalShow'` — the
Firestore role-scoping value used in `roles[showId]` and passed as `hasCapability`'s `showId`
argument. The Sanity documents that carry `startDate`/`endDate` are `_type: "show"` documents
(added by F1: `sanity/schemas/documents/show.ts`), each with its own `_id`
(`show-19-2027`, `show-18-2024`, ...) that has **no relationship** to the string `'nationalShow'`
at all. There is a *separate*, pre-existing `_type: "nationalShow"` singleton document whose
`_id` genuinely is `'nationalShow'` — but that document does not carry `startDate`/`endDate`
(it has `showDate`/`showEndDate`, a different field pair, per `types/index.ts`'s
`ShowIdentity` type and `nationalShowQuery`), and is not what F13's per-show grant needs to
gate against.

A naive `ShowWindowLookup` implementation — `*[_type == "show" && _id == $showId][0]` — would
receive `showId = 'nationalShow'`, match **zero** `show` documents (none of the six has that
`_id`), and resolve to `null` forever. This would look identical to "working as intended,
fail-closed" from every angle: no error, no crash, a green fail-closed gate. It would in fact be
the exact same bug this contract exists to fix, just moved one layer down and much harder to
notice, because A3-A8's offline fail-closed tests would all still pass — they inject their own
`ShowWindowSource`, so they cannot see a `showId`-vs-`_id` confusion baked into the *production*
data source.

**Resolution:** `fetchActiveShowWindow` (the production `ShowWindowSource`) never looks up a
Sanity document *by* the `showId` argument at all — it doesn't receive one (`ShowWindowSource`
is `() => Promise<ShowWindow | null>`, zero args, deliberately). It queries every `show`
document and resolves "the currently active one" via the **existing**, already-proven
`resolveActiveShow()` (`lib/show-resolution.ts`, F1) — the same function checkout already uses,
reused rather than reimplemented, inheriting its fail-closed behaviour on zero or multiple
active shows for free. `showId` scoping happens one level up, in
`resolveShowWindowLookup(showId, now)`: it fetches (or reads the cached) *one* active show's
window, then hands back a closure that serves that window only when called with the exact
`showId` it was built for (A6 proves this — including the specific case of a Sanity-`_id`-shaped
string being correctly refused, the confusion this section exists to prevent). Since this
project has exactly one Firestore-scoping `showId` value in real use today (`'nationalShow'`,
per F1's own dataset read — the one exception, `door-qr-check-wrong-show`, is a QA negative-
control fixture, not a real booking), this design is correct for the system as it exists; it
generalises cleanly if a second concurrently-sellable show is ever introduced, because nothing
here hardcodes the literal `'nationalShow'` string inside `lib/show-window-lookup.ts` itself.

## Why caching, and why this bound

`hasCapability()` sits on the admin-auth decision path for every capability-gated request. A
naive implementation would fetch Sanity fresh on every call — acceptable in absolute terms for
`issue-comp` (a low-frequency admin action, not the door scanner), but wrong to build as the
*only* implementation, because F4's own README already flagged this as the general concern
(*"adding a Firestore read to every scan for a role lookup is the wrong trade at exactly the
place reliability matters most"*) and the checkin route's own comment (see below) makes clear
that route is the one that will eventually need this at real scan frequency.

`ShowWindowLookup`'s type is **synchronous** — `(showId: string) => ShowWindow | null` — while a
Sanity fetch is inherently async. This is the actual design constraint, not a stylistic
choice: a live network call cannot sit inside a function `hasCapability()` calls synchronously.
The resolution is a two-phase split:

1. `ensureFresh(now)` — async, called once per request by the route, awaits a fetch only if the
   cache is empty or stale (`>= SHOW_WINDOW_CACHE_TTL_MS` old).
2. `read(now)` / the closure `resolveShowWindowLookup` returns — synchronous, reads only what's
   already cached, and **re-validates freshness at read time**, not just at write time.

**The TTL bound is enforced at the read, not only at the write.** This is the direct answer to
"a stale cache that keeps a lapsed window alive is a security defect, so bound it and gate the
bound": if a caller ever skips `ensureFresh` (a bug, a race, a future caller that forgets the
two-step contract), `read()` still refuses to serve an entry `>=` `SHOW_WINDOW_CACHE_TTL_MS`
old, rather than serving whatever the last successful write happened to leave behind
indefinitely. A4 gates exactly this boundary, including the exact-boundary instant (`>=`, not
`>` — served just under the bound, refused *at* it, matching `isWithinWindow`'s own `>=`/`<=`
convention rather than introducing a third comparison style into this codebase).

**60 seconds (`SHOW_WINDOW_CACHE_TTL_MS = 60_000`)**, chosen as the concrete bound: short enough
that a show being deactivated, or its dates being corrected in Studio, propagates to every admin
action within a minute — no operator-visible "why isn't this working yet" — while still turning
what would otherwise be a live Sanity fetch on every `issue-comp` request into, at most, one
fetch per minute per server process. This is deliberately the SAME class of tradeoff F4's README
already accepted for the `roles` claim's own short-TTL-cache recommendation (spec §5.6); it is
not re-litigated here, just applied to the second half of the same decision.

**The cache is a module-level singleton** (`getProductionShowWindowCache()`), not one instance
per request — the TTL bound has to apply *across* requests within one server process to have any
performance benefit at all; a per-request cache would refetch every time regardless of TTL, which
is the exact over-fetching A5 is written to catch.

## Why a throwing or null-resolving source never propagates

`fetchActiveShowWindow` must never throw out of `ShowWindowCache.ensureFresh()` — a Sanity
outage must degrade to "no per-show grants honoured this minute" (fail closed, matching F4's
"missing show → refused" posture exactly), never to an unhandled 500 on an admin action that
would otherwise have worked. This directly resolves the backlog's separate, related P2 item
("[P2, NEW] A throwing `lookupShowWindow` propagates out of `hasCapability()`... F5 must decide
whether to wrap it when wiring the default lookup") for THIS lookup's own data source — the
catch lives inside `ensureFresh`, at the boundary where the real I/O happens, not inside
`hasCapability()` itself (which this contract does not touch, and which still faithfully
propagates whatever a caller's injected `lookupShowWindow` throws — a caller writing a
raw closure that ignores this contract's `ShowWindowCache` could still reintroduce that P2 item
for themselves; this contract closes it for its own module, not for the type in the abstract).
A4 gates this directly: a throwing source resolves to a `null` read, and the exception is proven
not to escape `ensureFresh` at all.

## Timezone posture, stated explicitly

This project's server runs in SAST (UTC+2); Sanity `datetime` fields and Firestore/Cloud Logging
timestamps are UTC. This project has already shipped one false published correction from exactly
this confusion (`learned.md`, "Firestore `createTime` and Cloud Logging timestamps are UTC; SAOC
operates SAST (+2)") — the backlog item that escalated this contract names the same risk
explicitly for this exact feature.

**Posture:** `parseUtcDatetime()` requires an explicit UTC offset designator (`Z` or `±HH:MM`)
on every date string it accepts, and rejects (returns `null` — fails closed, identically to any
other malformed input) anything without one. JavaScript's own `new Date(bareDatetimeString)`
parses an offset-less string-with-time in the **process's local timezone** per the ECMA-262 Date
Time String Format spec — under this project's real deployment timezone, that would silently
shift a boundary by exactly 2 hours, in whichever direction happens to matter for a given
request, with no error and no log line. Since Sanity's `datetime` field type always serialises
with an explicit `Z` offset in normal operation, requiring one costs nothing in the working case
and only ever rejects genuinely malformed/hand-corrupted data — which is exactly the fail-closed
posture this whole module already takes for every other malformed-input case.

**Why this is provable offline, and how:** A `Date` object always represents an absolute instant
(epoch milliseconds) internally, regardless of what timezone string was used to construct it —
so *comparing* two correctly-parsed `Date`s (as `isWithinWindow`'s `>=`/`<=` already does) is
timezone-safe by construction. The risk is entirely at the *parsing* boundary, one function,
fully unit-testable with zero network: A7 runs `parseUtcDatetime()` under `TZ=Africa/Johannesburg`
explicitly (set on the command itself, not inherited from whatever timezone the gate machine
happens to run in — this makes the check deterministic and reproduces the real defect
regardless of CI environment) and proves an explicit `Z` and an explicit `+02:00` offset resolve
to the identical UTC instant, while a bare offset-less string — the one shape that would silently
misparse under this exact TZ — is rejected outright.

## What this contract does NOT prove

- **That the live, deployed `fetchActiveShowWindow` correctly reads the real Sanity dataset.**
  `fetchActiveShowWindow` is the one function in this module this contract does not and cannot
  contract-test — it is a thin wrapper around `sanityFetch`/`resolveActiveShow`, and testing it
  live would require a live Sanity dataset and network access, forbidden by this contract's hard
  offline/credential-free constraint (matching F4's own precedent for the exact same class of
  gap — see that README's "Why the date-window lookup is injected"). A1's type-check compiles it;
  nothing executes it. Whoever runs F13's live HTTP-round-trip verification against the deployed
  host is the actual proof this function works against real data.
- **That `app/api/admin/checkin/route.ts` (the door scanner) is wired.** Deliberately, explicitly
  out of scope. That route's own comment (`app/api/admin/checkin/route.ts:18-27`) documents F7's
  judgement call: live `hasCapability()` enforcement there is "unsafe to ship before
  `scripts/admin-migrate-roles.ts --apply` has run — today it hasn't, zero accounts hold a `roles`
  claim, and switching this on would refuse every door scanner, including Brad's, with no gate to
  catch it." This contract does not override that judgement call or touch that route. Wiring the
  checkin route is a separate, later decision gated on the live migration running — not something
  this contract should force by building the lookup and then reaching into an unrelated route to
  use it.
- **That `app/api/admin/tickets/route.ts` or `app/api/admin/export-csv/route.ts` are capability-
  gated at all.** Neither calls `hasCapability()` today — both only check `getAdminSession()`
  (any admin, any show, unrestricted). F13's own brief mentions
  `GET /api/admin/export-csv?showId=nationalShow`, implying a future `showId` query parameter and
  a capability check that don't exist on that route yet. That is a materially larger, separate
  gap (adding show-scoping to a route that currently has none, not wiring an existing-but-inert
  lookup parameter) and is explicitly out of this contract's scope — building it here would
  silently expand the blast radius past what was authorised, the same discipline F10's re-pin
  ceremony documented for a different file. Flagged here for whoever picks up that route's
  capability-gating.
- **That a real per-show `manager` grant reaches `/admin` end to end on the deployed host.** That
  is F13's own live-HTTP-round-trip "Done" criterion and requires
  `scripts/admin-migrate-roles.ts --apply` to have actually run against real Firebase Auth
  accounts (still not run, per `.agent/memory/project/reboot.md` — a separate blocker needing
  Brad's authorisation, not this contract's to fix or fake). This contract makes that outcome
  POSSIBLE the moment the migration runs and Lee-Ann's grant is issued; it does not and cannot
  prove it happened.
- **`ADMIN_EMAIL_ALLOWLIST` deployment state, or that any real admin account holds `admin: true`
  and a `roles` claim.** Orthogonal to this contract entirely — see `docs/admin-access.md`.

## Judgement calls made that the dispatch left open

1. **`ShowWindowSource` takes zero arguments, not a `showId`.** The dispatch's own framing
   implies a lookup "reading `show.startDate`/`show.endDate`" per show, but per the identifier-
   space finding above, there is exactly one meaningful "active show" concept in this codebase
   today (`resolveActiveShow()`'s single winner), and the Firestore `showId` string has no
   Sanity-side counterpart to look up by. Making the data source zero-arg, with scoping handled
   entirely by `resolveShowWindowLookup`'s returned closure, is what makes A6's showId-vs-`_id`
   distinction possible to state and gate at all — a `showId`-parameterised source would invite
   exactly the naive-but-wrong `_id == $showId` implementation this section exists to prevent.
2. **The cache is a class (`ShowWindowCache`), not a closure-returning factory function**,
   unlike most of this project's other F3/F4 pure modules. Chosen because tests need to construct
   multiple independent cache instances with different injected sources/TTLs without any shared
   module state leaking between them (A4, A5, A6, A8 each build their own), while production code
   still gets one shared instance via `getProductionShowWindowCache()`. A2's `@ts-expect-error` on
   zero-arg construction is the compiler proof that an un-configured cache (no source at all,
   which would be meaningless and silently always-refuse) is impossible to construct.
3. **`resolveShowWindowLookup` accepts an optional `deps.cache` override rather than the tests
   reaching into module internals.** Matches this project's existing injectable-dependency
   convention (F8/F10's `deps.db` pattern in `lib/orders.ts`) rather than inventing a new one.
4. **Only `app/api/admin/tickets/comp/route.ts` is wired.** This is the ONE existing call site of
   `hasCapability()` in the entire codebase (`grep -rn hasCapability app/ lib/ scripts/`,
   confirmed at contract-authoring time) — there is no other route to choose between. See "What
   this contract does NOT prove" above for why checkin/tickets/export-csv are explicitly left
   alone rather than opportunistically wired while this file is already open.
5. **A9's wiring proof is a source-level check, not a live HTTP round trip**, following the exact
   precedent and justification `ticketing-f3-admin-roles`'s own A8 already established for a
   structurally identical situation (an authorship/construction property no runtime call can
   observe without disproportionate mocking). Unlike F3's A8, this check does not merely assert a
   regex matches — it FIRST self-tests that same regex against two frozen fixtures (the real
   pre-contract file content, and this contract's own architect-authored wired golden) and
   refuses to evaluate the live file at all unless the discriminator is proven, on known inputs,
   to reject the wrong shape and accept the right one.

## Every assertion and its defeating mutation

See the contract YAML's own `description` field for each assertion (A1-A10) and each check
script's own header comment — every script states its defeating mutation inline, next to the
code that catches it, so the two cannot drift apart. Not duplicated here to avoid the two
descriptions silently diverging over time.

## Files written by this contract

- `contracts/contract-ticketing-show-window-lookup.yaml`
- `contracts/golden/ticketing-show-window-lookup/README.md` (this file)
- `contracts/golden/ticketing-show-window-lookup/comp-route-wired.expected.ts.txt` — the
  architect-authored exact expected content of `app/api/admin/tickets/comp/route.ts` after
  wiring (referenced by A9, not sha256-pinned — this is not a payment-security boundary like
  `app/api/tickets/itn/route.ts`, so A9 checks the specific call-site shape rather than
  byte-identity, leaving `@dev` free to make unrelated formatting/comment adjustments elsewhere
  in the file without failing the gate).
- `contracts/checks/ticketing-show-window-lookup/tsconfig.typecheck.json`
- `contracts/checks/ticketing-show-window-lookup/fixtures/show-window-lookup-typecheck.ts`
- `contracts/checks/ticketing-show-window-lookup/fixtures/comp-route-unwired.fixture.ts.txt` —
  frozen copy of the real pre-contract file content, used only as A9's negative self-test input.
- `contracts/checks/ticketing-show-window-lookup/check-build-window-fail-closed.mjs` (A3)
- `contracts/checks/ticketing-show-window-lookup/check-cache-fail-closed-and-ttl.mjs` (A4)
- `contracts/checks/ticketing-show-window-lookup/check-refetch-on-stale.mjs` (A5)
- `contracts/checks/ticketing-show-window-lookup/check-showid-scoping.mjs` (A6)
- `contracts/checks/ticketing-show-window-lookup/check-utc-parsing.mjs` (A7)
- `contracts/checks/ticketing-show-window-lookup/check-boundary-inclusivity-e2e.mjs` (A8)
- `contracts/checks/ticketing-show-window-lookup/check-comp-route-wiring.mjs` (A9)

Every `.mjs` script above was syntax-checked (`node --check`) by architect. A9 was additionally
run standalone (it has no dependency on `lib/show-window-lookup.ts`, which does not exist yet) —
its self-test against both fixtures passed, and it correctly FAILS against the current,
unimplemented real file, exactly as expected pre-implementation. A1-A8 cannot run yet (the module
they import does not exist) and are not claimed to be green. No `agent_review` assertion appears
anywhere in this contract.
