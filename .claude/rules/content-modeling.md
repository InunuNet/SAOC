# Content Modelling — Code for the Next Instance, Not This One

The National Show happens every three years, in a new city, at a new venue, with new dates,
new prices and new people. Societies come and go. Judges rotate. **Almost nothing about this
site is permanent, and anything modelled as permanent becomes a bug on a three-year timer.**

These rules exist because in August 2026 a single venue change (CTICC → Stellenbosch Flying
Club) required edits in four Sanity documents and four repo files, and left the site briefly
telling visitors to catch a bus to a stop 45 km from the show. That was a modelling failure,
not a content mistake.

---

## 1. One fact, one home

A fact is stored **once**. Everything else references or derives it.

Never store the same value in two documents "so it's convenient to query". Duplicated facts do
not stay in sync — they stay in sync only for as long as someone remembers all the copies.

Bad: the venue name living on the show singleton, on the edition document, and on the calendar
event, all as free strings.
Correct: one venue object; other documents reference the show and read through it.

If a duplicate is genuinely unavoidable (denormalised for a query path), it must be **derived
in code at write time, never typed twice by a human**, and a contract assertion must prove the
copies agree.

## 2. Model the recurring thing as recurring

Anything that happens more than once is edition-scoped, not "the current one".

Ask of every new field: *what happens to this in 2030?* If the answer is "someone edits it" —
good. If it is "someone remembers to edit it in several places", or "a developer changes code" —
the model is wrong. **A new show must be a content operation, never a code change.**

Rollover (this edition becomes an archive entry, a new edition becomes current) must be a
documented, repeatable procedure. If no one can state that procedure, it does not work.

## 3. Dependent content must declare what it depends on

Prose that is only true for one venue, one city, one year or one price **must record which
instance it was written for**, so the system can detect staleness instead of silently serving
wrong information.

Travel directions, parking, accommodation, "how far from the airport" — these are not general
copy, they are functions of the venue. When the venue changes, they must be able to flag
themselves as out of date automatically. A confirmation/status field that a human has to
remember to flip is not a mechanism; it is a hope.

**The failure mode to design against is not "content is missing" — it is "content is confidently
wrong".** Missing content is visible. Stale content looks fine.

## 4. Seeds and `lib/data` are not a second source of truth

Seed scripts and local data files reconstruct an **empty** dataset. They must reproduce the
current shape, never a snapshot of one instance's facts frozen at authoring time. A seed that
still holds last edition's venue is a loaded gun pointed at the next rebuild.

Seeds stay `createIfNotExists` — never `createOrReplace`. When live content and seeds disagree,
**live content wins and the seed is the thing that is wrong.**

## 5. Never invent instance-specific detail to fill a gap

When the venue is known but its parking, transport and accommodation are not, the correct output
is an honest "not confirmed yet", not plausible-sounding detail. Invented specifics are
indistinguishable from researched ones once they are on the page, and nobody ever goes back to
check them.

Clearing stale content beats rewriting it from imagination. An empty section is a visible gap;
a fabricated one is a lie with a long half-life.

## 6. Beware the careless global replace

Venue-shaped strings recur across genuinely different records — past shows, society meeting
places, unrelated events in the same city. A find-and-replace on "Cape Town" or "Civic Centre"
corrupts real history.

Any sweep that rewrites content must ship with a **negative control**: an assertion proving the
records that should NOT have changed are still intact.
