# Exhibitor Information Page — Guide for Lee-Ann and the Show Committee

This is a plain-language guide to the exhibitor information page
(saoc.co.za/national-show/exhibitors — "how to enter the National Show"). You don't need to know
code — just where to find things in Studio and what each field controls.

**Nothing here is live yet.** This is on our development site while the committee reviews it —
there is no public web address pointing at it yet.

## The Most Important Thing to Understand First

**We did not know SAOC's own exhibitor rules, so we did not invent them.**

We researched how established orchid shows around the world brief their exhibitors — entry
deadlines, staging times, plant eligibility, judging conventions — and put that on the page as a
**starting point for the committee to correct**. None of it is SAOC policy. Every block on the
page carries a small label telling the reader exactly that, so nobody — including an exhibitor
reading the page — can mistake our research for something the council decided.

**Your job is to read through the page, decide what's right for SAOC and what isn't, and correct
it in Studio.** The labels tell you exactly which blocks need your attention and which don't.

## Quick Start

1. Go to [http://localhost:3000/studio](http://localhost:3000/studio) (development) or the live
   Studio URL once we have one
2. Click **"Show Exhibitor Information"** in the left sidebar (under "Singletons")
3. Edit the copy you see on the screen
4. Click **"Publish"** at the top right
5. Changes appear on the page within about a minute

## What the Three Labels Mean

Every section of the page shows a small marker next to it. There are three, and they mean
different things:

| What you'll see | What it means |
|---|---|
| **"To be confirmed by the show committee"** | A blank we need you to fill in — a real deadline, fee, or time that only SAOC can supply |
| **"Researched international show practice — not yet SAOC policy"** | We found this is how other established shows do it, and we're offering it as a starting point. Confirm it, change it, or reject it — your call |
| **"Open question for the show committee — we could not establish this"** | We looked and genuinely could not find a public example anywhere. We're asking you, not telling you |

**A fourth state has no marker at all: once you confirm something is correct, remove or change
its status and the marker disappears** — it then reads as a plain fact on the page, the way any
of your own approved content should.

## How to Move a Block from "Pending" to Confirmed

Say the council has decided the entry deadline. Here's the process:

1. Open **"Show Exhibitor Information"** in Studio
2. Find the **"Key Dates"** field group and open the "Entries close" row (or whichever date
   you're confirming)
3. Update the **"When"** field with the real date/time, and the **"Detail"** field with any
   extra explanation
4. Find the matching **status** field on that row and change it from "Pending" (or "Research"/
   "Question") to **"Confirmed"**
5. Click **"Publish"**

The marker disappears from that row, and it now reads as a plain, confirmed fact — no different
from any other text on the site.

**Every section works this way** — the key dates table, the entry fee section, the judging
section, and so on each have their own status. Confirming one doesn't confirm the others; you
control each block independently.

## How to Change a Deadline or Fee

- **Deadlines and key dates**: "Show Exhibitor Information" → **Key Dates** group → each row has
  a Label (e.g. "Entries close"), a When (free text — write it however makes sense, e.g. "Friday
  14 August 2027, 5pm"), and a Detail field.
- **Entry fees**: "Show Exhibitor Information" → **Reference Sections** group → **"Entry Fees"**.
  This is a normal text field (Heading + Body) — write the fee structure however the council has
  agreed it (per-plant, per-exhibitor, whatever applies). Body text supports basic formatting —
  paragraphs, bold, that kind of thing.

There is no separate numeric "price" field like the ticket prices have — exhibitor fees are
usually more than one number (entry fee, judging fee, etc.), so this is free text you write out
in full.

## The Step-by-Step Journey

Below the key dates, the page walks an exhibitor through the process from deciding to enter
through to taking their plants home. Each step is its own document:

1. In Studio, click **"Show Exhibitor Step"** in the left sidebar (a list, not a singleton —
   there are seven of them)
2. Click any step to edit its **Title**, **When** (roughly what point in the process this is),
   and **Body** (the explanation)
3. Each step has its own status marker too, same rules as above
4. There's an **"Order"** field controlling the sequence they appear in, and an **"Active"**
   checkbox if you ever need to hide one without deleting it

## The Nine Reference Sections

Further down the page, nine sections cover the detail an exhibitor needs to plan around: how
entry works, fees, classes, judging, plant eligibility, displays and stands, selling plants,
practicalities (insurance/security/watering/loading), and permits/moving plants between
provinces. Each is in **"Show Exhibitor Information"** → **Reference Sections**, with a Heading
and a Body field.

**Each section's status marker lives in a separate place from the section itself** — under the
**"Confirmation Status"** group, further down the same document. There's one status field per
section, named to match (e.g. the "Fees" status controls the marker on the "Entry Fees" section).
This is deliberate: it keeps every section's confirmation state visible together in one place
rather than scattered through the document, so at a glance you can see everything that still
needs a decision.

**Two of these — Classes and Judging — deliberately don't repeat information that already lives
elsewhere on the site.** The Classes section links out to the show classes already listed on the
National Show page rather than listing them again, and Judging links to the existing SAOC judging
standards page. If you need to change a class or a judging rule, change it at the source (the
National Show page or the Judging page) — not here.

## Open Questions

Near the bottom of the page, an **"Open Questions"** list shows everything the research
genuinely could not find an answer for anywhere — things like overnight security, who waters
plants during the show, insurance, and whether exhibitors can sell plants from their own entries.

This list is effectively **the committee's to-do list for this page**. Each question is its own
entry in Studio ("Open Questions" field, under the same singleton) — add, remove, or answer them
as the council makes decisions. Answering one usually means moving its answer into the matching
reference section above and confirming that section's status, then you can delete the question
here.

## How to Supply the Entry-Form PDF

There is currently no entry form — the page honestly says so rather than showing a broken link.
Once the committee has one:

1. Open **"Show Exhibitor Information"** in Studio
2. Find the **"Entry Form"** group
3. Under **"Entry Form — File"**, click to upload the PDF (only PDF files are accepted)
4. Click **"Publish"**

The page will automatically show a real "Download the entry form" button instead of the "not yet
published" message. You don't need to touch anything else — the pending message and the download
button are two states of the same field, and Studio switches between them for you.

If the form is hosted somewhere else instead of uploaded here (e.g. a Google Drive link), use the
**"Entry Form — External URL"** field instead of uploading a file. Only fill in one of the two.

## Things We Still Need From You

The page cannot be finished without the council supplying:

- The real entry deadline and fees
- Staging and plant-removal times
- Whether exhibitors may be present during judging
- How long an exhibitor must have owned a plant before it's eligible to enter (our research found
  one overseas show requires 12 months — that number is theirs, not a recommendation)
- Whether exhibitors may sell plants, and on what terms
- Insurance and overnight security arrangements for benched plants
- The entry form itself

Until these arrive, the page shows the appropriate label ("to be confirmed" or "open question")
in each spot rather than guessing. Please don't feel you need to answer everything at once —
confirm sections as the council reaches decisions, and publish each as you go.

## Things to Know

### Publishing Changes

After you edit anything, you **must click "Publish"** at the top right, or your changes won't
appear on the website.

### When Do Changes Appear?

Changes typically appear within about a minute of publishing. Occasionally it can take a little
longer — the page checks for new content periodically rather than instantly, which is normal and
not a sign that something is broken.

### Don't Worry About Breaking the Honesty Markers

The "to be confirmed" / "researched" / "open question" labels are built to be hard to accidentally
remove — if you ever leave a status field blank or pick something unexpected, the page falls back
to showing "To be confirmed by the show committee" rather than silently showing nothing. You can't
accidentally make a section look confirmed by leaving a field empty.

## Questions?

If something doesn't work as expected, or you're not sure whether a piece of text should be
"Confirmed" yet, contact the dev team with a screenshot of what you're seeing in Studio.
