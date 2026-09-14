// menu-system-layout4 M1/F1 -- GOOD fixture: exact transcription of
// goldens/f1-nav-config-target.json's target NAV shape, generated once from that file so it
// cannot drift from it by hand-typo. Used as the positive control before pointing checkers at
// the negative fixtures in this directory -- if this fixture itself fails a checker, the
// checker (or the golden) has a bug, not the fixture.
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
      "meta": "(placeholder pending Brad/Lee-Ann copy)",
      "heading": "Tickets",
      "blurb": "(placeholder pending Brad/Lee-Ann copy)",
      "ctaLabel": "Buy tickets",
      "ctaHref": "/national-show/tickets"
    }
  },
  {
    "type": "link",
    "id": "sponsors",
    "label": "Sponsors",
    "href": "/sponsors"
  }
];
