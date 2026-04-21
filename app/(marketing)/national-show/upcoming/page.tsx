import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Upcoming National Show' };

// TODO: Fetch next NationalShow from Firestore (startDate > now), render landing — design handoff pending
// Currently TBC scaffold — date/venue not yet confirmed
export default function UpcomingShowPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">Upcoming National Orchid Show</h1>
      <p className="mt-4 text-gray-500">
        Details for the next National Show will be announced shortly. [Placeholder — design handoff pending]
      </p>
    </div>
  );
}
