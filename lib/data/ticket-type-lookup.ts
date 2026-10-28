import { isDemoTicketTypeDoc } from '@/lib/demo-ticket-type';
import { isTicketingTestMode } from '@/lib/ticketing-test-mode';
import { qaFixturesAllowed } from '@/lib/ticket-on-sale';
import { sanityFetch } from '@/sanity/lib/fetch';
import { ticketTypeBySlugQuery } from '@/sanity/queries';

export interface SanityTicketType {
  _id: string;
  name: string;
  slug: string;
  demo?: boolean | null;
  active?: boolean | null;
  show?: { _ref: string } | null;
  price: number;
  regularPrice?: number | null;
  description: string;
  capacity: number;
  releasedQuantity?: number | null;
  earlyBirdCutoff?: string | null;
  provisional?: boolean | null;
  requiresDaySelection?: boolean | null;
  category?: string | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
  excludedDays?: string[] | null;
}

// A demo / QA-fixture product is for local QA only: on any production build (which includes the
// beta wall) or once payments are live it is a 404, exactly like a slug that does not exist.
// Read per request, never at module load.
export function isHiddenDemoProduct(ticketType: SanityTicketType): boolean {
  return (
    isDemoTicketTypeDoc(ticketType) &&
    !qaFixturesAllowed(process.env, !isTicketingTestMode())
  );
}

export function fetchTicketTypeBySlug(slug: string): Promise<SanityTicketType | null> {
  return sanityFetch<SanityTicketType | null>({
    query: ticketTypeBySlugQuery,
    params: { slug },
    tags: ['ticketType', 'sanity'],
    live: true,
  });
}
