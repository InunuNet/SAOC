import { defineQuery } from 'next-sanity';

export const homePageQuery = defineQuery(`
  *[_type == "homePage"][0]{
    title,
    heroImages,
    missionText
  }
`);

export const societyListQuery = defineQuery(`
  *[_type == "society"] | order(name asc){
    _id,
    name,
    "slug": slug.current,
    province,
    region,
    founded,
    meets,
    venue,
    memberCount,
    description,
    logo,
    website,
    markBadge
  }
`);

export const nationalShowQuery = defineQuery(`
  *[_type == "nationalShow"][0]{
    title,
    showDate,
    showEndDate,
    edition,
    hostRegion,
    location,
    venue,
    hero,
    countdownDate
  }
`);

// F1/F2 (show-visitor-info): the show-identity facts the visitor pages need, with the
// legacy `location` display string deliberately EXCLUDED. Those pages read venue.* only,
// so the two can never drift invisibly — see venue-single-source.golden.md.
export const nationalShowVenueQuery = defineQuery(`
  *[_type == "nationalShow"][0]{
    showDate,
    showEndDate,
    venue
  }
`);

// F1 (show-visitor-info): every piece of visitor-facing copy across the three new pages.
export const showVisitorInfoQuery = defineQuery(`
  *[_type == "showVisitorInfo"][0]{
    pendingLabel,
    researchLabel,
    planTitle,
    planIntro,
    gettingThereIntro,
    airportRoutes,
    parking,
    publicTransport,
    accommodationIntro,
    accommodation,
    attractions,
    emergencyContacts,
    expectTitle,
    expectIntro,
    openingHours,
    admissionNote,
    admissionLinkLabel,
    food,
    photographyPolicy,
    cloakroom,
    accessibility,
    faqTitle,
    faqIntro,
    faqContactNote,
    confirmations
  }
`);

// Sorted server-side. The tertiary sort on question keeps rendering deterministic when two
// entries share an order value — otherwise the HTML changes between requests and the
// ordering assertion flakes.
export const showFaqsQuery = defineQuery(`
  *[_type == "showFaq" && active == true] | order(category asc, order asc, question asc){
    _id,
    question,
    answer,
    category,
    order,
    status
  }
`);

// F1 (ticketing-pages): the checkout API needs only the sales gate, kept as its own
// small query rather than pulling the full nationalShowQuery into a payment route.
export const nationalShowSalesQuery = defineQuery(`
  *[_type == "nationalShow"][0]{
    salesOpen
  }
`);

// F9 (ticketing-foundation): `demo,` is additive — every other selected field is unchanged.
// The public /tickets page (app/(marketing)/tickets/page.tsx) filters the result through
// filterPubliclyListableTicketTypes() (lib/demo-ticket-type.ts) before rendering, so this
// query must select the field the filter depends on. See
// contracts/golden/ticketing-f9-demo-ticket/README.md, "A real, pre-existing gap this
// contract closes".
// F4 (multi-line-item-cart, M2): `provisional,` is additive — the public /tickets page gates
// a visible "provisional" marker on this flag. See
// contracts/golden/ticketing-f4-admission-products/README.md.
// F5 (ticketing-f5-day-attendees): `requiresDaySelection,` is additive — the public
// /tickets page gates CartDayPicker rendering on this flag. See
// contracts/golden/ticketing-f5-day-attendees/README.md.
export const activeTicketTypesQuery = defineQuery(`
  *[_type == "ticketType" && active == true] | order(order asc){
    _id,
    name,
    "slug": slug.current,
    price,
    description,
    capacity,
    releasedQuantity,
    order,
    demo,
    provisional,
    requiresDaySelection
  }
`);

// F3 (ticketing-conferences-and-events, M2): additive alongside activeTicketTypesQuery above
// (untouched, in case anything else references it) — same shape, plus a $category filter, so
// each category's purchase page (/tickets, /national-show/conferences, /national-show/
// workshops) selects only its own products server-side rather than over-fetching every
// category and filtering in JS. See contracts/golden/ticketing-purchase-pages-f3/README.md.
// F5 defect repair (ticketing-conferences-and-events, M2, Codex GPT-5.5 cross-model review
// 2026-08-21): `capacityPool,`/`headcountPerUnit,` are additive — CategoryTicketsPage.tsx's
// sold-out determination now calls planPooledCapacity() (the same pooling math checkout
// enforces) rather than comparing a type's own sold count to its own capacity field, which
// under-reports sold-out for a shared pool. See goldens/f5-checkout.golden.md.
export const activeTicketTypesByCategoryQuery = defineQuery(`
  *[_type == "ticketType" && active == true && (category == $category || (!defined(category) && $category == "admission"))] | order(order asc){
    _id,
    name,
    "slug": slug.current,
    price,
    description,
    capacity,
    releasedQuantity,
    order,
    demo,
    provisional,
    requiresDaySelection,
    category,
    capacityPool,
    headcountPerUnit,
  }
`);

// F4 (multi-line-item-cart, M2): `releasedQuantity,`/`earlyBirdCutoff,` are additive —
// checkout's per-ticketType loop enforces both server-side via effectiveCapacity()/
// isWithinEarlyBirdWindow(). See
// contracts/golden/ticketing-f4-admission-products/README.md.
// F5 (ticketing-f5-day-attendees): `requiresDaySelection,`/`requiresAttendeeNames,` are
// additive — checkout's per-line-item loop enforces both server-side. See
// contracts/golden/ticketing-f5-day-attendees/README.md.
export const ticketTypeBySlugQuery = defineQuery(`
  *[_type == "ticketType" && slug.current == $slug && active == true][0]{
    _id,
    name,
    price,
    capacity,
    show,
    releasedQuantity,
    earlyBirdCutoff,
    requiresDaySelection,
    requiresAttendeeNames,
    capacityPool,
    headcountPerUnit
  }
`);

// F5 defect repair (ticketing-conferences-and-events, M2, Codex GPT-5.5 cross-model review
// 2026-08-21): checkout must resolve the correct pool key for EVERY ticketType slug that
// already has sold/reserved tickets in a pool the cart touches — not just the slugs the
// current buyer is requesting — or a sibling slug's prior sales silently fall back to being
// their own singleton pool and escape the shared ceiling. Fetches every ticketType sharing
// `$pool` so the route can complete poolConfigByType before planPooledCapacity() runs.
//
// Second Codex GPT-5.5 pass (2026-08-21): deliberately NOT filtered on `active == true`. A
// sibling deactivated after selling out (or retired) still has real reserved/paid positions
// in Firestore, and getSoldCountsByTicketType() counts those regardless of the sibling's
// current `active` value — an active-only filter here would let that sibling's sold heads
// fall back to their own singleton pool and escape the shared ceiling, the exact oversell
// class this query exists to close. This is independent of draft-document exclusion — the
// checkout route's client (sanity/lib/client.ts) never resolves unpublished drafts, the same
// as every other query this route already runs — so dropping `active == true` only widens
// the result to inactive-but-published siblings, never to drafts.
// F5 defect repair (ticketing-conferences-and-events, M2, Codex GPT-5.5 cross-model review
// 2026-08-21, third pass): `capacityPool` is a free-text string, not namespaced per show — a
// published ticketType belonging to a DIFFERENT show that happens to reuse the same pool name
// would be fetched as a "sibling" here and merged into poolConfigByType, poisoning the current
// checkout's pool config with an unrelated headcountPerUnit/sold-count weighting. Scoped to
// `show._ref == $showId` using the same reference-field access pattern checkout already uses
// (ticketTypeMatchesActiveShow() in app/api/tickets/checkout/route.ts). Deliberately still NOT
// filtered on `active == true` — see the comment above this query for why that stays open.
export const ticketTypesByPoolQuery = defineQuery(`
  *[_type == "ticketType" && capacityPool == $pool && show._ref == $showId]{
    "slug": slug.current,
    capacityPool,
    headcountPerUnit
  }
`);

// F1 (ticketing-foundation): every show document's activation flag, fed to
// resolveActiveShow() (lib/show-resolution.ts) — checkout never guesses which show is
// sellable from request data. See contracts/golden/ticketing-f1-show-collision/README.md.
export const allShowActivationQuery = defineQuery(`
  *[_type == "show"]{
    _id,
    active
  }
`);

// ticketing-show-window-lookup: every show document's activation flag AND date fields,
// fed to resolveActiveShow() (lib/show-resolution.ts) + buildShowWindow()
// (lib/show-window-lookup.ts). Additive alongside allShowActivationQuery (F1, still
// consumed by checkout's resolveActiveShow() call, untouched) — this query exists
// because that one omits startDate/endDate, which checkout never needed but this
// lookup does.
export const activeShowWindowQuery = defineQuery(`
  *[_type == "show"]{
    _id,
    active,
    startDate,
    endDate
  }
`);

export const ticketsPageQuery = defineQuery(`
  *[_type == "ticketsPage"][0]{
    title,
    intro,
    buyButtonLabel,
    soldOutMessage,
    salesClosedMessage,
    termsNote,
    confirmationPendingHeading,
    confirmationPendingMessage,
    confirmationSuccessHeading,
    confirmationSuccessMessage,
    confirmationNotFoundMessage,
    ticketIncludesNote,
    cancelledHeading,
    cancelledMessage,
    cancelledButtonLabel
  }
`);

export const upcomingEventsQuery = defineQuery(`
  *[_type == "societyEvent" && date >= now()] | order(date asc){
    _id,
    title,
    "slug": slug.current,
    date,
    endDate,
    kind,
    description,
    venue,
    location,
    isFeatured,
    "hostSociety": hostSociety->{ _id, name, "slug": slug.current }
  }
`);

export const partnersQuery = defineQuery(`
  *[_type == "sponsor" && active == true] | order(tier asc, name asc){
    _id,
    name,
    tier,
    logo,
    website,
    description
  }
`);

export const aboutPageQuery = defineQuery(`
  *[_type == "aboutPage"][0]{
    title,
    pillars,
    timelineNodes,
    boardIntroText
  }
`);

export const boardMembersQuery = defineQuery(`
  *[_type == "boardMember"] | order(order asc){
    _id,
    name,
    role,
    email,
    photo,
    order
  }
`);

export const awardsQuery = defineQuery(`
  *[_type == "award"] | order(order asc){
    _id,
    code,
    name,
    description,
    threshold,
    order
  }
`);

export const societyBySlugQuery = defineQuery(`
  *[_type == "society" && slug.current == $slug][0]{
    _id,
    name,
    "slug": slug.current,
    province,
    region,
    founded,
    meets,
    venue,
    memberCount,
    description,
    logo,
    website,
    markBadge
  }
`);

export const societySlugsQuery = defineQuery(`
  *[_type == "society" && defined(slug.current)]{ "slug": slug.current }
`);

export const showClassesQuery = defineQuery(`
  *[_type == "showClass"] | order(order asc){
    _id,
    code,
    name,
    description
  }
`);

export const pastShowsQuery = defineQuery(`
  *[_type == "show" && status == "past"] | order(year desc){
    _id,
    title,
    "slug": slug.current,
    year,
    status,
    location,
    entries,
    exhibitors,
    awards
  }
`);

// F3 (cms-wiring-cleanup): the /societies filter chips read the `province` documents.
// The explicit order(order asc, name asc) is load-bearing — the chip sequence is
// curated, not alphabetical, and without a deterministic sort it reshuffles between
// renders. See goldens/province-chip-order.golden.json.
export const provinceListQuery = defineQuery(`
  *[_type == "province"] | order(order asc, name asc){
    _id,
    name,
    code,
    order
  }
`);

export const judgingPageQuery = defineQuery(`
  *[_type == "judgingPage"][0]{
    title,
    intro,
    howItWorks,
    stats,
    becomingAJudge,
    showPublicDirectory,
    "judges": judges[]->{
      name,
      region,
      accreditedSince,
      photo
    }
  }
`);

export const contactPageQuery = defineQuery(`
  *[_type == "contactPage"][0]{
    title,
    directContacts[]{
      name,
      role,
      email
    }
  }
`);

export const eventBySlugQuery = defineQuery(`
  *[_type == "societyEvent" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    date,
    endDate,
    kind,
    description,
    venue,
    location,
    isFeatured,
    "hostSociety": hostSociety->{ _id, name, "slug": slug.current }
  }
`);

export const eventSlugsQuery = defineQuery(`
  *[_type == "societyEvent" && defined(slug.current)]{ "slug": slug.current }
`);

// F1 (show-exhibitor-info): the /national-show/exhibitors singleton.
//
// Projects EVERY field on the schema. A field the schema declares but the query drops
// renders as nothing — the false-green class this project has hit three times. The
// entry-form asset URL is resolved here so EntryFormLink never has to build one, and so
// the "no form yet" branch is decidable from the query result alone.
export const showExhibitorInfoQuery = defineQuery(`
  *[_type == "showExhibitorInfo"][0]{
    title,
    intro,
    pendingLabel,
    researchLabel,
    questionLabel,
    keyDatesHeading,
    keyDatesNote,
    keyDatesCaption,
    keyDates[]{ _key, label, dateNote, detail, status },
    entryFormHeading,
    "entryFormFileUrl": entryFormFile.asset->url,
    "entryFormFileName": entryFormFile.asset->originalFilename,
    entryFormUrl,
    entryFormPendingNote,
    entryProcess{ heading, body },
    fees{ heading, body },
    classes{ heading, body },
    judging{ heading, body },
    eligibility{ heading, body },
    display{ heading, body },
    sales{ heading, body },
    practicalities{ heading, body },
    permits{ heading, body },
    questionsHeading,
    questionsIntro,
    openQuestions[] | order(order asc){ _key, question, context, topic, order },
    confirmations,
    judgingLinkLabel,
    classesLinkLabel,
    contactNote
  }
`);

// F1 (show-exhibitor-info): the exhibitor journey, in order.
//
// `active == true` rather than `!defined(active) || active`: initialValue guarantees the
// field is set on anything created through the Studio, and the seed sets it explicitly.
export const showExhibitorStepsQuery = defineQuery(`
  *[_type == "showExhibitorStep" && active == true] | order(order asc){
    _id,
    title,
    "when": when,
    body,
    order,
    status
  }
`);

// F3 (vendor-registration): the /national-show/vendors showcase. Projects EVERY field on
// the vendorNursery schema (F1/F2, contract vendor-f1f2-naming-and-nursery-schema) — a field
// the schema declares but the query drops renders as nothing, the project's recurring
// false-green class (see showExhibitorInfoQuery's comment above). Ordered by name: nurseries
// have no curated show order, so alphabetical is the deterministic, non-arbitrary default.
export const vendorNurseriesQuery = defineQuery(`
  *[_type == "vendorNursery"] | order(name asc){
    _id,
    name,
    logo,
    country,
    owner,
    history,
    specialisation,
    plantsBrought,
    website,
    socialMedia[]{ _key, platform, url },
    availableAtShow
  }
`);
