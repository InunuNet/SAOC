import { viewerIsVerifiedAdmin } from '@/lib/admin-viewer';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { NosHero } from '@/components/nos/NosHero';
import { SalesClosedNotice, TicketPurchaseForm } from '@/components/tickets';
import type { TicketTypeCardData } from '@/components/tickets';
import { SpeakersPartnerGate } from '@/components/tickets/SpeakersPartnerGate';
import { TicketBuyCrumbs } from '@/components/tickets/TicketBuyCrumbs';
import { resolveEffectivePrice } from '@/lib/checkout-reservation';
import { fetchTicketTypeBySlug } from '@/lib/data/ticket-type-lookup';
import { getAdmissionSoldOutBySlug } from '@/lib/data/admission-availability';
import { resolveActiveShow } from '@/lib/show-resolution';
import {
  hasSpeakersPartnerAccess,
  SPEAKERS_PARTNER_COOKIE_NAME,
  SPEAKERS_PARTNER_FIXED_QUANTITY,
  SPEAKERS_PARTNER_ROUTE,
  SPEAKERS_PARTNER_SLUG,
} from '@/lib/speakers-partner';
import { isTicketOnSale, qaFixturesAllowed } from '@/lib/ticket-on-sale';
import { isTicketingTestMode } from '@/lib/ticketing-test-mode';
import { nationalShowSalesQuery, activeShowWindowQuery } from '@/sanity/queries';
import { sanityFetch } from '@/sanity/lib/fetch';

// The hidden Speakers Partner ticket. Not linked from anywhere, not in the sitemap, noindex.
// Reads the access cookie per request, so it can never be prerendered.
export const dynamic = 'force-dynamic';

const PAGE_TITLE = 'Speakers Partner Ticket';
const GATE_LEDE = 'Enter the password the committee emailed you to buy this ticket.';
const UNAVAILABLE_MESSAGE = 'This ticket is not available right now.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  robots: { index: false, follow: false, nocache: true },
};

interface SanityShowActivation {
  _id: string;
  active: boolean | null;
}

export default async function SpeakersPartnerPage() {
  const cookieStore = await cookies();
  const hasAccess = hasSpeakersPartnerAccess(
    cookieStore.get(SPEAKERS_PARTNER_COOKIE_NAME)?.value,
    process.env,
    new Date()
  );
  const crumbs = <TicketBuyCrumbs name={PAGE_TITLE} />;

  if (!hasAccess) {
    return (
      <>
        <NosHero route={SPEAKERS_PARTNER_ROUTE} title={PAGE_TITLE} lede={GATE_LEDE} crumbs={crumbs} />
        <div data-nos-wrap data-ticket-body className="pb-12 pt-10 md:pt-16">
          <SpeakersPartnerGate />
        </div>
      </>
    );
  }

  const [ticketType, salesState, allShows] = await Promise.all([
    fetchTicketTypeBySlug(SPEAKERS_PARTNER_SLUG),
    sanityFetch<{ salesOpen?: boolean | null }>({
      query: nationalShowSalesQuery,
      tags: ['nationalShow', 'sanity'],
      live: true,
    }),
    sanityFetch<SanityShowActivation[]>({
      query: activeShowWindowQuery,
      tags: ['show', 'sanity'],
      live: true,
    }),
  ]);
  if (!ticketType) notFound();

  const activeShowId = resolveActiveShow(allShows ?? []);
  const salesOpen = salesState?.salesOpen === true;
  const soldOutBySlug = salesOpen
    ? await getAdmissionSoldOutBySlug([ticketType], activeShowId, { live: true })
    : {};
  const soldOut = soldOutBySlug[ticketType.slug] === true;
  const purchasable = isTicketOnSale({
    doc: ticketType,
    activeShowId,
    salesOpen,
    soldOut,
    now: new Date(),
    qaFixturesAllowed: qaFixturesAllowed(process.env, !isTicketingTestMode()),
  }).onSale;

  const price =
    resolveEffectivePrice({
      price: ticketType.price,
      regularPrice: ticketType.regularPrice ?? null,
      earlyBirdCutoff: ticketType.earlyBirdCutoff ?? null,
      now: new Date(),
    }) ?? ticketType.price;
  const cardData: TicketTypeCardData = {
    slug: ticketType.slug,
    name: ticketType.name,
    price,
    regularPrice: null,
    description: ticketType.description,
    soldOut,
    provisional: false,
    requiresDaySelection: false,
    requiresRegistration: ticketType.requiresRegistration === true,
  };

  return (
    <>
      <NosHero
        route={SPEAKERS_PARTNER_ROUTE}
        title={ticketType.name}
        lede={ticketType.description}
        crumbs={crumbs}
      />
      <div data-nos-wrap data-ticket-body className="pb-12 pt-10 md:pt-16">
        <div className="lg:max-w-4xl">
          {purchasable ? (
            <TicketPurchaseForm
              ticketTypes={[cardData]}
              showDays={[]}
              initialQuantity={SPEAKERS_PARTNER_FIXED_QUANTITY}
              fixedQuantity
              showTestModeBanner={await viewerIsVerifiedAdmin()}
            />
          ) : (
            <SalesClosedNotice message={UNAVAILABLE_MESSAGE} />
          )}
        </div>
      </div>
    </>
  );
}
