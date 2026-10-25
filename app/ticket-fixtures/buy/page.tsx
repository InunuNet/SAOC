import { notFound } from 'next/navigation';

import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { TicketPurchaseForm } from '@/components/tickets/TicketPurchaseForm';

// Render-check fixture: the real purchase form over one static ticket type, so its layout can be
// verified without an on-sale ticket in the dataset. There is no auth bypass here; the flag only
// exposes this static page. The flag is never set in apphosting.yaml or any deploy file.
export const dynamic = 'force-dynamic';

const FIXTURE_TICKET_TYPES = [
  {
    slug: 'fixture-ticket',
    name: 'Fixture ticket',
    price: 100,
    regularPrice: null,
    description: '',
    soldOut: false,
    provisional: false,
    requiresDaySelection: false,
  },
];

export default function TicketBuyFixturePage() {
  if (process.env.TICKET_FIXTURES !== '1') notFound();
  return (
    <NosThemeScope>
      <div data-nos-wrap className="py-12">
        <div className="max-w-[560px]">
          <TicketPurchaseForm ticketTypes={FIXTURE_TICKET_TYPES} showDays={[]} />
        </div>
      </div>
    </NosThemeScope>
  );
}
