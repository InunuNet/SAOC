import { notFound } from 'next/navigation';

import { SubmitEventPageBody } from '@/components/events/SubmitEventPageBody';

// Render-check fixture: the real page body over static societies, so layout can be verified
// without an authenticated session. There is no auth bypass here; the flag only exposes this
// static page. The flag is never set in apphosting.yaml or any deploy file.
export const dynamic = 'force-dynamic';

const FIXTURE_SOCIETIES = [
  { id: 'soc-7f3a2c', name: 'Fixture Orchid Society A' },
  { id: 'soc-1b9e44', name: 'Fixture Orchid Society B' },
  { id: 'soc-c05d18', name: 'Fixture Orchid Society C' },
];

export default function EventSubmitFixturePage() {
  if (process.env.EVENT_SUBMIT_FIXTURES !== '1') notFound();
  return (
    <main>
      <SubmitEventPageBody societies={FIXTURE_SOCIETIES} />
    </main>
  );
}
