// =============================================================
// SAOC — components/ui/DraftNotice.tsx
// Server Component — the one draft notice (NOS Design 2026-10-27): a plain 15px paragraph in muted
// ink with a bold lead-in and a 1px rule below. No border on the other sides, no fill, no box.
// Used by /members and /refunds.
// =============================================================

import type { ReactNode } from 'react';

interface DraftNoticeProps {
  /** The bold lead-in, e.g. "Not yet available." */
  leadIn: string;
  /** The rest of the notice, verbatim. */
  children: ReactNode;
}

export function DraftNotice({ leadIn, children }: DraftNoticeProps) {
  return (
    <p className="border-0 border-b border-solid border-rule bg-transparent pb-4 text-[15px] text-muted">
      <strong className="font-medium">{leadIn}</strong> {children}
    </p>
  );
}
