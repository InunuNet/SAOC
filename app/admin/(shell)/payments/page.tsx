import { getFirestore } from 'firebase-admin/firestore';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { PaymentSettingsPanel } from '@/components/admin/PaymentSettingsPanel';
import { initAdmin } from '@/lib/firebase-admin';
import { isOzowSandboxTestModeEnabled } from '@/lib/ozow-sandbox-test-mode';
import {
  listRecentPaymentSettingsChanges,
  type PaymentSettingsChange,
} from '@/lib/payment-settings-audit';
import { resolveActiveGateway } from '@/lib/payments/active-gateway';

export const metadata = { title: 'Payment gateway settings' };

/**
 * /admin/payments -- owner-only (gated by ./layout.tsx). Reads the current settings and the
 * audit trail server-side and hands plain data to the client panel, which writes through the
 * existing /api/admin/settings/* routes. A failed audit read degrades to an inline message.
 */
export default async function AdminPaymentsPage() {
  const [gateway, testAmount] = await Promise.all([
    resolveActiveGateway(),
    isOzowSandboxTestModeEnabled(),
  ]);

  let recent: PaymentSettingsChange[] = [];
  let recentLoadFailed = false;
  try {
    recent = await listRecentPaymentSettingsChanges(getFirestore(initAdmin()));
  } catch (error) {
    recentLoadFailed = true;
    console.error('[admin/payments] Failed to load recent changes:', {
      operation: 'list payment settings changes',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
  }

  return (
    <PageShell>
      <PageHeader title="Payment gateway settings" />
      <PaymentSettingsPanel
        initialGateway={gateway}
        initialTestAmount={testAmount}
        recent={recent}
        recentLoadFailed={recentLoadFailed}
      />
    </PageShell>
  );
}
