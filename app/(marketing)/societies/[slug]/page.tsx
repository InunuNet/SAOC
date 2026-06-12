import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHero } from '@/components/ui/PageHero';
import { sanityFetch } from '@/sanity/lib/fetch';
import { societyBySlugQuery, societySlugsQuery } from '@/sanity/queries';
import type { SanitySociety } from '@/components/societies';
import { societies as staticSocieties } from '@/lib/data/societies';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await sanityFetch<{ slug: string }[]>({
    query: societySlugsQuery,
    tags: ['society', 'sanity'],
  });
  if (slugs && slugs.length > 0) {
    return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
  }
  // Build-time fallback so SSG works with no Sanity connection.
  return staticSocieties.map((s) => ({ slug: s.slug ?? slugify(s.name) }));
}

async function getSociety(slug: string): Promise<SanitySociety | null> {
  const doc = await sanityFetch<SanitySociety>({
    query: societyBySlugQuery,
    params: { slug },
    tags: ['society', slug, 'sanity'],
  });
  if (doc) return doc;

  // Static fallback by synthesised slug.
  const match = staticSocieties.find((s) => (s.slug ?? slugify(s.name)) === slug);
  if (!match) return null;
  return {
    _id: `static-${slug}`,
    name: match.name,
    slug,
    province: match.province ?? null,
    region: match.region ?? null,
    founded: match.founded ?? null,
    meets: match.meet ?? null,
    venue: match.venue ?? null,
    memberCount: match.members ?? null,
    description: null,
    logo: null,
    website: match.websiteUrl ?? null,
    markBadge: null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const society = await getSociety(slug);
  if (!society) return { title: 'Society not found' };
  return {
    title: society.name,
    description: society.region
      ? `${society.name} — affiliated SAOC society in ${society.region}.`
      : `${society.name} — an affiliated SAOC society.`,
  };
}

export default async function SocietyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const society = await getSociety(slug);
  if (!society) notFound();

  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow={society.province ?? 'SAOC society'}
        heading={society.name}
        lede={society.region ?? undefined}
      />
      <div className="mx-auto max-w-[1280px] space-y-12 px-8 py-16">
        {/* Details grid: Meets / Venue / Founded / Members — each guarded */}
        <dl className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {society.meets ? (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                Meets
              </dt>
              <dd className="mt-1 font-sans text-[15px] text-ink">{society.meets}</dd>
            </div>
          ) : null}
          {society.venue ? (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                Venue
              </dt>
              <dd className="mt-1 font-sans text-[15px] text-ink">{society.venue}</dd>
            </div>
          ) : null}
          {society.founded ? (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                Founded
              </dt>
              <dd className="mt-1 font-sans text-[15px] text-ink">{society.founded}</dd>
            </div>
          ) : null}
          {society.memberCount !== null ? (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                Members
              </dt>
              <dd className="mt-1 font-sans text-[15px] text-ink">{society.memberCount}</dd>
            </div>
          ) : null}
        </dl>

        {/* Description prose — only when present */}
        {society.description ? (
          <p className="max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
            {society.description}
          </p>
        ) : null}

        {/* Website CTA — only when present */}
        {society.website ? (
          <a
            href={society.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-ink underline underline-offset-2"
          >
            Visit society website →
          </a>
        ) : null}

        <Link
          href="/societies"
          className="block font-mono text-[12px] uppercase tracking-[0.18em] text-muted"
        >
          ← All societies
        </Link>
      </div>
    </>
  );
}
