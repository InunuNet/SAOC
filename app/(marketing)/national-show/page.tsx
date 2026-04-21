import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'National Orchid Show' };

// TODO: Show overview, history, links to upcoming + archive — design handoff pending
export default function NationalShowPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">National Orchid Show</h1>
      <p className="mt-4 text-gray-500">[Placeholder — design handoff pending]</p>
    </div>
  );
}
