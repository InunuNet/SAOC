// =============================================================
// SAOC — components/admin/StatusPill.tsx
//
// F14 (nos-design-system M5) — the single implementation of admin's four-state status
// vocabulary. See .agent/memory/project/specs/nos-design-system/goldens/m5-admin-ia.golden.md
// §4: every domain status string used anywhere in /admin (ticket, vendor application, vendor
// submission, vendor stand-order statuses) is MAPPED onto exactly one of four meanings —
// `pending` / `active` / `done` / `blocked` — never a fifth. The domain string is what the
// label shows; the mapping only decides colour. Colour is never the only channel (every pill
// renders text), and `blocked` (settled, negative) keeps the semantic error hue rather than a
// brand colour — guardrail 1 of the mission's designer ruling.
//
// Per-feature ad-hoc status pills are the defect this file exists to prevent — every table in
// /admin renders status through this component, not through its own inline span + colour map.
// =============================================================

export type StatusVocabulary = 'pending' | 'active' | 'done' | 'blocked';

// Every domain status string this codebase's admin surfaces currently render, mapped onto one
// of the four states above. Unrecognised strings fall back to `pending` (see
// resolveStatusVocabulary) — "needs a human to look at this" is the safest default for a
// status this mapping doesn't yet know about, never a silent `done`.
const DOMAIN_STATUS_TO_VOCABULARY: Record<string, StatusVocabulary> = {
  // Ticket positions (types/index.ts TicketStatus)
  reserved: 'pending',
  paid: 'done',
  'checked-in': 'done',
  cancelled: 'blocked',
  refunded: 'blocked',

  // Vendor applications (VendorApplicationStatus) / vendor submissions (VendorSubmissionStatus)
  pending: 'pending',
  submitted: 'pending',
  'under-review': 'active',
  approved: 'done',
  declined: 'blocked',
  rejected: 'blocked',

  // Vendor stand orders (VendorStandOrderStatus)
  'not-started': 'pending',
  failed: 'blocked',
};

/**
 * Pure, exported mapping from a domain status string onto exactly one of the four defined
 * vocabulary states. Testable and greppable in isolation from any JSX.
 */
export function resolveStatusVocabulary(domainStatus: string): StatusVocabulary {
  return DOMAIN_STATUS_TO_VOCABULARY[domainStatus] ?? 'pending';
}

// Reuses only existing SAOC admin tokens for pending/active/done, plus Tailwind's default red
// for `blocked` — a genuinely semantic error colour, deliberately NOT one of the brand tokens,
// so a declined/rejected/failed/cancelled status is never mistaken for a styled brand accent.
const VOCABULARY_STYLES: Record<StatusVocabulary, string> = {
  pending: 'bg-bone text-muted border border-rule',
  active: 'bg-primary-100 text-primary-800',
  done: 'bg-primary text-ivory',
  blocked: 'bg-red-50 text-red-700 border border-red-200',
};

interface StatusPillProps {
  /** The domain status string, e.g. "paid", "under-review", "declined". */
  status: string;
  /** Overrides the visible label while the domain `status` still decides the colour — for
   *  surfaces (e.g. stand-payment "not-started") that want a friendlier label than the raw
   *  domain string. */
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const vocabulary = resolveStatusVocabulary(status);

  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${VOCABULARY_STYLES[vocabulary]}`}
    >
      {label ?? status}
    </span>
  );
}
