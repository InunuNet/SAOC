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

const STATIC_PARTNERS = [
  { _id: 'wosa', name: 'Wild Orchids of Southern Africa', website: null },
  { _id: 'sanbi', name: 'South African National Biodiversity Institute', website: null },
  { _id: 'kirstenbosch', name: 'Kirstenbosch NBG', website: null },
  { _id: 'aos', name: 'American Orchid Society', website: null },
  { _id: 'rhs', name: 'Royal Horticultural Society', website: null },
  { _id: 'woc', name: 'World Orchid Conference', website: null },
];

export function PartnersSection({ partners }: PartnersSectionProps) {
  const list = (partners && partners.length > 0 ? partners : STATIC_PARTNERS) as Array<{
    _id: string;
    name: string;
    website: string | null;
  }>;

  return (
    <section className="py-20 px-8 md:px-16 bg-bone border-t border-rule">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-10 flex justify-center">
          <span className="eyebrow">In collaboration with</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 border-l border-t border-rule">
          {list.map((p) =>
            p.website ? (
              <a
                key={p._id}
                href={p.website}
                target="_blank"
                rel="noopener noreferrer"
                className="border-r border-b border-rule px-8 py-10 flex items-center justify-center text-center font-serif text-[18px] text-ink leading-snug hover:bg-parchment transition-colors duration-150"
              >
                {p.name}
              </a>
            ) : (
              <div
                key={p._id}
                className="border-r border-b border-rule px-8 py-10 flex items-center justify-center text-center font-serif text-[18px] text-ink leading-snug"
              >
                {p.name}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
