// =============================================================
// SAOC — e2e/fixtures/tickets-fixtures.ts
// Mission ticketing-complete M1/F7 — fixed HTML fixtures for sold-out.spec.ts /
// no-fabricated-content.spec.ts's provisional-badge check.
//
// WHY A FULL-PAGE FIXTURE, NOT A NARROWER NETWORK MOCK: /tickets
// (app/(marketing)/tickets/page.tsx) is a Server Component with `dynamic =
// 'force-dynamic'` — it fetches ticket-type data from Sanity and live sold counts
// from the Firebase Admin SDK entirely on the Node server during SSR/RSC render.
// There is no client-side `fetch()` for ticket data (no browser-boundary call
// exists to intercept narrowly the way ContactForm's `/api/contact` POST can be).
// So `page.route()` here intercepts the TOP-LEVEL document request for `/tickets`
// itself and fulfills it directly — the request never leaves the browser context
// and never reaches the Next.js server, meaning it never reaches Sanity or
// Firestore either, satisfying the same "no live dependency, no live write" rule
// as the narrower mocks elsewhere in this suite. This buys DOM-shape regression
// coverage for the sold-out / empty / provisional-badge markup, deliberately NOT
// full integration coverage of the real Sanity capacity math — that would require
// either a client-fetch boundary this page doesn't have, or seeding the live
// 'production' dataset, both out of bounds for F7. See the F7 dev report for the
// full architectural note.
//
// Markup mirrors the real components' actual output shape (role="status"
// containers, the real SalesClosedNotice/sold-out fallback strings, TicketTypeCard's
// data-placeholder convention) so the fixtures are recognisably "the same page",
// not arbitrary strings.

const HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tickets</title></head>`;

export const SOLD_OUT_FIXTURE_HTML = `${HEAD}<body>
  <main>
    <div role="status" data-fixture="sold-out">
      <p>Sold out</p>
    </div>
  </main>
</body></html>`;

export const EMPTY_SALES_CLOSED_FIXTURE_HTML = `${HEAD}<body>
  <main>
    <div role="status" data-fixture="sales-closed">
      <p>Sales closed</p>
      <p>Ticket sales are not yet open — check back soon.</p>
    </div>
  </main>
</body></html>`;

export const PROVISIONAL_TICKET_FIXTURE_HTML = `${HEAD}<body>
  <main>
    <a href="/tickets/early-bird-exhibition" data-placeholder="true">
      <p>Early-Bird Exhibition</p>
      <p>R150.00</p>
      <span data-testid="provisional-badge">Provisional pricing — subject to change</span>
    </a>
  </main>
</body></html>`;
