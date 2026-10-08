# National Show — Finalized Page Structure

Written by the SAOC lead (architect role). First pass 2026-09-14 used Lee-Ann's Drive tree
and `origin/nos-site`'s route manifest as the reconciliation basis. **Revised same day per
Brad, via the team lead: the "SAOC Dev Status" Google Sheet
(`1CEq5_670M1Q-AA5ZyJ30ycASptsy2Is5sHJhMXNyClo`, tab `Pages`) is the authoritative,
already-agreed build-status source — not something for this doc to override.** Everywhere
below, the Sheet's route/status/mapping is what nos-site should build against. Where the
Sheet conflicts with Lee-Ann's Drive, `origin/nos-site`'s own branch state, or backlog.md,
that conflict is flagged explicitly, cited both ways, and left for Brad — not resolved here.

`Pages!A1:J60` re-pulled fresh 2026-09-14 via `gws sheets +read` (columns: Page, Route,
Local, Build lane, Design lane, Status, Content source (Lee-Ann), Content, Blocked on,
Notes). All quotes below are verbatim from that pull.

## National Show route table (per the Sheet, verbatim structure)

The Sheet organizes National Show under `/national-show` (Show hub) into four groups —
**Visit, Programme, Exhibit & Trade, The Show** — exactly as its own hub-row note states:
*"R1: SAOC chrome above, Show identity below the header. The four groups below become this
page's four sections."* Build this grouping; do not re-derive a different one from Drive.

### Visit

| Page | Route | Status (Sheet) | Content source (Lee-Ann) | Content | Blocked on | Notes |
|---|---|---|---|---|---|---|
| About the Show | `/national-show/about` | live | about-national-show_2026-09-09.md | SOURCED | — | Built + live-verified 2026-09-10 |
| What to Expect | `/national-show/what-to-expect` | live | what-to-expect_2026-09-09.md | SOURCED | — | Reconciled to her doc 2026-09-10 |
| Plan Your Visit | `/national-show/plan-your-visit` | live | — (Sanity-driven) | DATA | Lee-Ann | Venue / parking / access detail outstanding |
| FAQ | `/national-show/faq` | live | 17.1 FAQ.docx | BLOCKED | Lee-Ann | Her .docx is TRUNCATED in Drive — needs re-upload. Also contains "xx September 22027" placeholders |

### Programme

| Page | Route | Status (Sheet) | Content source (Lee-Ann) | Content | Blocked on | Notes |
|---|---|---|---|---|---|---|
| Programme of Events | `/national-show/programme` | **404 - planned** | — (folder EMPTY) | PLACEHOLDER | Lee-Ann | R11 disclosure rail |
| Workshops | `/national-show/workshops` | live | — (folder EMPTY) | PROVISIONAL | Lee-Ann | — |
| SAOC Symposium | `/national-show/symposium` | **404 - planned** | symposium theme (one sentence) | PLACEHOLDER | Lee-Ann | Spec 4.7: Symposium and WOSA must be SEPARATE |
| WOSA Conference | `/national-show/wosa-conference` | **404 - planned** | — (folder EMPTY) | PLACEHOLDER | Lee-Ann | Route is `/national-show/wosa-conference` (R3, 2026-09-10 mission ruling; **confirmed again by Brad 2026-09-14**) — bare `/wosa` stays free since WOSA runs multiple conferences/events, not one. WOSA is a separate org — link out, no conservation content. |
| Registration | `/national-show/conferences` | live | — | OURS | — | Already a registration page. **TODO (lead — this lane):** remove the "SAOC/WOSA Joint track" claim per spec 4.7, add links up to Symposium + WOSA. No redirect needed. |

### Exhibit & Trade

| Page | Route | Status (Sheet) | Content source (Lee-Ann) | Content | Blocked on | Notes |
|---|---|---|---|---|---|---|
| SA Exhibitors | `/national-show/sa-exhibitors` | **planned** | 1.1 Exhibitors - South African Exhibitors v1.0 | SOURCED | — | Public DIRECTORY of nurseries: logo, country, owner, history, specialisation, plants, website, socials |
| International Guests | `/national-show/international-guests` | **404 - planned** | — (folder EMPTY) | PLACEHOLDER | Lee-Ann | SLUG DECIDED (was `/exhibitors/international`) |
| Exhibitor Entry | `/national-show/exhibitors` | live | Sanity: entryProcess/fees/classes/judging/eligibility/display/sales/practicalities/permits | SOURCED | — | GROWER ENTRY GUIDE — how to enter your plants. **NOT the directory above. Do not repoint or rename.** |
| Vendors | `/national-show/vendors` | live | 13.2 Vendor Form.docx | SOURCED | — | Vendor showcase |
| Apply (short form) | `/national-show/vendors/apply` | live | 13.2 | FUNCTIONAL | — | — |
| Register (token-gated) | `/national-show/vendors/register` | live | 13.2 | FUNCTIONAL | — | ~60 fields. Design lane blocked here — needs a dev registration code |
| Stand payment | `/national-show/vendors/payment` | live | — | FUNCTIONAL | — | Payment + proof-of-payment upload |

### The Show

| Page | Route | Status (Sheet) | Content source (Lee-Ann) | Content | Blocked on | Notes |
|---|---|---|---|---|---|---|
| Tickets | `/national-show/tickets` | live | — | ROUTER | — | Audience router: visitor / exhibitor / vendor. A timing switch — the three audiences enter in different months. |
| Buy tickets | `/national-show/tickets/buy` | **MOVE** | 13.1 Ticketing details.docx | FUNCTIONAL | — | Move from `/tickets`. Ticketing belongs to the NOS — no top-level URL. Clean rename: pre-alpha, no bookmarks, no redirect needed. |
| Checkout step | `/national-show/tickets/buy/[slug]` | **MOVE** | 13.1 | FUNCTIONAL | — | Move from `/tickets/[slug]` |
| Confirmation | `/national-show/tickets/confirmation` | **MOVE** | — | FUNCTIONAL | — | Move from `/tickets/confirmation`. Also update the PayFast `return_url` at `app/api/tickets/checkout/route.ts:807` — sandbox only, no live payments. |
| Cancelled | `/national-show/tickets/cancelled` | **MOVE** | — | FUNCTIONAL | — | Move from `/tickets/cancelled`. Also update `cancel_url` at `app/api/tickets/checkout/route.ts:808`. |
| Show Sponsors | `/national-show/sponsors` | **planned** | — (NOS/15 Sponsors folder EMPTY) | PLACEHOLDER | Lee-Ann | The Show's OWN sponsors — a different list from SAOC's (Brad 2026-09-10). Needs its own data scope, not a filter over the SAOC list. |
| Past Editions | `/national-show/archive` | live | Firestore | DATA | — | — |
| Edition detail | `/national-show/archive/[year]` | live | Firestore | DATA | — | — |

### Contact — no separate National Show page

The Sheet has **no `/national-show/contact` row at all.** National Show contact is folded
into the single site-level row:

| Page | Route | Status | Content | Blocked on | Notes |
|---|---|---|---|---|---|
| Contact | `/contact` | live | FUNCTIONAL | Lee-Ann | Firestore + Resend. Which mailbox receives it is unconfirmed. **"NOS enquiries get a subject preset here — no second form."** |

## FLAGGED CONFLICT 1 — Contact: Sheet vs. Brad's live dispute this session

**This is the one the team lead's brief said Brad is actively disputing, and the Sheet —
which Brad says is authoritative — currently answers it the other way.**

- **Sheet (authoritative per Brad, this update):** no `/national-show/contact` route.
  General `/contact` handles it, with a subject preset distinguishing NOS enquiries. No
  second form.
- **`origin/nos-site`'s `content/show-pages/_retired.json`** independently records the same
  answer, dated and attributed: `"ruling": "Brad, 2026-09-10 — no NOS-level contact page. A
  second inbox is an unwatched inbox; site-level /contact is owned by the saoc-eb lane."`
  The M4 contract hard-fails (`RS4`) if `/national-show/contact` is ever created.
- **Brad's message to the team lead this session** disputes that the M4 golden's exclusion
  of a standalone Contact page was ever properly approved, and directs weighting Drive
  fidelity more heavily for this case.

Two independent, dated records (the Sheet and the retirement ruling) agree with each other
and disagree with Brad's statement in this session. That is not something to resolve by
inference in either direction — it needs to go back to him as: *"Both the Dev Status Sheet
and a dated 2026-09-10 ruling in the nos-site branch currently say no separate NOS contact
page, with NOS enquiries routed through `/contact` via a subject preset. Do you want that
kept, or do you want it overturned and `/national-show/contact` built?"* If he confirms the
Sheet, no code change is needed on this point — the "subject preset" mechanism referenced by
the Sheet should be checked for whether it already exists (`app/(marketing)/contact` /
`/api/contact`) or is itself unbuilt. If he overturns it, the source content (`2027 Show
Contact information.docx`) is still Lee-Ann's unfinished draft — real addresses still have to
come from her, not be invented to fill the page.

## FLAGGED CONFLICT 2 — six routes: Sheet says not-yet-live, nos-site's branch says built

nos-site reported (this session) 6 new + 11 pre-existing = 17 routes built/reconciled,
naming programme, symposium, wosa-conference, sa-exhibitors, international-guests, sponsors
as the 6 new ones. `origin/nos-site`'s own `content/national-show-routes.json` manifest
marks all six `status: "created"`.

**The Sheet marks five of those six `404 - planned` and the sixth (`sa-exhibitors`)
`planned`** — i.e. not live, by the authoritative source. Route-by-route:

| Route | nos-site branch manifest | Sheet |
|---|---|---|
| `/national-show/programme` | created | **404 - planned** |
| `/national-show/symposium` | created | **404 - planned** |
| `/national-show/wosa-conference` | created | **404 - planned** |
| `/national-show/sa-exhibitors` | created | **planned** |
| `/national-show/international-guests` | created | **404 - planned** |
| `/national-show/sponsors` | created | **planned** |

The likely explanation — **not confirmed, do not assume it as fact** — is that "created" on
the `nos-site` branch manifest describes branch state, while the Sheet tracks what's actually
deployed/merged, and PR #4 (nos-site's current PR) has not landed on `main` yet. If that's
right, this isn't really a factual conflict, just two different questions ("is it built on
the branch" vs. "is it live"). But it could also mean the Sheet is stale, or that "created" in
the manifest overstates real completeness (content status on most of these is `PLACEHOLDER`
per the Sheet, consistent with "built but not truly finished"). **Flagging, not concluding**:
whoever merges nos-site's PR should reconcile the Sheet's status column against actual
deployed reality once merged, rather than either source being trusted blind.

## FLAGGED CONFLICT 3 — ticket routes: Sheet plans a `/tickets/buy/*` move nos-site hasn't made

The Sheet specifies a **not-yet-executed MOVE**: `/national-show/tickets` becomes an
**audience router** (visitor/exhibitor/vendor), with actual purchase moving to
`/national-show/tickets/buy` (+ `/buy/[slug]`, `/confirmation`, `/cancelled`), all moved off
the current top-level `/tickets/*`.

`origin/nos-site`'s live route manifest still shows `/national-show/tickets` as `status:
untouched` with **no** `/buy` subpath at all — i.e. the pre-move structure. This isn't a
disagreement about the target structure (the Sheet is unambiguous and should be built
exactly as specified, including the two `return_url`/`cancel_url` PayFast callback updates
at `app/api/tickets/checkout/route.ts:807-808`) — it's simply **not done yet**. Flag it as an
outstanding build item for whichever lane owns `/national-show/tickets/*` (Sheet marks these
rows "SAOC lead" build lane, not "NOS Site" — **this is this lane's work, not nos-site's**),
not something nos-site needs to reconcile.

## FLAGGED CONFLICT 4 — Registration/Booking/Tickets folder-13 mapping

My earlier Drive-based pass mapped folder 13 to `/national-show/tickets` as "the general
ticket-purchase page." The Sheet is more precise and should be treated as the actual mapping:
folder 13's content splits across **`/national-show/conferences`** (labelled "Registration"
in the Sheet — Symposium/WOSA registration, content marked `OURS`, not sourced from her
folder) and the **`/national-show/tickets` router + `/tickets/buy/*`** flow (13.1 Ticketing
details.docx is the named source for `/buy`). No conflict between sources here once the
Sheet's finer split is used — this supersedes my earlier, coarser mapping. The backlog.md
note that `content/show-pages/13-booking-tickets.json` (sourced council copy) doesn't
actually render on `/national-show/tickets` still stands as a real residual and should be
checked once the router/`/buy` split above is built, not assumed resolved by the move.

## Items not in conflict — carried forward from Drive/backlog research

- **FAQ** (`/national-show/faq`): Sheet and Drive audit agree — `17.1 FAQ.docx` is
  confirmed byte-corrupted in Drive itself (valid local-file headers, no
  End-of-Central-Directory record, verified against Drive's own `md5Checksum`) — unrecoverable
  on our side, needs Lee-Ann to re-export. Sheet adds a second, independent content defect:
  the doc also contains literal "xx September 22027" placeholder text that must not ship
  even once the file is recovered.
- **Exhibitor Entry vs. SA Exhibitors**: Sheet is explicit these are two different pages —
  `/national-show/exhibitors` (grower entry guide, "do not repoint or rename") and
  `/national-show/sa-exhibitors` (public nursery directory). Do not merge or confuse them.
- **Sponsors**: Sheet confirms the Show has its **own** sponsor list, separate from SAOC's
  site-level `/sponsors` (Brad, 2026-09-10) — needs its own data scope, not a filter over the
  SAOC list.
- **International Exhibitors** (folder 5 → `/national-show/international-guests`): the
  2026-09-09 coverage-map audit recorded this as both-sides-empty (no Drive doc, no route).
  The Sheet now shows it as a real row with a decided slug, content `PLACEHOLDER`, blocked on
  Lee-Ann — consistent with "slug decided, content still owed by her," not actually a
  conflict, just more resolved than the older audit knew.

## Open items still needing Brad (do not invent answers)

1. **Contact** — see Flagged Conflict 1. Needs an explicit answer given the Sheet and the
   nos-site branch both disagree with what he told the team lead this session.
2. **Six-routes live-vs-planned status** — see Flagged Conflict 2. Needs whoever owns the
   Sheet (or Brad) to say whether "planned"/"404" will auto-resolve on merge or reflects a
   real gap the branch manifest is overstating.
3. **gws_inbox_check triad gap**: `needs-human.md` on `origin/nos-site` records an unresolved
   escalation from 2026-09-10 — deleting/never-building a NOS-owned contact page leaves no
   NOS route that sends mail for the mandatory verification triad's `gws_inbox_check` to test.
   Still open regardless of how Flagged Conflict 1 resolves, unless the `/contact` subject-preset
   mechanism the Sheet describes ends up being the thing that satisfies it.
4. **Programme/Workshops copy source**: whether the ticketing dev-spec's workshop/field-trip
   line items are authorised as page copy, or whether these need dedicated content from
   Lee-Ann (site-content-alignment openQuestion q7). Not decided here.
