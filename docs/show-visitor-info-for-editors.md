# National Show Visitor Info — Guide for Lee-Ann

This is a plain-language guide to the three new National Show pages — Plan Your Visit, What to
Expect, and FAQ. You don't need to know code — just where to find things in Studio and what the
little "To be confirmed" tags mean.

**Nothing here is live yet.** This is on the development site only, while the committee's answers
are still outstanding. Nobody outside the project team should be shown these pages as finished.

## Quick Start

1. Go to [http://localhost:3000/studio](http://localhost:3000/studio) (development) or the live
   Studio URL
2. Click **"National Show"** in the left sidebar (under "Singletons") to change the venue and
   dates, or **"Show Visitor Information"** to change everything on the three visitor pages
3. Edit the copy you see
4. Click **"Publish"** at the top right

Changes appear on the website within about a minute.

## What Is Happening Here?

Three pages tell visitors how to plan their trip to the show:

- **Plan Your Visit** (`/national-show/plan-your-visit`) — getting there from the airport,
  parking, public transport, where to stay, nearby things to do, emergency contacts
- **What to Expect** (`/national-show/what-to-expect`) — opening hours, how admission works, food,
  photography rules, where to leave coats and bags, wheelchair access
- **FAQ** (`/national-show/faq`) — common questions grouped by topic

Every word on these three pages comes from Studio. There is no committee-confirmed information
yet — venue, exact dates, opening hours and most other details are the web team's best working
guess, clearly marked as such, until SAOC tells us otherwise.

## The Venue — the One Thing Worth Understanding Well

The venue (and the dates, and which region is hosting) live in **one place**: the **"National
Show"** document. Every page that mentions the venue — the show page, Plan Your Visit, the Contact
page, the home page, even the little bar at the top of every page — reads from that one document.
That means:

**When the committee confirms the real venue, you change it once, in one place, and every page on
the site updates itself.** You never need to ask a developer to change a page because the venue
moved.

To change it:

1. Click **"National Show"** in the sidebar
2. Open the **"Venue"** section — name, address, city, province, postal code, map link, directions
3. Edit whatever the committee has confirmed
4. Click **"Publish"**

Do the same for the **"Dates"**, **"Edition"** and **"Host Region"** fields on that same document
when the committee confirms them.

**Confirmed venue:** The Hangar, Stellenbosch Flying Club, Stellenbosch Airfield, R44, Stellenbosch 7600, 18–21 September
2027 (client-confirmed 2026-08-12). Travel, parking and accessibility detail for this venue has
not been researched yet — those pages honestly say "not confirmed" rather than guess, and the
one-place-change above is how you fix the venue everywhere if it ever changes again in 2030.

## The "To Be Confirmed" Tags — What They Mean and How They Work

You will see small tags like *"To be confirmed by the show committee"* or *"Researched by the web
team against the working venue — not yet confirmed by the show committee"* next to many pieces of
information across these pages. That is deliberate — same idea as the "Provisional price" note on
the ticket pages.

There are three states behind each tag, set on the **"Show Visitor Information"** document under
**"Confirmation Status"**:

| What you set it to | What visitors see |
|---|---|
| **Pending** (the default) | The "To be confirmed by the show committee" tag |
| **Research** | The "Researched by the web team — not yet confirmed" tag |
| **Confirmed** | No tag at all — reads as a plain, settled fact |

**Only change something to "Confirmed" once the show committee has actually signed off on that
exact detail.** Once you do, the tag disappears and visitors will read it as fact.

### A warning: clearing the label text is NOT how you remove a tag

On the **"Show Visitor Information"** document, under **"Pending Labels"**, there are two text
fields — **"Pending Label"** and **"Research Label"** — that hold the wording of the two tags
above. These control the *wording* of every tag on the site at once.

**Do not clear these fields to try to hide the tags.** They are required fields, and Studio will
show an error if you try to leave one blank. If a tag is somehow blank on the live page anyway
(for example, if something was changed outside Studio), the website falls back to its own built-in
wording — you will see "To be confirmed" or "Not yet confirmed" instead, not a blank space. That
fallback is a safety feature, not a way to turn tags off.

**The only correct way to remove a tag from one piece of information** is to open the individual
status field for that block (under "Confirmation Status") and set it to **"Confirmed"** — never by
touching the label wording fields.

## Changing Content

### Venue, dates, edition, host region
Document: **"National Show"**. See "The Venue" section above.

### Opening hours, admission, food, photography, cloakroom, accessibility
Document: **"Show Visitor Information"**, group **"What to Expect"**. Each is a text field you can
edit freely.

**Admission note:** describe how admission works (concessions, door vs. advance booking,
re-entry) — but **never type a price here**. Prices are set on the **"Ticket Type"** documents
(see the ticketing guide) and this page links to `/tickets` automatically via the **"Admission
Link Label"** field. Keeping prices in one place means they can never go out of sync.

### Getting there, parking, transport, accommodation, attractions, emergency contacts
Document: **"Show Visitor Information"**, group **"Plan Your Visit"**.

- **"Travel From Airports"** — one entry per airport a visitor might fly into. Add or remove
  entries freely; the page just lists whatever is there.
- **"Accommodation"** — each entry has a **"Distance Band"** (Walking / Nearby / City / Further)
  that controls which group it's shown under on the page. There are deliberately no price or
  star-rating fields — SAOC doesn't have a booking arrangement with any of these places and the
  site must not look like it does.
- **"Nearby Attractions"** and **"Emergency Contacts"** — add or remove entries as needed.

### FAQ entries
Document type: **"Show FAQ"** (a list in the sidebar, not a singleton — each question is its own
document).

1. Click **"Show FAQ"** in the sidebar, then **"Create"** for a new question (or click an existing
   one to edit it)
2. Fill in **Question**, **Answer**, **Category** (Getting There / Tickets / Accessibility /
   Plant Sales / General), and **Order** (lower numbers appear first within their category)
3. Set the **Status** — Pending / Research / Confirmed, same rules as above
4. Make sure **"Active"** is checked, or the question won't appear on the site at all
5. Click **"Publish"**

To temporarily hide a question without deleting it, uncheck **"Active"** and publish.

## Publishing Changes

As with everything else in Studio: after you edit anything, you **must click "Publish"** at the
top right, or your changes won't appear on the website. Changes typically appear within about a
minute.

## Things to Know

- **These pages don't have a maps app embedded in them** — just a link to a map and, optionally, a
  static map picture. That's deliberate; it keeps the site fast and free of paid map subscriptions.
- **Ticket prices never appear on these pages** — What to Expect only links to `/tickets`, where
  the real (still provisional) prices live.
- **Nothing here is final.** Every "To be confirmed" tag is doing its job by being visible. Don't
  remove one unless the committee has actually confirmed that specific detail.

## Questions?

If something doesn't work as expected:

- **A tag disappeared and it shouldn't have?** Check the individual status field for that content
  block — it may have been accidentally set to "Confirmed". If every tag on the site disappeared
  at once, check that "Pending Label" and "Research Label" (under "Pending Labels") aren't blank.
- **Can't find "Show Visitor Information"?** Look in the sidebar under "Singletons" — it's a
  separate document from "National Show" and from individual "Show FAQ" entries.
- **Content looks wrong or hasn't updated?** Give it a minute after publishing, then refresh.

Anything else: contact the dev team with a screenshot of what you're seeing.
