// GOLDEN REFERENCE — f6-home-fidelity, D2
// Target shape for components/home/PartnersSection.tsx.
// @dev implements against this; it is not imported anywhere.
//
// Supersedes contracts/golden/partners-cards/PartnersSection.tsx, which
// documented the OLD heavy card layout (badge + description + arrow) that
// D2 identified as the drift itself — do not implement against that file.
//
// Reference (ref-section-8.png): a single-row, 6-column band of plain
// bordered cells, name-only, no per-card badge/description/arrow. Roughly
// 1/5 the vertical height of the old card grid.
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

interface PartnerCard {
  _id: string;
  name: string;
  website: string | null;
}

const STATIC_PARTNERS: PartnerCard[] = [
  { _id: 'wosa', name: 'Wild Orchids of Southern Africa', website: 'https://wosa.org.za' },
  {
    _id: 'sanbi',
    name: 'South African National Biodiversity Institute',
    website: 'https://www.sanbi.org',
  },
  {
    _id: 'kirstenbosch',
    name: 'Kirstenbosch NBG',
    website: 'https://www.sanbi.org/gardens/kirstenbosch',
  },
  { _id: 'aos', name: 'American Orchid Society', website: 'https://www.aos.org' },
  { _id: 'rhs', name: 'Royal Horticultural Society', website: 'https://www.rhs.org.uk' },
  { _id: 'woc', name: 'World Orchid Conference', website: null },
];

function toCards(partners?: SanityPartner[] | null): PartnerCard[] {
  if (!partners || partners.length === 0) return STATIC_PARTNERS;
  return partners.map((p) => ({ _id: p._id, name: p.name, website: p.website }));
}

export function PartnersSection({ partners }: PartnersSectionProps) {
  const cards = toCards(partners);

  return (
    <section className="py-20 px-8 md:px-16 bg-bone border-t border-rule">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-10">
          <span className="eyebrow">In collaboration with</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-l border-rule">
          {cards.map((card) => {
            const inner = (
              <span className="font-serif text-[15px] text-ink text-center leading-snug">
                {card.name}
              </span>
            );

            return card.website ? (
              <a
                key={card._id}
                href={card.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center text-center h-[110px] px-4 border-b border-r border-rule hover:bg-parchment transition-colors duration-150"
              >
                {inner}
              </a>
            ) : (
              <div
                key={card._id}
                className="flex items-center justify-center text-center h-[110px] px-4 border-b border-r border-rule"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
