import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About SAOC' };

// TODO: Design handoff pending — implement origin story (est. 1968), mission, committee, WOSA partnership note
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">About the South African Orchid Council</h1>
      <p className="mt-4 text-gray-500">[Placeholder — design handoff pending]</p>
    </div>
  );
}
