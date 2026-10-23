import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { ENQUIRY_HEADING, ENQUIRY_INTRO_PLACEHOLDER } from '@/lib/sponsor-enquiry-copy';
import type { SponsorEnquirySite } from '@/lib/sponsor-enquiry';

import { SponsorEnquiryFocus } from './SponsorEnquiryFocus';
import { SponsorEnquiryForm } from './SponsorEnquiryForm';

interface SponsorEnquirySectionProps {
  /** Which site's sponsors page renders this; the marker lets a check prove each host serves only its own. */
  site: SponsorEnquirySite;
}

/**
 * The inline sponsor enquiry (mission sponsor-enquiry-form, SP1): a section on each existing
 * sponsors page, targeted by the "Talk to us about sponsorship" CTA at `#enquire`. No new route.
 * The heading is a functional label shown always; the introduction and the consent wording are
 * copy gaps, so the beta preview marks them and a public build omits the introduction.
 */
export function SponsorEnquirySection({ site }: SponsorEnquirySectionProps) {
  const withhold = withholdPlaceholderProse();

  return (
    <section
      id="enquire"
      data-sponsor-enquiry={site}
      aria-labelledby="enquire-heading"
      className="scroll-mt-36 border border-rule bg-bone p-6 sm:p-10"
    >
      <div className="max-w-[640px]">
        <h2
          id="enquire-heading"
          tabIndex={-1}
          className="font-serif font-normal text-[26px] text-ink outline-none"
        >
          {ENQUIRY_HEADING}
        </h2>
        {withhold ? null : (
          <div data-placeholder="true" className="mt-3 flex flex-col items-start">
            <p className="font-sans text-[16px] leading-[1.55] text-ink/70">
              {ENQUIRY_INTRO_PLACEHOLDER}
            </p>
            <PlaceholderMarker />
          </div>
        )}
        <div className="mt-8">
          <SponsorEnquiryForm site={site} markPlaceholders={!withhold} />
        </div>
      </div>
      <SponsorEnquiryFocus />
    </section>
  );
}
