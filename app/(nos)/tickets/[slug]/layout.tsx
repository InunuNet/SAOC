import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { fetchTicketTypeBySlug, isHiddenDemoProduct } from '@/lib/data/ticket-type-lookup';
import { isRestrictedTicketSlug } from '@/lib/speakers-partner';

// TK-404: loading.tsx wraps the page in a Suspense boundary, which flushes the shell with a 200
// before the page's notFound() resolves. A layout renders outside that boundary, so an unknown or
// hidden-demo slug is resolved here, before the shell, and answers a real 404.
export default async function TicketSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The hidden Speakers Partner ticket has its own password-gated page; the generic buy route
  // answers 404 for it, exactly as for a slug that does not exist.
  if (isRestrictedTicketSlug(slug)) notFound();
  const ticketType = await fetchTicketTypeBySlug(slug);
  if (!ticketType || isHiddenDemoProduct(ticketType)) notFound();
  return children;
}
