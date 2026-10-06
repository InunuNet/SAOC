// menu-system-layout4 M3/F11 -- NEGATIVE fixture, SOFT-404 variant. Byte-for-byte
// clone of nav-config-ticket-rail-404.mjs with a DIFFERENT injected defect: the
// feature rail's "Weekend Pass" destination points at
// /tickets/does-not-exist-fixture-only-soft404 -- a path under the dynamic
// app/(marketing)/tickets/[slug]/page.tsx route that calls notFound() (see
// that file, line 91) AFTER Next 16's streaming SSR has already committed an
// HTTP 200 (loading.tsx starts streaming before notFound() resolves deep in
// the tree; the status code cannot retroactively become 404 once bytes are on
// the wire). The transport-level response is genuinely 200, so a checker that
// only checks `status === 200` cannot see this as a failure -- but Next 16
// itself always emits `<meta name="robots" content="noindex"` on the
// not-found boundary's render regardless of what the status code ended up
// being (confirmed directly against node_modules/next: the doc comment on
// notFound() in next/dist/client/components/not-found.js states it inserts
// this exact meta tag, and HTTPAccessFallbackErrorBoundary.render() in
// next/dist/client/components/http-access-fallback/error-boundary.js
// unconditionally wraps the not-found render in it). Verified LIVE, both
// locally (localhost:3002) and on https://beta.saoc.co.za, against this exact
// path before this fixture was written:
//   HTTP 200, body contains `<meta name="robots" content="noindex"/>`, no <h1>.
// This is the SAME injected-defect shape as nav-config-ticket-rail-404.mjs
// (one destination href swapped, nothing else touched) so it exercises the
// SAME --nav-file escape hatch and the SAME real per-href fetch() -- it only
// differs in which failure mode it proves the checker catches: a soft-404
// (200 + noindex) rather than a hard 404. If the checker only checks
// `status === 200` (pre-F11 behaviour), this fixture's defect is INVISIBLE to
// it and the checker would wrongly exit 0 -- that is exactly the gap this
// fixture exists to close.
export const NAV = [
  {
    "type": "link",
    "id": "about",
    "label": "About",
    "href": "/about"
  },
  {
    "type": "link",
    "id": "societies",
    "label": "Societies",
    "href": "/societies"
  },
  {
    "type": "link",
    "id": "judging",
    "label": "Judging & Awards",
    "href": "/judging"
  },
  {
    "type": "link",
    "id": "events",
    "label": "Events",
    "href": "/events"
  },
  {
    "type": "link",
    "id": "members",
    "label": "Members",
    "href": "/members"
  },
  {
    "type": "mega",
    "id": "national-show",
    "label": "National Show",
    "href": "/national-show",
    "lead": {
      "eyebrow": "The National Show",
      "leadLabel": "19th SAOC National Orchid Show",
      "leadHref": "/national-show",
      "meta": "(placeholder pending Brad/Lee-Ann copy)",
      "theShow": {
        "heading": "The Show",
        "headingHref": null,
        "links": [
          {
            "id": "tickets",
            "label": "Tickets",
            "href": "/national-show/tickets",
            "descriptor": "Buy admission tickets."
          },
          {
            "id": "show-sponsors",
            "label": "Show Sponsors",
            "href": "/national-show/sponsors",
            "descriptor": "The Show's own sponsors — a separate list from SAOC's site-level sponsors."
          },
          {
            "id": "past-shows",
            "label": "Past Shows",
            "href": "/national-show/archive",
            "descriptor": "Previous editions and their champions."
          }
        ]
      }
    },
    "columns": [
      {
        "id": "visit",
        "heading": "Visit",
        "headingHref": null,
        "links": [
          {
            "id": "about-the-show",
            "label": "About the Show",
            "href": "/national-show/about",
            "descriptor": "The show's theme, what it brings together, and who takes part."
          },
          {
            "id": "what-to-expect",
            "label": "What to Expect",
            "href": "/national-show/what-to-expect",
            "descriptor": "Hours, admission and on-the-day detail for visitors."
          },
          {
            "id": "plan-your-visit",
            "label": "Plan Your Visit",
            "href": "/national-show/plan-your-visit",
            "descriptor": "Travel, parking, accommodation and nearby attractions."
          },
          {
            "id": "faq",
            "label": "FAQ",
            "href": "/national-show/faq",
            "descriptor": "The questions visitors ask us most."
          }
        ]
      },
      {
        "id": "programme",
        "heading": "Programme",
        "headingHref": null,
        "links": [
          {
            "id": "programme",
            "label": "Programme",
            "href": "/national-show/programme",
            "descriptor": "The overall schedule of sessions across the four show days."
          },
          {
            "id": "workshops",
            "label": "Workshops",
            "href": "/national-show/workshops",
            "descriptor": "Book Sunset Cocktails and guided Field Trip outings."
          },
          {
            "id": "symposium",
            "label": "SAOC Symposium",
            "href": "/national-show/symposium",
            "descriptor": "The SAOC Symposium — what it is, its theme, and who it is for."
          },
          {
            "id": "wosa-conference",
            "label": "WOSA Conference",
            "href": "/national-show/wosa-conference",
            "descriptor": "What the WOSA Conference is and who it is for, with a link out to WOSA for wild-orchid content."
          },
          {
            "id": "conferences",
            "label": "Conference Registration",
            "href": "/national-show/conferences",
            "descriptor": "Register for the Symposium and WOSA Conference."
          }
        ]
      },
      {
        "id": "exhibit-trade",
        "heading": "Exhibit & Trade",
        "headingHref": null,
        "links": [
          {
            "id": "sa-exhibitors",
            "label": "South African Exhibitors",
            "href": "/national-show/sa-exhibitors",
            "descriptor": "Public directory of South African nurseries exhibiting at the show."
          },
          {
            "id": "international-guests",
            "label": "International Guests",
            "href": "/national-show/international-guests",
            "descriptor": "Public directory of international guests and exhibitors attending the show."
          },
          {
            "id": "exhibitors",
            "label": "Exhibitor Entry Guide",
            "href": "/national-show/exhibitors",
            "descriptor": "Entry process, fees, classes, judging and eligibility for growers entering plants."
          },
          {
            "id": "vendors",
            "label": "Trade Vendors",
            "href": "/national-show/vendors",
            "descriptor": "Trade vendor showcase, application and gated registration."
          }
        ]
      }
    ],
    "featureRail": {
      "heading": "Tickets",
      "destinations": [
        {
          "id": "tickets",
          "label": "Tickets",
          "href": "/national-show/tickets",
          "variant": "primary"
        },
        {
          "id": "day-visitor",
          "label": "Day Visitor",
          "href": "/tickets/day-visitor",
          "variant": "secondary"
        },
        {
          "id": "weekend-pass",
          "label": "Weekend Pass",
          "href": "/tickets/does-not-exist-fixture-only-soft404",
          "variant": "secondary"
        }
      ]
    }
  },
  {
    "type": "link",
    "id": "sponsors",
    "label": "Sponsors",
    "href": "/sponsors"
  }
];
