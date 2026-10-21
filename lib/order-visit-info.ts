import type { OrderConfirmationVisit } from '@/emails/OrderConfirmation';
import { formatShowDateRange, formatVenueAddress } from '@/lib/show-identity';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import type { ConfirmationBlock, ShowVenue, ShowVisitorInfo } from '@/types';

/**
 * The visit details printed in the order confirmation email (mission email-shell). Same Sanity
 * documents and the same rule as the ticket PDF's loader: a value is used only when the editors
 * have marked its block `confirmed`; anything else is null and renders as the "To be confirmed"
 * pill. Nothing is invented, and a loader failure yields an all-null visit rather than blocking
 * the email.
 */

interface NationalShowVenueDoc {
  showDate?: string | null;
  showEndDate?: string | null;
  venue?: ShowVenue | null;
}

export const EMPTY_ORDER_VISIT: OrderConfirmationVisit = {
  pendingLabel: null,
  venueName: null,
  venueAddress: null,
  showDates: null,
  openingTimes: null,
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildOrderVisit(
  show: NationalShowVenueDoc | null,
  info: ShowVisitorInfo | null
): OrderConfirmationVisit {
  const status = info?.confirmations ?? {};
  const confirmed = (block: ConfirmationBlock) => status[block] === 'confirmed';

  return {
    pendingLabel: clean(info?.pendingLabel),
    venueName: confirmed('venue') ? clean(show?.venue?.name) : null,
    venueAddress: confirmed('venue') ? formatVenueAddress(show?.venue) : null,
    showDates: confirmed('dates') ? formatShowDateRange(show?.showDate, show?.showEndDate) : null,
    openingTimes: confirmed('openingHours')
      ? (info?.openingHours ?? []).map((entry) => ({
          label: clean(entry.label) ?? '',
          value: clean(entry.hours),
        }))
      : null,
  };
}

export async function loadOrderVisit(): Promise<OrderConfirmationVisit> {
  try {
    const [show, info] = await Promise.all([
      sanityFetch<NationalShowVenueDoc>({
        query: nationalShowVenueQuery,
        tags: ['nationalShow', 'sanity'],
      }),
      sanityFetch<ShowVisitorInfo>({ query: showVisitorInfoQuery, tags: ['showVisitorInfo', 'sanity'] }),
    ]);
    return buildOrderVisit(show, info);
  } catch (error) {
    console.error('[order-confirmation] visit info load failed — rendering with pills', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return EMPTY_ORDER_VISIT;
  }
}
