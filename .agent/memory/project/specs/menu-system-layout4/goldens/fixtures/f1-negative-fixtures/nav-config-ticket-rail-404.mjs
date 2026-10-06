// menu-system-layout4 M3/F11 -- NEGATIVE fixture: byte-for-byte clone of
// nav-config-good-control.mjs (the F8 destinations[] shape) with exactly one
// injected defect -- the feature rail's "Weekend Pass" destination points at a
// path that will never exist, /national-show/does-not-exist-fixture-only-404,
// instead of the real /tickets/weekend-pass. Proves check-nav-links-200-gated-
// by-exemptions.mjs's --nav-file escape hatch actually feeds a real per-href
// fetch() (not a source-text grep): run against a real local dev server with
// --pending-routes pointed at pending-routes-empty-fixture.json (so the SKIP
// branch never triggers), this fixture must make the checker exit 1 and name
// this exact href among the failures. If it doesn't, the checker's HTTP branch
// isn't really checking what it claims to check.
//
// CORRECTED post-authoring (Codex GPT-5.5 review + @qa both independently
// caught this): this fixture originally pointed at
// /tickets/does-not-exist-fixture-only-404, which -- like every path under
// app/(marketing)/tickets/[slug]/page.tsx -- soft-404s (HTTP 200 + a noindex
// meta tag from Next's not-found boundary, per the goal section's "1b.
// AMENDMENT" note), NOT a real 404. That meant this fixture never actually
// exercised the checker's `status !== 200` branch at all -- it silently
// exercised the SAME noindex branch nav-config-tickets-soft-404.mjs exists to
// test, and the A6/A6b descriptions claiming this fixture proved the
// status-code branch were false. /national-show/does-not-exist-fixture-only-404
// has no dynamic segment in its route (app/(marketing)/national-show/ is a
// static tree) so it genuinely 404s at the router level -- verified LIVE on
// https://beta.saoc.co.za before this fix: HTTP 404. NOTE: its body also
// happens to contain the noindex meta tag (Next emits it on every not-found
// render, real 404 or soft-404 alike -- see A2c) -- that is expected and
// harmless, since status !== 200 alone already fails this href regardless of
// what the body contains; A2c's fix ensures the checker's own failure-reason
// string reports plain "404", never the misleading "soft-404" label, for
// exactly this case. A6e's assertion proves the failure came from the status
// branch specifically (output must NOT contain "soft-404").
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
          "href": "/national-show/does-not-exist-fixture-only-404",
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
