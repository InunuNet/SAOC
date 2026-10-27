// =============================================================
// SAOC — components/societies/SocietyFacts.tsx
// Server Component — society detail "at a glance": one label/value definition list (the /tickets
// facts pattern: a small label over a serif value). A confirmed meeting day, venue and contact
// are facts; the founded year and member count (usually our own estimates) are further rows of
// the same list, and a society whose figures are estimates carries the one marker line under it.
// The email is the longest value, so it takes the full measure.
// =============================================================

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';

import type { SanitySociety } from './SocietyCard';

export interface SocietyFactsProps {
  society: SanitySociety;
}

interface Fact {
  label: string;
  value: string;
  href?: string;
  /** The longest values (an email address) take the full measure of the list. */
  wide?: boolean;
}

const LABEL_CLASSES = 'font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-muted';
const VALUE_CLASSES = 'mt-1 font-serif text-[19px] leading-[1.3] text-ink';

function buildFacts(society: SanitySociety): Fact[] {
  const facts: Fact[] = [];
  if (society.meets) facts.push({ label: 'Meets', value: society.meets });
  if (society.venue) facts.push({ label: 'Venue', value: society.venue });
  if (society.annualShow) facts.push({ label: 'Annual show', value: society.annualShow });
  if (society.founded) facts.push({ label: 'Founded', value: String(society.founded) });
  if (society.memberCount !== null && society.memberCount !== undefined) {
    facts.push({ label: 'Members', value: `~${society.memberCount}` });
  }
  if (society.contactPhone) {
    facts.push({
      label: 'Telephone',
      value: society.contactPhone,
      href: `tel:${society.contactPhone.replace(/[^+\d]/g, '')}`,
    });
  }
  if (society.contactEmail) {
    facts.push({
      label: 'Email',
      value: society.contactEmail,
      href: `mailto:${society.contactEmail}`,
      wide: true,
    });
  }
  return facts;
}

export function SocietyFacts({ society }: SocietyFactsProps) {
  const facts = buildFacts(society);
  if (facts.length === 0) return null;
  const estimated = Boolean(
    (society.founded && society.foundedPlaceholder) ||
      (society.memberCount !== null && society.memberCount !== undefined && society.memberCountPlaceholder),
  );

  return (
    <div data-placeholder={estimated ? 'true' : undefined} className="border-y border-rule py-8">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className={`border-l border-accent pl-4${fact.wide ? ' sm:col-span-2' : ''}`}
          >
            <dt className={LABEL_CLASSES}>{fact.label}</dt>
            <dd className={VALUE_CLASSES}>
              {fact.href ? (
                <a
                  href={fact.href}
                  className="inline-flex min-h-11 items-center break-all underline underline-offset-2"
                >
                  {fact.value}
                </a>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {estimated ? (
        <div className="mt-6">
          <PlaceholderMarker />
        </div>
      ) : null}
    </div>
  );
}
