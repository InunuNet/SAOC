import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { SubmitEventForm } from '@/components/events/SubmitEventForm';

export const metadata: Metadata = {
  title: 'Submit an Event — SAOC',
  robots: { index: false },
};

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
      <p className="text-gray-600 mb-6">Sign in to submit an event for council review.</p>
      <a href="/login" className="underline text-gray-900 text-sm">
        Sign in
      </a>
    </div>
  );
}

export default async function SubmitEventPage() {
  const authed = await isAuthenticated();

  if (!authed) {
    return <LoginPrompt />;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2">Submit an event</h1>
      <p className="text-gray-600 text-sm mb-8">
        Your submission will be reviewed by the council before it appears on the site.
      </p>
      <SubmitEventForm />
    </div>
  );
}
