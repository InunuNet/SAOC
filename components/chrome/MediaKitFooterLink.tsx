'use client';

import Link from 'next/link';

import { useIsAdmin } from '@/components/admin/useIsAdmin';

interface MediaKitFooterLinkProps {
  href: string;
  label: string;
  className?: string;
}

// The media kit is for signed-in members only (admins until a members system exists), so its footer
// link renders only once /api/admin/whoami confirms a session. The page gate itself is unchanged.
export function MediaKitFooterLink({ href, label, className }: MediaKitFooterLinkProps) {
  if (!useIsAdmin()) return null;
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
