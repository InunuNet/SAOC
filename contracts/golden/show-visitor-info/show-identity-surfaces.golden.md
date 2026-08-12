# Show-identity surface inventory

> The mission rule is that changing the venue is a Studio edit. Round 1 proved that for three new
> pages. @qa swapped the venue for real and found the **home page** — the most-seen surface on
> the site — still advertising the old one, alongside the show landing page contradicting itself
> in a single viewport.

A "show-identity fact" is any of: **venue name, venue city, venue province, show dates, edition
number, host region, countdown target**. Every one of them lives in the `nationalShow` singleton.
This document is the complete list of places they reach a visitor, and it is the table
`check-show-identity-sweep.mjs` sweeps.

---

## The inventory

| # | Surface | File | Facts rendered | Round-1 state |
|---|---|---|---|---|
| 1 | `/national-show` hero | `app/(marketing)/national-show/page.tsx:199` | venue name | **stale** — read legacy `location` |
| 2 | `/national-show` CTA | `app/(marketing)/national-show/page.tsx:231` | edition, month/year, venue city | Sanity ✅ |
| 3 | `/national-show` hero meta | same file | dates, host region | Sanity ✅ |
| 4 | `/national-show` exhibitor stages fallback | `page.tsx:132-160` | four fabricated date ranges | **fabricated, unmarked** |
| 5 | `/national-show` cycle table | `page.tsx` `CYCLE_YEARS` | current-row year/edition/host | Sanity ✅ (past/future rows are constitutional record) |
| 6 | `/national-show/plan-your-visit` | `components/show/VenueCard.tsx` | full venue object | Sanity ✅ |
| 7 | `/contact` | same `VenueCard` | full venue object | Sanity ✅ |
| 8 | Home show band | `components/home/ShowBand.tsx:10-12,16,58` | dates, host region, venue name, countdown, edition | **all hardcoded** |
| 9 | Home hero CTA | `components/home/Hero.tsx:100` | edition, year | **hardcoded** |
| 10 | Home nav card | `components/home/NavCards.tsx:27,29` | edition, year, month, city | **hardcoded** |
| 11 | Utility bar pill (**every page**) | `components/chrome/UtilityBar.tsx:47` | edition, month, year | **hardcoded** |
| 12 | Archive index CTA | `app/(marketing)/national-show/archive/page.tsx:153,156,163` | edition, month/year, city | **hardcoded** |
| 13 | Archive year page CTA | `app/(marketing)/national-show/archive/[year]/page.tsx:239,246` | edition, city, year | **hardcoded** |
| 14 | Countdown component | `components/show/ShowCountdown.tsx:7,93` | fallback date, edition in `aria-label` | **fabricated fallback** |

**Out of scope, by ownership not by merit:**

- `app/(marketing)/national-show/exhibitors/**` and `components/show/Exhibitor*` — owned by the
  exhibitor stream, actively being edited. The same defect class is present there and has been
  handed to that stream rather than fixed across a live branch boundary.
- `page.tsx:248` pins `month: 'September'` on every Sanity-sourced *past* show. Historical
  record, low harm, and correcting it needs a month on the past-show schema. Backlog.

---

## Two rules for every surface on this list

### 1. Sanity is the left-hand side of every fallback

```ts
const venueLine = sanityShow?.venue?.name || sanityShow?.location || 'Venue to be confirmed';
```

Never `'literal' || sanityValue` — that masks a published edit behind a hardcoded default.
Asserted by A55.

### 2. A fabricated fallback is worse than no fallback

`ShowCountdown`'s `DEFAULT_COUNTDOWN_DATE = '2027-09-18T09:00:00+02:00'` is an invented date
presented as a **live ticking fact**, with no pending marker, if an editor clears or mistypes
`countdownDate`. Same fail-open shape as the marker bug: correct while the data is good, silently
dishonest the moment it is not.

The rule: **when a show-identity fact is absent, render the absence.** A pending marker, a
"to be confirmed" string, or nothing at all — never a plausible invention. This is the whole
reason the mission has a confirmation-status model.

The one legitimate exception is `'Triennial'` on the landing hero: a standing constitutional fact
about how the show is constituted, not a per-edition value. It stays in code, deliberately.

---

## The legacy `location` field

`nationalShow.location` is a plain display string that predates `nationalShow.venue`. It still
holds the venue name, and `contracts/checks/cms-loop-f3-national-show` mutates it in a live
round-trip check, so it cannot simply be deleted.

Its status is now: **fallback only, never a primary source.** Every surface reads `venue.name`
first. The schema description tells editors to maintain the venue object and treat `location` as
legacy. `check-show-identity-sweep` proves the ordering by swapping `venue` while leaving
`location` at the old value — any surface still preferring `location` renders the stale venue and
fails.

Retiring it properly means migrating the `cms-loop-f3` check to another field and dropping the
field in a follow-up. Filed, not done here: this round is a QA-defect round, and deleting a field
another contract's check depends on is not a QA fix.

---

## `nationalShow.title` must not embed the edition ordinal

*Added 2026-08-12 — team-lead ruling on A61.*

The seeded title was `"The 19th South African National Orchid Show"`. The edition also lives in
its own `edition` field, and every ordinal on the site is derived from it. That made the title a
second, silent copy of a show-identity fact: change the edition in Studio and the H1 keeps saying
"19th" forever, with no code defect anywhere to find. Precisely the failure mode this inventory
exists to eliminate — and `title` is not on the list of show-identity facts above, so no surface
row was ever going to catch it.

The seeded title is now `"The South African National Orchid Show"`. Nothing about the WIRING
changed: the landing page still renders the CMS title verbatim (A56), so the page shows whatever
the dataset holds.

**The general rule this instances:** a CMS text field must not restate a fact another field owns.
If it does, the two will disagree the first time an editor changes one of them, and the site will
render both.

Updated in the same change: `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json`,
`scripts/seed-page-singletons.ts` (the `createOrReplace` seed), and the live dataset.

---

## The historical carve-out on `/national-show`

*Added 2026-08-12 — team-lead ruling on A61.*

The landing page's **Past editions** list renders each past show's own venue, from `show`
documents. One of them (2018, *Cape Town City Hall*) is legitimately in the current venue's city.
A61 puts the old city in the fail set for `/national-show`, so before this ruling the assertion
could never go green by any Studio edit — and no Studio edit *should* clear it, because rewriting
a past show's host city to match a new venue would be falsifying the record. Row 5 of the
inventory already calls these rows constitutional record, and `/national-show/archive` already
carried the same carve-out.

`check-show-identity-sweep.mjs` now cuts that one `<section>` out of the page text before testing
the **city token only**.

**What the carve-out costs, stated plainly:** a stale *current* venue city would go undetected on
this page if — and only if — it rendered inside the Past editions section. Nothing renders there
but per-past-show fields, so the exposure is theoretical rather than practical. Everything else is
unchanged: the old venue *name*, show year, edition ordinal and roman numeral are still swept
across the entire page including that section, and a stale city anywhere else on the page still
fails. Two guards keep it from widening — the check fails if the section cannot be found (the
exemption must be live to be trusted) and fails if the excised block exceeds 40% of the page (a
page-level exemption in disguise).
