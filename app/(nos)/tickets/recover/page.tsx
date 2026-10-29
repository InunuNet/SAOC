import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ConfirmedTicketList } from '@/components/tickets/ConfirmedTicketList';
import { getConfirmedOrderByOrderId, getOrderRecoveryRecord } from '@/lib/orders';
import { resolveRecoveryAccess } from '@/lib/recovery-access';

// The emailed recovery link carries a bearer token and the page reads live Firestore: never
// cached, never indexed, and no Referer (the token is in the URL). The same headers are set in
// next.config.ts so they do not depend on this file. Display only: no form, no resend.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function RecoverTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;

  // anchor: recover-resolve
  const access = await resolveRecoveryAccess({
    rawToken: token,
    secret: process.env.RECOVERY_TOKEN_SECRET,
    now: new Date(),
    loadOrder: getOrderRecoveryRecord,
  });
  // anchor: recover-denied
  if (!access.ok) {
    notFound();
  }

  // anchor: recover-order
  const confirmed = await getConfirmedOrderByOrderId(access.orderId);
  // anchor: recover-order-missing
  if (!confirmed) {
    notFound();
  }

  return (
    <>
      <NosHero route="/tickets/confirmation" title="Tickets" priority />
      <NosSection>
        <div className="mx-auto max-w-[600px] text-center">
          <ConfirmedTicketList confirmedOrder={confirmed} downloadTicketButtonLabel="Download ticket" />
        </div>
      </NosSection>
    </>
  );
}
