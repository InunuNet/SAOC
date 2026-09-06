// =============================================================
// SAOC — components/societies/SocietyFacts.tsx
// Server Component — society detail "at a glance" band. Renders a
// confirmed meeting day/venue as a real fact when the society has
// supplied one; founded year and member count (usually our own
// estimates) are folded into one quiet, single line rather than
// repeated as separate hedge badges — a real fact and an estimate
// should not carry equal visual weight.
// =============================================================

import type { SanitySociety } from './SocietyCard';

export interface SocietyFactsProps {
  society: SanitySociety;
}

export function SocietyFacts({ society }: SocietyFactsProps) {
  const hasConfirmedMeeting = Boolean(society.meets || society.venue);
  const estimateParts: string[] = [];
  if (society.founded) estimateParts.push(`est. ${society.founded}`);
  if (society.memberCount !== null && society.memberCount !== undefined) {
    estimateParts.push(`~${society.memberCount} members`);
  }
  const estimateIsPlaceholder = Boolean(society.foundedPlaceholder || society.memberCountPlaceholder);

  if (!hasConfirmedMeeting && estimateParts.length === 0) return null;

  return (
    <div className="border-y border-rule py-8">
      {hasConfirmedMeeting ? (
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {society.meets ? (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                Meets
              </dt>
              <dd className="mt-1 font-sans text-[15px] text-ink">{society.meets}</dd>
            </div>
          ) : null}
          {society.venue ? (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                Venue
              </dt>
              <dd className="mt-1 font-sans text-[15px] text-ink">{society.venue}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {estimateParts.length > 0 ? (
        <p
          data-placeholder={estimateIsPlaceholder ? 'true' : undefined}
          className={hasConfirmedMeeting ? 'mt-6 font-sans text-[13px] text-muted' : 'font-sans text-[13px] text-muted'}
        >
          {estimateParts.join(' · ')}
          {estimateIsPlaceholder ? (
            <span className="ml-2 border border-rule bg-bone px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              estimated
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
