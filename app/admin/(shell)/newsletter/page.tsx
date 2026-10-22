import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { BUTTON_SECONDARY } from '@/components/admin/tokens';
import { NewsletterSubscribersTable, type SubscriberRow } from '@/components/admin/NewsletterSubscribersTable';
import { NEWSLETTER_COPY } from '@/lib/newsletter-copy';
import { listAllSubscribers } from '@/lib/newsletter-store';

// Firestore must only be read at request time, never during the build (see the vendors page).
export const dynamic = 'force-dynamic';

export default async function NewsletterAdminPage() {
  const subscribers = await listAllSubscribers();
  const sorted = [...subscribers].sort(
    (a, b) => (b.subscribedAt?.getTime() ?? 0) - (a.subscribedAt?.getTime() ?? 0),
  );
  const subscribedCount = sorted.filter((row) => row.status === 'subscribed').length;
  const rows: SubscriberRow[] = sorted.map((row) => ({
    id: row.id,
    email: row.email,
    source: row.source,
    status: row.status,
    subscribedAt: row.subscribedAt ? row.subscribedAt.toISOString() : null,
  }));
  const counts = `${subscribedCount} ${NEWSLETTER_COPY.adminCountSubscribed}, ${
    sorted.length - subscribedCount
  } ${NEWSLETTER_COPY.adminCountUnsubscribed}`;

  return (
    <PageShell>
      <PageHeader
        title={NEWSLETTER_COPY.adminHeading}
        subtitle={counts}
        actions={
          <a href="/api/admin/newsletter/export-csv" className={BUTTON_SECONDARY}>
            {NEWSLETTER_COPY.adminDownloadCsv}
          </a>
        }
      />
      <NewsletterSubscribersTable rows={rows} />
    </PageShell>
  );
}
