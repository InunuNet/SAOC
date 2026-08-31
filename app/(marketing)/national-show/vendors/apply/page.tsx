import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { VendorApplyForm } from '@/components/vendors';

export const metadata: Metadata = { title: 'Vendor Application — National Show' };

export default function VendorApplyPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading="Vendor Application"
        lede="Apply to exhibit as a vendor at the 2027 SAOC National Show. Once the committee reviews and approves your application, we'll email you a link to complete your full registration and agreement."
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        <VendorApplyForm />
      </div>
    </>
  );
}
