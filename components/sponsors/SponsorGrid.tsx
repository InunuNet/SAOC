import Image from 'next/image';
import type { SanityImageSource } from '@sanity/image-url';

import { urlFor } from '@/sanity/lib/image';
import { ArrowIcon } from '@/components/ui/ArrowIcon';

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
          <h2 className="doc-h2">{tier === 'Other' ? 'Sponsors' : `${tier} sponsors`}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                <h3 className="font-serif font-normal text-[20px] leading-snug text-ink mt-4">
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
                    className="mt-3 inline-flex min-h-6 items-center font-sans text-[13px] text-ink underline underline-offset-2 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
                  >
                    Visit website<ArrowIcon />
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
