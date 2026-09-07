// =============================================================
// SAOC — components/admin/PartyBadge.tsx
//
// F14 (nos-design-system M5) — the single implementation of admin's party-type vocabulary.
// This is the concrete answer to "is there a vendor? an exhibitor? a visitor?" (see
// .agent/memory/project/specs/nos-design-system/goldens/m5-admin-ia.golden.md §5): audience
// becomes a first-class, visible, filterable attribute of a record, rendered the same shape,
// position and wording everywhere it appears — never a per-surface ad-hoc badge.
//
// A record's party type is DERIVED from which collection it came from (vendorApplications /
// vendorSubmissions → vendor, tickets/orders → visitor, the allowlisted admin roster →
// committee); there is no exhibitor collection yet (see /admin/exhibitors), so `exhibitor` is
// used only where this component is rendered against the declared-empty section, never
// against fabricated rows.
// =============================================================

export type PartyType = 'vendor' | 'exhibitor' | 'visitor' | 'committee';

const PARTY_LABELS: Record<PartyType, string> = {
  vendor: 'Vendor',
  exhibitor: 'Exhibitor',
  visitor: 'Visitor',
  committee: 'Committee',
};

// Same neutral ink-on-bone token every party type shares — the badge distinguishes audiences
// by TEXT, not by colour-coding a fifth vocabulary on top of StatusPill's four. Colour is
// reserved for status; party identity is reserved for wording.
const PARTY_BADGE_STYLE = 'bg-bone text-ink border border-rule';

interface PartyBadgeProps {
  type: PartyType;
}

export function PartyBadge({ type }: PartyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${PARTY_BADGE_STYLE}`}
    >
      {PARTY_LABELS[type]}
    </span>
  );
}
