import type { Metadata } from 'next';

import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import { ContactForm } from '@/components/contact';
import { VenueCard } from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  contactPageQuery,
  nationalShowVenueQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import type { ShowVenue, ShowVisitorInfo } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = { title: 'Contact' };

interface DirectContact {
  name: string | null;
  role: string | null;
  email: string | null;
}

interface ContactPageData {
  title: string | null;
  directContacts: DirectContact[] | null;
}

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

  const contacts: DirectContact[] =
    data?.directContacts && data.directContacts.length > 0
      ? data.directContacts
      : FALLBACK_CONTACTS;

  return (
    <>
      <PageHero
        image="/images/orchid-pink.jpg"
        eyebrow="Get in touch"
        heading={data?.title ?? 'Contact SAOC'}
        lede="Questions about societies, shows, judging, or membership? Reach the right person, or send us a message."
      />
      <div className="mx-auto max-w-[1280px] px-8 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* LEFT — direct contacts sidebar */}
          <aside className="space-y-6">
            <h2 className="font-serif text-[22px] font-semibold text-ink">Direct contacts</h2>
            <ul className="space-y-5">
              {contacts.map((c, i) => (
                <li key={i} className="border-b border-rule pb-5 last:border-0">
                  {c.role ? (
                    <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
                      {c.role}
                    </p>
                  ) : null}
                  {c.name ? (
                    <p className="mt-1 font-serif text-[17px] text-ink">{c.name}</p>
                  ) : null}
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="mt-1 inline-block font-sans text-[14px] text-ink underline underline-offset-2 hover:text-accent"
                    >
                      {c.email}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>

            <VenueCard
              venue={show?.venue}
              heading="National Show venue"
              status={info?.confirmations?.venue}
              pendingLabel={info?.pendingLabel}
              researchLabel={info?.researchLabel}
            />
            <p className="font-sans text-[14px] text-ink/70">
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
            <h2 className="font-serif text-[22px] font-semibold text-ink">Send a message</h2>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
