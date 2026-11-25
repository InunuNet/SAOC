import type { Metadata } from 'next';

import { CONTACT_LINK } from '@/components/chrome/nav-config';
import { ContactForm } from '@/components/contact/ContactForm';
import { NosContactAside } from '@/components/contact/NosContactAside';
import { NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { SaocText } from '@/components/nos/SaocText';
import { ShowContactDetails } from '@/components/nos/ShowContactDetails';
import { VenueCard } from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import { SHOW_TITLE } from '@/lib/show-title';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';
import type { ShowVenue, ShowVisitorInfo } from '@/types';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact',
  description: `Contact ${SHOW_TITLE}.`,
  image: nosOgImage('Contact — National Orchid Show'),
  path: '/national-show/contact',
});

// CT-G1 (NOS Design, comms.md): Lee-Ann's 2027 Show Contact information (Drive: National Show /
// Contact, v1.1). The committee list is hers, word for word, split at her " - " into name and role.
// Her row for Otto and Nerine (no surnames yet), the show's web address and her "Email address??"
// notes are not rendered (owner item dddd). The address is in the card (the telephone number was removed 19 Nov 2026 at Brad's instruction)
// (ShowContactDetails). The page is presentation only: ContactForm keeps every field and handler.
const COMMITTEE_HEADING = 'Committee';
const COMMITTEE: readonly { name: string; role: string }[] = [
  { name: 'Hendrik Schoeman', role: 'Chair of show' },
  { name: 'Barry Deutschmann', role: 'Vice Chair of show' },
  { name: 'Bernadette Smith', role: 'Co-ordinator of the SAOC Symposium and marketing' },
  { name: 'Caral-Anne van der Westhuizen', role: 'Co-ordinator of Hospitality and assisting with finances' },
  { name: 'Scott Ormerod', role: 'Design and Advertising copy' },
  { name: 'Vic Heard', role: 'Representative of WOSA and assisting with marketing and outings' },
  { name: 'Lee-Ann McCleland', role: 'Show co-ordinator, website development and Treasurer' },
  { name: 'Fiona Barnwell', role: 'Judging and show schedule' },
  { name: 'Cara Holmes', role: 'Venue Layout' },
];

// Same bound as the SAOC pages: Sanity edits reach the page within the 60s CDN window.
export const revalidate = 60;

interface ShowVenueData {
  venue: ShowVenue | null;
}

export default async function NosContactPage() {
  // The venue block is the shared VenueCard reading nationalShow.venue, moved here from the SAOC
  // /contact page (Brad, 25 Nov 2026), so it cannot drift from the show's other venue surfaces.
  const [show, info] = await Promise.all([
    sanityFetch<ShowVenueData>({ query: nationalShowVenueQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<ShowVisitorInfo>({ query: showVisitorInfoQuery, tags: ['showVisitorInfo', 'sanity'] }),
  ]);
  return (
    <>
      <NosHero
        route="/national-show/contact"
        className="nos-contact-hero"
        title={CONTACT_LINK.label}
        crumbLabel={CONTACT_LINK.label}
        priority
      />
      <div className="nos-ct-body saoc-container" data-doc-layout="" data-nos-contact="page">
        <div data-nos-contact-form="" data-doc-main="" className="nos-ct-form">
          <ContactForm site="nos" />
        </div>
        <aside data-ct-card="" className="ds-card nos-ct-card">
          <ShowContactDetails />
          <div className="mb-12">
            <VenueCard
              venue={show?.venue}
              heading="National Orchid Show venue"
              status={info?.confirmations?.venue}
              pendingLabel={info?.pendingLabel}
              researchLabel={info?.researchLabel}
              mapAction="button"
            />
          </div>
          <NosContactAside />
        </aside>
        <section className="nos-ct-team" aria-labelledby="ct-committee-h">
          <h2 id="ct-committee-h" className="doc-h2">
            {COMMITTEE_HEADING}
          </h2>
          <dl data-ct-team="">
            {COMMITTEE.map((member) => (
              <div key={member.name}>
                <dt>{member.name}</dt>
                <dd>
                  <p>
                    <SaocText>{member.role}</SaocText>
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <NosShowIndex current="/national-show/contact" />
    </>
  );
}
