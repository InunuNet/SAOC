import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { SubmitEventPageBody } from '@/components/events/SubmitEventPageBody';
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
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold mb-3">Members only</h1>
      <p className="text-gray-600 mb-6">Event submission is available to SAOC members.</p>
      <a href="/contact" className="underline text-gray-900 text-sm">
        Contact us about membership
      </a>
    </div>
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
