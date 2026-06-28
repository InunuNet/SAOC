import Image from 'next/image';
import Link from 'next/link';

interface NavCardData {
  href: string;
  badge: string;
  titleBefore: string;
  titleEm: string;
  titleAfter: string;
  body: string;
  meta: string;
  image: string;
  alt: string;
}

const NAV_CARDS: NavCardData[] = [
  {
    href: '/about',
    badge: 'About',
    titleBefore: 'Since 1968, a ',
    titleEm: 'federated',
    titleAfter: ' body',
    body: 'Founded in Bloemfontein by four societies. Today a national council.',
    meta: 'Reg# 1978/004040/08',
    image: '/images/orchid-violet.jpg',
    alt: 'Violet orchid',
  },
  {
    href: '/societies',
    badge: 'Societies',
    titleBefore: 'Twenty-one societies, ',
    titleEm: 'nine provinces',
    titleAfter: '',
    body: 'From Cape Town to Polokwane — meet the affiliates, find one near you.',
    meta: '21 societies',
    image: '/images/orchid-pink.jpg',
    alt: 'Pink orchid',
  },
  {
    href: '/judging',
    badge: 'Judging',
    titleBefore: 'A system ',
    titleEm: 'overhauled',
    titleAfter: ' in 1990, still evolving',
    body: 'AM, FCC, HCC and the regional judging network — how we award quality.',
    meta: '56 accredited judges',
    image: '/images/orchid-dark.jpg',
    alt: 'Dark orchid',
  },
  {
    href: '/national-show',
    badge: 'National Show',
    titleBefore: 'The 19th ',
    titleEm: 'National Orchid Show',
    titleAfter: ', 2027',
    body: 'Every three years. Four days. A thousand plants at their peak.',
    meta: 'Sep 2027 · Cape Town',
    image: '/images/orchid-yellow.jpg',
    alt: 'Yellow orchid',
  },
];

export function NavCards() {
  return (
    <section className="py-24 px-8 md:px-16 bg-bone">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-12">
          <div className="mb-3"><span className="eyebrow">Find your way in</span></div>
          <h2 className="font-serif text-[clamp(34px,4.4vw,54px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary">
            Four ways into <em>SAOC</em>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {NAV_CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative aspect-[4/5] overflow-hidden block"
            >
              {/* Background image */}
              <Image
                src={card.image}
                alt={card.alt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                sizes="(min-width: 768px) 25vw, 50vw"
              />

              {/* Dark gradient scrim */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/30 to-transparent"
              />

              {/* Hover border */}
              <div
                aria-hidden="true"
                className="absolute inset-0 border-2 border-transparent group-hover:border-accent transition-colors duration-150"
              />

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-between p-5 group-hover:-translate-y-1 transition-transform duration-150">
                {/* Badge */}
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ivory/80 self-start bg-primary/40 px-2 py-1">
                  {card.badge}
                </span>

                {/* Bottom content */}
                <div>
                  <h3 className="font-serif text-[18px] font-medium text-ivory leading-snug mb-2">
                    {card.titleBefore}<em className="text-accent-soft not-italic">{card.titleEm}</em>{card.titleAfter}
                  </h3>
                  <p className="font-sans text-[13px] text-ivory/70 leading-snug mb-3">
                    {card.body}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ivory/60">
                      {card.meta}
                    </span>
                    <span className="font-serif text-[16px] text-accent-soft" aria-hidden="true">
                      →
                    </span>
                  </div>
                </div>
              </div>

              {/* Hover shadow */}
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-100 shadow-lg transition-opacity duration-150 pointer-events-none"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
