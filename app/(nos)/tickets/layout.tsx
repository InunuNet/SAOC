import type { Metadata } from 'next';

import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { ticketingTestMetadata } from '@/lib/ticketing-test-metadata';

// R62 #1 (F18b): no brand switch at payment. The ticket routes sit under the NOS chrome
// (app/(nos)/layout.tsx) and inside the same `.nos-theme` scope as the show pages.
export function generateMetadata(): Metadata {
  return ticketingTestMetadata();
}

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <NosThemeScope>{children}</NosThemeScope>;
}
