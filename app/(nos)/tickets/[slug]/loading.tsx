import { NosHero } from '@/components/nos/NosHero';
import { TicketBuyCrumbs } from '@/components/tickets/TicketBuyCrumbs';

// nos-loader-h1: the ticket's name is only known once it has loaded, so the h1 is a one-line
// non-breaking-space box (no guessed name) under the page's own two static crumbs; the name and
// the third crumb arrive with the page.
// TL-1: the lede is not known either, so it reserves two lede lines (1lh boxes) with a 0.55lh bar
// in each, 100% and 70% wide, in the lede's own colour at 15%. No text, no pulse.
const LEDE_BARS = (
  <>
    <span aria-hidden="true" className="flex h-[1lh] items-center">
      <span className="block h-[0.55lh] w-full rounded-[2px] bg-current/15" />
    </span>
    <span aria-hidden="true" className="flex h-[1lh] items-center">
      <span className="block h-[0.55lh] w-[70%] rounded-[2px] bg-current/15" />
    </span>
  </>
);

export default function Loading() {
  return (
    <NosHero
      route="/tickets"
      title={' '}
      titleAs="p"
      crumbs={<TicketBuyCrumbs />}
      lede={LEDE_BARS}
    />
  );
}
