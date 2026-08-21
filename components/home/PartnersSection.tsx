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
  description: string | null;
}

const STATIC_PARTNERS: PartnerCard[] = [
  {
    _id: 'wosa',
    name: 'Wild Orchids of Southern Africa',
    website: 'https://wildorchids.co.za',
    description: 'Partner organisation hosting the WOSA Conference at the 2027 National Show.',
  },
  {
    _id: 'sanbi',
    name: 'South African National Biodiversity Institute',
    website: 'https://www.sanbi.org',
    description:
      "South Africa's national institute for biodiversity science, conservation planning and botanical gardens.",
  },
  {
    _id: 'kirstenbosch',
    name: 'Kirstenbosch NBG',
    website: 'https://www.sanbi.org/gardens/kirstenbosch',
    description:
      "One of the world's great botanical gardens, managed by SANBI at the foot of Table Mountain.",
  },
];

function toCards(partners?: SanityPartner[] | null): PartnerCard[] {
  if (!partners || partners.length === 0) return STATIC_PARTNERS;
  return partners.map((p) => ({
    _id: p._id,
    name: p.name,
    website: p.website,
    description: p.description,
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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const content = (
              <>
                <span className="font-serif text-lg text-ink leading-snug">{card.name}</span>
                {card.description ? (
                  <>
                    {' '}
                    <span className="mt-3 block text-[15px] text-muted leading-relaxed">
                      {card.description}
                    </span>
                  </>
                ) : null}
              </>
            );

            return card.website ? (
              <a
                key={card._id}
                href={card.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-rule p-8 transition-colors duration-150 hover:bg-parchment"
              >
                {content}
              </a>
            ) : (
              <div key={card._id} className="border border-rule p-8">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
