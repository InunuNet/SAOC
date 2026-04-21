import type { Metadata } from 'next';

// TODO: Fetch NationalShow by year from Firestore, generateStaticParams, render results + gallery
export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return { title: `National Show ${year}` };
}

export default async function ShowYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">National Orchid Show {year}</h1>
      <p className="mt-4 text-gray-500">[Placeholder — design handoff pending]</p>
    </div>
  );
}
