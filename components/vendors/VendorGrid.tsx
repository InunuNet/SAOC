import Image from 'next/image';
import type { SanityImageSource } from '@sanity/image-url';

import { urlFor } from '@/sanity/lib/image';

export interface SanityVendorSocialLink {
  platform: string | null;
  url: string | null;
}

export interface SanityVendorNursery {
  _id: string;
  name: string;
  logo: SanityImageSource | null;
  country: string | null;
  owner: string | null;
  history: string | null;
  specialisation: string | null;
  plantsBrought: string | null;
  website: string | null;
  socialMedia: SanityVendorSocialLink[] | null;
  availableAtShow: string[] | null;
}

export interface VendorGridProps {
  nurseries: SanityVendorNursery[];
}

// Mirrors SponsorGrid's own card/link conventions (components/sponsors/SponsorGrid.tsx) —
// no new colour, font, or spacing token introduced. Renders the prop array's own order:
// vendorNurseriesQuery already sorts by name, so this component must not re-sort.
export function VendorGrid({ nurseries }: VendorGridProps) {
  if (nurseries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {nurseries.map((nursery) => (
        <div key={nursery._id} className="border border-rule bg-parchment p-6 flex flex-col">
          {nursery.logo ? (
            <Image
              src={urlFor(nursery.logo).width(200).url()}
              alt={`${nursery.name} logo`}
              width={200}
              height={100}
              className="h-16 w-auto object-contain"
            />
          ) : null}
          <h3 className="font-serif text-[20px] font-semibold leading-snug text-ink mt-4">
            {nursery.name}
          </h3>
          {nursery.country ? (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {nursery.country}
            </p>
          ) : null}
          {nursery.owner ? (
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/70">
              {nursery.owner}
            </p>
          ) : null}
          {nursery.history ? (
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/70">
              {nursery.history}
            </p>
          ) : null}
          {nursery.specialisation ? (
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/70">
              {nursery.specialisation}
            </p>
          ) : null}
          {nursery.plantsBrought ? (
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/70">
              {nursery.plantsBrought}
            </p>
          ) : null}
          {nursery.availableAtShow && nursery.availableAtShow.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {nursery.availableAtShow.map((tag) => (
                <li
                  key={tag}
                  className="border border-rule px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
          {nursery.website ? (
            <a
              href={nursery.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block font-sans text-[13px] text-ink underline underline-offset-2"
            >
              Visit website →
            </a>
          ) : null}
          {nursery.socialMedia && nursery.socialMedia.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-3">
              {nursery.socialMedia.map((social, index) =>
                social.url ? (
                  <a
                    key={`${social.url}-${index}`}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sans text-[13px] text-ink underline underline-offset-2"
                  >
                    {social.platform ?? 'Social'}
                  </a>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
