import { notFound, redirect } from 'next/navigation';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { StudioClient } from '@/components/admin/studio/StudioClient';
import { getAdminSession } from '@/lib/admin-auth';
import { readSavedDesign } from '@/lib/ticket-design/saved';
import { STUDIO_DEFAULT_SLUG, studioTypeOptions } from '@/lib/ticket-design/studio-samples';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ticket design studio', robots: { index: false, follow: false } };

/**
 * /admin/studio -- ticket design studio (mission ticket-design-studio F2). Dev-only: 404 unless
 * TICKET_STUDIO_ENABLED=1, which is never set in apphosting.yaml. The shell layout already
 * redirects visitors without a session; this page re-checks.
 */
export default async function StudioPage() {
  if (process.env.TICKET_STUDIO_ENABLED !== '1') notFound();
  const session = await getAdminSession();
  if (!session.ok) redirect('/admin/login');

  const types = studioTypeOptions();
  if (!types.some((type) => type.slug === STUDIO_DEFAULT_SLUG)) notFound();
  const entries = await Promise.all(
    types.map(async (type) => [type.slug, await readSavedDesign(type.slug)] as const),
  );
  const designs = Object.fromEntries(entries);

  return (
    <PageShell>
      <PageHeader
        title="Ticket design studio"
        subtitle="Choose from the approved options and watch the real email and ticket PDF update. Wording is read-only."
      />
      <StudioClient
        types={types}
        initialSlug={STUDIO_DEFAULT_SLUG}
        designs={designs}
      />
    </PageShell>
  );
}
