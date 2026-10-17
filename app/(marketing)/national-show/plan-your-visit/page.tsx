import type { Metadata } from 'next';
import Link from 'next/link';

import { AccommodationList, ConfirmationBadge, TravelRoutes, VenueCard } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { VisitDisclosure, VisitGettingThere } from '@/components/show/VisitDisclosure';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowVenue, ShowVisitorInfo } from '@/types';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Plan Your Visit — National Orchid Show',
  image: nosOgImage('Plan Your Visit — National Orchid Show'),
  description:
    'Getting to the South African National Orchid Show: travel from the airports, parking, ' +
    'public transport, where to stay and what else to see while you are in town.',
  path: '/national-show/plan-your-visit',
});

// Codi P3 H8: the pending items on this page are grouped under ONE chip per disclosure, to the
// nos-v4/plan-your-visit.html golden (l.575-616). The two aria-labels are the golden's.
const EMERGENCY_LABEL = 'Emergency contacts, to be confirmed by the show committee';

// A number worth dialling: digits, with an optional leading + and spaces between groups.
const PHONE_SHAPED = /^\+?\d[\d\s]*$/;

interface ShowVenueData {
  venue: ShowVenue | null;
}

export default async function PlanYourVisitPage() {
  const [info, show] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowVenueData>({ query: nationalShowVenueQuery, tags: ['nationalShow', 'sanity'] }),
  ]);

  const pendingLabel = info?.pendingLabel;
  const researchLabel = info?.researchLabel;
  const status = info?.confirmations ?? {};
  const attractions = (info?.attractions ?? []).filter((a) => a?.name);
  const emergencyContacts = (info?.emergencyContacts ?? []).filter((c) => c?.label);
  // Numbers worth dialling get a tel: link; any other contact is drawn as its label plus the
  // value Sanity holds for it, as a short tag.
  const dialContacts = emergencyContacts.filter((c) => PHONE_SHAPED.test(c.number ?? ''));
  const onSiteContacts = emergencyContacts.filter((c) => !PHONE_SHAPED.test(c.number ?? ''));

  // The Getting-there items, in page order; an item with no body or list is not drawn.
  const gettingThereItems = [
    { heading: 'Parking', body: info?.parking, status: status.parking },
    { heading: 'Public transport', body: info?.publicTransport, status: status.publicTransport },
    {
      heading: 'Where to stay',
      body: info?.accommodationIntro,
      status: status.accommodation,
      children: <AccommodationList options={info?.accommodation} />,
    },
  ].filter((item) => item.body || (item.children && (info?.accommodation ?? []).length > 0));

  return (
    <>
      <NosHero
        route="/national-show/plan-your-visit"
        title={info?.planTitle ?? 'Plan your visit'}
        lede={info?.planIntro ?? undefined}
        priority
      />

      <NosSection wrapClassName="space-y-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="space-y-8">
            <SectionHeading
              as="h2"
              title="Getting there"
              lede={info?.gettingThereIntro ?? undefined}
            />
            <TravelRoutes routes={info?.airportRoutes} />
            <VisitGettingThere
              items={gettingThereItems}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </section>

          <aside>
            <VenueCard
              venue={show?.venue}
              status={status.venue}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
              mapAction="button"
            />
          </aside>
        </div>

        {attractions.length > 0 ? (
          <section className="nos-surface">
            <SectionHeading as="h3" title="While you are here" />
            <ConfirmationBadge
              status={status.attractions}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {attractions.map((attraction, index) => (
                <li key={attraction._key ?? `${attraction.name}-${index}`}>
                  <Card className="h-full">
                    <h3 className="font-serif text-[18px] font-medium text-ink">
                      {attraction.name}
                    </h3>
                    {attraction.note ? (
                      <p className="mt-2 font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-muted">
                        {attraction.note}
                      </p>
                    ) : null}
                    {attraction.url ? (
                      <a
                        href={attraction.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-3 inline-block font-sans text-[13px] underline underline-offset-2 hover:text-accent"
                      >
                        Visit website ↗
                      </a>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {emergencyContacts.length > 0 ? (
          <section>
            <SectionHeading as="h2" title="In an emergency" className="mb-6" />
            <VisitDisclosure label={EMERGENCY_LABEL} tone="pale">
              <div>
                <ConfirmationBadge
                  status={status.emergencyContacts}
                  pendingLabel={pendingLabel}
                  researchLabel={researchLabel}
                />
              </div>
              {dialContacts.length > 0 ? (
                <dl className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-3">
                  {dialContacts.map((contact, index) => (
                    <div
                      key={contact._key ?? `${contact.label}-${index}`}
                      className="flex flex-col gap-1"
                    >
                      <dt className="font-sans text-[16px] leading-[1.55] text-[var(--ink-700)]">
                        {contact.label}
                      </dt>
                      <dd className="order-first font-serif text-primary">
                        <a
                          href={`tel:${(contact.number ?? '').replace(/[^\d+]/g, '')}`}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center text-[clamp(2.4rem,3vw,3rem)] font-light leading-[1.1] underline-offset-4 hover:underline"
                        >
                          {contact.number}
                        </a>
                      </dd>
                      {contact.note ? (
                        <dd className="font-sans text-[14px] leading-[1.55] text-[var(--ink-500)]">
                          {contact.note}
                        </dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              ) : null}
              {onSiteContacts.map((contact, index) => (
                <div
                  key={contact._key ?? `${contact.label}-${index}`}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-6"
                >
                  <h3 className="nos-opsz-32 font-serif text-[20px] leading-[1.2] text-ink">
                    {contact.label}
                  </h3>
                  {contact.number ? (
                    <span className="font-sans text-[16px] font-semibold text-[var(--ink-500)]">
                      {contact.number}
                    </span>
                  ) : null}
                </div>
              ))}
              {onSiteContacts.map((contact, index) =>
                contact.note ? (
                  <p
                    key={contact._key ?? `${contact.label}-note-${index}`}
                    className="font-sans text-[15px] leading-[1.55] text-[var(--ink-500)]"
                  >
                    {contact.note}
                  </p>
                ) : null
              )}
            </VisitDisclosure>
          </section>
        ) : null}
      </NosSection>

      <CtaBand
        eyebrow="Stay informed"
        title="Be the first to know"
        lede="Parking, public transport and accommodation are confirmed by the show committee as the event draws closer. Ask the council to be notified the moment they are settled, or point out anything missing here."
        action={
          <Button as={Link} href="/contact" variant="on-dark">
            Ask the council
          </Button>
        }
      />
      <NosShowIndex current="/national-show/plan-your-visit" />
    </>
  );
}
