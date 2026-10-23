// =============================================================
// SAOC — components/societies/SocietyCommittee.tsx
// Server Component — committee roles and names exactly as the society
// supplied them to Lee-Ann. Renders nothing when no committee is stored;
// no empty rows, no "not supplied" text. Uses the same dl markup and
// tokens as SocietyFacts.
// =============================================================

import type { SanitySociety } from './SocietyCard';

export interface SocietyCommitteeProps {
  society: SanitySociety;
}

export function SocietyCommittee({ society }: SocietyCommitteeProps) {
  const members = society.committee ?? [];
  if (members.length === 0) return null;

  return (
    <section>
      <span className="eyebrow">Committee</span>
      <dl className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {members.map((member) => (
          <div key={`${member.role}-${member.name}`}>
            <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {member.role}
            </dt>
            <dd className="mt-1 font-sans text-[15px] text-ink">{member.name}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
