import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { ENQUIRY_HEADING } from '@/lib/sponsor-enquiry-copy';
import type { SponsorEnquirySite } from '@/lib/sponsor-enquiry';

import { SponsorEnquiryFocus } from './SponsorEnquiryFocus';
import { SponsorEnquiryForm } from './SponsorEnquiryForm';

interface SponsorEnquirySectionProps {
  /** Which site's sponsors page renders this; the marker lets a check prove each host serves only its own. */
  site: SponsorEnquirySite;
  /** Set on a page built against the content standard: the section sits in the document column on the page ground, with the shared h2. */
  inDocument?: boolean;
}

/**
 * The inline sponsor enquiry (mission sponsor-enquiry-form, SP1): a section on each existing
 * sponsors page, targeted by the "Talk to us about sponsorship" CTA at `#enquire`. No new route.
 * The heading is a functional label shown always; the introduction and the consent wording are
 * copy gaps, so the beta preview shows one marker line for the whole form and a public build none.
 */
export function SponsorEnquirySection({ site, inDocument = false }: SponsorEnquirySectionProps) {
  const withhold = withholdPlaceholderProse();

  return (
    <section
      id="enquire"
      data-sponsor-enquiry={site}
      aria-labelledby="enquire-heading"
      className={
        inDocument ? 'doc-section scroll-mt-36' : 'scroll-mt-36 border border-rule bg-bone p-6 sm:p-10'
      }
    >
      <div className={inDocument ? undefined : 'max-w-[640px]'}>
        <h2
          id="enquire-heading"
          tabIndex={-1}
          className={inDocument ? 'doc-h2 outline-none' : 'font-serif font-normal text-[22px] text-ink outline-none'}
        >
          {ENQUIRY_HEADING}
        </h2>
        {withhold ? null : (
          <div data-placeholder="true" className="mt-3">
            <PlaceholderMarker />
          </div>
        )}
        <div className="mt-8">
          <SponsorEnquiryForm site={site} />
        </div>
      </div>
      <SponsorEnquiryFocus />
    </section>
  );
}
