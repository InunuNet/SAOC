import { resolveReplyTo } from '@/lib/email';
import { getConfirmedOrderForDisplay } from '@/lib/orders';
import { formatShowDay, formatShowDayShort, showDayStub } from '@/lib/show-day-format';
import { formatShowDateRange, formatVenueAddress } from '@/lib/show-identity';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  nationalShowVenueQuery,
  showVisitorInfoQuery,
  ticketTypeScheduleTraitsQuery,
} from '@/sanity/queries';
import { TICKET_PRODUCTS, productIdForSlug } from '@/lib/data/ticket-presentation';
import { resolveTicketSchedule } from '@/lib/ticket-pdf-schedule';
import type {
  TicketPdfPosition,
  TicketPdfSchedule,
  TicketPdfTime,
  TicketPdfVisit,
} from '@/lib/ticket-pdf';
import type { TicketTypeTraits } from '@/lib/ticket-pdf-schedule';
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

interface TicketTypeTraitsDoc {
  name?: string | null;
  slug?: string | null;
  requiresDaySelection?: boolean | null;
}

/**
 * Ticket-type slug and day-selection flag keyed by slug and by name, because an order position
 * stores whichever the checkout wrote. A loader failure yields an empty map: toPdfPositions then
 * treats the stored ticketType as the slug, and an unmapped one prints the pill.
 */
export async function loadTicketTypeTraits(): Promise<Map<string, TicketTypeTraits>> {
  const traits = new Map<string, TicketTypeTraits>();
  try {
    const docs = await sanityFetch<TicketTypeTraitsDoc[]>({
      query: ticketTypeScheduleTraitsQuery,
      tags: ['ticketType', 'sanity'],
    });
    for (const doc of docs ?? []) {
      if (!doc.slug) continue;
      const entry = { slug: doc.slug, requiresDaySelection: doc.requiresDaySelection };
      traits.set(doc.slug, entry);
      if (doc.name) traits.set(doc.name, entry);
    }
  } catch (error) {
    console.error('[ticket-pdf] ticket type lookup failed — rendering with pills', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
  }
  return traits;
}

/**
 * Per-ticket schedule (D11 rev, resolveTicketSchedule): a buyer-chosen day gives the numeral,
 * weekday and date, with the time from the matching Sanity opening-hours row; an event or pass
 * product prints its own date and meta line from TICKET_PRODUCTS (an event also its stub numeral);
 * anything else is unconfirmed (null), which renders the pill. No date is ever invented.
 */
export function buildPositionSchedule(
  type: TicketTypeTraits,
  chosenDay: string | null | undefined,
  visit: TicketPdfVisit
): TicketPdfSchedule | null {
  const resolved = resolveTicketSchedule(type, chosenDay ?? null);
  if (resolved.kind === 'product') {
    const productId = productIdForSlug(type.slug);
    const product = productId ? TICKET_PRODUCTS[productId] : null;
    return {
      eyebrow: null,
      numeral: product?.kind === 'event' ? product.numeral || null : null,
      dateText: resolved.dateText,
      timeText: resolved.metaText,
    };
  }
  if (resolved.kind === 'chosen-day' && chosenDay) {
    const stub = showDayStub(chosenDay);
    const label = formatShowDayShort(chosenDay);
    const time = visit.openingTimes?.find((entry) => entry.label === label)?.value ?? null;
    return {
      eyebrow: stub?.caption ?? null,
      numeral: stub?.numeral ?? null,
      dateText: resolved.dateText,
      timeText: time,
    };
  }
  return null;
}

type PdfPositionSource = Pick<TicketPdfPosition, 'bookingRef' | 'attendeeName' | 'ticketType'>;

export function toPdfPositions(
  positions: PdfPositionSource[],
  chosenDays: ReadonlyMap<string, string | null>,
  visit: TicketPdfVisit,
  traits: ReadonlyMap<string, TicketTypeTraits>
): TicketPdfPosition[] {
  return positions.map(({ bookingRef, attendeeName, ticketType }) => {
    const type = traits.get(ticketType) ?? { slug: ticketType };
    return {
      bookingRef,
      attendeeName,
      ticketType,
      slug: type.slug,
      schedule: buildPositionSchedule(type, chosenDays.get(bookingRef), visit),
    };
  });
}

/** Email path: the ITN outcome carries no chosenDay, so read it back from the paid order. */
export async function loadChosenDays(
  orderReference: string | null
): Promise<Map<string, string | null>> {
  const days = new Map<string, string | null>();
  if (!orderReference) return days;
  try {
    const order = await getConfirmedOrderForDisplay(orderReference);
    for (const position of order?.positions ?? []) {
      days.set(position.bookingRef, position.chosenDay ?? null);
    }
  } catch (error) {
    console.error('[ticket-pdf] chosen-day lookup failed — rendering without day', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
  }
  return days;
}
