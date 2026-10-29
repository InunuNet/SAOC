import type { Metadata } from 'next';
import Link from 'next/link';

import { SubmitEventPageBody } from '@/components/events/SubmitEventPageBody';
import { RouteHero } from '@/components/ui/RouteHero';
import { getAdminSession } from '@/lib/admin-auth';
import { buildPageMetadata } from '@/lib/seo';
import { sanityFetch } from '@/sanity/lib/fetch';
import { societyListQuery } from '@/sanity/queries';

export const metadata: Metadata = buildPageMetadata({
  title: 'Submit an Event',
  description: 'Your submission will be reviewed by the council before it appears on the site.',
  path: '/events/submit',
  noIndex: true,
});

interface SanitySocietyRow {
  _id: string;
  name: string;
}

function LoginPrompt() {
  return (
    <RouteHero
      route="/events/submit"
      heading="Members only"
      lede="Event submission is available to SAOC members."
      actions={
        <Link
          href="/contact"
          className="mt-8 inline-flex min-h-11 items-center bg-accent px-6 py-3 font-sans text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-accent-soft"
        >
          Contact us about membership
        </Link>
      }
    />
  );
}

export default async function SubmitEventPage() {
  const session = await getAdminSession();

  if (!session.ok) {
    return <LoginPrompt />;
  }

  const listed = await sanityFetch<SanitySocietyRow[] | null>({
    query: societyListQuery,
    tags: ['societies', 'sanity'],
  });
  const societies = (listed ?? []).map((row) => ({ id: row._id, name: row.name }));

  return <SubmitEventPageBody societies={societies} />;
}
