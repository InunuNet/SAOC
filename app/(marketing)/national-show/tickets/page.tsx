import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = { title: 'Tickets — National Show' };

const OPTIONS = [
  {
    id: 'visitor',
    heading: "I'm coming to visit",
    body: 'Buy an admission ticket to browse the show floor, exhibits, and displays.',
    cta: 'Get visitor tickets',
    href: '/tickets',
  },
  {
    id: 'exhibitor',
    heading: "I'm exhibiting orchids",
    body: 'See what is involved in exhibiting at the National Show. Entry sales are not yet open — they open closer to the show.',
    cta: 'Exhibitor entry',
    href: '/national-show/exhibitors',
  },
  {
    id: 'vendor',
    heading: "I'm a nursery or trader",
    body: 'Register a trade booth to sell plants and supplies at the show.',
    cta: 'Vendor registration',
    href: '/national-show/vendors/apply',
  },
  {
    id: 'conferences',
    heading: "I'm attending a conference",
    body: 'Register for the SAOC Symposium, the WOSA Conference, or the combined Joint track.',
    cta: 'Conferences tickets',
    href: '/national-show/conferences',
  },
  {
    id: 'workshops',
    heading: 'I want workshops or a field trip',
    body: 'Book Sunset Cocktails or a guided Field Trip outing at the show.',
    cta: 'Workshops & Field Trips tickets',
    href: '/national-show/workshops',
  },
] as const;

export default function NationalShowTicketsPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading="What are you here for?"
        lede="Choose the option that matches why you're coming to the 2027 SAOC National Show — we'll take you straight to the right form."
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {OPTIONS.map((option) => (
            <div
              key={option.id}
              className="flex flex-col gap-4 rounded-sm border border-rule bg-ivory p-6"
            >
              <h2 className="font-serif text-[20px] font-medium text-ink">{option.heading}</h2>
              <p className="font-sans text-[14px] leading-relaxed text-ink/80">{option.body}</p>
              <Link
                href={option.href}
                className="mt-auto inline-block rounded-sm bg-primary px-4 py-2 text-center font-sans text-[14px] font-medium text-ivory hover:bg-primary-800 transition-colors duration-150"
              >
                {option.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
