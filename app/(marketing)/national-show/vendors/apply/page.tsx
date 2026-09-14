import type { Metadata } from 'next';

import { NosHero } from '@/components/nos/NosHero';
import { VendorApplyForm } from '@/components/vendors';
import { buildPageMetadata } from '@/lib/seo';

// Indexable (this is the public front door of the vendor flow) but carries no Event or Offer
// markup — the flow it leads into is invitation-gated, which Google excludes (M6/B8c).
export const metadata: Metadata = buildPageMetadata({
  title: 'Vendor Application — National Show',
  description:
    'Apply to exhibit as a vendor at the 2027 SAOC National Show. Once the committee ' +
    'reviews and approves your application, we will email you a link to complete your full ' +
    'registration and agreement.',
  path: '/national-show/vendors/apply',
});

// F10 (nos-design-system, M3): applying should feel like an invitation to a curated trade
// floor, not a bureaucratic form (research item D, WOC framing). VendorApplyForm is
// SAOC-owned and untouched — it already re-skins through the inherited nos-theme tokens.
export default function VendorApplyPage() {
  return (
    <>
      <NosHero
        image="/images/orchid-purple.jpg"
        eyebrow="National Show"
        title="Vendor Application"
        lede="Apply to exhibit as a vendor at the 2027 SAOC National Show. Once the committee reviews and approves your application, we'll email you a link to complete your full registration and agreement."
        priority
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        <VendorApplyForm />
      </div>
    </>
  );
}
