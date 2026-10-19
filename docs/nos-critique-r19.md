# nos-critique-r19

Codi's FINAL review of the ticket state pages (beta `93940e04`, 1280px), relayed by the lead (saoc-82) on 2026-10-19.
BASE `origin/main` `93940e04`. There are no copy changes: every edit stays inside `docs/rules/no-invention.md` (no new copy,
tokens or colours), `design/design_handoff_saoc/` and `branding/National Show 2027/`. Nothing under `branding/` changes.

## F1 - Ticket state pages: "Back to tickets" on the hero edge, server-rendered not-found, titles

The two pages are PayFast's return targets: `/tickets/cancelled` (cancel_url) and `/tickets/confirmation` (return_url). Both
link "Back to tickets" to `/national-show/tickets`.

- **/tickets/cancelled: the button sits on the hero content edge** (`app/(marketing)/tickets/cancelled/page.tsx`).
  - The centred 600px column (`mx-auto max-w-[600px] text-center`) is now `<div className="nk-state">`. The "Booking ref: …"
    line (shown with `?ref=`) moves to the same left edge with it.
  - At BASE, `.nos-theme .nk-cta { width: 100%; grid-column: 1 / -1 }` beat the Link's Tailwind `w-auto`, so the button was a
    600px centred bar at 1280px and full width at 390px.
  - A new block in `app/(marketing)/national-show/nos-structure.css`, directly below `.nk-checkout-total .nk-cta`, sets
    `.nos-theme .nk-state .nk-cta { width: auto; grid-column: auto; }`. The button now keeps its natural width (50px tall, from
    `nk-btn`) at every width, on the h1/lede edge. The Link line itself is unchanged.
- **/tickets/confirmation: "Booking not found" is decided on the server.**
  - At BASE the server rendered hero "Tickets" plus `ConfirmationPoller`, which fetched `/api/tickets/status` in the browser
    and, on a 404 or an empty ref, showed an h2 "Booking not found", the sentence and a 14px text link. A state decided in the
    browser could own neither the hero h1 nor the `<title>`.
  - New `lib/ticket-status.ts` exports `getTicketStatus(ref)`: the status endpoint's existing query (`tickets` where
    `bookingRef == ref`, limit 1). It returns the status, or `null` when there is no ticket or no status, and throws on a
    Firestore error.
  - `app/api/tickets/status/route.ts` calls it and keeps every response: 404 "Not found." for an empty, missing or status-less
    ref, `{ status }` only on success, 500 on error. The server and the poller share one lookup, so they cannot disagree.
  - `page.tsx`: when there is no confirmed order, the page is not-found if the ref is empty or `getTicketStatus` resolves
    `null`. A lookup that throws is not "not found": the page renders the poller exactly as at BASE.
  - The not-found render is `NosHero` with the h1 "Booking not found" and `confirmationNotFoundMessage` as its lede, fetched
    server-side with the poller's existing fallback. Below it, an `nk-state` div holds the `nk-btn nk-cta` "Back to tickets"
    link, the same treatment as /tickets/cancelled.
  - Server-side, the lede reads the CMS sentence ("… If you've just paid, check the confirmation link or contact
    info@saoc.co.za."). BASE fetched it in the browser, where the request failed on local builds, so it showed the fallback.
    Both are existing copy.
  - `ConfirmationPoller` loses its not-found state, branch and copy field. A 404 now calls `router.refresh()`, so the server
    renders the not-found state (a ticket deleted mid-poll is the only way to reach it now). Its checking, reserved and
    timed-out states and their link are unchanged.
  - `getConfirmedOrderForDisplay` and `getTicketStatus` are wrapped in React `cache()`, so `generateMetadata` and the page
    share one lookup per request.
  - `normalizeBookingRefParam` and the whole success render are byte-identical to BASE, including the success state's own
    14px "Back to tickets" link, which is outside this ruling.
- **Titles** (sentence case, R64). Both go through the root template `%s | South African Orchid Council`.
  - `/tickets/cancelled`: "Payment Cancelled" becomes "Payment cancelled", the same string as the h1 fallback.
  - `/tickets/confirmation` not-found: `generateMetadata` returns "Booking not found", so the title is in the server HTML.
    Success and pending keep the site default, as at BASE. A lookup error also keeps the default.
- **Note for the lead:** these pages keep the root SAOC title template, while `/tickets/<slug>` uses the NOS suffix
  ("— National Orchid Show | SAOC", R62 #1). Moving them to the NOS suffix needs a separate ruling.
- **Not rendered by the checks:** the confirmation success state needs a paid order in Firestore. Reading live orders (PII) and
  seeding one (a write to the shared project) are both out of bounds, so the success source is instead held byte-identical to
  BASE.
