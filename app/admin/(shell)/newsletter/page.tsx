import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { BUTTON_SECONDARY } from '@/components/admin/tokens';
import { NewsletterSubscribersTable, type SubscriberRow } from '@/components/admin/NewsletterSubscribersTable';
import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { NEWSLETTER_COPY } from '@/lib/newsletter-copy';
import {
  listCounts,
  NEWSLETTER_LIST_FILTERS,
  NEWSLETTER_STATUS_FILTERS,
  rowMatches,
  type NewsletterListFilter,
  type NewsletterStatusFilter,
} from '@/lib/newsletter-preferences';
import { listAllSubscribers } from '@/lib/newsletter-store';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

// Firestore must only be read at request time, never during the build (see the vendors page).
export const dynamic = 'force-dynamic';

// Subscribers are buyer data, so removing them from a list needs the same capability as the
// buyer exports (owner and manager today); the API route enforces it again.
const NEWSLETTER_MANAGE_CAPABILITY = 'export-buyer-data';

type SearchParams = Promise<{ list?: string | string[]; status?: string | string[] }>;

// An unknown or repeated value falls back to the default view rather than erroring.
function pickFilter<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const single = Array.isArray(value) ? value[0] : value;
  return allowed.find((candidate) => candidate === single) ?? fallback;
}

async function adminCanManage(): Promise<boolean> {
  const session = await getAdminSession();
  if (!session.ok) return false;
  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  return hasCapability(session.decodedToken, NATIONAL_SHOW_ID, NEWSLETTER_MANAGE_CAPABILITY, {
    now,
    lookupShowWindow,
  });
}

export default async function NewsletterAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const list: NewsletterListFilter = pickFilter(params.list, NEWSLETTER_LIST_FILTERS, 'all');
  const status: NewsletterStatusFilter = pickFilter(params.status, NEWSLETTER_STATUS_FILTERS, 'all');

  const [subscribers, canManage] = await Promise.all([listAllSubscribers(), adminCanManage()]);
  const sorted = [...subscribers].sort(
    (a, b) => (b.subscribedAt?.getTime() ?? 0) - (a.subscribedAt?.getTime() ?? 0),
  );
  const subscribedCount = sorted.filter((row) => row.status === 'subscribed').length;
  const rows: SubscriberRow[] = sorted
    .filter((row) => rowMatches(row, list, status))
    .map((row) => ({
      id: row.id,
      email: row.email,
      source: row.source,
      status: row.status,
      topics: row.topics,
      topicRemovals: row.topicRemovals.map((entry) => ({
        topic: entry.topic,
        removedAt: entry.removedAt ? entry.removedAt.toISOString() : null,
      })),
      restoreTopics: row.restoreTopics,
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
          <>
            <p className="font-sans text-[13px] text-muted">{NEWSLETTER_COPY.adminExportHint}</p>
            <a href={`/api/admin/newsletter/export-csv?list=${list}`} className={BUTTON_SECONDARY}>
              {NEWSLETTER_COPY.adminDownloadCsv}
            </a>
          </>
        }
      />
      <NewsletterSubscribersTable
        rows={rows}
        list={list}
        status={status}
        counts={listCounts(sorted, status)}
        canManage={canManage}
      />
    </PageShell>
  );
}
