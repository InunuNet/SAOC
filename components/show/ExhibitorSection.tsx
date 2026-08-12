// =============================================================
// SAOC — components/show/ExhibitorSection.tsx
// Server Component — one reference section of the exhibitor guide: heading, portable-text
// body, and the marker saying how far from settled SAOC policy it is.
//
// Renders nothing when there is no body, so a half-filled Sanity document produces a
// shorter page rather than an empty heading with a marker under it.
// =============================================================

import type { ReactNode } from 'react';

import { PortableText } from '@portabletext/react';

import type { ExhibitorSection as ExhibitorSectionData, ExhibitorStatus } from '@/types';

import { ExhibitorStatusBadge } from './ExhibitorStatusBadge';

export interface ExhibitorSectionProps {
  section?: ExhibitorSectionData | null;
  status?: ExhibitorStatus | string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  questionLabel?: string | null;
  children?: ReactNode;
  id?: string;
}

export function ExhibitorSection({
  section,
  status,
  pendingLabel,
  researchLabel,
  questionLabel,
  children,
  id,
}: ExhibitorSectionProps) {
  const body = section?.body ?? [];
  if (!section?.heading && body.length === 0) return null;

  return (
    <section id={id} className="border-t border-rule pt-8">
      {section?.heading ? (
        <h3 className="font-serif text-[24px] font-medium leading-snug text-ink">
          {section.heading}
        </h3>
      ) : null}

      <ExhibitorStatusBadge
        status={status}
        pendingLabel={pendingLabel}
        researchLabel={researchLabel}
        questionLabel={questionLabel}
      />

      {body.length > 0 ? (
        <div className="mt-3 max-w-3xl space-y-4 font-sans text-[16px] leading-relaxed text-ink/80">
          <PortableText value={body} />
        </div>
      ) : null}

      {children}
    </section>
  );
}
