import type { Metadata } from 'next';

import { NosHero } from '@/components/nos/NosHero';
import { VendorApplyForm } from '@/components/vendors';

export const metadata: Metadata = { title: 'Vendor Application — National Show' };

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
