// =============================================================
// SAOC — components/legal/LegalBreadcrumb.tsx
// Server Component — the breadcrumb of a host-neutral legal page (Privacy, Terms). The same page
// renders on both hosts, so the trail follows the host: the SAOC trail on the SAOC site, the NOS
// trail on the NOS site. Reading the host is why these pages are already dynamic.
// =============================================================

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { NosBreadcrumb } from '@/components/nos/NosBreadcrumb';
import { requestSite } from '@/lib/request-site';

export async function LegalBreadcrumb({ label }: { label: string }) {
  const site = await requestSite();
  return site === 'nos' ? (
    <NosBreadcrumb items={[{ label }]} />
  ) : (
    <Breadcrumb items={[{ label }]} />
  );
}
