import { resolveReplyTo } from '@/lib/email';
import { formatShowDateRange, formatVenueAddress } from '@/lib/show-identity';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import type { TicketPdfTime, TicketPdfVisit } from '@/lib/ticket-pdf';
import type { ConfirmationBlock, ShowVenue, ShowVisitorInfo } from '@/types';

/**
 * ticket-pdf (D7) — assembles the public visit information printed on the ticket from the same
 * Sanity documents the visitor pages read. A value is only used when the editors have marked its
 * block `confirmed`; anything else is null and renders as the "To be confirmed" pill. Nothing is
 * invented, and a loader failure yields an all-null visit rather than blocking the ticket.
 */

const ORGANISER = 'South African Orchid Council';
const SHOW_URL = 'saoc.co.za/national-show';

interface NationalShowVenueDoc {
  showDate?: string | null;
  showEndDate?: string | null;
  venue?: ShowVenue | null;
}

const EMPTY_VISIT: TicketPdfVisit = {
  pendingLabel: null,
  venueName: null,
  venueAddress: null,
  venueParking: null,
  showDates: null,
  showUrl: SHOW_URL,
  emergency: [],
  onSiteContact: null,
  organiser: ORGANISER,
  showOffice: null,
  questionsEmail: null,
  openingTimes: null,
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildTicketPdfVisit(
  show: NationalShowVenueDoc | null,
  info: ShowVisitorInfo | null
): TicketPdfVisit {
  const status = info?.confirmations ?? {};
  const confirmed = (block: ConfirmationBlock) => status[block] === 'confirmed';

  const openingTimes: TicketPdfTime[] | null = confirmed('openingHours')
    ? (info?.openingHours ?? []).map((entry) => ({
        label: clean(entry.label) ?? '',
        value: clean(entry.hours),
      }))
    : null;

  return {
    ...EMPTY_VISIT,
    pendingLabel: clean(info?.pendingLabel),
    venueName: confirmed('venue') ? clean(show?.venue?.name) : null,
    venueAddress: confirmed('venue') ? formatVenueAddress(show?.venue) : null,
    venueParking: confirmed('parking') ? clean(info?.parking) : null,
    showDates: confirmed('dates') ? formatShowDateRange(show?.showDate, show?.showEndDate) : null,
    emergency: confirmed('emergencyContacts')
      ? (info?.emergencyContacts ?? []).flatMap((contact) => {
          const number = clean(contact.number);
          const label = clean(contact.label);
          return number && label ? [{ number, label }] : [];
        })
      : [],
    questionsEmail: resolveReplyTo(),
    openingTimes,
  };
}

export async function loadTicketPdfVisit(): Promise<TicketPdfVisit> {
  try {
    const [show, info] = await Promise.all([
      sanityFetch<NationalShowVenueDoc>({
        query: nationalShowVenueQuery,
        tags: ['nationalShow', 'sanity'],
      }),
      sanityFetch<ShowVisitorInfo>({ query: showVisitorInfoQuery, tags: ['showVisitorInfo', 'sanity'] }),
    ]);
    return buildTicketPdfVisit(show, info);
  } catch (error) {
    console.error('[ticket-pdf] visit info load failed — rendering with pills', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return { ...EMPTY_VISIT, questionsEmail: resolveReplyTo() };
  }
}
