import type { Metadata } from 'next';

import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { ticketingTestMetadata } from '@/lib/ticketing-test-metadata';

// /vsp renders the vendor stand-payment status page, which belongs to the show tree; it wears the
// same `.nos-theme` scope as /national-show/* and /tickets/*.
export function generateMetadata(): Metadata {
  return ticketingTestMetadata();
}

export default function VspLayout({ children }: { children: React.ReactNode }) {
  return <NosThemeScope>{children}</NosThemeScope>;
}
