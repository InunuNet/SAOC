import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contact' };

// TODO: Wire up ContactForm client component to /api/contact route — design handoff pending
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">Contact SAOC</h1>
      <p className="mt-4 text-gray-500">[Placeholder — contact form, design handoff pending]</p>
    </div>
  );
}
