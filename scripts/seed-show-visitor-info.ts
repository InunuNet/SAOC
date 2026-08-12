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
 * EVERY seeded value is either verified research (sourced in the show-visitor-info
 * research golden file) or an honest "not confirmed" placeholder. Nothing is
 * invented, and no block is seeded with a committee-signed-off status — the
 * confirmations object below marks each block pending, research or confirmed, and
 * the pages render a visible marker for all three.
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
// Venue confirmed by the client 2026-08-12 — see
// contracts/golden/venue-seed-truth/expected-venue.json. No confirmed switchboard
// number or arrival note exists yet for this venue, so phone and directionsNote are
// left unset rather than carrying over the previous venue's values.
// ---------------------------------------------------------------------------

const VENUE = {
  name: 'The Hangar, Stellenbosch Flying Club',
  addressLines: ['Stellenbosch Airfield', 'R44'],
  city: 'Stellenbosch',
  province: 'Western Cape',
  postalCode: '7600',
  latitude: -33.9794,
  longitude: 18.8196,
  // OpenStreetMap deliberately: no API key, no account, no terms-of-service question
  // about embedding, and the link works for every visitor.
  mapsUrl:
    'https://www.openstreetmap.org/?mlat=-33.9794&mlon=18.8196#map=15/-33.9794/18.8196',
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

// The venue changed from the previous working-venue assumption (a Cape Town
// city-centre convention centre) to Stellenbosch Airfield. That travel research no
// longer applies to the new venue and none of it has been redone yet, so these
// arrays are cleared rather than reintroduce stale content or invent new
// airfield-specific detail. Matches the live Sanity dataset, which was cleared the
// same way — see contracts/golden/venue-seed-truth/README.md.
const AIRPORT_ROUTES: Record<string, unknown>[] = [];

const ACCOMMODATION: Record<string, unknown>[] = [];

const ATTRACTIONS: Record<string, unknown>[] = [];

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

// One status per content block. The venue is now client-confirmed (2026-08-12);
// everything else is still pending — the travel/accommodation research done against
// the previous working venue no longer applies to the new one and has not been
// redone, so those blocks are pending, not research.
const CONFIRMATIONS = {
  _type: 'confirmationStatuses',
  venue: 'confirmed',
  dates: 'pending',
  openingHours: 'pending',
  admission: 'pending',
  parking: 'pending',
  publicTransport: 'pending',
  accessibility: 'pending',
  photography: 'pending',
  cloakroom: 'pending',
  food: 'pending',
  accommodation: 'pending',
  attractions: 'pending',
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
      'The show venue has changed to the Stellenbosch Flying Club. Travel, parking and ' +
      'accommodation guidance for the new venue has not been worked out yet — the previous ' +
      'guidance was written for a Cape Town city-centre venue and no longer applies.',
    airportRoutes: keyed(VISITOR_INFO_ID, 'route', AIRPORT_ROUTES),

    parking: 'Parking arrangements have not been confirmed for the new venue.',
    publicTransport: 'Public transport options to Stellenbosch Airfield have not been confirmed.',

    accommodationIntro:
      'Accommodation guidance for the Stellenbosch area is still being put together. The ' +
      'previous list was written for a Cape Town city-centre venue and has been removed rather ' +
      'than left to mislead.',
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
    accessibility: 'Accessibility details have not been confirmed for the new venue.',

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
    status: 'pending',
    question: 'How do I get to the show from Cape Town International Airport?',
    answer:
      'The show is at Stellenbosch Flying Club, on the R44 at Stellenbosch Airfield in the Cape ' +
      'Winelands. Public transport options to the venue have not been confirmed. Detailed travel ' +
      'guidance for the venue will be added to the Plan your visit page once it is confirmed.',
  },
  {
    id: 'showFaq-getting-there-2',
    category: 'getting-there',
    order: 2,
    status: 'pending',
    question: 'Is there parking at the venue?',
    answer:
      'Parking arrangements have not been confirmed by the show committee. We will publish rates ' +
      'and directions once the booking is confirmed.',
  },
  {
    id: 'showFaq-getting-there-3',
    category: 'getting-there',
    order: 3,
    status: 'pending',
    question: 'Where exactly is the show being held?',
    answer:
      'At the hangar at Stellenbosch Flying Club, Stellenbosch Airfield, on the R44 in the Cape ' +
      'Winelands. On-site details such as the entrance to use, parking and accessibility are ' +
      'still being worked out and will be published here as they are settled.',
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
      'Accessibility specifics have not been confirmed. We will publish the confirmed detail, ' +
      'including accessible parking and assistance on request, once the committee supplies it.',
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
