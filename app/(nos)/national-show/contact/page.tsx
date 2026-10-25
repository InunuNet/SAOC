import type { Metadata } from 'next';

import { CONTACT_LINK } from '@/components/chrome/nav-config';
import { ContactForm } from '@/components/contact/ContactForm';
import { NosContactAside } from '@/components/contact/NosContactAside';
import { NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { ShowContactDetails } from '@/components/nos/ShowContactDetails';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { buildPageMetadata } from '@/lib/seo';
import { SHOW_TITLE } from '@/lib/show-title';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact',
  description: `Contact ${SHOW_TITLE}.`,
  image: nosOgImage('Contact — National Orchid Show'),
  path: '/national-show/contact',
});

// Lee-Ann's 2027 Show Contact information (Drive: National Show / Contact, v1.1): her committee list and
// the show's web address, word for word except that her "(Needs Surnames)" note to herself is not copy.
// The address and telephone number are in the aside card (ShowContactDetails). No lede: the line the
// page carried was a stand-in.
const COMMITTEE_HEADING = 'Committee';
const COMMITTEE = [
  "Hendrik Schoeman - Chair of show",
  "Barry Deutschmann - Vice Chair of show",
  "Bernadette Smith - Co-ordinator of the SAOC Symposium and marketing",
  "Caral-Anne van der Merwe - Co-ordinator of Hospitality and assisting with finances",
  "Scott Ormerod - Design and Advertising copy",
  "Vic Heard - Representative of WOSA and assisting with marketing and outings",
  "Lee-Ann McCleland - Show co-ordinator, website development and Treasurer",
  "Fiona Barnwell - Judging and show schedule",
  "Otto and Nerine Exhibition design and display",
  "Cara Holmes - Venue Layout",
] as const;
const SHOW_SITE_URL = 'http://nos.saoc.co.za/';

export default function NosContactPage() {
  return (
    <>
      <NosHero
        route="/national-show/contact"
        title={CONTACT_LINK.label}
        crumbLabel={CONTACT_LINK.label}
        priority
      />
      <DocumentLayout
        aside={
          <div data-nos-contact-aside="">
            <ShowContactDetails />
            <NosContactAside />
          </div>
        }
      >
        <div className="nos-doc-stack" data-nos-contact="page">
          <div className="doc-prose">
            <h2 className="doc-h2">{COMMITTEE_HEADING}</h2>
            <ul>
              {COMMITTEE.map((member) => (
                <li key={member}>{member}</li>
              ))}
            </ul>
            <p>
              <a href={SHOW_SITE_URL}>{SHOW_SITE_URL}</a>
            </p>
          </div>
          <div data-nos-contact-form="" className="w-full max-w-[640px]">
            <ContactForm site="nos" />
          </div>
        </div>
      </DocumentLayout>
      <NosShowIndex current="/national-show/contact" />
    </>
  );
}
