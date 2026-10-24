import type { Metadata } from 'next';

import { CONTACT_LINK } from '@/components/chrome/nav-config';
import { ContactForm } from '@/components/contact/ContactForm';
import { NosContactAside } from '@/components/contact/NosContactAside';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { NOS_CONTACT_LEDE_PLACEHOLDER } from '@/lib/nos-contact-copy';
import { buildPageMetadata } from '@/lib/seo';
import { SHOW_TITLE } from '@/lib/show-title';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Gap prose and markers depend on env (withholdPlaceholderProse), so the page renders per request:
// a static prerender would freeze the build-time mode.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact',
  description: `Contact ${SHOW_TITLE}.`,
  image: nosOgImage('Contact — National Orchid Show'),
  path: '/national-show/contact',
});

export default async function NosContactPage() {
  const markPlaceholders = !withholdPlaceholderProse();

  return (
    <>
      <NosHero
        route="/national-show/contact"
        title={CONTACT_LINK.label}
        lede={
          markPlaceholders ? (
            <>
              {NOS_CONTACT_LEDE_PLACEHOLDER}
              <PlaceholderMarker tone="dark" />
            </>
          ) : undefined
        }
        priority
      />
      <NosSection
        data-nos-contact="page"
        wrapClassName="grid gap-12 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:gap-20"
      >
        <div data-nos-contact-form="" className="w-full max-w-[640px]">
          <ContactForm site="nos" markPlaceholders={markPlaceholders} />
        </div>
        <div data-nos-contact-aside="">
          <NosContactAside />
        </div>
      </NosSection>
    </>
  );
}
