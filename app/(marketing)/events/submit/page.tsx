import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { SubmitEventPageBody } from '@/components/events/SubmitEventPageBody';
import { RouteHero } from '@/components/ui/RouteHero';
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

async function isAuthenticated(): Promise<boolean> {
  try {
    const session = (await cookies()).get('session')?.value;
    if (!session) return false;

    const { initAdmin } = await import('@/lib/firebase-admin');
    const { getAuth } = await import('firebase-admin/auth');
    initAdmin();
    await getAuth().verifySessionCookie(session, true);
    return true;
  } catch {
    return false;
  }
}

function LoginPrompt() {
  return (
    <RouteHero
      route="/events/submit"
      heading="Members only"
      lede="Event submission is available to SAOC members."
      actions={
        <a
          href="/contact"
          className="mt-8 inline-flex min-h-11 items-center bg-accent px-6 py-3 font-sans text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-accent-soft"
        >
          Contact us about membership
        </a>
      }
    />
  );
}

export default async function SubmitEventPage() {
  const authed = await isAuthenticated();

  if (!authed) {
    return <LoginPrompt />;
  }

  const listed = await sanityFetch<SanitySocietyRow[] | null>({
    query: societyListQuery,
    tags: ['societies', 'sanity'],
  });
  const societies = (listed ?? []).map((row) => ({ id: row._id, name: row.name }));

  return <SubmitEventPageBody societies={societies} />;
}
