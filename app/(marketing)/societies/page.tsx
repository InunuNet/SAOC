import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Affiliated Societies' };

// TODO: Fetch societies from Firestore (server component, admin SDK), render grid
// Data shape: see Society type in types/index.ts
export default function SocietiesPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">Affiliated Societies</h1>
      <p className="mt-4 text-gray-500">[Placeholder — 21 societies, design handoff pending]</p>
    </div>
  );
}
