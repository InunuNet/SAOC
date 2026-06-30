// GOLDEN REFERENCE — partners-cards
// This is the target shape for components/home/PartnersSection.tsx.
// @dev implements against this; it is not imported anywhere.
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
  badge: string;
  name: string;
  description: string;
  website: string | null;
}

const STATIC_PARTNERS: PartnerCard[] = [
  {
    _id: 'wosa',
    badge: 'Local Partner',
    name: 'Wild Orchids of Southern Africa',
    description:
      "SA's authoritative register for indigenous wild orchid species, documenting and conserving over 500 taxa across all nine provinces. The reference SAOC members turn to for wild identification and habitat questions.",
    website: 'https://wosa.org.za',
  },
  {
    _id: 'sanbi',
    badge: 'Local Partner',
    name: 'South African National Biodiversity Institute',
    description:
      "SANBI manages SA's national botanical gardens and leads the country's biodiversity research programme. SAOC coordinates with SANBI on cultivated orchid provenance and herbarium records.",
    website: 'https://www.sanbi.org',
  },
  {
    _id: 'kirstenbosch',
    badge: 'Botanical Garden',
    name: 'Kirstenbosch NBG',
    description:
      "One of the world's great botanical gardens, set against Cape Town's Table Mountain. Kirstenbosch hosts SAOC events and maintains a living collection of southern African orchid species.",
    website: 'https://www.sanbi.org/gardens/kirstenbosch',
  },
  {
    _id: 'aos',
    badge: 'International',
    name: 'American Orchid Society',
    description:
      "Founded in 1921, the AOS sets internationally adopted judging standards and publishes the orchid world's most widely read scientific and hobbyist literature. SAOC's judging system aligns with AOS protocols.",
    website: 'https://www.aos.org',
  },
  {
    _id: 'rhs',
    badge: 'International',
    name: 'Royal Horticultural Society',
    description:
      "The UK's leading horticultural charity and co-steward of the international orchid register. The RHS has hosted orchid classes at the Chelsea Flower Show since 1913.",
    website: 'https://www.rhs.org.uk',
  },
  {
    _id: 'woc',
    badge: 'International',
    name: 'World Orchid Conference',
    description:
      'The triennial global congress bringing together growers, hybridisers and societies from every continent. The WOC is the pinnacle event on the international orchid calendar.',
    website: null,
  },
];

function toCards(partners?: SanityPartner[] | null): PartnerCard[] {
  if (!partners || partners.length === 0) return STATIC_PARTNERS;
  return partners.map((p) => ({
    _id: p._id,
    badge: p.tier ?? 'Partner',
    name: p.name,
    description: p.description ?? '',
    website: p.website,
  }));
}

export function PartnersSection({ partners }: PartnersSectionProps) {
  const cards = toCards(partners);

  return (
    <section className="py-20 px-8 md:px-16 bg-bone border-t border-rule">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-10">
          <span className="eyebrow">In collaboration with</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const inner = (
              <>
                <div className="mb-3">
                  <span className="eyebrow">{card.badge}</span>
                </div>
                <h3 className="font-serif text-[20px] font-medium text-primary leading-snug mb-3">
                  {card.name}
                </h3>
                <p className="font-sans text-[14px] text-ink/70 leading-relaxed mb-6 flex-1">
                  {card.description}
                </p>
                <div className="flex items-center justify-end border-t border-rule pt-3 mt-auto">
                  <span
                    className="font-serif text-[15px] text-primary group-hover:translate-x-1 transition-transform duration-150"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>
              </>
            );

            return card.website ? (
              <a
                key={card._id}
                href={card.website}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col p-6 bg-parchment hover:shadow-md transition-shadow duration-200"
              >
                {inner}
              </a>
            ) : (
              <div
                key={card._id}
                className="group flex flex-col p-6 bg-parchment hover:shadow-md transition-shadow duration-200"
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
