// F2 (ticketing-flow-redesign, M2) — explicit per-slug map of real orchid photos for
// TicketTypeCard, replacing the old placeholder icon. See
// contracts/golden/ticketing-flow-redesign-f2/README.md §4 for why this is an explicit
// map (not a slug hash) and why it reuses only the five existing site-wide images —
// no new assets, per this repo's CLAUDE.md "no invented brand assets".
export const TICKET_TYPE_ORCHID_IMAGE: Record<string, string> = {
  'early-bird': '/images/orchid-pink.jpg',
  'day-visitor': '/images/orchid-yellow.jpg',
  'weekend-pass': '/images/orchid-purple.jpg',
  vip: '/images/orchid-violet.jpg',
};

export const DEFAULT_ORCHID_IMAGE = '/images/orchid-dark.jpg';

export function getOrchidImageForTicketType(slug: string): string {
  return TICKET_TYPE_ORCHID_IMAGE[slug] ?? DEFAULT_ORCHID_IMAGE;
}
