import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { listAllSubscribers } from '@/lib/newsletter-store';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { AdminNav } from '@/components/admin/AdminNav';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import type { ShowIdentity } from '@/types';

// Firestore must only be read at request time, never during the build (see app/admin/vendors/page.tsx).
export const dynamic = 'force-dynamic';

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

function formatDate(value: Date | null): string {
  return value ? value.toLocaleString('en-ZA', DATE_FORMAT) : '';
}

export default async function NewsletterAdminPage() {
  const session = await getAdminSession();
  let canReviewVendors = false;
  let canManagePaymentSettings = false;
  if (session.ok) {
    const now = new Date();
    const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
    const options = { now, lookupShowWindow };
    canReviewVendors = hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', options);
    canManagePaymentSettings = hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'manage-payment-settings', options);
  }

  const [show, subscribers] = await Promise.all([
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    listAllSubscribers(),
  ]);
  const sorted = [...subscribers].sort(
    (a, b) => (b.subscribedAt?.getTime() ?? 0) - (a.subscribedAt?.getTime() ?? 0),
  );
  const subscribedCount = sorted.filter((row) => row.status === 'subscribed').length;

  return (
    <>
      <UtilityBar show={show} />
      <Header />
      <AdminNav
        variant="bar"
        canReviewVendors={canReviewVendors}
        canManagePaymentSettings={canManagePaymentSettings}
      />
      <main>
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
          <span className="eyebrow">Admin</span>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
              {NEWSLETTER_COPY.adminHeading}
            </h1>
            <a
              href="/api/admin/newsletter/export-csv"
              className="font-sans text-[13px] font-medium text-ink underline hover:text-accent"
            >
              {NEWSLETTER_COPY.adminDownloadCsv}
            </a>
          </div>
          <p className="mt-4 font-sans text-[14px] text-ink/80">
            {subscribedCount} {NEWSLETTER_COPY.adminCountSubscribed}, {sorted.length - subscribedCount}{' '}
            {NEWSLETTER_COPY.adminCountUnsubscribed}
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse text-left font-sans text-[14px] text-ink">
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className="px-3 py-2 font-semibold">{NEWSLETTER_COPY.adminColumnEmail}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{NEWSLETTER_COPY.adminColumnSource}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{NEWSLETTER_COPY.adminColumnStatus}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{NEWSLETTER_COPY.adminColumnSubscribed}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id} className="border-b border-rule">
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{row.source}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{formatDate(row.subscribedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
