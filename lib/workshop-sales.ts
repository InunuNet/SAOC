// Workshop tickets are not on sale at the 1 Dec 2026 launch (Brad, 19 Nov 2026: "Tickets for the
// workshops is a work in progress and needs to state coming soon"). One switch, read by the
// shared on-sale predicate (checkout, the buy page and the hub), so a workshop ticket can neither
// be offered nor bought until it is flipped to true.
import { WORKSHOPS_PRODUCT_SLUG } from '@/lib/data/ticket-presentation';

export const WORKSHOP_TICKETS_ON_SALE = false;

/** Category value Sanity may carry for a ticket type sold as a workshop. */
const WORKSHOP_CATEGORY = 'workshop';

export interface WorkshopTicketFields {
  slug?: string | null;
  category?: unknown;
  /** True when a workshopSession document links this ticket type (computed in the GROQ query). */
  isWorkshopSession?: unknown;
}

/** A ticket type is a workshop ticket by its product slug, its category or a linked session. */
export function isWorkshopTicketDoc(doc: WorkshopTicketFields): boolean {
  return (
    doc.slug === WORKSHOPS_PRODUCT_SLUG ||
    doc.category === WORKSHOP_CATEGORY ||
    doc.isWorkshopSession === true
  );
}
