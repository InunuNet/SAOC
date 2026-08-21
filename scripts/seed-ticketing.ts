/**
 * F1 (ticketing-pages) — Seed the ticketsPage copy singleton and patch nationalShow with a
 * CLOSED sales gate. F4 (multi-line-item-cart, M2) — seed the five REAL council admission
 * products from lib/provisional-figures.ts (the single source of truth for every price/
 * capacity/releasedQuantity/earlyBirdCutoff number — this script carries no copy of its own,
 * see contracts/golden/ticketing-f4-admission-products/README.md), and retire the five OLD
 * placeholder ticket types (adult/pensioner/child/saoc-member/exhibitor) by setting
 * `active: false` — never deleted, the pre-production dataset may still be referenced by slug
 * in a demo/QA pass.
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
 * Every seeded ticketType carries `provisional: true` — machine-readable, gating the public
 * /tickets page's visible "provisional" marker (see
 * contracts/golden/ticketing-f4-admission-products/README.md). `description` is permanent,
 * factual copy from lib/provisional-figures.ts (what the ticket covers) — it never carries
 * provisional-pricing messaging itself; that comes ONLY from the provisional-flag-gated badge,
 * so the two never fall out of sync when a product's provisional flag flips independently.
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

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
  type ProvisionalAdmissionProduct,
} from '../lib/provisional-figures';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local (see file header). Read only from inside
// main() (via createSanityClient()), never at module scope — importing this module
// (e.g. for testing buildTicketTypeDoc) must never read env or construct a client.
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

function createSanityClient(): SanityClient {
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

  return createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    token,
    useCdn: false,
  });
}

// Pinned singleton _id convention (matches sanity/structure.ts / seed-page-singletons.ts):
// the document's own _id equals its schema type name.
const NATIONAL_SHOW_ID = 'nationalShow';

// ---------------------------------------------------------------------------
// Ticket types — F4 (multi-line-item-cart, M2): the five REAL council admission
// products, imported from lib/provisional-figures.ts (the single source of truth for
// every price/capacity/releasedQuantity/earlyBirdCutoff number — see
// contracts/golden/ticketing-f4-admission-products/README.md). The five OLD placeholder
// categories below are retired (active: false), never deleted.
// ---------------------------------------------------------------------------

/** The five OLD placeholder ticket categories (F1, pre-council-spec) — retired, not deleted. */
const OLD_PLACEHOLDER_SLUGS = ['adult', 'pensioner', 'child', 'saoc-member', 'exhibitor'];

/**
 * Builds the ticketType document object for one product — pure, no env/network access, so it
 * can be safely imported and exercised in isolation (see
 * contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs). `index` sets the
 * `order` field (1-based, matching the original inline literal's `index + 1`).
 */
export function buildTicketTypeDoc(
  product: ProvisionalAdmissionProduct,
  index: number,
  showId: string,
): Record<string, unknown> & { _id: string; _type: string } {
  return {
    _id: `ticketType-${product.slug}`,
    _type: 'ticketType',
    name: product.name,
    slug: { _type: 'slug', current: product.slug },
    price: product.price,
    description: product.description,
    capacity: product.capacity,
    active: true,
    order: index + 1,
    show: { _type: 'reference', _ref: showId },
    provisional: product.provisional,
    earlyBirdCutoff: product.earlyBirdCutoff,
    releasedQuantity: product.releasedQuantity,
    requiresDaySelection: product.requiresDaySelection,
    requiresAttendeeNames: product.requiresAttendeeNames,
    category: product.category,
    capacityPool: product.capacityPool ?? null,
    headcountPerUnit: product.headcountPerUnit ?? null,
  };
}

async function fetchActiveShowId(client: SanityClient): Promise<string> {
  const activeShow = await client.fetch<{ _id: string } | null>(
    `*[_type == "show" && active == true][0]{ _id }`
  );
  if (!activeShow) {
    throw new Error('No active `show` document found — cannot seed ticketType.show reference.');
  }
  return activeShow._id;
}

async function seedTicketTypes(client: SanityClient, showId: string): Promise<void> {
  console.log('  ticketType documents (new, from lib/provisional-figures.ts):');
  const allProducts = [
    ...ADMISSION_PRODUCTS,
    ...CONFERENCE_PRODUCTS,
    ...WORKSHOP_FIELD_TRIP_PRODUCTS,
  ];
  for (const [index, product] of allProducts.entries()) {
    await client.createIfNotExists(buildTicketTypeDoc(product, index, showId));
    console.log(`    ${product.slug} (createIfNotExists)`);
  }

  console.log('  ticketType documents (old placeholders, retired):');
  for (const slug of OLD_PLACEHOLDER_SLUGS) {
    const docId = `ticketType-${slug}`;
    const exists = await client.fetch<boolean>(`defined(*[_id == $docId][0]._id)`, { docId });
    if (!exists) {
      console.log(`    ${slug} (no document — nothing to retire)`);
      continue;
    }
    await client.patch(docId).set({ active: false }).commit({ autoGenerateArrayKeys: false });
    console.log(`    ${slug} -> active: false`);
  }
}

async function seedTicketsPage(client: SanityClient): Promise<void> {
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

async function patchNationalShowSalesOpen(client: SanityClient): Promise<void> {
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
  const client = createSanityClient();
  console.log(`Seeding ticketing content in Sanity dataset "${client.config().dataset}" ` +
    `(project ${client.config().projectId})`);
  const showId = await fetchActiveShowId(client);
  await seedTicketTypes(client, showId);
  await seedTicketsPage(client);
  await patchNationalShowSalesOpen(client);
  console.log('Seed complete.');
}

// Guard against module-scope side effects: importing this file (e.g. to test
// buildTicketTypeDoc in isolation) must never trigger a live seed run — only direct
// execution (`tsx scripts/seed-ticketing.ts` / `node --import tsx/esm scripts/seed-ticketing.ts`)
// does.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
