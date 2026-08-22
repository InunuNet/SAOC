---
schema: athanor.mission/v1
slug: leeann-content-corrections
goal: 'Confirmed-fact content correction sweep: purge the invented 18-21 Sept show-date
  placeholder in favour of the council-confirmed 16-19 September 2027 dates, designate
  an interim POPIA Information Officer, and draft real (estimated, flagged) content
  for the refund policy and the remaining unpriced ticket/vendor/conference categories'
created_at: '2026-08-21T09:29:24.274852+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  status: superseded
  title: Purge the invented 18-21 September placeholder; re-seed with the confirmed 16-19 September 2027 dates
  superseded_by: 'Mission show-dates-purge-16-19-sept-2027 (created 2026-08-22) covers this in
    full and more thoroughly — its @architect pass found two additional live Sanity documents
    (show-19-2027, societyEvent-15-...) this brief did not enumerate. Do not dispatch @dev against
    this F1; when show-dates-purge-16-19-sept-2027 completes, mark this F1 done-by-reference
    rather than re-doing the work.'
  inline_brief: 'The 2027 National Show dates are CONFIRMED: Thursday 16 - Sunday 19 September 2027
    (stated as flat fact by a prior session in the pricing artifact,
    https://claude.ai/code/artifact/1b5729ed-46f5-497b-8070-63a025330e5a, "Show dates" note box -
    verify this yourself with WebFetch before trusting it, do not just trust this brief). The OLD
    invented placeholder (18-21 September / 2027-09-18T09:00:00+02:00, which falls Sat-Tue and was
    never council-confirmed) is still what is actually seeded into Sanity and still drives the live
    home-page countdown. @architect: re-grep the whole repo for "18.21 September", "2027-09-18",
    and "18–21" before scoping - the known-sites list in memory (project_show_dates_placeholder)
    is a POINTER, not current truth, and will itself be stale by now. As of the last audit it
    touched scripts/seed-page-singletons.ts, scripts/seed-show-visitor-info.ts, lib/data/events.ts,
    docs/show-visitor-info.md, docs/b4-national-show.md, docs/m3-home.md,
    docs/dataset-residue-guard.md, docs/show-visitor-info-for-editors.md (which presents it to
    Lee-Ann herself as "Confirmed venue: ... 18-21 September" - now doubly wrong), and
    docs/f4-seed-page-singletons.md. Non-negotiable invariants: purge in ONE pass, not piecemeal -
    a partial fix leaves the countdown or an editor-facing doc contradicting the live site (this
    project has been burned by exactly this twice before, see project_national_show_venue and this
    same show-dates placeholder). Re-seed Sanity with the confirmed dates, not just fix code
    constants - the dataset is pre-production so this is safe (project_sanity_dataset_not_live) but
    must be done with the careful/documented re-seed method, not an ad-hoc write. F5
    (ticketing-f5-day-attendees, already shipped) already reads show.startDate/endDate from Sanity
    rather than hardcoding dates anywhere in the ticketing flow, so this should mostly be a
    Sanity-data + doc/countdown-constant fix, not a ticketing code-logic change - confirm this
    assumption rather than trusting it. Assert the purge is complete and total (no surviving
    18-21 Sept / 2027-09-18 literal anywhere in the checked-in tree) and that the live countdown
    and every editor-facing doc agree with the site.'
- id: F2
  status: pending
  title: Designate an interim POPIA Information Officer on /privacy
  inline_brief: 'Brad''s decision, 2026-08-21: name Lee-Ann McCleland (Fynbos Pottery Studio) as
    SAOC''s Information Officer on the /privacy page for now - she can correct it later if the
    council wants someone else. Currently app/(marketing)/privacy/page.tsx names
    secretary@saoc.co.za by project convention (not a real designation). IMPORTANT: no confirmed
    email address for Lee-Ann McCleland exists anywhere in project memory or the codebase - only
    her name is confirmed (from a WhatsApp/messaging screenshot). Do NOT invent an email address
    for her. Either use her name with no direct email link (routing contact through the existing
    secretary@saoc.co.za or a generic contact channel), or flag this explicitly to Brad as a
    blocking question before publishing a wrong/guessed address - inventing a contact detail is
    exactly the defect class this project has been burned by before (CTICC venue, show dates -
    see provisional-figures.md "Why this file exists at all"). This is a low-risk, single-page
    text change but still goes through the mission chain per project rules - no direct edits.
    Note clearly on the page or in a code comment that this is an interim/placeholder designation,
    not a formally confirmed one - POPIA still requires formal registration with the Information
    Regulator separately, which this does not satisfy and should not be presented as satisfying.'
- id: F3
  status: pending
  title: Draft real refund and cancellation policy content for /refunds
  inline_brief: 'Brad''s direction, 2026-08-21: draft real (estimated) refund/cancellation policy
    content for the council to review and adjust, rather than leaving /refunds structurally empty
    while waiting on Lee-Ann''s answer to the pricing artifact''s refund question (her form
    answers are still unsaved as of 2026-08-21 - verify this is still true before assuming it,
    per reference_leeann_pricing_artifact). app/(marketing)/refunds/page.tsx exists (109 lines)
    but is deliberately figure-free today - no cancellation windows, refund conditions, or
    cooling-off period. Draft reasonable, clearly-estimated terms (e.g. a tiered refund window
    relative to the show date, what happens to a weather-cancelled field trip, the cocktail
    event''s 18+ restriction and its refund implications) and mark them unmistakably as pending
    council confirmation - same containment discipline as provisional-figures.md (a machine-
    readable or at minimum visually unmistakable "provisional" marker, not just prose that could
    be mistaken for settled policy). When real/adjusted figures land later this must be trivial to
    replace - do not scatter the estimated figures across multiple call sites. Check POLICY-10 (a
    contract assertion banning digit+unit patterns on this page, written when the page was
    deliberately figure-free) - it will need to be revisited/narrowed once real figures are added,
    not just deleted; find it and read its current intent before touching it. Also verify the
    three-live-pages requirement from the payment-gateway trial application (POPIA/terms/refunds
    are what a merchant application checks for, per project_popia_deferred and
    project_gateway_deadline_august_2026) - this feature is on that critical path.'
- id: F4
  status: pending
  title: Estimate remaining unpriced ticket/vendor/conference categories
  inline_brief: 'F4 of the multi-line-item-cart mission already shipped lib/provisional-figures.ts
    with estimated, provisional-flagged prices/capacities for the five ticketing ADMISSION products
    (Early-Bird, Day Visitor, Early-Bird Weekend Pass, Weekend Pass, VIP) - read
    docs/f4-admission-products.md and contracts/golden/ticketing-f4-admission-products/README.md
    for that established pattern and discipline before designing this feature; do not invent a new
    one. Per Brad''s 2026-08-21 direction (do not wait on the council, estimate and flag), extend
    the same discipline to the categories the pricing artifact still shows as unanswered: vendor
    fees (Exhibit Vendors, Food Vendors - artifact section B), conference tickets (SAOC Symposium
    Early-Bird/Normal, WOSA Conference Early-Bird/Normal, SAOC/WOSA Joint Early-Bird/Normal -
    artifact section C), and workshop/field-trip/cocktail pricing and capacity (Sunset Cocktails
    single/couple, Workshops per-session, Field Trip single/all-outings - artifact section D,
    which the artifact itself notes cannot be fully priced yet because individual workshops/field
    trips are not yet defined by Lee-Ann - scope this feature to what CAN be reasonably estimated
    now, and explicitly flag what genuinely cannot). Do not invent figures with no basis - where
    her draft document (Drive 1fegrT9UKObJ71tUjUme_kFtqieSOsYca) gives no anchor at all for a
    category, that specific line should stay explicitly marked "not yet estimable" rather than a
    guessed number, matching this project''s standing rule against inventing figures with zero
    source. Confirm with WebFetch whether the pricing artifact''s state has changed (she may have
    saved answers since 2026-08-21) before assuming every field is still blank.'
milestones:
- id: M1
  title: Show-date purge and Information Officer designation (fast, low-risk content fixes)
  features:
  - F1
  - F2
  status: pending
- id: M2
  title: Estimated policy and pricing content
  features:
  - F3
  - F4
  status: pending
---

# Mission: Confirmed-fact content correction sweep

## Context

Drafted 2026-08-21 after the user caught the orchestrator repeating stale backlog claims that
contradicted work already done in prior sessions (show dates confirmed but never propagated; the
refunds/privacy pages already shipped but described as missing). This mission is the concrete
follow-through: fix the live-content gaps that correction surfaced, plus the two content items
Brad decided to unblock rather than wait on the council for (estimated pricing, drafted refund
policy - same "estimate now, correct later" discipline already proven in F4 of the
multi-line-item-cart mission via lib/provisional-figures.ts).

The multi-line-item-cart mission (F6: booking contact block + 5-ticket cap + POPIA privacy-page
accuracy) is PAUSED, not abandoned, and still has real overlap with this mission's F2 (POPIA
accuracy) - when resuming multi-line-item-cart, check whether F6's POPIA work and this mission's
F2 have already covered each other before dispatching @architect on F6, to avoid duplicate or
conflicting privacy-page edits.

Read `.agent/memory/project/backlog.md`'s "Blocked on the council / Lee-Ann" section (top three
items, corrected 2026-08-21) for the full current-state detail behind F1/F3/F4 below - it was
just rewritten to be accurate and is the actual source of truth for scope, not this brief alone.

## Notes

- F1 and F2 are independent of each other and could run in parallel if the orchestrator chooses,
  but each still needs its own architect/dev/qa/Codex/docs pass per the mandatory chain.
- F3 and F4 both touch the "estimate now, flag provisional" pattern - consider whether they share
  enough of a data model to combine into one architect pass, or whether keeping them separate
  (refund policy is page content, F4 is structured ticket-type data) is cleaner. Orchestrator's
  call at dispatch time, not decided here.
- Do not derive, invent, or guess any figure/date/contact detail not explicitly given in this
  brief or backlog.md. Where information is missing (e.g. Lee-Ann's email), flag it rather than
  filling the gap.

