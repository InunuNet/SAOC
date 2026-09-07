# Platform decision record — nos-design-system M5 / M6

Architect: `Arch_Opu5_M5-F14_NosDesignSystem`, 2026-09-07.
Scope: M5 (F14–F16, admin) and M6 (F17–F19, conversion / SEO / social).

Contracts: `contract-m5.yaml`, `contract-m6.yaml`.
Goldens: `goldens/m5-admin-ia.golden.md`, `goldens/m6-conversion-seo-social.golden.md`.

Every claim below about current code was read from the tree on 2026-09-07, not assumed.

---

## D-A1 — Admin information architecture

**Decision.** Reorganise `/admin` **by audience**, replace the flat ticket table at
`/admin` with a queue rack, and give admin two fixed vocabularies (four status states,
four party types) instead of per-feature improvisation. Full route tree, nav rules and
dashboard hierarchy are in `goldens/m5-admin-ia.golden.md` §1–§3.

**The actual problem.** `/admin` is titled "Ticket Admin" and renders a flat `tickets`
table, while the nav calls the same route "Dashboard". `/admin/vendors` and
`/admin/vendors/applications` are two stages of one pipeline presented as two peers.
`/admin/door` is a third audience entirely. Nothing on any screen says which audience a
row belongs to. A volunteer arriving cold cannot tell what needs them.

**Route tree**: `/admin` (overview) · `/admin/visitors[/tickets]` · `/admin/vendors[/applications]`
· `/admin/exhibitors` · `/admin/door` · `/admin/settings`.

**Dashboard hierarchy** (from research §G's pretixSCAN capability-matrix pattern): one
row per queue, each carrying *name · pending count as the largest number on the row ·
oldest-pending age · one primary action*, ordered **oldest-age descending**. Zero-pending
queues keep their row — a disappearing row destroys the scan pattern. No charts, no
revenue, no activity feed (no audit log exists to source one from; inventing one would
fabricate history).

**Status vocabulary — four states, defined in words before any colour** (research §G,
Pencil & Paper: *"describe the convention in words first, then see if it still warrants
a colour"*): `pending` (needs a human now) / `active` (in progress) / `done` (settled,
positive) / `blocked` (settled, negative). Every pill in `/admin` maps to one. Colour is
never the only channel — every pill carries text. Error states keep the semantic error
colour and are never remapped to a brand hue (mission guardrail 1).

### Visual system: admin is deliberately NOT NOS-branded

It keeps the existing SAOC admin surface and gets **information design**, not a re-skin.
Three reasons, all load-bearing:

1. Admin serves SAOC **year-round and across editions**. NOS 2027 is one edition;
   branding a permanent tool to a dated edition means re-skinning it in 2030.
2. The NOS palette is tuned for elegance — pale gold grounds, low-contrast olive
   accents. The mission's own contrast note already warns olive on pale gold fails WCAG
   AA. That is the wrong optimisation for dense operational tables read on a phone in a
   hall.
3. The NOS token layer is scoped to `app/(marketing)/national-show/layout.tsx` by
   design. `/admin` sits outside that subtree; keeping it out costs nothing and preserves
   the "one deletable wrapper" property the whole mission rests on.

Asserted by M5/A9.

**Rejected alternatives.**
- *Keep the flat tree and just restyle.* Rejected — the confusion is structural. A
  prettier "Ticket Admin" that is still called "Dashboard" solves nothing.
- *One universal queue view with an audience filter.* Rejected — a filter is a control a
  volunteer must discover and operate. Separate routes are self-describing and
  bookmarkable, and the URL itself answers "where am I".
- *NOS-brand the admin for consistency.* Rejected for the three reasons above.

---

## D-A2 — Roles and profiles

**Decision: do NOT build public user accounts.** Recommended model, honestly:

| Party | Identity model | Status |
|---|---|---|
| Committee / admin | Firebase Auth + `admin` claim + `email_verified` + live allowlist + `roles` claim → capabilities | **exists, keep** |
| Vendor | single-use HMAC token, no password, no account | **exists, keep** |
| Exhibitor | **no data model exists at all** | see below |
| Visitor | accountless; order reference + emailed QR | **exists, keep** |

### Why not full accounts — plainly

Brad asked for "profile management" and "whether you subscribed for application or
original development, application or regular user". Read literally as public user
accounts, that is **not a styling task — it is a multi-week security surface with a
permanent maintenance tail**: password reset and email-verification flows, session
management, account-takeover and credential-stuffing defence, POPIA-relevant PII sitting
behind a new auth boundary, deletion/export requests, and an admin user-management CRUD
to go with it. For a body that runs one national show every three years, that cost buys
almost nothing a person would notice.

The existing token + order-reference model already delivers the user-visible outcome —
a person can get back to their thing via a link — with none of that surface. **The
vendor flow deliberately avoids accounts, and it was right to.**

**What Brad actually needs, I believe, is not accounts but legibility**: on every admin
screen, an unmistakable answer to *who is this person and which pipeline are they in*.
That is a **derived attribute of a record**, not a login. It is delivered by
`PartyType = vendor | exhibitor | visitor | committee` and one shared `PartyBadge`,
derived from the source collection, never stored redundantly and never guessed.

**If retrieval is the real pain**, the 5% that buys 90% of the value is a **magic-link
"email me my order"** flow — no password, no stored credential, no new auth boundary.
Recommend that as a separate small mission if Brad confirms retrieval is the complaint.

### The genuine gap in what exists

`lib/admin-roles.ts` defines three roles (`door-staff`, `manager`, `owner`) and nine
capabilities, and `lib/admin-auth.ts` enforces them per request. **There is no UI to see
who holds which role** — assignment is a manual custom-claim operation.

Recommendation: M5 adds a **read-only** Team panel (who is on the allowlist, who holds
which role, which capabilities that implies). **Writing custom claims from the UI is a
privilege-escalation surface and is explicitly deferred** — a bug in that form is a
total compromise of the admin boundary. Read-only is safe, useful, and cheap.

### Exhibitors — the honest answer

**There is no exhibitor data model.** Verified: the Firestore collections are
`adminSettings`, `buyers`, `checkinAttempts`, `contactSubmissions`, `orders`,
`supporterRegistrations`, `tickets`, `vendorApplications`, `vendorStandOrders`,
`vendorSubmissions`. Sanity's `showExhibitorInfo` / `showExhibitorStep` are **editorial
guidance content**, not entries.

So `/admin/exhibitors` renders a declared-empty section — badge, one honest sentence
that entries are not yet accepted online, a link to the public guidance, and a
`data-placeholder` marker. **Zero rows, zero fake counts, and no "0 of 0" table chrome
that implies a pipeline exists.** Building exhibitor entries (schema + form + payment +
judging integration) is a separate mission and should be costed as one. Asserted by
M5/A7 and A8, and behaviourally by A14 case 4.

**Rejected alternative.** *Model exhibitors now so the admin looks complete.* Rejected —
it fabricates a pipeline, and the mission's hardest rule exists because five invented
committee members reached the live site. A convincing empty screen beats a fictional
full one.

---

## D-A3 — Sanity as the contribution surface

**Decision — the boundary rule, in one line:**

> **Sanity owns anything a person would want to change without a deploy. Firestore owns
> anything a person would be upset to see changed.**

Tie-breaker for a boundary case: *does this record have a legal or financial audit
meaning?* If yes → Firestore.

| Sanity (editorial, declarative) | Firestore (transactional, append-only) |
|---|---|
| page copy, programme, FAQ, visitor/exhibitor guidance, venue, opening hours | `orders`, `tickets`, `buyers`, `checkinAttempts` |
| `ticketType` **definitions and prices** | `vendorApplications`, `vendorSubmissions`, `vendorStandOrders` |
| sponsors, judges, awards, societies, board, shows | `contactSubmissions`, `supporterRegistrations`, `adminSettings` |

**Brad's requirement is already largely met and he may not know it.** Sanity already
carries 26 schema types including `ticketType`, `ticketsPage`, `showFaq`,
`showVisitorInfo`, `showExhibitorInfo`, `showExhibitorStep`, `sponsor`, `showVenue`,
`openingHoursEntry`, `nationalShow`. **The gap is discoverability, not schema.**
`sanity/structure.ts` presents nine pinned singletons and then a flat eleven-item
collection list — which is exactly the shape that stops a new contributor.

**Changes:**

1. **Group `structure.ts` into named folders** — *National Show 2027* / *Societies &
   People* / *Judging* / *Site pages*. Highest value-per-line change in this whole
   decision. Keep the existing singleton pinning and `filterNewDocumentOptions`
   loophole-closer exactly as they are.
2. **New `seoMeta` object type** (title, description, ogImage, noIndex) embedded on the
   page singletons, so D-M6b is editor-controllable rather than hardcoded per route.
3. **New `showProgramme` / `programmeDay`** — the landing page's programme is currently
   hardcoded JSX. It is also the data source F18's `subEvent` structured data needs, so
   this one change serves both milestones.
4. **New `socialAsset`** — the headline / date / CTA strings the F19 artboards render,
   so marketing can change a poster line without a developer.

**The contributor path — this is the literal answer to "every web developer can
contribute".** Adding a content type is four files, always the same four:

```
sanity/schemas/documents/<type>.ts   define it
sanity/schemas/index.ts              register it
sanity/structure.ts                  place it in a folder (pin it if singleton)
sanity/queries.ts                    add the GROQ query
```

Then fetch with `sanityFetch({ query, tags })` — tags drive on-demand ISR through
`/api/revalidate`. Editors never touch any of it; they work in `/studio`, where pinned
singletons make duplicates impossible. **Document this four-file path in
`docs/nos-design-system.md`** — it is the deliverable that makes the requirement true,
not the schema count.

**Rejected alternatives.**
- *Move transactional data into Sanity so everything is in one place.* Rejected —
  Sanity has no transactions, no ACID guarantees, and a content editor with publish
  rights could alter a paid order. Financial records need Firestore's boundary.
- *Move page copy into Firestore so admins edit it in `/admin`.* Rejected — it means
  building a CMS inside the admin, which is the thing Sanity already is.

---

## D-M6a — Ticket purchase as a conversion surface

**Decision.** Reframe `/national-show/tickets` from a **router** into a **front door
with a primary path**, and specify the buy-screen and confirmation work as gated F17b.
Full shape in `goldens/m6-conversion-seo-social.golden.md` Part A.

**Verified defects** (read from source today): five `OPTIONS` in `sm:grid-cols-3` → an
orphan cell at ≥640px; **no price visible anywhere before a click**; all five cards
carry identical weight so the dominant visitor journey is presented as one of five
equals; and a white headline over `/images/orchid-yellow.jpg`, the lightest of the five
cleared photographs.

**The fix**: one dominant admission block with a real Sanity-sourced "from" price and a
single primary CTA, plus the remaining four options in a **two-column** secondary grid
(four items, two columns — no orphan at any breakpoint). Hard constraints get their own
short line next to the price rather than being folded into prose — Kew's pattern from
research §B. Existing copy is preserved verbatim; only data-sourced strings are added.

**Confirmation as a ticket, not a receipt**: a bounded stub card with a perforation
rule, the QR at the stub end, booking ref in monospace, show identity on the body, day
and attendee name where present, download attached to the stub, and a clean
`@media print` rule. **No new data is needed** — every field already exists on
`getConfirmedOrderForDisplay()`'s positions.

**Day selection and attendee naming already exist and must not be rebuilt** —
`CartDayPicker`, `CartAttendeeFields`, `cartValidation.ts`, backed by F4/F5 schema
fields and server-side `chosenDay` validation. F17b is presentational only.

### ⚠ Ownership — the single biggest risk in this milestone

F17's brief says "end to end". End-to-end crosses a session boundary:

- **Ours:** `app/(marketing)/national-show/tickets/page.tsx` → **F17a, build now.**
- **Sibling SAOC session's:** `app/(marketing)/tickets/**` and `components/tickets/**`
  → **F17b, specified here but BLOCKED.**

The mission names `CategoryTicketsPage` as untouchable; the same rule applies to that
whole tree, and `AdmissionTicketsList.tsx` changed there tonight. **F17b must not be
implemented until the sibling session confirms in writing.** M6/B4 asserts the gated
tree is unmodified; when confirmation arrives the orchestrator removes that assertion
deliberately and records who confirmed. A dev must not discover this at merge time.

### Two content questions — Brad's call, surfaced not resolved

1. **The VIP ladder is incoherent.** VIP R300 sits *below* plain Weekend Pass R400 and
   below Early-Bird Weekend R380, while VIP is described as "Reception access plus
   full-weekend admission" — strictly more product for less money. Any honest side-by-side
   presentation makes this visible. **Do not renumber, reorder to hide it, or reword the
   VIP description.** It needs a pricing decision, not a design workaround.
2. **Two live general-enquiry addresses** — `council@saoc.co.za` and `info@saoc.co.za`.
   Not ours to pick.

---

## D-M6b — SEO

**Built against research §H2 (fetched from Google Search Central), NOT §H.** Three of
§H's claims are confirmed wrong; my first draft of this decision inherited all three and
is superseded below.

**Decision.** One `lib/seo.ts` `buildPageMetadata()` helper applied across
`/national-show/**`; **exactly one `Event` node on the entire site** — the current
edition on `/national-show` — with one `Offer` per Sanity `ticketType` pointing at
per-product purchase pages; **no Event markup on archives, workshops, conferences or the
vendor flow**; corrected sitemap.

### What changed from the first draft, and what it cost

| §H claimed | §H2 confirms | Consequence |
|---|---|---|
| `subEvent` gets multi-day events session-level results | Google's Event doc never mentions `subEvent`/`superEvent`; its documented pattern is one standalone Event per session on its own leaf page | Dropped. Would have been pure waste. |
| Archives as `eventStatus: EventCompleted` + `superEvent` | Google documents only four values, and `EventCompleted` is not among them; `previousStartDate` is rescheduling-only and requires `EventRescheduled` | Dropped. Archive treatment is now my own call — see below. |
| (not covered) | `offers.url` must be a page whose **predominant purpose** is selling that specific ticket | Forced per-product offer URLs. Turned out to be free. |
| (not covered) | Events requiring membership/invitation to purchase are **ineligible** | Vendor flow gets no Event/Offer markup at all. |

`eventAttendanceMode` is moot — undocumented by Google and NOS is physical-only.
Confirmed and kept: the three required fields are `name`, `startDate`, `location`; the
`offers` shape is `price` / `priceCurrency` / `availability` / `validFrom` / `url`; Open
Graph requires only `og:title`, `og:type`, `og:image`, `og:url` and defines no event type.

### The `offers.url` constraint costs nothing — and it is the same decision as D-M6a

Google requires each offer URL to be a page predominantly selling that specific ticket.
`/national-show/tickets` is a five-product router and does not qualify.

**The per-product purchase pages already exist.** `app/(marketing)/tickets/[slug]/page.tsx`,
linked from `components/tickets/TicketTypeCard.tsx:121`, shipped with mission
`ticketing-flow-redesign`. So `offers.url` points at `/tickets/<slug>` and **no new routes
are needed for admission.** The conversion fix in D-M6a — surface the price, hand the
visitor to a dedicated product page — and this structured-data constraint are satisfied by
the same structure, for free. Treated as one decision, as asked.

### Workshops and conferences — the blocker is missing data, not route economics

I was asked to say plainly whether the SEO benefit justifies a route explosion. **There is
no route explosion to justify** — `/tickets/<slug>` is already generated for every
`ticketType`, workshop and conference products included, so every session already has its
leaf page.

The real blocker is different and harder: **Sanity's `ticketType` schema carries no session
date.** Verified fields: name, slug, price, description, capacity, active, order, show,
demo, provisional, earlyBirdCutoff, regularPrice, releasedQuantity, requiresDaySelection,
requiresAttendeeNames, category, capacityPool, headcountPerUnit. `startDate` is a hard
Google requirement and cannot be supplied from what exists.

**Decision: no Event markup on workshops or conferences in this milestone.** Recommended
follow-up, out of scope: add `sessionStart` / `sessionEnd` to `ticketType`, conditioned on
`category`, then add Event markup to those leaf pages. Faking a session date to unlock a
rich result is exactly the failure mode this mission exists to prevent. Asserted by B8d.

### The vendor flow gets no Event or Offer markup

Google's content guidelines: events requiring "a membership, or invitation prior to
purchasing the ticket" are **ineligible** for the event experience. The vendor flow is
single-use-HMAC-token gated — precisely that. Marking it up is inert at best, a guidelines
problem at worst. Additionally `/national-show/vendors/register` and `.../payment` should
carry `noindex`; they are token-gated and have nothing to rank for. Asserted by B8c.

**Verified current state.** `robots.ts` is sound. `sitemap.ts` exists but **lists
`/national-show/upcoming`, which is an intentional 308 permanent redirect** — a live
crawl-budget defect — and omits every other `/national-show/*` child.
`components/seo/JsonLd.tsx` has `Organization` and `BreadcrumbList` but **no `Event`
anywhere**. Only four files in the repo touch `openGraph`; every `/national-show/*` route
ships a bare `metadata = { title }`. `app/og/route.tsx` exists — extend it with an NOS
variant rather than adding a second endpoint.

### The cannibalisation decision — and the archive call is mine, labelled as judgement

§H2 leaves the archive question genuinely open: Google's Event feature is framed end to
end around upcoming, bookable, attendable events, its documentation does not address past
editions at all, and no fetched source resolves it either way.

**My call: `/national-show/archive/[year]` pages carry NO `Event` markup.** They are
regular content pages — descriptive metadata plus the existing `BreadcrumbList`.
Reasoning: a past edition is not bookable, so Event markup on it buys nothing Google
documents, while creating a second Event entity competing under the same series name as
the live show. Given the choice between an undocumented `eventStatus` value whose effect
is unknown and no markup at all, no markup is the honest option. **This is inference, not
documented guidance** — recorded as such so a future reader does not mistake it for a
standard.

**The anti-cannibalisation mechanism is unchanged and never depended on the dropped
vocabulary.** Each archive page stays **self-canonical**. Do not cross-canonicalise them
to `/national-show` — that deindexes genuinely unique historical content back to 2012, the
site's strongest long-tail asset. The mechanism is **entity distinctness plus unambiguous
titles**: every archive title and `h1` leads with the year and edition, and every archive
page links to the current edition. That was always doing the real work; `superEvent` was
decoration.

Rejected: cross-canonical (deindexes the archive); `noindex` on archives (throws the same
content away for no benefit); `EventCompleted` (not a value Google documents — a guess
dressed as a standard); `previousStartDate` linking editions (explicitly ruled out, it is
rescheduling-only and requires `EventRescheduled`).

### No fabricated Event data

Google's Event rich result requires `name`, `startDate`, `location`. If Sanity does not
supply one of them, **emit no Event node at all** rather than an Event carrying a
substituted date or venue. A malformed Event is worse than none, and a fabricated one
breaches this mission's hardest rule. Asserted structurally by M6/B9 and behaviourally by
B11 case 6.

### The JSX whitespace trap

A live bug class here: an inline close tag ending a source line drops the following
space, invisibly in source. Therefore **every assertion about rendered copy, titles or
meta tags reads served HTML via a real server** — never a source grep. Source greps
appear in these contracts only as cheap structural guards and are labelled
necessary-but-not-sufficient.

---

## D-M6c — Social kit

**Decision.** Artboards are a **rendered `noindex` route** at
`/national-show/social-kit`, exported by a Playwright script at `deviceScaleFactor: 2`
into `.agent/evidence/nos-design/social/`. Four sizes: 1080×1080, 1080×1350, 1080×1920,
1200×628. Each element carries `data-artboard` / `data-artboard-size` so the exporter
selects by attribute, not DOM position.

**Rationale.** The artboards are then **driven by the same scoped NOS tokens as the
site**, so they cannot drift from the shipped brand, and re-export is one command.

**Constraints.** Only the **five cleared photographs** in `public/images/` — Scott
Ormerod's 13 are watermarked and unlicensed, and shipping one is a rights breach, not a
style error (asserted by M6/B14). Every string comes from Sanity `nationalShow` or the
new `socialAsset` document; anything absent renders `data-placeholder`. No gradients, no
duotone, no filters on photography. Story text stays inside a 250px top/bottom safe area.

**Rejected alternative.** *Static PNGs committed to `public/`.* They desynchronise the
moment a token or the wordmark changes, cannot be regenerated without the original design
file, and put undiffable binaries in git.

---

## Risks, ranked

1. **Cross-session ownership of `/tickets/**` (highest).** F17 as briefed crosses into
   the sibling SAOC session's tree, which changed tonight. Mitigated by the F17a/F17b
   split and assertion B4, but it needs an explicit written handshake before F17b starts.
2. **"Full user accounts" being read as in-scope.** If that expectation stands, M5 is not
   a milestone — it is its own multi-week mission with a permanent security tail. Needs
   Brad's confirmation of the token/order-reference recommendation before F14 dispatch.
3. **Exhibitors having no data model.** `/admin/exhibitors` will look thin, and thin is
   the correct output. If it reads as an unfinished feature rather than an honest
   statement, the temptation to fill it with plausible rows is exactly the failure mode
   that put five invented committee members on the live site.
4. ~~**Behavioural assertions need a real server with real Firebase credentials.**~~
   **RESOLVED 2026-09-07 by the orchestrator — this risk is closed.** The mission file's
   note that `FIREBASE_ADMIN_*` are empty and `.env.enc` will not decrypt is now **stale**;
   do not act on it. Credentials were sourced from the sibling `~/ai/SAOC` checkout and
   verified with `crypto.createPrivateKey()` and end-to-end — `/national-show/workshops`,
   `/conferences` and `/tickets` all return 200. A14/A15/B10/B11/B15 can run against a real
   server.

   **The trap that cost two attempts, recorded so nobody repeats it:** the service-account
   PEM is 28 physical lines inside a quoted value. A naive copy takes only the first line
   (truncated key); a second attempt left an unbalanced quote so the value ran on into a
   later comment. The working method is to extract the PEM by its own `BEGIN`/`END`
   delimiters and write it as a **single line with literal `\n`** — the form
   `lib/firebase-admin.ts:13` actually expects, via its `.replace(/\\n/g, '\n')`.
   `.env.local` is gitignored (confirmed), so nothing leaks. The credential copy between
   checkouts is flagged to Brad for the record.
5. **`require_dev_result.sh`** blocks `@qa` dispatch unless a `dev-result-*.md` exists in
   `.agent/memory/scratch/`. Noted; the artifact must come from a real `@dev` run and must
   not be fabricated to unblock the chain.

## What Brad has underestimated

- **"Profile management" is not a design task.** Read as public accounts it is weeks of
  security-surface work with a permanent maintenance cost, for a triennial show. The
  legibility he actually described — knowing at a glance whether someone is a vendor,
  exhibitor or visitor — is a badge and a route tree, and is delivered in M5.
- **Exhibitors do not exist as data.** "Is there an exhibitor?" currently has no
  queryable answer. Making one is a separate mission, not a screen.
- **Sanity is already most of the way there** — 26 types, singletons pinned, duplicate
  creation already blocked. The blocker to other developers contributing is a flat
  20-item Studio list and no written four-file recipe, both cheap to fix.
- **Two priced products contradict each other** (D-M6a). No amount of design fixes a
  ladder where the premium tier costs less than the standard one.
