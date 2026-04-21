import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'National Show Archive' };

// TODO: Fetch all NationalShow docs from Firestore ordered by year desc, render index — design handoff pending
export default function ShowArchivePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">National Show Archive</h1>
      <p className="mt-4 text-gray-500">[Placeholder — design handoff pending]</p>
    </div>
  );
}
