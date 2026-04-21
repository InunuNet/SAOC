import type { Metadata } from 'next';

// TODO: Fetch society by slug from Firestore, generateStaticParams for SSG
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function SocietyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-bold">Society: {slug}</h1>
      <p className="mt-4 text-gray-500">[Placeholder — individual society page, design handoff pending]</p>
    </div>
  );
}
