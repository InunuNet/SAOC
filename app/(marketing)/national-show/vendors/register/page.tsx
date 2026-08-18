import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { VendorRegisterForm } from '@/components/vendors';

export const metadata: Metadata = { title: 'Vendor Registration — National Show' };

export default function VendorRegisterPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading="Vendor Registration"
        lede="Register your business as a vendor at the 2027 SAOC National Show."
      />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
        <VendorRegisterForm />
      </div>
    </>
  );
}
