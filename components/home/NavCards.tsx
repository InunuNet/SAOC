import Image from 'next/image';
import Link from 'next/link';

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
    <section data-home-section="nav-cards" className="py-24 bg-bone">
      <div className="saoc-container">
        <div className="mb-12">
          <div className="mb-3">
            <span className="eyebrow eyebrow--on-tint">Find your way in</span>
          </div>
          <h2 className="font-serif text-[clamp(34px,4.4vw,54px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary">
            Four ways into SAOC
          </h2>
        </div>

        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-4 gap-5">
          {cards.map((card) => {
            const CardLink = card.crossSite ? 'a' : Link;
            return (
              <CardLink
                key={card.href}
                href={card.href}
                data-nav-card
                data-placeholder={card.unsourced && !withhold ? 'true' : undefined}
                className="group flex flex-col bg-parchment border border-rule transition-[translate,box-shadow,border-color] duration-150 ease-(--ease) hover:-translate-y-1 hover:border-accent hover:shadow-[0_20px_50px_rgba(34,40,31,0.08)] focus-visible:-translate-y-1 focus-visible:border-accent focus-visible:shadow-[0_20px_50px_rgba(34,40,31,0.08)] active:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 motion-reduce:active:translate-y-0"
              >
                <div className="relative aspect-[3/2] min-[560px]:aspect-[4/5] overflow-hidden">
                  <Image
                    src={card.image}
                    alt={card.alt}
                    fill
                    className="object-cover transition-[scale] duration-150 ease-(--ease) group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100"
                    sizes="(min-width: 1100px) 25vw, (min-width: 560px) 50vw, 100vw"
                  />
                  <span
                    data-nav-card-badge
                    className="absolute top-3 left-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ivory bg-primary/80 px-[11px] py-[5px] rounded-[2px]"
                  >
                    {card.badge}
                  </span>
                </div>

                <div className="flex flex-col flex-1 p-[22px]">
                  {card.title ? (
                    <h3
                      data-nav-card-title
                      className="font-serif text-[24px] font-semibold leading-[1.18] text-primary mb-3 underline decoration-transparent decoration-1 underline-offset-4 transition-[color,text-decoration-color] duration-150 ease-(--ease) group-hover:text-primary-800 group-hover:decoration-accent group-focus-visible:text-primary-800 group-focus-visible:decoration-accent text-pretty"
                    >
                      {card.title}
                    </h3>
                  ) : null}

                  <p className="font-sans text-[16px] leading-[1.55] text-muted mb-auto pb-5">
                    {card.body}
                  </p>
                  {card.unsourced && !withhold ? (
                    <div className="pb-4">
                      <PlaceholderMarker />
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
                    <span
                      data-nav-card-meta
                      className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted"
                    >
                      {card.meta}
                    </span>
                    <span
                      data-nav-card-arrow
                      className="font-serif text-[18px] text-primary transition-[translate,color] duration-150 ease-(--ease) group-hover:translate-x-1 group-hover:text-accent group-focus-visible:translate-x-1 group-focus-visible:text-accent motion-reduce:group-hover:translate-x-0 motion-reduce:group-focus-visible:translate-x-0"
                      aria-hidden="true"
                    >
                      →
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
