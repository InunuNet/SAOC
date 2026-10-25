import type { Metadata } from 'next';

import { CONTACT_LINK } from '@/components/chrome/nav-config';
import { ContactForm } from '@/components/contact/ContactForm';
import { NosContactAside } from '@/components/contact/NosContactAside';
import { NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { ShowContactDetails } from '@/components/nos/ShowContactDetails';
import { buildPageMetadata } from '@/lib/seo';
import { SHOW_OFFICE_CONTACT_LINE, SHOW_OFFICE_PHONE, SHOW_OFFICE_PHONE_HREF } from '@/lib/show-contact';
import { SHOW_TITLE } from '@/lib/show-title';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact',
  description: `Contact ${SHOW_TITLE}.`,
  image: nosOgImage('Contact — National Orchid Show'),
  path: '/national-show/contact',
});

// CT-G1 (NOS Design, comms.md): Lee-Ann's 2027 Show Contact information (Drive: National Show /
// Contact, v1.1). The committee list is hers, word for word, split at her " - " into name and role.
// Her row for Otto and Nerine (no surnames yet), the show's web address and her "Email address??"
// notes are not rendered (owner item dddd). The address and telephone are in the card
// (ShowContactDetails). The page is presentation only: ContactForm keeps every field and handler.
const COMMITTEE_HEADING = 'Committee';
const COMMITTEE: readonly { name: string; role: string }[] = [
  { name: 'Hendrik Schoeman', role: 'Chair of show' },
  { name: 'Barry Deutschmann', role: 'Vice Chair of show' },
  { name: 'Bernadette Smith', role: 'Co-ordinator of the SAOC Symposium and marketing' },
  { name: 'Caral-Anne van der Merwe', role: 'Co-ordinator of Hospitality and assisting with finances' },
  { name: 'Scott Ormerod', role: 'Design and Advertising copy' },
  { name: 'Vic Heard', role: 'Representative of WOSA and assisting with marketing and outings' },
  { name: 'Lee-Ann McCleland', role: 'Show co-ordinator, website development and Treasurer' },
  { name: 'Fiona Barnwell', role: 'Judging and show schedule' },
  { name: 'Cara Holmes', role: 'Venue Layout' },
];
const FACT_PHONE = 'Telephone';
const FACT_COORDINATOR = 'Show co-ordinator';
const COORDINATOR_NAME = SHOW_OFFICE_CONTACT_LINE.split(' - ')[0];

export default function NosContactPage() {
  return (
    <>
      <NosHero
        route="/national-show/contact"
        title={CONTACT_LINK.label}
        crumbLabel={CONTACT_LINK.label}
        facts={[
          { term: FACT_PHONE, value: SHOW_OFFICE_PHONE },
          { term: FACT_COORDINATOR, value: COORDINATOR_NAME },
        ]}
        factLinks={{ [FACT_PHONE]: SHOW_OFFICE_PHONE_HREF }}
        priority
      />
      <div className="nos-ct-body saoc-container" data-doc-layout="" data-nos-contact="page">
        <div data-nos-contact-form="" className="nos-ct-form">
          <ContactForm site="nos" />
        </div>
        <aside data-ct-card="" className="nos-ct-card">
          <ShowContactDetails />
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
                <dd>{member.role}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <NosShowIndex current="/national-show/contact" />
    </>
  );
}
