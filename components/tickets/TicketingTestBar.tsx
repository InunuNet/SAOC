'use client';

import { usePathname } from 'next/navigation';

import { TicketingTestBarView } from '@/components/tickets/TicketingTestBarView';
import { isTicketingSurfacePath, isTicketingTestMode } from '@/lib/ticketing-test-mode';

// Mission committee-testing F1 -- mounted once as the first element of NosFrame. Renders in the
// server HTML on every ticketing surface while payments are not live, and nowhere else.
export function TicketingTestBar() {
  const pathname = usePathname();
  if (!isTicketingTestMode() || !isTicketingSurfacePath(pathname)) return null;
  return <TicketingTestBarView />;
}
