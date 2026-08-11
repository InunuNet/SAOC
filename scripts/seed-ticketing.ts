/**
 * F1 (ticketing-pages) — Seed the five council ticket categories, the ticketsPage
 * copy singleton, and patch nationalShow with a CLOSED sales gate.
 *
 * Deliberately separate from scripts/seed-page-singletons.ts, which is known-hazardous
 * (it force-replaces documents with hardcoded literals — re-running it silently reverts
 * editor changes). This script is additive and non-destructive on purpose:
 *   - ticketType docs and the ticketsPage singleton use createIfNotExists, keyed on a
 *     deterministic _id, so a second run (or an editor's changes) is always safe.
 *   - nationalShow.salesOpen is patched with setIfMissing — writes the field only when
 *     it's absent, so it can never revert an editor's other nationalShow fields, and
 *     can never flip salesOpen back to false after someone has deliberately opened
 *     sales for the demo.
 *
 * Real prices have never been confirmed by the council — every seeded ticketType is
 * visibly marked "Provisional price — pending council confirmation." in its
 * description. See contracts/golden/ticketing-m1-m2/seed-ticketing.golden.json.
 *
 * Required env (read directly from .env.local, NOT via the `dotenv` package — see
 * scripts/seed-page-singletons.ts header for why):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-ticketing.ts
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

// Pinned singleton _id convention (matches sanity/structure.ts / seed-page-singletons.ts):
// the document's own _id equals its schema type name.
const NATIONAL_SHOW_ID = 'nationalShow';

// ---------------------------------------------------------------------------
// Ticket types — the council's real five categories, placeholder pricing/capacity.
// Each description is its own literal "Provisional price — pending council
// confirmation." string (not a shared constant) so the provisional marking is
// visibly, individually present on every one of the five seeded documents.
// ---------------------------------------------------------------------------

interface SeedTicketType {
  slug: string;
  name: string;
  price: number;
  description: string;
  capacity: number;
  order: number;
}

const TICKET_TYPES: SeedTicketType[] = [
  {
    slug: 'adult',
    name: 'Adult',
    price: 150,
    description: 'Provisional price — pending council confirmation.',
    capacity: 300,
    order: 1,
  },
  {
    slug: 'pensioner',
    name: 'Pensioner',
    price: 100,
    description: 'Provisional price — pending council confirmation.',
    capacity: 100,
    order: 2,
  },
  {
    slug: 'child',
    name: 'Child',
    price: 50,
    description: 'Provisional price — pending council confirmation.',
    capacity: 100,
    order: 3,
  },
  {
    slug: 'saoc-member',
    name: 'SAOC Member',
    price: 100,
    description: 'Provisional price — pending council confirmation.',
    capacity: 150,
    order: 4,
  },
  {
    slug: 'exhibitor',
    name: 'Exhibitor',
    price: 0,
    description: 'Provisional price — pending council confirmation.',
    capacity: 50,
    order: 5,
  },
];

async function seedTicketTypes(): Promise<void> {
  console.log('  ticketType documents:');
  for (const t of TICKET_TYPES) {
    await client.createIfNotExists({
      _id: `ticketType-${t.slug}`,
      _type: 'ticketType',
      name: t.name,
      slug: { _type: 'slug', current: t.slug },
      price: t.price,
      description: t.description,
      capacity: t.capacity,
      active: true,
      order: t.order,
    });
    console.log(`    ${t.slug} (createIfNotExists)`);
  }
}

async function seedTicketsPage(): Promise<void> {
  console.log('  ticketsPage:');
  await client.createIfNotExists({
    _id: 'ticketsPage',
    _type: 'ticketsPage',
    title: 'Get Your Tickets',
    intro:
      "Secure your seat at the SAOC National Show — South Africa's premier orchid " +
      'exhibition, bringing together growers, judges and orchid lovers from across the ' +
      'country.',
    buyButtonLabel: 'Buy Ticket',
    soldOutMessage: 'Sold out',
    salesClosedMessage: 'Tickets for the 2027 National Show are not yet on sale — check back soon.',
    termsNote:
      'Tickets are non-refundable but may be transferred to another attendee by emailing ' +
      'info@saoc.co.za before the show. Please bring your booking reference to the door.',
    confirmationPendingHeading: 'Confirming your payment',
    confirmationPendingMessage:
      "We're still waiting for payment confirmation from PayFast. This usually takes a " +
      "few seconds — please don't refresh or submit payment again. This page will update " +
      'automatically.',
    confirmationSuccessHeading: "You're booked in",
    confirmationSuccessMessage:
      'Thank you — your payment is confirmed and your spot at the SAOC National Show is ' +
      'secured.',
    confirmationNotFoundMessage:
      "We couldn't find a booking for that reference. If you've just paid, check the " +
      'confirmation link or contact info@saoc.co.za.',
    ticketIncludesNote:
      'Your ticket includes full-day entry to the National Show floor, access to the ' +
      'judging galleries, and entry to all exhibitor stages.',
    cancelledHeading: 'Payment cancelled',
    cancelledMessage:
      'No payment was taken. Your reservation has been left open — you\'re welcome to try ' +
      'again whenever you\'re ready.',
    cancelledButtonLabel: 'Back to tickets',
  });
  console.log('    seeded (createIfNotExists)');
}

async function patchNationalShowSalesOpen(): Promise<void> {
  console.log('  nationalShow.salesOpen:');
  await client.patch(NATIONAL_SHOW_ID).setIfMissing({ salesOpen: false }).commit({
    autoGenerateArrayKeys: false,
  });
  console.log('    patched with setIfMissing (never overwrites an editor-set value)');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Seeding ticketing content in Sanity dataset "${dataset}" (project ${projectId})`);
  await seedTicketTypes();
  await seedTicketsPage();
  await patchNationalShowSalesOpen();
  console.log('Seed complete.');
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
