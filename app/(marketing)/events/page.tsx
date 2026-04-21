import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Events' };

// TODO: Fetch events from Firestore ordered by startDate, render calendar/list — design handoff pending
export default function EventsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">Events</h1>
      <p className="mt-4 text-gray-500">[Placeholder — design handoff pending]</p>
    </div>
  );
}
