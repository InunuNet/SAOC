# nos-critique-r19 F1 — the ticket state pages: "Back to tickets" on the hero edge, not-found in the hero, titles

BASE: `origin/main` `1c9fa99f` (harness 3.8.41, CI workflows and public/llms-full.txt over `a4807791`, no rendered page changed; re-pinned from `cbda2c43`, `a4807791`, earlier from `93940e04`, on restacks of `fix/nos-critique-r19-restack`), worktree
`.tmp/sandbox/critique-r19`. The measurements below were taken on `93940e04`; r18 changes none of these pages, and the baselines are
re-captured on `a4807791`.
Rulings: Codi, FINAL, beta 93940e04 at 1280px, relayed by the lead (saoc-82) on 2026-10-19. No copy changes.
Single feature: three rulings on two sibling pages sharing one button treatment and one CSS rule (`contract-f1.yaml`).
Goldens: `f1-edits.json`, `f1-footprint.json`, `f1-baseline.json` (BASE captures), `nonreg-baseline.json`.
Sources: `docs/rules/no-invention.md`; `design/design_handoff_saoc/`; `branding/National Show 2027/`.

**Routes, verified in code:** `/tickets/cancelled` (`app/(marketing)/tickets/cancelled/page.tsx`, the gateway's cancel_url) and
`/tickets/confirmation` (`app/(marketing)/tickets/confirmation/page.tsx`, return_url). Neither lives under /national-show; both link
"Back to tickets" to `/national-show/tickets`. Titles go through the root template `%s | South African Orchid Council`.

## BASE, measured (public build; preview identical)

| route @width | h1 | lede | "Back to tickets" | title |
|---|---|---|---|---|
| cancelled @1280 | x=32, 1216 wide | x=32 | nk-btn nk-cta, x=340, 600x50 (centred bar) | Payment Cancelled \| South African Orchid Council |
| cancelled @390 | x=16 | x=16 | x=16, 358x50 (full width) | same |
| confirmation?ref=bogus @1280 | "Tickets" | none | 14px text link, x=592, centred, under h2 "Booking not found" | South African Orchid Council |
| confirmation (no ref) @390 | "Tickets" | none | 14px text link, x=147 | same |

Cause of the cancelled bar: `.nos-theme .nk-cta { width: 100%; grid-column: 1 / -1 }` (nos-structure.css:1147) beats Tailwind `w-auto`,
inside a `mx-auto max-w-[600px] text-center` column. The NosSection wrap's content edge is the hero copy's axis (nos-structure.css:49),
so a left-aligned child of the wrap sits on the h1/lede edge.

## 1. P2 — /tickets/cancelled (exact, `f1-edits.json` `cancelled` + `css`)

- Line 50: the column `mx-auto max-w-[600px] text-center` becomes `nk-state`. The "Booking ref: …" line (shown with `?ref=`) moves to
  the same left edge with it; centring it alone under a left button would split the block.
- nos-structure.css, after BASE line 2027 (2016 before r18's crumb block) (directly below `.nk-checkout-total .nk-cta`, its own block, nowhere near r18's `.nk-crumbs`):
  `.nos-theme .nk-state .nk-cta { width: auto; grid-column: auto; }`. Natural width at every width, including 390 (the checkout's ≤700
  full-width rule is scoped to `.nk-checkout-total` and does not apply).
- The Link line is unchanged (its `w-auto` was the intent the override now honours). No new token, colour or size; nk-btn gives 50px.

## 2. P2 — /tickets/confirmation booking-not-found (the mechanism)

BASE decides not-found **in the browser**: the server renders hero "Tickets" + `ConfirmationPoller`, which fetches
`/api/tickets/status`, and on 404 (or an empty ref) shows h2 "Booking not found", the `confirmationNotFoundMessage` sentence and a 14px
link. A client-decided state can neither own the server-rendered hero h1 nor the `<title>`.

**Decision: decide not-found on the server, in page.tsx, with the same lookup the status endpoint uses.**
- New `lib/ticket-status.ts`: `export async function getTicketStatus(ref: string): Promise<string | null>` — the endpoint's existing
  query (`tickets` where `bookingRef == ref`, limit 1), returning the status or `null` when there is no ticket or no status; it throws on a
  Firestore error. `app/api/tickets/status/route.ts` calls it and keeps every response (404 "Not found." for empty/missing/no status,
  `{ status }` only, 500 on error). One lookup, so the server and the poller cannot disagree about "not found".
- page.tsx, when there is no confirmed order: not-found = empty ref, or `getTicketStatus(ref)` resolves `null`. A thrown lookup is not
  "not found": the page renders the poller exactly as at BASE (it keeps polling, as before).
- Not-found render: `<NosHero route="/tickets/confirmation" title="Booking not found" lede={confirmationNotFoundMessage} priority />`
  then a NosSection with `<div className="nk-state">` holding `<Link href="/national-show/tickets" className="nk-btn nk-cta">Back to
  tickets</Link>`. The sentence is `confirmationNotFoundMessage` from `ticketsPageQuery` (fetched server-side as the success branch
  does) with the poller's existing fallback "We couldn't find a booking for that reference.". Every string already exists in BASE.
  Note: the CMS holds a longer sentence ("… If you've just paid, check the confirmation link or contact info@saoc.co.za.",
  `f1-edits.json` `notFound.cmsMessage`). BASE fetched it in the browser, which fails on the local builds, so BASE rendered the fallback;
  the server fetch reads the CMS sentence. R3 accepts either: both are existing copy, and the CMS one is what an editor set.
- `ConfirmationPoller` loses its not-found state (state, branch, copy field): a 404 calls `router.refresh()` (once per mount, 2a), so the server
  renders the not-found state (a ticket deleted mid-poll is the only way to reach it now). Its checking/reserved/timed-out states and their
  link are not in this ruling and are unchanged.
- **Title:** `export async function generateMetadata({ searchParams })` returns `{ title: 'Booking not found' }` for the not-found state and
  `{}` otherwise (BASE has no confirmation title; success and pending keep the site default). It must reach the same verdict as the page:
  no confirmed order AND (empty ref OR status null), errors → `{}`. Wrap `getConfirmedOrderForDisplay` and `getTicketStatus` in React
  `cache()` in page.tsx so generateMetadata and the page share one lookup per request. Why generateMetadata and not a client
  `document.title`: the title is then in the server HTML (crawlers, the first paint, the tab), which R2 checks in the HTTP response.
- Kept byte-identical (S3): `normalizeBookingRefParam` (BASE 17-19; `contracts/checks/ticketing-ux-defects-browser-found` imports it) and
  the whole success render (BASE 48-127). Its own 14px "Back to tickets" link is outside this ruling and stays.

**Fixture:** none. A bogus ref (`r19-no-such-booking`) finds no ticket in Firestore, and no ref at all short-circuits to not-found
without a lookup; the checks use both. Reading or seeding real orders is not needed.

## 2a. Pre-merge amendment: the refresh-loop guard (exact, `f1-edits.json` `poller`)

Codi, FINAL, relayed by the lead after the restack. **The loop:** on a 404 the poller calls `router.refresh()`. If the server lookup
throws, `isBookingNotFound` returns false and the page renders the poller again. The next 404 refreshes again, without end.

**Decision: refresh on a 404 at most once per mount.**
- In the polling effect, beside `let attempts = 0; let cancelled = false;`, add `let refreshedOn404 = false;`.
- The 404 branch becomes: if `refreshedOn404`, `setState('timed-out')` and return. Otherwise set the flag, `router.refresh()`, schedule
  the next poll (`if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS)`) and return.
- **Why it keeps polling after the one refresh:** BASE's 404 branch returned and stopped. If the refreshed server render is not-found,
  the poller unmounts and its cleanup stops the loop. If the lookup failed again, the server renders the poller again. `router.refresh()`
  keeps the client instance, so the effect does not re-run and the flag survives. The next poll's 404 then reaches the terminal state.
  Without the re-schedule, the poller would sit on "checking" forever.
- **Why a local in the effect and not `useRef`:** the effect already keeps its per-mount state as locals (`attempts`, `cancelled`). The
  scope is the same, because a new `bookingRef` re-runs the effect, resets the flag and is a new booking. Avoiding `useRef` also means
  no import change.
- **The fallback state:** the existing `timed-out` state. It shows the pending heading, "This is taking longer than expected. Please
  don't resubmit payment — contact info@saoc.co.za with your booking reference …", and the ref. It fits a status nobody could
  confirm, so it is the right terminal state. No better existing option exists, because r19 removed the poller's own not-found
  state, and bringing back a client not-found would contradict ruling 2. No new copy.
- The empty-ref `router.refresh()` and the confirmed-status `router.refresh()` stay as they are. An empty ref is decided not-found on
  the server without any lookup, so the poller never renders for it and it cannot loop. S4 pins three calls in the code.
- **Rendered or unit proof: not feasible without a production seam, so the proof is static.** To reach the loop you need
  `getConfirmedOrderForDisplay` to succeed (return null) while `getTicketStatus` throws. Both read the same Firestore through
  `initAdmin()`:
  - starving the server of credentials throws in `getConfirmedOrderForDisplay` first (it is not wrapped), so the page hits the
    error boundary instead of rendering the poller;
  - intercepting only the browser's status call can't fake the server's verdict;
  - no test seam exists, and the ruling forbids adding one.

  S4 therefore pins the exact branch (`poller.guarded404Re`), the declaration and the call count.

## 3. P3 — titles

- `/tickets/cancelled`: `'Payment Cancelled'` → `'Payment cancelled'` (R64 sentence case; the h1 fallback's own string). Renders
  "Payment cancelled | South African Orchid Council".
- not-found: "Booking not found | South African Orchid Council" (section 2).
- Not changed, noted for the lead: these pages keep the root SAOC template, while `/tickets/<slug>` spells out the NOS suffix
  ("— National Orchid Show | SAOC", R62 #1). Moving them to the NOS suffix is a separate ruling.

## 4. Footprint

`f1-footprint.json`: cancelled/page.tsx, confirmation/page.tsx, ConfirmationPoller.tsx, api/tickets/status/route.ts, lib/ticket-status.ts
(new), nos-structure.css; plus `docs/nos-critique-r19.md` with a `## F1` section.

## 5. What the checks cannot render

The confirmation SUCCESS state needs a paid order in Firestore. Reading live orders to find one was refused (PII) and seeding one is a
write to the shared Firestore project, so it is not rendered: S3 holds its source byte-identical to BASE instead, and nonreg covers the
hub. If the lead wants it rendered, the operator can provide a dedicated test order ref and the check takes it as an env var.
