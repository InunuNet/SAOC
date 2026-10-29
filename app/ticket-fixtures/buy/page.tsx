import { notFound } from 'next/navigation';

import { NosThemeScope } from '@/components/nos/NosThemeScope';
import '@/components/nos-chrome/nos-chrome.css';
import { TicketPurchaseForm } from '@/components/tickets/TicketPurchaseForm';
import { isHostedRuntime } from '@/lib/fixture-route-guard';

// Render-check fixture: the real purchase form over one static ticket type, so its layout can be
// verified without an on-sale ticket in the dataset. There is no auth bypass here; the flag only
// exposes this static page. nos-chrome.css supplies --nc-gutter (the NOS layout loads it on the real
// route), so the fixture has the same page gutter. The flag is never set in apphosting.yaml or any deploy
// file, and the route also 404s on the hosted runtime (lib/fixture-route-guard.ts), so it cannot render
// on the deployed site even if the flag were set there. The <main> stands in for the NOS layout's
// <main id="main-content">, so the form sits inside a landmark as it does on /tickets/<slug>.
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

// ?type=day swaps in a day-selection product (two show days, no default day) so the checkout's
// day-required alert can be exercised beside the attendee fields.
const FIXTURE_DAY_TICKET_TYPES = [
  { ...FIXTURE_TICKET_TYPES[0], slug: 'fixture-day-ticket', name: 'Fixture day ticket', requiresDaySelection: true },
];
const FIXTURE_SHOW_DAYS = ['2027-03-12', '2027-03-13'];

export default async function TicketBuyFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  if (isHostedRuntime() || process.env.TICKET_FIXTURES !== '1') notFound();
  const { type } = await searchParams;
  const dayProduct = type === 'day';
  return (
    <NosThemeScope>
      <main>
        <div data-nos-wrap className="py-12">
          <div className="max-w-[560px]">
            <TicketPurchaseForm
              ticketTypes={dayProduct ? FIXTURE_DAY_TICKET_TYPES : FIXTURE_TICKET_TYPES}
              showDays={dayProduct ? FIXTURE_SHOW_DAYS : []}
            />
          </div>
        </div>
      </main>
    </NosThemeScope>
  );
}
