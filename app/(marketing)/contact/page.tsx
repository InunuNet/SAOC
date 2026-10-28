import type { Metadata } from 'next';

import Link from 'next/link';

import { RouteHero } from '@/components/ui/RouteHero';
import { ContactForm } from '@/components/contact';
import { VenueCard } from '@/components/show';
import { SAOC_LINK_RING } from '@/components/ui/saoc-link-ring';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  contactPageQuery,
  nationalShowVenueQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowVenue, ShowVisitorInfo } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

const LEDE =
  'Questions about societies, shows, judging, or membership? Reach the right person, or send us a message.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact SAOC',
  description: LEDE,
  lede: LEDE,
  path: '/contact',
});

interface DirectContact {
  name: string | null;
  role: string | null;
  email: string | null;
}

interface ContactPageData {
  title: string | null;
  directContacts: DirectContact[] | null;
}

// Role labels the Council's Drive does not source (mirrors provenance.unsourced "contact-labels").
const UNSOURCED_LABEL = /SAOC Secretariat|General enquiries/;

// Static fallback when Sanity returns null — SAOC secretariat.
const FALLBACK_CONTACTS: DirectContact[] = [
  { name: 'SAOC Secretariat', role: 'General enquiries', email: 'info@saoc.co.za' },
];

interface ShowVenueData {
  venue: ShowVenue | null;
}

export default async function ContactPage() {
  // The venue block renders the SAME VenueCard against the SAME nationalShow.venue
  // object as the show pages, so the two can never drift apart (spec §4.18).
  const [data, show, info] = await Promise.all([
    sanityFetch<ContactPageData>({ query: contactPageQuery, tags: ['contact', 'sanity'] }),
    sanityFetch<ShowVenueData>({ query: nationalShowVenueQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
  ]);

  // F19 (vote 1C): only the mailbox is sourced (Spec V3). The "SAOC Secretariat" and "General
  // enquiries" labels are not in the Council's Drive, whether they come from the CMS or the
  // fallback, so the public build shows the address alone and the beta preview marks the labels.
  const withhold = withholdPlaceholderProse();
  const contacts: DirectContact[] =
    data?.directContacts && data.directContacts.length > 0 ? data.directContacts : FALLBACK_CONTACTS;
  const isLabelUnsourced = (text: string | null) => text !== null && UNSOURCED_LABEL.test(text);

  return (
    <>
      <RouteHero
        exempt
        route="/contact"
        eyebrow="Get in touch"
        heading={data?.title ?? 'Contact SAOC'}
        lede={LEDE}
      />
      <div className="saoc-container py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* LEFT — direct contacts sidebar */}
          <aside className="space-y-6">
            <h2 className="font-serif font-normal text-[22px] text-ink">Direct contacts</h2>
            <ul className="space-y-5">
              {contacts.map((c, i) => {
                const marked = isLabelUnsourced(c.role) || isLabelUnsourced(c.name);
                const role = withhold && isLabelUnsourced(c.role) ? null : c.role;
                const name = withhold && isLabelUnsourced(c.name) ? null : c.name;
                return (
                  <li
                    key={i}
                    data-placeholder={marked && !withhold ? 'true' : undefined}
                    className="flex flex-col items-start gap-1 border-b border-rule pb-5 last:border-0"
                  >
                    {role ? (
                      <p className="font-mono text-[11px] tracking-[0.16em] text-muted">{role}</p>
                    ) : null}
                    {name ? <p className="mt-1 font-serif font-medium text-[17px] text-ink">{name}</p> : null}
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="mt-1 inline-flex min-h-11 items-center font-sans text-[14px] text-ink underline underline-offset-2 hover:text-accent outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
                      >
                        {c.email}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {withhold || !contacts.some((c) => isLabelUnsourced(c.role) || isLabelUnsourced(c.name)) ? null : (
              <PlaceholderMarker />
            )}

            <VenueCard
              venue={show?.venue}
              heading="National Show venue"
              status={info?.confirmations?.venue}
              pendingLabel={info?.pendingLabel}
              researchLabel={info?.researchLabel}
              linkClassName={SAOC_LINK_RING}
            />
            <p className="font-sans text-[16px] leading-[1.55] text-ink/70">
              Visiting the show?{' '}
              <Link
                href="/national-show"
                className="underline underline-offset-2 hover:text-accent"
              >
                See the National Show
              </Link>{' '}
              for travel, hours and admission.
            </p>
          </aside>

          {/* RIGHT — contact form */}
          <div>
            <h2 className="font-serif font-normal text-[22px] text-ink">Send a message</h2>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
