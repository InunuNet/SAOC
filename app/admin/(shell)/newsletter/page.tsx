import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { BUTTON_SECONDARY } from '@/components/admin/tokens';
import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { listAllSubscribers } from '@/lib/newsletter-store';

// Firestore must only be read at request time, never during the build (see the vendors page).
export const dynamic = 'force-dynamic';

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const HEAD_CELL_CLASS = 'px-3 py-2 font-semibold';
const CELL_CLASS = 'px-3 py-2';

function formatDate(value: Date | null): string {
  return value ? value.toLocaleString('en-ZA', DATE_FORMAT) : '';
}

export default async function NewsletterAdminPage() {
  const subscribers = await listAllSubscribers();
  const sorted = [...subscribers].sort(
    (a, b) => (b.subscribedAt?.getTime() ?? 0) - (a.subscribedAt?.getTime() ?? 0),
  );
  const subscribedCount = sorted.filter((row) => row.status === 'subscribed').length;
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left font-sans text-[14px] text-ink">
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className={HEAD_CELL_CLASS}>{NEWSLETTER_COPY.adminColumnEmail}</th>
              <th scope="col" className={HEAD_CELL_CLASS}>{NEWSLETTER_COPY.adminColumnSource}</th>
              <th scope="col" className={HEAD_CELL_CLASS}>{NEWSLETTER_COPY.adminColumnStatus}</th>
              <th scope="col" className={HEAD_CELL_CLASS}>{NEWSLETTER_COPY.adminColumnSubscribed}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-b border-rule">
                <td className={CELL_CLASS}>{row.email}</td>
                <td className={CELL_CLASS}>{row.source}</td>
                <td className={CELL_CLASS}>{row.status}</td>
                <td className={CELL_CLASS}>{formatDate(row.subscribedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
