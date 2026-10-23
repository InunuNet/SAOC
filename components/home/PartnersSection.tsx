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
    description: 'Partner organisation hosting the WOSA Conference at the National Orchid Show.',
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
  const rowBase =
    'grid grid-cols-[1fr_auto] min-[900px]:grid-cols-[5fr_6fr_auto] items-baseline gap-x-10 gap-y-3 border-b border-rule py-7 px-3 min-h-[44px]';

  return (
    <section data-home-section="partners" className="py-20 bg-parchment">
      <div className="saoc-container">
        <div className="mb-10">
          <span className="eyebrow">In collaboration with</span>
        </div>

        <div className="border-t border-rule -mx-3">
          {cards.map((card) => {
            const body = (
              <>
                <span
                  data-partner-name
                  className="text-balance font-serif tracking-[-0.015em] font-normal min-[1000px]:font-light text-[clamp(28px,3.2vw,42px)] leading-[1.12] text-primary underline decoration-transparent decoration-1 underline-offset-[6px] transition-[color,text-decoration-color] duration-150 ease-(--ease) group-hover:text-primary-800 group-hover:decoration-accent group-focus-visible:text-primary-800 group-focus-visible:decoration-accent"
                >
                  {card.name}
                </span>
                {card.description ? (
                  <span className="col-span-2 min-[900px]:col-span-1 min-[900px]:col-start-2 row-start-2 min-[900px]:row-start-1 font-sans text-[16px] leading-[1.55] text-muted">
                    {card.description}
                  </span>
                ) : null}
                {card.website ? (
                  <span
                    data-partner-arrow
                    aria-hidden="true"
                    className="col-start-2 row-start-1 min-[900px]:col-start-3 font-serif font-normal text-[20px] text-primary transition-[translate,color] duration-150 ease-(--ease) group-hover:translate-x-1 group-hover:text-accent group-focus-visible:translate-x-1 group-focus-visible:text-accent motion-reduce:group-hover:translate-x-0 motion-reduce:group-focus-visible:translate-x-0"
                  >
                    →
                  </span>
                ) : null}
              </>
            );

            return card.website ? (
              <a
                key={card._id}
                href={card.website}
                target="_blank"
                rel="noopener noreferrer"
                data-partner-row
                className={`group ${rowBase} transition-colors duration-150 ease-(--ease) hover:bg-accent/8 focus-visible:bg-accent/8 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]`}
              >
                {body}
              </a>
            ) : (
              <div key={card._id} data-partner-row className={rowBase}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
