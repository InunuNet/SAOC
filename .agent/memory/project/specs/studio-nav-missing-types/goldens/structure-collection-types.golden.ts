// Golden reference: COLLECTION_TYPES in sanity/structure.ts must include these
// three schema-registered, live-page-used types alongside the existing entries.
// Do not remove any pre-existing entry — this is an addition, not a rewrite.
const COLLECTION_TYPES = [
  'society',
  'boardMember',
  'societyEvent',
  'show',
  'showClass',
  'award',
  'sponsor',
  'judge',
  'ticketType',
  'showFaq',
  'showExhibitorStep',
  'showPage',
  // F1 (studio-nav-missing-types): registered in sanity/schemas/index.ts but
  // omitted from this nav list, making them unreachable via Studio's normal
  // left-hand navigation (though `+ Create` still worked).
  'showSponsor', // used by /national-show/sponsors
  'vendorNursery', // used by /national-show/vendors, /sa-exhibitors, /international-guests
  'province', // used by lib/data/provinces.ts, /societies, /societies/[slug], /about, /national-show, /national-show/archive
];
