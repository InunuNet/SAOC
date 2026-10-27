import { NosHero } from '@/components/nos/NosHero';
import { TicketBuyCrumbs } from '@/components/tickets/TicketBuyCrumbs';

// nos-loader-h1: the ticket's name is only known once it has loaded, so the h1 is a one-line
// non-breaking-space box (no guessed name) under the page's own two static crumbs; the name and
// the third crumb arrive with the page.
export default function Loading() {
  return (
    <NosHero route="/tickets" title={'\u00a0'} titleAs="p" crumbs={<TicketBuyCrumbs />} />
  );
}
