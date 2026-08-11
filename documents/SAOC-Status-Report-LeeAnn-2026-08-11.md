# Status report — to Lee-Ann McCleland

**Date:** 11 August 2026
**From:** Brad Adams, Inunu Net
**To:** Lee-Ann McCleland, SAOC Secretary — 2027national@gmail.com
**Subject:** SAOC website — build status, what's needed from the committee

> **Note (internal, delete before sending):** This is written fresh rather than edited from the
> unsent Gmail draft `r7069159880970212600`, which could not be retrieved this session and was in
> any case stale — it predates the verified proposal provenance, the resolved PayFast position and
> the brand decisions. If you want the old draft's phrasing folded in, paste it and I'll merge.
> Everything below is verified against the live site and the live content database, not assumed.

---

Hi Lee-Ann,

Here's a proper status update on where the website stands, what's blocking, and what we need from
the committee to keep moving. I've split it by whose court each item sits in so nothing falls
between us.

## Where the build is

The site is built and running. Every page is live on our preview hosting and can be walked through
end to end today:

- **Home, About, Societies, Judging, Events, National Show, Sponsors, Media Kit, Contact,** plus
  Constitution, Privacy and Terms.
- **All 21 affiliated societies** are in, each with its own page — province, region, venue, meeting
  details, founding year and member count.
- **18 events** across the calendar, each with its own page, and a working "add to calendar"
  export so members can subscribe to SAOC dates directly.
- **The National Show section** — overview, exhibitor information, and a show archive covering
  2012, 2015, 2018, 2021 and 2024, with individual pages per show.
- **The contact form** is live and delivers, with a confirmation email back to the sender.
- **Behind the scenes:** the ticket check-in system for door staff, and the content management
  system the committee will use to edit the site.

## The CMS is now working

This is the significant change since we last spoke. The content management system had a technical
fault that prevented documents from being edited — that's fixed. I'm now editing site content
directly, and once you've had a walkthrough, the committee can too. Editing text, dates, venue
details and images no longer needs a developer.

That matters for the questions in Section 8 of your specification: day-to-day content editing is
in Phase 1. The more advanced capabilities you asked about — scheduled publishing, per-society
logins, one profile appearing across multiple pages, and a searchable awards archive — all depend
on the shared content database, which is Phase 2 work. The capability is in the plan; it isn't in
this phase.

## Ticketing

The payment side is built — checkout and the payment-confirmation handling are both written and
tested. Two things stand between that and tickets actually going on sale, and they're covered
under "what we need" below.

## How I'd sequence the rest

To restate the plan so we're working from the same page:

1. **Lock the design direction.** Nothing else moves until the visual identity is signed off. I'm
   currently designing the SAOC organisational identity myself — that's in progress on my side.
2. **Core SAOC site live,** together with a National Show landing page.
3. **Ticket sales open off that landing page** — deliberately early, so we have the longest
   possible runway to sell out before the 2027 show.
4. **Phase 2, separately scoped and quoted** once Phase 1 is live and the committee is actively
   marketing: the shared content database behind Exhibitors, Speakers, Judges, Awards and
   Workshops; combined multi-category booking with waiting lists; the Members Portal, journal
   archive and full awards archive; and the Symposium, WOSA Conference and Workshop pages.

Worth being straight about the scale: Specification V2 describes what is effectively two websites —
a six-page SAOC organisational site and an eighteen-page National Show site with a relational
database behind it. The proposal the Council accepted in May covered eight pages, a Show landing
page and general admission ticketing. The Phase 1 work is on track against what was quoted; the
larger pieces are real and buildable, but they're a separate project rather than an extension of
this one. Twelve of the eighteen Show pages depend on that shared database.

One small correction while we're here: Specification V2 records the combined multi-category
checkout — general admission, Symposium, WOSA and workshops in a single transaction — as confirmed
by Inunu. Only general admission was confirmed. The combined checkout is Phase 2.

---

## What we need from the committee

### 1. Ticket prices and capacity — the most urgent item

Ticket sales cannot be switched on without real numbers. We need:

- Prices for each category: adult, pensioner, child, SAOC member, exhibitor.
- Venue capacity, and any per-day limits.
- Whether any category needs to be capped separately.

This is the single item most directly delaying revenue, because it blocks tickets going on sale,
which in turn shortens the selling window before the show.

### 2. A PayFast account for SAOC

To confirm where this landed: Yoco is waitlisted with no delivery date, so PayFast is the
recommendation — 3.2% plus R2 per card transaction, 2.0% on instant EFT.

I can continue building and testing against my own PayFast test account, so **development is not
blocked**. What is blocked is going live, which needs **SAOC to register its own PayFast merchant
account as a non-profit**. That registration requires the organisation's FICA documents — NPO or
PBO registration, proof of address, and bank-issued proof of the account. Money from ticket sales
must land in SAOC's account, not ours, which is why this has to be SAOC's own registration.

Could you let me know who on the committee is taking this on? It tends to take a few weeks
end to end, so starting it now avoids it becoming the thing that holds up the launch.

### 3. Content

The site's structure is complete; a number of fields are still empty and need real material.
Where the committee holds this information, could you gather it and send it through — we'll load
it in. In rough priority order:

**Judges directory — nothing on file yet.** We need the full list: names, region, and the year
each was accredited. Photographs are welcome but optional.

**Past National Shows** — the biggest gap. For each of 2012, 2015, 2018, 2021 and 2024 we
currently hold only the year, host location and entry count. We need the dates, the venue,
exhibitor and award counts, a short paragraph on each show, the results and winners, and any
photographs the committee holds. This is what turns the archive from a list into a record worth
visiting.

**The 2027 Show** — confirmed dates and venue, and the exhibitor stage details.

**The 21 societies** — for each, a short description (two or three sentences), a logo if they have
one, and a website or Facebook page address. Everything else for the societies is already in.

**Sponsors** — we hold six names only. For each we need the sponsorship tier, a logo, a website
address, a short description, and confirmation of whether they're currently active. Also worth
confirming those six are the right six.

**Council members** — we have names and roles. We need email addresses, photographs, and the order
they should appear in. Plus a short introductory paragraph about the Council for the About page.

**Events** — for the 18 events on the calendar we need a short description, the hosting society,
and the location for each. Five are also missing an end date.

**Awards** — the year each award category was established.

I appreciate this is a substantial list. It's the material the pages are already built to display,
so every item sent through makes a visible difference immediately. If it's easier, send it in
batches as it comes in rather than waiting to assemble it all.

### 4. Domain approval emails — a small but time-sensitive thing

We'll initiate the transfer of saoc.co.za to our registrar from our side. Once we do, the registrar
automatically emails the domain's registered administrative and owner contacts asking them to
approve the transfer. **These approvals have a deadline and the transfer fails silently if they're
missed.**

Two things would help: confirm which email addresses are on record as the domain's administrative
and owner contacts, and make sure whoever holds them knows to expect the approval request and
action it promptly. If any of those addresses are no longer monitored, tell me before we start and
we'll handle it differently.

---

## What's on our side

For completeness, so you can see the work isn't all pointing at the committee:

- The SAOC organisational identity — I'm designing it now.
- The National Show identity — a new design is done, and I'll present it to the committee.
- Continued ticketing development against a test payment account.
- Loading all content the committee sends through.
- Migrating the old website and its email accounts across, and the domain and DNS cutover.

## What I'd like from you

If you could come back on the ticket prices and capacity, and let me know who's handling the
PayFast registration, those two unlock the most. The content can follow in batches.

Happy to walk the committee through the site live if that's useful — it demonstrates far better
than it describes.

Best regards,

Brad Adams
Inunu Net
brad@inunu.net
