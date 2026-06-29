import Image from 'next/image';
import Link from 'next/link';

interface NavCardData {
  href: string;
  badge: string;
  title: string;
  body: string;
  meta: string;
  image: string;
  alt: string;
}

const NAV_CARDS: NavCardData[] = [
  {
    href: '/societies',
    badge: 'Societies',
    title: 'Twenty-one societies, nine provinces',
    body: 'From Cape Town to Polokwane — meet the affiliates, find one near you.',
    meta: '21 societies',
    image: '/images/orchid-pink.jpg',
    alt: 'Pink orchid',
  },
  {
    href: '/national-show',
    badge: 'National Show',
    title: 'The 19th National Orchid Show, 2027',
    body: 'Every three years. Four days. A thousand plants at their peak.',
    meta: 'Sep 2027 · Cape Town',
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
  },
  {
    href: '/about',
    badge: 'About',
    title: 'Since 1968, a federated body',
    body: 'Founded in Bloemfontein by four societies. Today a national council.',
    meta: 'Reg# 1978/004040/08',
    image: '/images/orchid-violet.jpg',
    alt: 'Violet orchid',
  },
];

export function NavCards() {
  return (
    <section className="py-24 px-8 md:px-16 bg-bone">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-12">
          <div className="mb-3"><span className="eyebrow">Find your way in</span></div>
          <h2 className="font-serif text-[clamp(34px,4.4vw,54px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary">
            Four ways into SAOC
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {NAV_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col bg-parchment hover:shadow-md transition-shadow duration-200"
            >
              {/* Image */}
              <div className="relative aspect-[3/2] overflow-hidden">
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              </div>

              {/* Text area */}
              <div className="flex flex-col flex-1 p-6">
                <span className="inline-block font-mono text-[10px] uppercase tracking-[0.22em] text-primary border border-primary/30 px-2 py-1 self-start mb-4">
                  {card.badge}
                </span>

                <h3 className="font-serif text-[22px] font-medium text-primary leading-snug mb-3 flex-1">
                  {card.title}
                </h3>

                <p className="font-sans text-[14px] text-ink/70 leading-relaxed mb-4">
                  {card.body}
                </p>

                <div className="flex items-center justify-between border-t border-rule pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {card.meta}
                  </span>
                  <span
                    className="font-serif text-[16px] text-primary group-hover:translate-x-1 transition-transform duration-150"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
