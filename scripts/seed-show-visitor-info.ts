/**
 * F1 (show-visitor-info) — Seed the National Show visitor-information content:
 * the showVisitorInfo copy singleton, the showFaq collection, and the structured
 * venue + show-identity fields on the existing nationalShow singleton.
 *
 * A NEW script on purpose. scripts/seed-page-singletons.ts is known-hazardous: it
 * force-replaces documents with hardcoded literals, so re-running it silently reverts
 * whatever the secretary edited in Studio. Nothing here uses that pattern and nothing
 * here touches that file.
 *
 *   - showVisitorInfo and every showFaq document use createIfNotExists on a
 *     deterministic _id, so a second run collides with the existing document rather
 *     than creating a duplicate or overwriting an edit.
 *   - nationalShow gains venue / showDate / showEndDate / edition / hostRegion via
 *     setIfMissing, which writes a field only when it is absent. An editor's
 *     correction can never be reverted by a re-run.
 *   - Portable-text _key values are derived from the document _id, never random:
 *     a random key changes the document on every run and defeats idempotence.
 *
 * EVERY seeded value is either verified research (sourced in
 * contracts/golden/show-visitor-info/cticc-research.golden.md) or an honest
 * "not confirmed" placeholder. Nothing is invented, and no block is seeded with a
 * committee-signed-off status — the confirmations object below marks each block
 * pending or research, and the pages render a visible marker for both.
 *
 * Required env (read directly from .env.local, NOT via the `dotenv` package — its
 * banner writes to stdout and has corrupted captured values on this project before):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-show-visitor-info.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local (see file header).
// ---------------------------------------------------------------------------

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnvLocal();
const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
const token = env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, ' +
      'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
  );
}

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

// Pinned singleton _id convention (matches sanity/structure.ts): the document's own
// _id equals its schema type name.
const NATIONAL_SHOW_ID = 'nationalShow';
const VISITOR_INFO_ID = 'showVisitorInfo';

// A _key must be stable across runs, so derive it from the owning document _id and a
// positional suffix. Sanity keys are plain strings; dots are replaced for readability.
function stableKey(ownerId: string, suffix: string): string {
  return `${ownerId}-${suffix}`.replace(/\./g, '-');
}

function keyed<T extends object>(ownerId: string, prefix: string, items: T[]): Array<T & { _key: string }> {
  return items.map((item, index) => ({ ...item, _key: stableKey(ownerId, `${prefix}-${index + 1}`) }));
}

// ---------------------------------------------------------------------------
// nationalShow — venue object plus the three show-identity fields whose absence
// forced the landing page to keep hardcoding a date range, a host and an edition.
// setIfMissing throughout: never force-set over an editor's correction.
// Values sourced in cticc-research.golden.md, retrieved 2026-08-11. All RESEARCH
// status — the show committee has confirmed no venue.
// ---------------------------------------------------------------------------

const VENUE = {
  name: 'Cape Town International Convention Centre',
  addressLines: ['Convention Square', '1 Lower Long Street'],
  city: 'Cape Town',
  province: 'Western Cape',
  postalCode: '8001',
  latitude: -33.915141,
  longitude: 18.425657,
  // OpenStreetMap deliberately: no API key, no account, no terms-of-service question
  // about embedding, and the link works for every visitor.
  mapsUrl:
    'https://www.openstreetmap.org/?mlat=-33.915141&mlon=18.425657#map=17/-33.915141/18.425657',
  directionsNote:
    'Working venue assumption only — the show committee has not confirmed a venue. The CTICC ' +
    'is on the Foreshore at the harbour end of the city centre. Which entrance the show uses ' +
    'will be confirmed closer to the time.',
  phone: '+27 21 410 5000',
};

// The dates mirror the countdownDate already in the dataset, so they introduce no new
// claim — but they are NOT committee-confirmed. confirmations.dates below seeds pending,
// and the landing page renders that marker beside the hero meta grid.
const SHOW_IDENTITY = {
  showDate: '2027-09-18T09:00:00+02:00',
  showEndDate: '2027-09-21T17:00:00+02:00',
  edition: 19,
  hostRegion: 'Western Cape',
};

// Sanity assigns a fresh _rev to any document a committed transaction touches, even
// when the mutation changes nothing — a no-op setIfMissing still bumps the revision.
// So idempotence needs the write to be SKIPPED, not merely made harmless: read the
// document first and only patch the fields that are genuinely absent.
async function patchNationalShow(): Promise<void> {
  console.log('  nationalShow.venue + show-identity fields:');
  const candidates: Record<string, unknown> = { venue: VENUE, ...SHOW_IDENTITY };
  const existing = (await client.getDocument(NATIONAL_SHOW_ID)) ?? {};

  const missing = Object.fromEntries(
    Object.entries(candidates).filter(([field]) => {
      const value = (existing as Record<string, unknown>)[field];
      return value === undefined || value === null;
    }),
  );

  if (Object.keys(missing).length === 0) {
    console.log('    already set — no write issued');
    return;
  }

  await client.patch(NATIONAL_SHOW_ID).setIfMissing(missing).commit({ autoGenerateArrayKeys: false });
  console.log(`    patched with setIfMissing: ${Object.keys(missing).join(', ')}`);
}

// ---------------------------------------------------------------------------
// showVisitorInfo — all visitor-page copy.
// ---------------------------------------------------------------------------

const AIRPORT_ROUTES = [
  {
    _type: 'travelRoute',
    origin: 'Cape Town International Airport (CPT)',
    distance: 'About 22 km',
    duration: 'Roughly 25 to 40 minutes by road, depending on traffic',
    directions:
      'Follow the N2 towards the city centre and take the Foreshore off-ramps. The venue sits ' +
      'on the Foreshore at the harbour end of the central business district.',
    transportOptions: [
      'MyCiTi bus route A01 runs between the airport and Civic Centre station, roughly every ' +
        '20 minutes in peak periods and about hourly off-peak, taking around 30 minutes. Civic ' +
        'Centre station is on Hertzog Boulevard, a walk of about 600 m from the venue.',
      "Metered taxis and e-hailing services operate from the airport's designated ranks.",
      "Car hire desks are in the airport's central terminal building.",
    ],
  },
  {
    _type: 'travelRoute',
    origin: 'OR Tambo International Airport, Johannesburg (JNB)',
    distance: 'About 1 400 km — not a practical drive',
    duration: 'About 2 hours by connecting flight',
    directions:
      'Connect to Cape Town International, then follow the Cape Town International guidance above.',
    transportOptions: ['Domestic connecting flights run throughout the day.'],
  },
  {
    _type: 'travelRoute',
    origin: 'King Shaka International Airport, Durban (DUR)',
    distance: 'About 1 650 km — not a practical drive',
    duration: 'About 2 hours by connecting flight',
    directions:
      'Connect to Cape Town International, then follow the Cape Town International guidance above.',
    transportOptions: ['Domestic connecting flights run throughout the day.'],
  },
];

const ACCOMMODATION = [
  {
    _type: 'accommodationOption',
    name: 'Foreshore hotels adjoining the convention precinct',
    area: 'Foreshore',
    distanceBand: 'walking',
    note:
      "Several large hotels sit within a few minutes' walk of the working venue. Specific " +
      'properties will be listed once the venue is confirmed.',
  },
  {
    _type: 'accommodationOption',
    name: 'V&A Waterfront',
    area: 'V&A Waterfront',
    distanceBand: 'nearby',
    note:
      'About 2 km. A wide range of hotels and serviced apartments, with restaurants and the ' +
      'Robben Island ferry on the doorstep.',
  },
  {
    _type: 'accommodationOption',
    name: "City Bowl and Company's Garden",
    area: 'Cape Town City Centre',
    distanceBand: 'nearby',
    note:
      'About 1 to 2 km. Smaller hotels and guesthouses within walking distance of the museums ' +
      "and the Company's Garden.",
  },
  {
    _type: 'accommodationOption',
    name: 'Green Point and Sea Point',
    area: 'Atlantic Seaboard',
    distanceBand: 'city',
    note:
      'About 3 to 6 km. Guesthouses and self-catering apartments along the Atlantic seaboard ' +
      'promenade.',
  },
  {
    _type: 'accommodationOption',
    name: 'Southern Suburbs',
    area: 'Newlands, Claremont and surrounds',
    distanceBand: 'further',
    note:
      'About 10 to 15 km. Quieter, leafier, and close to Kirstenbosch — worth considering if ' +
      'you are extending your stay.',
  },
];

const ATTRACTIONS = [
  {
    _type: 'attraction',
    name: 'V&A Waterfront',
    note:
      'About 2 km from the working venue. Shops, restaurants, the aquarium, and the departure ' +
      'point for Robben Island ferries.',
  },
  {
    _type: 'attraction',
    name: 'Kirstenbosch National Botanical Garden',
    note:
      "About 13 km. South Africa's flagship botanical garden, on the eastern slopes of Table " +
      'Mountain — the obvious companion outing for a show visitor.',
  },
  {
    _type: 'attraction',
    name: 'Table Mountain Aerial Cableway',
    note:
      "About 6 km. Runs weather permitting; check the cableway's own status before travelling.",
  },
  {
    _type: 'attraction',
    name: "Company's Garden and the city museums",
    note:
      'About 1.5 km. The original 17th-century garden, with the South African Museum and the ' +
      'National Gallery alongside it.',
  },
  {
    _type: 'attraction',
    name: 'Bo-Kaap',
    note: 'About 2 km. Historic neighbourhood on the slopes of Signal Hill.',
  },
];

const EMERGENCY_CONTACTS = [
  { _type: 'emergencyContact', label: 'Police (national)', number: '10111' },
  { _type: 'emergencyContact', label: 'Ambulance and fire (national)', number: '10177' },
  {
    _type: 'emergencyContact',
    label: 'All emergencies, from a mobile phone',
    number: '112',
    note: 'Works from any mobile, including one with no airtime.',
  },
  {
    _type: 'emergencyContact',
    label: 'On-site first aid and show duty contact',
    number: 'To be confirmed',
    note: 'The committee will supply the on-site contact before the show.',
  },
];

const OPENING_HOURS = [
  {
    _type: 'openingHoursEntry',
    label: 'Show days',
    hours: 'To be confirmed',
    note: 'Dates and daily opening hours are still with the show committee.',
  },
  {
    _type: 'openingHoursEntry',
    label: 'Final day',
    hours: 'To be confirmed',
    note: 'The final day usually closes earlier to allow exhibitors to break down their displays.',
  },
];

// One status per content block. Nothing here is signed off by the show committee, so
// nothing seeds with a signed-off status: research where we verified it ourselves,
// pending where the value is a placeholder the committee must supply.
const CONFIRMATIONS = {
  _type: 'confirmationStatuses',
  venue: 'research',
  dates: 'pending',
  openingHours: 'pending',
  admission: 'pending',
  parking: 'pending',
  publicTransport: 'research',
  accessibility: 'pending',
  photography: 'pending',
  cloakroom: 'pending',
  food: 'pending',
  accommodation: 'research',
  attractions: 'research',
  emergencyContacts: 'pending',
};

async function seedVisitorInfo(): Promise<void> {
  console.log('  showVisitorInfo:');
  if (await client.getDocument(VISITOR_INFO_ID)) {
    console.log('    already exists — no write issued');
    return;
  }
  await client.createIfNotExists({
    _id: VISITOR_INFO_ID,
    _type: 'showVisitorInfo',

    pendingLabel: 'To be confirmed by the show committee',
    researchLabel:
      'Researched by the web team against the working venue — not yet confirmed by the show ' +
      'committee',

    planTitle: 'Plan your visit',
    planIntro:
      'Everything you need to get to the National Orchid Show and make a day of it. Travel and ' +
      'accommodation guidance below is our own research against the working venue; the show ' +
      'committee will confirm the final details.',
    gettingThereIntro:
      'Most visitors from outside the Western Cape arrive by air. Whichever national airport ' +
      'you start from, your route runs through Cape Town International.',
    airportRoutes: keyed(VISITOR_INFO_ID, 'route', AIRPORT_ROUTES),

    parking:
      'Parking arrangements for show visitors have not been confirmed. The venue has multiple ' +
      'parking garages; rates, capacity and which garage show visitors should use will be ' +
      'published once the committee confirms the booking.',
    publicTransport:
      "MyCiTi is Cape Town's scheduled bus service. Civic Centre station on Hertzog Boulevard " +
      'is the closest stop to the working venue — about 600 m, a walk of roughly seven minutes ' +
      '— and is the city terminus of the A01 airport route. Metered taxis and e-hailing ' +
      'services operate throughout the central city.',

    accommodationIntro:
      'A starting point for booking, grouped by how far you would be from the venue. These are ' +
      'suggestions from our own research, not recommendations or negotiated rates — SAOC has no ' +
      'arrangement with any property listed.',
    accommodation: keyed(VISITOR_INFO_ID, 'stay', ACCOMMODATION),
    attractions: keyed(VISITOR_INFO_ID, 'attraction', ATTRACTIONS),
    emergencyContacts: keyed(VISITOR_INFO_ID, 'emergency', EMERGENCY_CONTACTS),

    expectTitle: 'What to expect',
    expectIntro:
      "What the show looks like from a visitor's side of the bench: when the doors open, what " +
      'it costs to come in, and the practical details that decide whether you bring a camera, ' +
      'a coat or a cool box.',
    openingHours: keyed(VISITOR_INFO_ID, 'hours', OPENING_HOURS),
    admissionNote:
      'Admission is charged per person per day, with concession rates for pensioners and ' +
      'children, and a reduced rate for members of affiliated SAOC societies. Whether tickets ' +
      'are sold at the door as well as in advance has not yet been confirmed. Current prices ' +
      'are shown on the ticket page.',
    admissionLinkLabel: 'See ticket prices and book',
    food:
      'Catering arrangements have not been confirmed. Details of what will be available on ' +
      'site, and whether visitors may bring their own refreshments, will be published once the ' +
      'committee confirms the venue.',
    photographyPolicy:
      'The photography policy has not been confirmed. Personal photography is normally welcome ' +
      'at SAOC shows; tripods, flash near the benches, and any commercial or press photography ' +
      'usually need prior arrangement. Confirmed rules will be published here.',
    cloakroom:
      'Cloakroom and plant-holding arrangements have not been confirmed. If you buy plants at ' +
      'the show, we expect a holding area will be available so you need not carry them for the ' +
      'rest of your visit — this will be confirmed.',
    accessibility:
      'Accessibility details have not been confirmed. The working venue is a modern convention ' +
      'centre with step-free access and accessible facilities. Specifics — accessible parking, ' +
      'wheelchair availability, aisle widths between benches, and assistance on request — will ' +
      'be confirmed by the committee.',

    faqTitle: 'Frequently asked questions',
    faqIntro:
      'Answers to what visitors ask us most. Many of these depend on details the show committee ' +
      'has not yet confirmed; those answers are marked as such and will be updated as the ' +
      'arrangements firm up.',
    faqContactNote: 'Not answered here? We would rather hear the question than have you guess.',

    confirmations: CONFIRMATIONS,
  });
  console.log('    seeded (createIfNotExists)');
}

// ---------------------------------------------------------------------------
// showFaq documents — deterministic _ids so a re-run collides with the existing
// document instead of creating a duplicate.
// ---------------------------------------------------------------------------

interface SeedFaq {
  id: string;
  category: string;
  order: number;
  status: string;
  question: string;
  answer: string;
}

const FAQS: SeedFaq[] = [
  {
    id: 'showFaq-getting-there-1',
    category: 'getting-there',
    order: 1,
    status: 'research',
    question: 'How do I get to the show from Cape Town International Airport?',
    answer:
      'The venue is about 22 km from the airport, roughly 25 to 40 minutes by road. The MyCiTi ' +
      'A01 bus runs from the airport to Civic Centre station, about 600 m from the working ' +
      'venue. Full detail is on the Plan your visit page.',
  },
  {
    id: 'showFaq-getting-there-2',
    category: 'getting-there',
    order: 2,
    status: 'pending',
    question: 'Is there parking at the venue?',
    answer:
      'Parking arrangements have not been confirmed by the show committee. The working venue ' +
      'has several parking garages; we will publish rates and directions once the booking is ' +
      'confirmed.',
  },
  {
    id: 'showFaq-getting-there-3',
    category: 'getting-there',
    order: 3,
    status: 'pending',
    question: 'Where exactly is the show being held?',
    answer:
      'The venue has not been formally confirmed. We are planning around the Cape Town ' +
      'International Convention Centre and will update this page the moment the committee ' +
      'confirms.',
  },
  {
    id: 'showFaq-tickets-1',
    category: 'tickets',
    order: 1,
    status: 'pending',
    question: 'How much does it cost to get in?',
    answer:
      'Current prices are listed on the ticket page. They remain provisional until the council ' +
      'confirms them.',
  },
  {
    id: 'showFaq-tickets-2',
    category: 'tickets',
    order: 2,
    status: 'pending',
    question: 'Can I buy a ticket at the door?',
    answer:
      'Whether tickets will be sold at the door as well as in advance has not been confirmed.',
  },
  {
    id: 'showFaq-tickets-3',
    category: 'tickets',
    order: 3,
    status: 'pending',
    question: 'Are there concessions for pensioners, children or society members?',
    answer:
      'Yes — concession rates for pensioners and children, and a reduced rate for members of ' +
      'affiliated SAOC societies, are planned. The amounts are provisional until the council ' +
      'confirms them.',
  },
  {
    id: 'showFaq-accessibility-1',
    category: 'accessibility',
    order: 1,
    status: 'pending',
    question: 'Is the venue wheelchair accessible?',
    answer:
      'Accessibility specifics have not been confirmed. The working venue is a modern ' +
      'convention centre with step-free access and accessible facilities; we will publish the ' +
      'confirmed detail, including accessible parking and assistance on request, once the ' +
      'committee supplies it.',
  },
  {
    id: 'showFaq-accessibility-2',
    category: 'accessibility',
    order: 2,
    status: 'pending',
    question: 'Are assistance dogs welcome?',
    answer:
      'This has not been confirmed. Please contact us before the show so we can give you a ' +
      'definite answer.',
  },
  {
    id: 'showFaq-plant-sales-1',
    category: 'plant-sales',
    order: 1,
    status: 'pending',
    question: 'Can I buy plants at the show?',
    answer:
      'Plant sales are a normal part of a national show, but the sales arrangements for 2027 ' +
      'have not been confirmed.',
  },
  {
    id: 'showFaq-plant-sales-2',
    category: 'plant-sales',
    order: 2,
    status: 'pending',
    question: 'Can I leave plants I have bought somewhere while I carry on looking?',
    answer:
      'Cloakroom and plant-holding arrangements have not been confirmed. We expect a holding ' +
      'area will be available and will confirm here.',
  },
  {
    id: 'showFaq-plant-sales-3',
    category: 'plant-sales',
    order: 3,
    status: 'pending',
    question: 'Can I take plants I buy across a provincial or national border?',
    answer:
      'Moving plants across borders can require permits, and the requirements depend on where ' +
      'you are travelling to. Check with the relevant authority well before the show. We will ' +
      'add specific guidance once the committee confirms which sellers will be present.',
  },
  {
    id: 'showFaq-general-1',
    category: 'general',
    order: 1,
    status: 'pending',
    question: 'May I take photographs?',
    answer:
      'The photography policy has not been confirmed. Personal photography is normally welcome; ' +
      'tripods, flash near the benches and any commercial or press photography usually need ' +
      'prior arrangement.',
  },
  {
    id: 'showFaq-general-2',
    category: 'general',
    order: 2,
    status: 'pending',
    question: 'Will there be food and drink available?',
    answer: 'Catering arrangements have not been confirmed.',
  },
  {
    id: 'showFaq-general-3',
    category: 'general',
    order: 3,
    status: 'pending',
    question: 'When is the show?',
    answer:
      'The dates have not been formally confirmed by the show committee. The countdown on the ' +
      'show page reflects our current working dates.',
  },
];

function answerBlocks(faq: SeedFaq) {
  return [
    {
      _type: 'block',
      _key: stableKey(faq.id, 'block'),
      style: 'normal',
      markDefs: [],
      children: [
        { _type: 'span', _key: stableKey(faq.id, 'span'), text: faq.answer, marks: [] },
      ],
    },
  ];
}

async function seedFaqs(): Promise<void> {
  console.log('  showFaq documents:');
  const existingIds = new Set<string>(
    await client.fetch<string[]>('*[_id in $ids]._id', { ids: FAQS.map((faq) => faq.id) }),
  );

  for (const faq of FAQS) {
    if (existingIds.has(faq.id)) {
      console.log(`    ${faq.id} (already exists — no write issued)`);
      continue;
    }
    await client.createIfNotExists({
      _id: faq.id,
      _type: 'showFaq',
      question: faq.question,
      answer: answerBlocks(faq),
      category: faq.category,
      order: faq.order,
      status: faq.status,
      active: true,
    });
    console.log(`    ${faq.id} (createIfNotExists)`);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `Seeding show visitor information in Sanity dataset "${dataset}" (project ${projectId})`,
  );
  await patchNationalShow();
  await seedVisitorInfo();
  await seedFaqs();
  console.log('Seed complete.');
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
