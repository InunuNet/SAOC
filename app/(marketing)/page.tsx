import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Home' };

// TODO: Design handoff pending — implement hero, intro sections, featured show, societies CTA
export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">South African Orchid Council</h1>
      <p className="mt-4 text-gray-500">
        [Placeholder — design handoff pending]
      </p>
    </div>
  );
}
