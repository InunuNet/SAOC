// =============================================================
// SAOC — components/show/EntryFormLink.tsx
// Server Component — THE DEAD-LINK GUARD.
//
// There is no online entry submission. The entry form is a PDF the show committee
// supplies, served from Sanity or hosted elsewhere. Until one exists, this block renders
// the pending note as PLAIN TEXT with no anchor at all.
//
// The failure this guards against is an anchor with an empty, "#" or undefined href. It
// looks clickable, it is clickable, and it goes nowhere — which is worse than no link,
// because an exhibitor concludes the site is broken rather than that the form is not out
// yet. There is no branch in this component that can emit a placeholder href: the anchor
// is only constructed once a non-empty target has been resolved.
// =============================================================

import { Button } from '@/components/nos/Button';
import type { ExhibitorStatus } from '@/types';

import { ExhibitorStatusBadge } from './ExhibitorStatusBadge';

export interface EntryFormLinkProps {
  heading?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  url?: string | null;
  entryFormPendingNote?: string | null;
  status?: ExhibitorStatus | string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  questionLabel?: string | null;
  id?: string;
}

function resolveTarget(fileUrl?: string | null, url?: string | null) {
  const file = typeof fileUrl === 'string' ? fileUrl.trim() : '';
  if (file.length > 0) return { href: file, download: true };
  const external = typeof url === 'string' ? url.trim() : '';
  if (external.length > 0) return { href: external, download: false };
  return null;
}

export function EntryFormLink({
  heading,
  fileUrl,
  fileName,
  url,
  entryFormPendingNote,
  status,
  pendingLabel,
  researchLabel,
  questionLabel,
  id,
}: EntryFormLinkProps) {
  const target = resolveTarget(fileUrl, url);

  return (
    <section id={id} className="nos-surface">
      {heading ? <h2 className="font-serif text-ink">{heading}</h2> : null}

      <ExhibitorStatusBadge
        status={status}
        pendingLabel={pendingLabel}
        researchLabel={researchLabel}
        questionLabel={questionLabel}
      />

      {target === null ? (
        <p className="mt-3 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
          {entryFormPendingNote}
        </p>
      ) : (
        <Button
          as="a"
          href={target.href}
          variant="ghost"
          className="mt-4"
          {...(target.download ? { download: fileName ?? true } : { rel: 'noopener noreferrer' })}
        >
          Download the entry form
        </Button>
      )}
    </section>
  );
}
