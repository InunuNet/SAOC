import type { Metadata } from 'next';

import { ticketingTestMetadata } from '@/lib/ticketing-test-metadata';

export function generateMetadata(): Metadata {
  return ticketingTestMetadata();
}

export default function TicketingTestTitleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
