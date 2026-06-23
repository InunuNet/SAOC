import Image from 'next/image';
import type { SanityImageSource } from '@sanity/image-url';

import { urlFor } from '@/sanity/lib/image';

export interface SanitySponsor {
  _id: string;
  name: string;
  tier: string | null;
  logo: SanityImageSource | null;
  website: string | null;
  description: string | null;
}

export interface SponsorGridProps {
  sponsors: SanitySponsor[];
}

const TIER_ORDER = ['Title', 'Gold', 'Silver', 'Supporting'] as const;

export function SponsorGrid({ sponsors }: SponsorGridProps) {
  if (sponsors.length === 0) return null;

  const grouped = sponsors.reduce<Record<string, SanitySponsor[]>>((acc, s) => {
    const key =
      s.tier && TIER_ORDER.includes(s.tier as (typeof TIER_ORDER)[number]) ? s.tier : 'Other';
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const orderedTiers = [...TIER_ORDER, 'Other'].filter((t) => grouped[t]?.length);

  return (
    <div className="space-y-12">
      {orderedTiers.map((tier) => (
        <section key={tier}>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            {tier === 'Other' ? 'Sponsors' : `${tier} sponsors`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {grouped[tier].map((sponsor) => (
              <div
                key={sponsor._id}
                className="border border-rule bg-parchment p-6 flex flex-col"
              >
                {sponsor.logo ? (
                  <Image
                    src={urlFor(sponsor.logo).width(200).url()}
                    alt={`${sponsor.name} logo`}
                    width={200}
                    height={100}
                    className="h-16 w-auto object-contain"
                  />
                ) : null}
                <h3 className="font-serif text-[20px] font-semibold leading-snug text-ink mt-4">
                  {sponsor.name}
                </h3>
                {sponsor.description ? (
                  <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/70">
                    {sponsor.description}
                  </p>
                ) : null}
                {sponsor.website ? (
                  <a
                    href={sponsor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block font-sans text-[13px] text-ink underline underline-offset-2"
                  >
                    Visit website →
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
