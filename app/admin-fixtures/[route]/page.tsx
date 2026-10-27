import { notFound } from 'next/navigation';

import { DoorScannerClient } from '@/components/admin/DoorScannerClient';
import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import {
  DashboardPanel,
  NeedsAttentionList,
  PANEL_HEADING_CLASS,
  QuickActionList,
  StatCards,
} from '@/components/admin/dashboard/DashboardParts';
import { AdminPill } from '@/components/admin/AdminPill';
import { AdminShell } from '@/components/admin/shell/AdminShell';
import { PaymentSettingsPanel } from '@/components/admin/PaymentSettingsPanel';
import { SettingsProfile } from '@/components/admin/SettingsProfile';
import { TicketsTable } from '@/components/admin/TicketsTable';
import { VendorApplicationReviewTable } from '@/components/admin/VendorApplicationReviewTable';
import { VendorReviewTable } from '@/components/admin/VendorReviewTable';
import { formatAdminClock } from '@/lib/admin-format';
import { isHostedRuntime } from '@/lib/fixture-route-guard';
import {
  FIXTURE_PENDING_COUNT,
  fixtureApplications,
  fixtureDashboard,
  fixtureStandPayments,
  fixtureTickets,
  fixtureVendors,
} from '@/lib/admin-fixtures/data';

// Render-check fixtures: the real shell and the real presentational components over static
// data, so layout can be verified without an authenticated session. There is no auth bypass
// anywhere; the route simply does not exist unless ADMIN_FIXTURES=1 is set at request time, and
// that flag is never put in apphosting.yaml or .env.local.example. See contracts/checks/
// admin-redesign/static.sh (fixtures-safe) and render-check.mjs (--no-flag).
export const dynamic = 'force-dynamic';

const FIXTURE_EMAIL = 'fixture-admin@example.org';

const ROUTE_PATHS: Record<string, string> = {
  dashboard: '/admin',
  tickets: '/admin/tickets',
  door: '/admin/door',
  vendors: '/admin/vendors',
  applications: '/admin/vendors/applications',
  payments: '/admin/payments',
  settings: '/admin/settings',
};

function renderBody(route: string, now: Date): React.ReactNode {
  switch (route) {
    case 'dashboard': {
      const data = fixtureDashboard(now);
      return (
        <PageShell>
          <PageHeader title="Dashboard" subtitle={`Updated ${formatAdminClock(now)}`} />
          <StatCards data={data} options={{ canReviewVendors: true, showNewsletter: true }} />
          <div className="mt-6 grid grid-cols-1 gap-4 min-[1280px]:grid-cols-2">
            <DashboardPanel>
              <h2 className={PANEL_HEADING_CLASS}>Quick actions</h2>
              <QuickActionList
                options={{ canReviewVendors: true, canManagePaymentSettings: true }}
              />
            </DashboardPanel>
            <DashboardPanel>
              <h2 className={PANEL_HEADING_CLASS}>Needs attention</h2>
              <NeedsAttentionList items={data.needsAttention} />
            </DashboardPanel>
          </div>
        </PageShell>
      );
    }
    case 'tickets':
      return (
        <PageShell>
          <PageHeader title="Tickets" />
          <TicketsTable tickets={fixtureTickets(now)} />
        </PageShell>
      );
    case 'door':
      return <DoorScannerClient initialCheckedInCount={31} />;
    case 'vendors':
      return (
        <PageShell>
          <PageHeader title="Vendors" />
          <VendorReviewTable
            submissions={fixtureVendors(now)}
            standPaymentStatusById={fixtureStandPayments()}
          />
        </PageShell>
      );
    case 'applications':
      return (
        <PageShell>
          <PageHeader title="Applications" />
          <VendorApplicationReviewTable applications={fixtureApplications(now)} />
        </PageShell>
      );
    case 'payments':
      return (
        <PageShell>
          <PageHeader title="Payment gateway settings" />
          <PaymentSettingsPanel
            initialGateway="ozow"
            initialTestAmount
            recent={[
              {
                id: 'fixture-change',
                setting: 'activePaymentGateway',
                from: { gateway: 'payfast' },
                to: { gateway: 'ozow' },
                byEmail: FIXTURE_EMAIL,
                at: now,
              },
            ]}
          />
        </PageShell>
      );
    case 'settings':
      return (
        <PageShell>
          <PageHeader title="Settings" />
          <div className="flex max-w-[520px] flex-col gap-4">
            <SettingsProfile
              name="Fixture Admin"
              email={FIXTURE_EMAIL}
              providerLabel="Google"
              roleLines={['All shows: owner']}
              signOutLabel="Sign out"
              signOutHelp="Signing out ends your session on every device."
              signOutControl={null}
            />
          </div>
        </PageShell>
      );
    default:
      return notFound();
  }
}

export default async function AdminFixturePage({ params }: { params: Promise<{ route: string }> }) {
  if (isHostedRuntime() || process.env.ADMIN_FIXTURES !== '1') {
    notFound();
  }
  const { route } = await params;
  const pathname = ROUTE_PATHS[route];
  if (!pathname) {
    notFound();
  }

  return (
    <>
      <AdminShell
        email={FIXTURE_EMAIL}
        canReviewVendors
        canManagePaymentSettings
        pendingCount={FIXTURE_PENDING_COUNT}
        pathnameOverride={pathname}
      >
        {renderBody(route, new Date())}
      </AdminShell>
      <AdminPill verifiedAdmin />
    </>
  );
}
