import { formatShowDateRange } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';

export interface ShowMeta {
  /** Venue and dates, joined; null when neither is set. */
  lead: string | null;
  /** Dates only; null when the dates are not set. */
  rail: string | null;
}

/**
 * The mega-menu and menu-panel meta lines, computed exactly as the SAOC
 * MegaMenu does: from the nationalShow Sanity singleton, never authored here.
 */
export function getShowMeta(show?: ShowIdentity | null): ShowMeta {
  const venueName = show?.venue?.name ?? null;
  const dateRange = formatShowDateRange(show?.showDate, show?.showEndDate);
  const lead =
    [venueName, dateRange].filter((part): part is string => Boolean(part)).join(' · ') || null;
  return { lead, rail: dateRange };
}
