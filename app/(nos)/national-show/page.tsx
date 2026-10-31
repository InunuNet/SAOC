import { Fragment, Suspense, type ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import { ShowCountdown } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { ExhibitorStageCard } from '@/components/nos/ExhibitorStageCard';
import { JudgingGroupCard } from '@/components/nos/JudgingGroupCard';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { StatusMarker } from '@/components/show/_shared/StatusMarker';
import { JsonLd, nationalShowEventJsonLd } from '@/components/seo/JsonLd';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  activeTicketTypesByCategoryQuery,
  nationalShowQuery,
  nationalShowSalesQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import { buildShowFacts } from '@/lib/data/show-facts';
import {
  JUDGING_GROUPS,
  JUDGING_GROUPS_HEADING,
  LANDING_CTA,
  LANDING_FIGURES,
  LANDING_INTRO,
  PLANT_ENTRY_HEADING,
  PLANT_ENTRY_STAGES,
  type JudgingGroup,
} from '@/lib/data/nos-home-landing';
import { COLUMN_CLASS, SPAN_CLASS, resolveGridLayout } from '@/lib/grid-columns';
import { cheapestAdmission, formatRand } from '@/components/nos/cheapest-admission';
import { buildShowOffers, type SanityHubTicketType } from '@/lib/data/national-show-offers';
import { TICKET_CATEGORIES } from '@/lib/data/ticket-hub-source';
import { resolveActiveShow, type ShowActivationFields } from '@/lib/show-resolution';
import { buildPageMetadata } from '@/lib/seo';
import { nosPath } from '@/lib/nos-paths';
import { SHOW_TITLE, SHOW_TITLE_EXPANDED } from '@/lib/show-title';
import { NOS_TITLE_DEFAULT } from '@/lib/site-metadata';
import { formatVenueAddress, toShowIsoDate } from '@/lib/show-identity';
import type { ShowVenue, ShowVisitorInfo } from '@/types';
import { nosUrl } from '@/lib/site-hosts';
import type { SanityImageSource } from '@sanity/image-url';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

/** The hub's `<h1>` (R68, Brad): the show's plain name. nav-config keeps its own longer label
 *  as the mega-menu lead, so the two are deliberately separate. */
const HUB_HEADING = 'National Orchid Show';

const HUB_MEGA = NOS_NAV.find((n) => n.type === 'mega');

/** The mega's own Tickets leaf (the removed header CTA used to resolve it the same way). Throws at
 *  load if the leaf is ever removed rather than rendering a hero CTA with no destination. */
const TICKETS_CTA = (() => {
  const leaf = HUB_MEGA?.lead?.theShow.links.find((l) => l.id === 'tickets');
  if (!leaf)
    throw new Error('national-show hub: mega Tickets leaf missing; hero CTA cannot resolve');
  return leaf;
})();

/** The hub's two actions, label and href as nav-config carries them: the header's Tickets leaf
 *  (primary, gold) and Plan Your Visit (secondary, ghost). Used by the hero and the closing band. */
const HUB_PLAN_LINK = {
  label:
    HUB_MEGA?.columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit')?.label ??
    'Plan your visit',
  href:
    HUB_MEGA?.columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit')?.href ??
    '/national-show/plan-your-visit',
};

// ---------------------------------------------------------------------------------------
// F18 wiring (nos-design-system, M6) — the site's ONE schema.org Event node lives on this
// page and nowhere else. Every value below is derived from the Sanity nationalShow
// singleton and the admission ticketType documents; nothing here is a literal show fact.
// When Sanity lacks a name, a start date or a complete venue, nationalShowEventJsonLd()
// returns null and NO node is emitted — a placeholder date or venue is never substituted.
// ---------------------------------------------------------------------------------------

const EVENT_URL = nosUrl('/');

interface SanityNationalShow {
  title: string | null;
  showDate: string | null;
  showEndDate: string | null;
  edition: number | null;
  hostRegion: string | null;
  location: string | null;
  venue: ShowVenue | null;
  hero: SanityImageSource | null;
  countdownDate: string | null;
}

const LEDE = "South Africa’s triennial National Orchid Show, bringing together growers, judges and enthusiasts from all nine provinces.";
const THEME_LINE = "“From Wild Origins to Cultivated Excellence: The Future of Orchids.”";
const ABOUT_LEAD = "The National Orchid Show - Western Cape 2027 is the South African Orchid Council's premier triennial event, bringing together orchid enthusiasts, growers, researchers, conservationists, judges, horticultural professionals and members of the public to celebrate one of the world's most remarkable plant families.";
const ABOUT_BODY = "The National Orchid Show will showcase a spectacular display of all the orchids that are submitted for judging and display. There will be specialist plant sales by local and international vendors, educational exhibits, a comprehensive symposium and conference, practical workshops and opportunities to engage with local and international experts.";
const DATES_LABEL = "Show dates – for public entrance";
const DATES_LINE = "Thursday 23 to Sunday 26 September 2027";
const HOURS = [["Thursday VIP Ticket Holders", "14.00 to 19.00"], ["Friday & Saturday", "9.00 to 17.00"], ["Sunday", "9.00 to 16.00"]] as const;
const SYMPOSIUM_LINE = "The National Show Symposium will feature an outstanding programme of presentations by respected local and international speakers covering orchid cultivation, breeding, conservation, taxonomy, judging, sustainability and emerging scientific research.";
const WOSA_LINE = "A Conference held by Wild Orchids Southern Africa (WOSA) will highlight the ecology and conservation of indigenous orchids, illustrating how research undertaken in natural habitats continues to influence cultivation practices, breeding programmes and the long-term future of orchids.";
const WORKSHOPS_LINE = "Workshops are planned as part of the wider event programme.";
const EXHIBIT_LEAD = "All South African Orchid Council members whose subscriptions are valid may enter orchids for judging. If you are unsure, please check with your society.";
const EXHIBIT_BODY = "All submitted orchids will be placed in the Show display. Regional Societies may also have their own displays by booking a stand. They will also be able to sell society plants on behalf of their members.";
const CLOSING = "Whether your passion lies in conservation, scientific discovery, judging, growing or simply enjoying the extraordinary beauty of orchids, the National Orchid Show – Western Cape 2027 offers an unforgettable experience that celebrates the complete journey of orchids and the people dedicated to their future.";

// HM-G1 (NOS Design, comms.md): the home keeps its approved rhythm and takes Lee-Ann's words. Every
// sentence below is verbatim from About v1.2, What to Expect v1.0 or FAQ v1.0 (docs/rules/no-invention.md):
// her About keeps its hyphen ("Show - Western Cape"), What to Expect its en dash. The section h2s Visit,
// Programme and Exhibit & trade are the nav group names; register and link labels are read from the nav.
// "who\u2019s" in FAQ 26 is her spelling (owner item vvvv).
const FACT_LABELS = ['Dates', 'Venue'] as const;
const ABOUT_HEADING = '2027 South African National Orchid Show';
const ABOUT_LINK_LABEL = 'About the show';
const WTE_LINK_LABEL = 'What to expect';
const VISIT_IDS = ['about-the-show', 'what-to-expect', 'plan-your-visit', 'faq', 'tickets'] as const;
const EXHIBIT_IDS = ['exhibitors', 'vendors', 'international-guests'] as const;
const PROGRAMME_ROWS = [
  { id: 'symposium', line: SYMPOSIUM_LINE },
  { id: 'wosa-conference', line: WOSA_LINE },
  { id: 'workshops', line: WORKSHOPS_LINE },
] as const;

// C-4 / R13: the judging grid's column count is derived from the live group count, never a literal.
// Counts divisible by five keep the five-up grid; any other count takes the orphan-free layout.
const JUDGING_WIDE_COLUMNS = 5;
const JUDGING_GRID_LAYOUT = resolveGridLayout(JUDGING_GROUPS.length);
const JUDGING_COLUMNS_CLASS =
  JUDGING_GROUPS.length % JUDGING_WIDE_COLUMNS === 0
    ? 'lg:grid-cols-5'
    : COLUMN_CLASS[JUDGING_GRID_LAYOUT.columns];
// An odd count leaves a lone last card in the two-up grid; it spans the row there, as at desktop.
const JUDGING_ODD_SPAN_CLASS = JUDGING_GROUPS.length % 2 === 1 ? 'sm:col-span-2' : '';

/** Her description with each of her italic runs (species and section names) set in <em>. */
function withItalics(group: JudgingGroup): ReactNode {
  if (group.description === null) return null;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const run of group.italics) {
    const at = group.description.indexOf(run, cursor);
    if (at < 0) throw new Error(`national-show hub: italic run "${run}" not in group ${group.n}`);
    parts.push(group.description.slice(cursor, at), <em key={at}>{run}</em>);
    cursor = at + run.length;
  }
  parts.push(group.description.slice(cursor));
  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}

function judgingCardSpanClass(index: number): string {
  if (index !== JUDGING_GROUPS.length - 1) return '';
  const lgSpan =
    JUDGING_GROUPS.length % JUDGING_WIDE_COLUMNS !== 0 && JUDGING_GRID_LAYOUT.finalCardSpans > 1
      ? SPAN_CLASS[JUDGING_GRID_LAYOUT.finalCardSpans]
      : '';
  return [JUDGING_ODD_SPAN_CLASS, lgSpan].filter(Boolean).join(' ');
}

// The hub keeps the full NOS default title; the group template would only repeat the show's name.
export const metadata: Metadata = {
  ...buildPageMetadata({
    title: SHOW_TITLE_EXPANDED,
    image: nosOgImage(SHOW_TITLE),
    description: LEDE,
    path: '/national-show',
  }),
  title: { absolute: NOS_TITLE_DEFAULT },
};

interface NavLeafRef {
  id: string;
  label: string;
  href: string;
}

function collectLeaves(node: unknown, into: Map<string, NavLeafRef>): void {
  if (!node || typeof node !== 'object') return;
  // Narrowing an arbitrary nav node to a string-keyed record; the typeof checks below guard every read.
  const record = node as Record<string, unknown>;
  if (
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    typeof record.href === 'string' &&
    !into.has(record.id)
  ) {
    into.set(record.id, { id: record.id, label: record.label, href: record.href });
  }
  for (const value of Object.values(record)) collectLeaves(value, into);
}

const LEAVES = (() => {
  const leaves = new Map<string, NavLeafRef>();
  collectLeaves(NOS_NAV, leaves);
  return leaves;
})();

function leafFor(id: string): NavLeafRef {
  const leaf = LEAVES.get(id);
  if (!leaf) throw new Error(`national-show hub: the show nav has no leaf "${id}"`);
  return leaf;
}

export default async function NationalShowPage() {
  const [sanityShow, visitorInfo, salesState, shows, hubTicketTypesByCategory] = await Promise.all([
    sanityFetch<SanityNationalShow>({
      query: nationalShowQuery,
      tags: ['nationalShow', 'sanity'],
    }),
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<{ salesOpen?: boolean | null }>({
      query: nationalShowSalesQuery,
      tags: ['nationalShow', 'sanity'],
    }),
    sanityFetch<ShowActivationFields[]>({
      query: activeShowWindowQuery,
      tags: ['show', 'sanity'],
    }),
    Promise.all(
      TICKET_CATEGORIES.map((category) =>
        sanityFetch<SanityHubTicketType[]>({
          query: activeTicketTypesByCategoryQuery,
          params: { category },
          tags: ['ticketType', 'sanity'],
        })
      )
    ),
  ]);
  const admissionTicketTypes = hubTicketTypesByCategory[0];
  const hubTicketTypes = hubTicketTypesByCategory.flatMap((rows) => rows ?? []);

  const edition = sanityShow?.edition ?? null;
  // Dates and Venue only (HM-G1): the other shared facts are not on the home.
  const heroMeta = buildShowFacts(sanityShow).filter(({ label }) =>
    (FACT_LABELS as readonly string[]).includes(label)
  );

  // The price anchor shows only while sales are open and the cheapest admission has a price.
  const anchor =
    salesState?.salesOpen === true
      ? cheapestAdmission(admissionTicketTypes ?? [], new Date())
      : null;
  const priceAnchor =
    anchor && anchor.price > 0 ? `${anchor.type.name} from ${formatRand(anchor.price)}` : null;

  // The one Event node on the site. Offers are omitted entirely while sales are closed.
  const eventData = nationalShowEventJsonLd({
    name: SHOW_TITLE_EXPANDED,
    startDate: toShowIsoDate(sanityShow?.showDate),
    endDate: toShowIsoDate(sanityShow?.showEndDate),
    description: LEDE,
    venueName: sanityShow?.venue?.name,
    venueAddress: formatVenueAddress(sanityShow?.venue),
    url: EVENT_URL,
    offers: salesState?.salesOpen === true ? buildShowOffers(hubTicketTypes, new Date(), resolveActiveShow(shows ?? [])) : [],
  });

  const aboutLink = leafFor('about-the-show');
  const wteLink = leafFor('what-to-expect');

  return (
    <>
      {eventData ? <JsonLd data={eventData} /> : null}

      <NosHero
        route="/national-show"
        priority
        title={HUB_HEADING}
        titleSize="display"
        lede={<span data-hm-lede="">{LEDE}</span>}
        actions={
          <>
            <div className="nos-hero-row" data-hm-exempt="">
              <div className="nos-hero-cta-group">
                <div className="nos-hero-actions">
                  <Button<typeof Link>
                    as={Link}
                    href={nosPath(TICKETS_CTA.href)}
                    variant="on-dark"
                    data-nos-hero-button=""
                  >
                    <span data-nos-hero-text="btn-primary-label">{TICKETS_CTA.label}</span>
                  </Button>
                  <Button<typeof Link>
                    as={Link}
                    href={nosPath(HUB_PLAN_LINK.href)}
                    variant="ghost-on-dark"
                    data-nos-hero-button=""
                  >
                    <span data-nos-hero-text="btn-plan-label">{HUB_PLAN_LINK.label}</span>
                  </Button>
                </div>

                {priceAnchor ? (
                  <p data-nos-hero-text="price" className="nos-hero-price">
                    {priceAnchor}
                  </p>
                ) : null}
              </div>

              <Suspense fallback={null}>
                <ShowCountdown
                  label="Opens in"
                  countdownDate={sanityShow?.countdownDate}
                  edition={edition}
                  pendingLabel={visitorInfo?.pendingLabel}
                />
              </Suspense>
            </div>

            <dl className="nos-hero-facts">
              {heroMeta.map(({ label, value }, index) => (
                <div key={label}>
                  <dt data-nos-hero-text={`meta-dt-${index}`}>{label}</dt>
                  <dd data-nos-hero-text={`meta-dd-${index}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <p data-hm-theme="" className="nos-hero-theme">
              Theme <em>{THEME_LINE}</em>
            </p>
          </>
        }
      />

      {/* Brad 2026-10-29: the show-dates card floats beside every band from the intro to the closing,
          like the What to expect card. .nos-hm-float is the sticky track (see nos-structure.css). */}
      <div className="nos-hm-float">
      <div data-hm-visit-card-track="" className="nos-hm-float-track">
        <div data-hm-visit-card="" className="ds-card nos-hm-card">
          <p className="nos-hm-card-label">{DATES_LABEL}</p>
          <p className="nos-hm-card-dates">{DATES_LINE}</p>
          <dl>
            {HOURS.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Link href={nosPath(wteLink.href)} className="nos-hm-link">
            {WTE_LINK_LABEL} <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>

      <NosSection
        tone="gold"
        data-hm-section="intro"
        aria-labelledby="hm-intro-h"
        wrapClassName="nos-about nos-about-top"
      >
        <div>
          <h2 id="hm-intro-h" className="nos-hm-h2">
            {LANDING_INTRO.tagline}
          </h2>
          {LANDING_INTRO.paragraphs.map((paragraph, index) => (
            <p key={paragraph} className={index === 0 ? 'nos-hm-lead' : 'nos-hm-body'}>
              {paragraph}
            </p>
          ))}
          <ul className="nos-figures nos-figures-below">
            {LANDING_FIGURES.map(({ value, label }) => (
              <li key={label} data-hm-figure="">
                <span className="nos-figure font-serif">{value}</span>
                <span className="nos-figure-label">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </NosSection>

      <NosSection data-hm-section="about" aria-labelledby="hm-about-h">
        <div className="nos-hm-about-single">
          <h2 id="hm-about-h" className="nos-hm-h2">
            {ABOUT_HEADING}
          </h2>
          <p className="nos-hm-lead">{ABOUT_LEAD}</p>
          <p className="nos-hm-body">{ABOUT_BODY}</p>
          <Link href={nosPath(aboutLink.href)} className="nos-hm-link">
            {ABOUT_LINK_LABEL} <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </NosSection>

      <NosSection tone="gold" data-hm-section="visit" aria-labelledby="hm-visit-h">
        <h2 id="hm-visit-h" className="nos-hm-h2">
          Planning a visit
        </h2>
        <ul className="nos-hm-register nos-hm-visit">
          {VISIT_IDS.map((id) => {
            const leaf = leafFor(id);
            return (
              <li key={id}>
                <Link href={nosPath(leaf.href)}>
                  <h3>{leaf.label}</h3>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </NosSection>

      <NosSection tone="gold" data-hm-section="judging" className="nos-section-joined">
        <SectionHeading title={JUDGING_GROUPS_HEADING} />
        <div className={`mt-10 grid grid-cols-1 gap-7 sm:grid-cols-2 ${JUDGING_COLUMNS_CLASS}`}>
          {JUDGING_GROUPS.map((group, index) => (
            <div key={group.n} data-hm-judging-card="" className={judgingCardSpanClass(index)}>
              <JudgingGroupCard
                code={String(group.n)}
                group={`Group ${group.n}`}
                name={group.name}
                description={withItalics(group)}
              />
            </div>
          ))}
        </div>
      </NosSection>

      <NosSection tone="royal" data-hm-section="plant-entry">
        <SectionHeading title={PLANT_ENTRY_HEADING} tone="on-dark" />
        <div className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {PLANT_ENTRY_STAGES.map(({ stage, title, description }) => (
            <div key={stage} data-hm-stage="" className="h-full [&>*]:h-full">
              <ExhibitorStageCard stage={stage} title={title} description={description} />
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start gap-5">
          <p className="font-serif tracking-[-0.015em] text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] leading-tight text-ivory">
            {LANDING_CTA.startPlanning}
          </p>
          {/* Her form is not supplied yet: plain text, never a link, with the one pending marker. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-sans text-[18px] font-semibold leading-[1.55] text-ivory">
              {LANDING_CTA.registerHere}
            </p>
            <span data-hm-register-marker="">
              <StatusMarker
                kind="confirmation"
                status="pending"
                pendingLabel={visitorInfo?.pendingLabel}
                tone="dark"
                as="span"
              />
            </span>
          </div>
          <p className="max-w-[58ch] font-sans text-[18px] leading-[1.55] text-[var(--lilac-muted)]">
            {LANDING_CTA.openingSentence}
          </p>
        </div>
      </NosSection>

      <NosSection data-hm-section="programme" aria-labelledby="hm-programme-h">
        <h2 id="hm-programme-h" className="nos-hm-h2">
          Programme
        </h2>
        <ul className="nos-hm-rows">
          {PROGRAMME_ROWS.map(({ id, line }) => {
            const leaf = leafFor(id);
            return (
              <li key={id}>
                <Link href={nosPath(leaf.href)}>
                  <h3>{leaf.label}</h3>
                  <p>{line}</p>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </NosSection>

      <NosSection
        tone="gold"
        data-hm-section="exhibit"
        aria-labelledby="hm-exhibit-h"
        wrapClassName="nos-about"
      >
        <div>
          <h2 id="hm-exhibit-h" className="nos-hm-h2">
            Exhibit &amp; trade
          </h2>
          <p className="nos-hm-lead">{EXHIBIT_LEAD}</p>
          <p className="nos-hm-body">{EXHIBIT_BODY}</p>
        </div>
        <ul className="nos-hm-register">
          {EXHIBIT_IDS.map((id) => {
            const leaf = leafFor(id);
            return (
              <li key={id}>
                <Link href={nosPath(leaf.href)}>
                  {leaf.label} <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </NosSection>

      <NosSection tone="royal" data-hm-section="closing" wrapClassName="nos-hm-closing">
        <p className="nos-hm-closing-text">{CLOSING}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button<typeof Link> as={Link} href={nosPath(TICKETS_CTA.href)} variant="on-dark">
            {TICKETS_CTA.label}
          </Button>
          <Button<typeof Link> as={Link} href={nosPath(HUB_PLAN_LINK.href)} variant="ghost-on-dark">
            {HUB_PLAN_LINK.label}
          </Button>
        </div>
      </NosSection>
      </div>
    </>
  );
}
