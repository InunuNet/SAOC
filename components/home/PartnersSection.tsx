import type { SanityImageSource } from '@sanity/image-url';

export interface SanityPartner {
  _id: string;
  name: string;
  tier: string | null;
  logo: SanityImageSource | null;
  website: string | null;
  description: string | null;
}

export interface PartnersSectionProps {
  partners?: SanityPartner[] | null;
}

export function PartnersSection({ partners }: PartnersSectionProps) {
  const list = partners ?? [];

  return (
    <section className="py-16 px-8 md:px-16 bg-parchment border-t border-rule">
      <div className="max-w-[1280px] mx-auto text-center">
        <div className="mb-10 flex justify-center"><span className="eyebrow">Our partners</span></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-center justify-items-center">
          {list.map((p) => (
            <span key={p._id} className="font-serif text-[18px] text-ink text-center leading-snug">
              {p.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
