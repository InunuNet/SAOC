import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { formatRand } from '@/components/nos/cheapest-admission';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import type { TicketCard } from '@/lib/data/ticket-card-view-models';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Lee-Ann's What to Expect (Drive: National Show / What to expect, v1.2), published as she wrote it
// (typos included: docs/rules/no-invention.md). Her struck lines (the build's own held-back
// statements) are not copy and are not rendered. Her Section 3 narrative has the page's own title, so
// it follows the standfirst under a screen-reader-only h2. WE-G1 (NOS Design, comms.md): the dates,
// opening hours and admission are one sticky card. Her admission figures (R350 and the rest) are
// superseded by the ticket records: each row's price is the tickets page's own, read live from the
// ticket view models (R7), and a row whose record is missing or not on sale is omitted.
// The page reads Firebase for those prices, so it renders per request.
export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PAGE_TITLE = 'What to expect';
const FACTS_LABELS = ['Dates', 'Venue'] as const;
const ADMISSION_LINK_LABEL = 'See ticket prices and book';

export const metadata: Metadata = buildPageMetadata({
  title: PAGE_TITLE,
  image: nosOgImage('What to expect — National Orchid Show'),
  description:
    'Opening hours, admission, food, photography and accessibility at the South ' +
    'African National Orchid Show.',
  path: '/national-show/what-to-expect',
});

const STANDFIRST =
  "The National Orchid Show is a prestigious event that takes please every three years. The Show moves between provinces on this cycle which allows the local societies the opportunity to host the delegates, judges and the public.";
const NARRATIVE = [
  "The National Orchid Show – Western Cape 2027 promises an immersive experience celebrating the beauty, science and future of orchids.",
  "Explore breathtaking displays showcasing thousands of flowering orchids, from rare species found in nature to award-winning cultivated hybrids that demonstrate decades of careful breeding and horticultural achievement. Watch South Africa's leading judges evaluate exceptional plants as growers compete for prestigious national awards that recognise excellence in orchid cultivation.",
  "Browse the extensive plant sales area, where specialist nurseries from across South Africa will be joined by selected international orchid vendors, offering an exceptional range of orchid species, hybrids, companion plants, growing media and specialist supplies. Whether you are purchasing your very first orchid or searching for a rare collector's specimen, knowledgeable growers from around the world will be on hand to share their expertise and passion.",
  "The National Show Symposium will feature an outstanding programme of presentations by respected local and international speakers covering orchid cultivation, breeding, conservation, taxonomy, judging, sustainability and emerging scientific research. A Conference held by Wild Orchids Southern Africa (WOSA) will highlight the ecology and conservation of indigenous orchids, illustrating how research undertaken in natural habitats continues to influence cultivation practices, breeding programmes and the long-term future of orchids.",
  "Visitors can further develop their knowledge through practical workshops, meet orchid societies from across the country, engage with researchers and conservationists, and discover how every aspect of the National Show reflects this year's theme - ***“From Wild Origins to Cultivated Excellence: The Future of Orchids.”***",
  "The National Orchid Show - Western Cape 2027 is made possible through the generous support of our headline sponsors, donors and partners, whose commitment to horticulture, conservation, education and scientific advancement enables the South African Orchid Council to present a truly world-class event.",
  "Whether your passion lies in conservation, scientific discovery, judging, growing or simply enjoying the extraordinary beauty of orchids, the National Orchid Show offers an unforgettable experience that celebrates the complete journey of orchids and the people dedicated to their future.",
];
const DATES_HEADING = "Show dates – for public entrance";
const DATES_LINE = "Thursday 23 to Sunday 26 September 2027";
const HOURS = [
  "Thursday VIP Ticket Holders – 16.00 to 18.00",
  "Sunset Cocktails 18.30 to 21.00",
  "Friday & Saturday – 9.00 to 17.00",
  "Sunday – 9.00 to 16.00",
];
const FOOD = "There will be several options for food and beverages.";
const PHOTOGRAPHY = [
  "Photography of all plants and exhibition stands are allowed. Should you take photographs of attendees or the public please ensure that you get their express permission should you wish to publish these on or in any public content.",
  "All rights are reserved by the management committee to use photographs of the event that are publicly available.",
];
const ACCESSIBILITY = [
  "The ground floor of the Hangar is accessible to all visitors, including people with disabilities and mobility challenges.",
  "Please note that some activities and events will take place on the mezzanine level, which is accessible only by stairs. There are two stairways: one may be suitable for visitors using crutches, but neither is wheelchair accessible.",
  "We apologise for any inconvenience this may cause and encourage visitors who may require assistance to contact the organisers in advance so that we can advise on the available arrangements.",
];

const THEME = '“From Wild Origins to Cultivated Excellence: The Future of Orchids.”';
const THEME_LEAD = "Visitors can further develop their knowledge through practical workshops, meet orchid societies from across the country, engage with researchers and conservationists, and discover how every aspect of the National Show reflects this year's theme - ";
const THEME_INDEX = 4;

// Her five admission lines by name and in her order, each keyed to its ticketType _id; the card is
// matched through the slug the tickets page uses for the same record.
const ADMISSION_ROWS = [
  { id: 'ticketType-vip', slug: 'vip', name: 'VIP Ticket' },
  { id: 'ticketType-sunset-cocktails-single', slug: 'sunset-cocktails-single', name: 'Sunset Cocktails (Single)' },
  { id: 'ticketType-weekend-pass-early-bird', slug: 'weekend-pass-early-bird', name: 'Weekend Pass (Early Bird)' },
  { id: 'ticketType-early-bird', slug: 'early-bird', name: 'Early-Bird Exhibition Ticket' },
  { id: 'ticketType-day-visitor', slug: 'day-visitor', name: 'Day Pass Ticket', passSlot: 'day' },
] as const;
const HOURS_SEPARATOR = ' – ';
// A line with no dash (Sunset Cocktails) splits where the clock times begin.
const TIME_START = /\s(?=\d{1,2}\.\d{2} to )/;

function splitHoursLine(line: string): [string, string] {
  if (line.includes(HOURS_SEPARATOR)) {
    const [label, ...value] = line.split(HOURS_SEPARATOR);
    return [label, value.join(HOURS_SEPARATOR)];
  }
  const [label, ...value] = line.split(TIME_START);
  return [label, value.join(' ')];
}
const NO_PRICE_STATES: ReadonlySet<string> = new Set(['salesClosed', 'pricePending', 'soldOut']);

const RAIL_BLOCKS = [
  { title: 'Food and refreshments', paragraphs: [FOOD] },
  { title: 'Photography', paragraphs: PHOTOGRAPHY },
  { title: 'Accessibility', paragraphs: ACCESSIBILITY },
];

export default async function WhatToExpectPage() {
  const loaded = await loadTicketCardViewModels();
  const cards = Object.values(loaded.cards);
  const sellable = (card: TicketCard | undefined): boolean =>
    card !== undefined && !NO_PRICE_STATES.has(card.state);
  const admission = ADMISSION_ROWS.flatMap((row) => {
    const own = cards.find((candidate) => candidate?.slug === row.slug);
    if (own && own.price !== null && sellable(own)) {
      return [{ ...row, price: formatRand(own.price) }];
    }
    // While the early-bird pool lasts, the early-bird record holds the Day Pass slot and carries
    // the regular Day Pass price from its sibling record (ticket-hub-source.ts).
    const holder = cards.find(
      (candidate) =>
        'passSlot' in row &&
        candidate?.productId === row.passSlot &&
        candidate.regularPrice !== null &&
        !NO_PRICE_STATES.has(candidate.state),
    );
    return holder && holder.regularPrice !== null
      ? [{ ...row, price: formatRand(holder.regularPrice) }]
      : [];
  });

  return (
    <>
      <NosHero
        route="/national-show/what-to-expect"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        facts={heroFactsFromShow(await loadShowFacts(), FACTS_LABELS)}
        priority
      />

      <div className="nos-we-body saoc-container" data-doc-layout="">
        <div className="nos-we-stand" data-doc-main="">
          <p data-we-stand="" className="doc-standfirst">
            {STANDFIRST}
          </p>
        </div>

        <div data-we-rest="" className="nos-we-rest">
          {RAIL_BLOCKS.map((block) => (
            <section key={block.title} className="nos-we-block">
              <h2 className="doc-h2">{block.title}</h2>
              {block.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        <section className="nos-we-s3" aria-labelledby="we-s3-h">
          <h2 id="we-s3-h" className="sr-only">
            What to Expect
          </h2>
          <div data-we-s3="">
            {NARRATIVE.map((paragraph, index) =>
              index === THEME_INDEX ? (
                <p key={paragraph}>
                  {THEME_LEAD}
                  <em>{THEME}</em>
                </p>
              ) : (
                <p key={paragraph}>{paragraph}</p>
              ),
            )}
          </div>
        </section>

        <aside data-we-card="" className="ds-card nos-we-card">
          <p className="nos-we-label">{DATES_HEADING}</p>
          <p className="nos-we-dates">{DATES_LINE}</p>
          <h3>Opening hours</h3>
          <dl data-we-hours="">
            {HOURS.map((line) => {
              const [label, value] = splitHoursLine(line);
              return (
                <div key={line}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              );
            })}
          </dl>
          <h3>Admission</h3>
          <dl data-we-admission="">
            {admission.map((row) => (
              <div key={row.id} data-ticket-id={row.id}>
                <dt>{row.name}</dt>
                <dd>{row.price}</dd>
              </div>
            ))}
          </dl>
          <Button as={Link} href="/tickets" className="nos-we-cta">
            {ADMISSION_LINK_LABEL} <span aria-hidden="true">&rarr;</span>
          </Button>
        </aside>
      </div>
      <NosShowIndex current="/national-show/what-to-expect" />
    </>
  );
}
