import type { Metadata } from 'next';
import Link from 'next/link';

import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildSectionLedes } from '@/lib/data/ticket-section-ledes';
import {
  PROGRAMME_PRODUCTS,
  TICKET_DETAIL_HREFS,
  TICKET_PRODUCTS,
  partnerNameOf,
  type TicketProductId,
} from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// NOS Design golden PG-G1 (comms.md, 2026-10-25): hero, one timetable board of the four show days
// (her opening hours, What to Expect v1.0), the bookable sessions placed on their day, a ruled row
// for sessions with no date yet, then the existing ticket grid under "Tickets". No holding
// statement and no placeholder copy: every string is hers or the ticket product's own.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Programme',
  image: nosOgImage('Programme — National Orchid Show'),
  description: 'The overall schedule of sessions across the four days of the National Show.',
  path: '/national-show/programme',
});

// The timetable board. Heading, date line and opening hours are What to Expect v1.0, Section 2
// ("Show dates – for public entrance"), word for word (Drive: Docs for Brad / National Show / What to
// Expect). Sessions are not written here: they are placed on their day from each ticket product's own
// date (lib/data/ticket-presentation.ts).
interface ShowDay {
  weekday: string;
  day: string;
  month: string;
  /** Her opening-hours text for the day. */
  hours: string;
}

const TIMETABLE_HEADING = 'Show dates – for public entrance';
const TICKETS_HEADING = 'Tickets';
const TIMETABLE_DATE_LINE = 'Thursday 23 to Sunday 26 September 2027';
const OPENING_HOURS_LABEL = 'Opening hours';

const SHOW_DAYS: readonly ShowDay[] = [
  {
    weekday: 'Thursday',
    day: '23',
    month: 'September',
    hours: 'VIP Ticket Holders – 14.00 to 19.00',
  },
  { weekday: 'Friday', day: '24', month: 'September', hours: '9.00 to 17.00' },
  { weekday: 'Saturday', day: '25', month: 'September', hours: '9.00 to 17.00' },
  { weekday: 'Sunday', day: '26', month: 'September', hours: '9.00 to 16.00' },
];

const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;
const PAGE_TITLE = 'Programme';
const WORKSHOPS_HREF = '/workshops';
// "9am to 5pm" (the ticket card) is shown in her style, "9.00 to 17.00", on the board (D-PG1).
const CLOCK_TIME = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;
const NOON = 12;

function herTimeStyle(meta: string): string {
  return meta.replace(
    CLOCK_TIME,
    (_all, hour: string, minutes: string | undefined, meridiem: string) => {
      const base = Number(hour) % NOON;
      const h24 = meridiem.toLowerCase() === 'pm' ? base + NOON : base;
      return `${h24}.${minutes ?? '00'}`;
    }
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

interface Session {
  id: TicketProductId;
  href: string;
  time: string | null;
  name: string;
  subtitle: string | null;
}

// The programme products whose date names a show day, by the day's weekday and numeral.
function sessionsOn(weekday: string, day: string): Session[] {
  return PROGRAMME_PRODUCTS.flatMap((id) => {
    const product = TICKET_PRODUCTS[id];
    const href = TICKET_DETAIL_HREFS[id];
    if (!href || !product.when.startsWith(`${weekday} ${day} `)) return [];
    return [
      {
        id,
        href,
        time: product.meta ? herTimeStyle(product.meta) : null,
        name: product.name,
        subtitle: product.theme,
      },
    ];
  });
}

function undatedProducts() {
  return PROGRAMME_PRODUCTS.map((id) => TICKET_PRODUCTS[id]).filter(
    (product) => !SHOW_DAYS.some((d) => product.when.startsWith(`${d.weekday} ${d.day} `))
  );
}

export default async function ProgrammePage() {
  const [facts, { cards }] = await Promise.all([loadShowFacts(), loadTicketCardViewModels()]);
  // r16 F1 (Codi): the tickets hub's own Programme section, from the same components and data,
  // so the cards, lede and links here can never differ from the hub's.
  const showProvisional = !withholdPlaceholderProse();
  const ledes = buildSectionLedes({
    showDate: null,
    showEndDate: null,
    has: {
      vip: Boolean(cards.vip),
      sunset: Boolean(cards.sunset),
      symposium: Boolean(cards.symposium),
      wosa: Boolean(cards.wosa),
      workshops: Boolean(cards.workshops),
    },
    names: {
      symposium: cards.symposium?.name ?? null,
      wosa: cards.wosa?.name ?? null,
      workshops: cards.workshops?.name ?? TICKET_PRODUCTS.workshops.name,
    },
  });
  const hasProgramme = PROGRAMME_PRODUCTS.some((id) => cards[id]);

  return (
    <>
      <NosHero
        route="/national-show/programme"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        facts={heroFactsFromShow(facts, FACTS_LABELS)}
        priority
      />

      <div data-programme-body="" className="nos-pg-body">
        <section className="nos-pg-days" data-nos-wrap="" aria-labelledby="pg-days-h">
          <header className="nos-pg-head">
            <h2 id="pg-days-h">{TIMETABLE_HEADING}</h2>
            <p>{TIMETABLE_DATE_LINE}</p>
          </header>
          <ol className="nos-pg-board" data-programme-board="">
            {SHOW_DAYS.map((d) => (
              <li key={d.weekday} className="nos-pg-day">
                <p className="nos-pg-date">
                  <span className="wd">{d.weekday}</span> <span className="d">{d.day}</span>{' '}
                  <span className="m">{d.month}</span>
                </p>
                <div className="nos-pg-slots">
                  <div className="nos-pg-hours">
                    <span className="k">{OPENING_HOURS_LABEL}</span>{' '}
                    <span className="v">{d.hours}</span>
                  </div>
                  {sessionsOn(d.weekday, d.day).map((session) => (
                    <Link key={session.id} href={session.href} className="nos-pg-session">
                      {session.time ? <span className="t">{session.time}</span> : null}{' '}
                      <span className="n">{session.name}</span>
                      {session.subtitle ? (
                        <>
                          {' '}
                          <span className="s">{session.subtitle}</span>
                        </>
                      ) : null}
                      <Arrow />
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          {undatedProducts().map((product) => (
            <Link key={product.id} href={WORKSHOPS_HREF} className="nos-pg-later">
              <span className="n">{product.name}</span>{' '}
              <span className="s">{[product.when, product.meta].filter(Boolean).join(' · ')}</span>
              <Arrow />
            </Link>
          ))}
        </section>
      </div>

      {hasProgramme ? (
        <TicketSection id="programme" title={TICKETS_HEADING} lede={ledes.programme} columns={3}>
          {PROGRAMME_PRODUCTS.map((id) => {
            const vm = cards[id];
            return vm ? (
              <div key={id} className="nk-wrap">
                <TicketCard
                  productId={id}
                  vm={vm}
                  name={vm.name}
                  partnerName={partnerNameOf(id, cards)}
                  showProvisional={showProvisional}
                />
              </div>
            ) : null;
          })}
        </TicketSection>
      ) : null}
      <NosShowIndex current="/national-show/programme" />
    </>
  );
}
