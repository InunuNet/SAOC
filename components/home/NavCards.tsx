import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { formatShowShortMonthYear, showLabelWithEdition, showYearOf } from '@/lib/show-identity';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { nosUrl } from '@/lib/site-hosts';
import type { ShowIdentity } from '@/types';

interface NavCardData {
  href: string;
  badge: string;
  title: string;
  body: string;
  meta: string;
  image: string;
  alt: string;
  /** Title and meta state figures the Council's copy does not source (F19, vote 1C). */
  unsourced?: boolean;
  /** The card leaves for the NOS site: a plain anchor, same tab, no arrow. */
  crossSite?: boolean;
}

// F7: the National Show card's title and meta line are show-identity facts (edition,
// year, month, city) and came from the nationalShow singleton only after round 2 — they
// were literals, so a venue or date change in Studio left this card stale.
// See show-identity-surfaces.golden.md.
const TBC = 'To be confirmed';

const NAV_CARDS: NavCardData[] = [
  {
    href: '/societies',
    badge: 'Societies',
    title: 'Twenty-one societies, nine provinces',
    body: 'From Cape Town to Polokwane — meet the affiliates, find one near you.',
    meta: '21 societies',
    image: '/images/orchid-pink.jpg',
    alt: 'Pink orchid',
    unsourced: true,
  },
  {
    href: nosUrl('/'),
    crossSite: true,
    badge: 'National Show',
    // Overwritten from the nationalShow singleton in buildNavCards().
    title: '',
    body: 'Every three years. Four days. A thousand plants at their peak.',
    meta: '',
    image: '/images/orchid-yellow.jpg',
    alt: 'Yellow orchid',
  },
  {
    href: '/judging',
    badge: 'Judging',
    title: 'A system overhauled in 1990, still evolving',
    body: 'AM, FCC, HCC and the regional judging network — how we award quality.',
    meta: '56 accredited judges',
    image: '/images/orchid-dark.jpg',
    alt: 'Dark orchid',
    unsourced: true,
  },
  {
    href: '/about',
    badge: 'About',
    title: 'Since 1968, a federated body',
    body: 'Founded in Bloemfontein by four societies. Today a national council.',
    meta: 'Reg# 1978/004040/08',
    image: '/images/orchid-violet.jpg',
    alt: 'Violet orchid',
    unsourced: true,
  },
];

function buildNavCards(show: ShowIdentity | null | undefined, withhold: boolean): NavCardData[] {
  const year = showYearOf(show?.showDate);
  const title = [
    `The ${showLabelWithEdition(show?.edition, 'National Orchid Show')}`,
    year ? `, ${year}` : '',
  ].join('');
  const meta = [formatShowShortMonthYear(show?.showDate), show?.venue?.city]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return NAV_CARDS.map((card) => {
    if (card.crossSite) return { ...card, title, meta: meta || TBC };
    // The About card's registration number is not a headline claim, so only its title is withheld;
    // the card's own badge string stands in as its heading.
    if (card.unsourced && withhold) {
      return { ...card, title: card.badge, meta: card.badge === 'About' ? card.meta : '' };
    }
    return card;
  });
}

export interface NavCardsProps {
  show?: ShowIdentity | null;
  /** True on the public build: unsourced titles and figures are not rendered. */
  withhold?: boolean;
}

export function NavCards({ show, withhold = false }: NavCardsProps) {
  const cards = buildNavCards(show, withhold);

  return (
    <section data-home-section="nav-cards" className="bg-bone pt-24 pb-[calc(6rem+10px)]">
      <div className="saoc-container">
        <div className="mb-12">
          <div className="mb-3">
            <span className="eyebrow eyebrow--on-tint">Find your way in</span>
          </div>
          <h2 className="font-serif text-[clamp(34px,4.4vw,54px)] font-light leading-[1.08] tracking-[-0.015em] text-primary">
            Four ways into SAOC
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-7 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
          {cards.map((card) => {
            const CardLink = card.crossSite ? 'a' : Link;
            return (
              <CardLink
                key={card.href}
                href={card.href}
                data-nav-card
                data-placeholder={card.unsourced && !withhold ? 'true' : undefined}
                className="petal-card group"
              >
                <div className="petal-card-well">
                  <Image
                    src={card.image}
                    alt={card.alt}
                    fill
                    className="petal-card-photo"
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  />
                  <span data-nav-card-badge className="petal-card-chip">
                    {card.badge}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  {card.title ? (
                    <h3
                      data-nav-card-title
                      className="mb-3 text-pretty font-serif text-[24px] font-normal leading-[1.18] text-primary"
                    >
                      {card.title}
                    </h3>
                  ) : null}

                  <p className="mb-auto pb-5 font-sans text-[16px] leading-[1.55] text-muted">
                    {card.body}
                  </p>
                  {card.unsourced && !withhold ? (
                    <div className="pb-4">
                      <PlaceholderMarker />
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <span
                      data-nav-card-meta
                      className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted"
                    >
                      {card.meta}
                    </span>
                    <span data-nav-card-arrow className="petal-card-arrow" aria-hidden="true">
                      <ArrowRight size={16} strokeWidth={1.5} />
                    </span>
                  </div>
                </div>
              </CardLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
