import { CAPABILITIES, ROLE_NAMES, ROLE_TO_CAPABILITIES } from '@/lib/admin-roles';
import { getVendorAdminNotifyRecipients } from '@/lib/vendor-admin-notify-recipients';
import { PartyBadge } from './PartyBadge';

/**
 * READ-ONLY team panel (F14, nos-design-system M5 / platform-README.md D-A2). Closes the gap
 * that lib/admin-roles.ts defines three roles and nine capabilities with no UI to see them —
 * assignment stays a manual Firebase custom-claim operation. Deliberately renders no form and
 * calls no write route: writing custom claims from the UI is a privilege-escalation surface
 * (a bug in that form is a total compromise of the admin boundary) and is explicitly deferred,
 * never built here.
 *
 * Reuses `getVendorAdminNotifyRecipients()` for the allowlist value only — the exact
 * "read-only reuse, never gating, never a second roster" precedent that function's own header
 * comment documents (see docs/vendor-flow-notifications.md). This panel has no authorization
 * meaning of its own; it never calls `isEmailAllowlisted` or any admin-auth.ts export.
 *
 * A pure Server Component (no Firestore read, no cookies of its own) — safe to render inside
 * app/admin/settings/layout.tsx, which already gates this subtree on `manage-payment-settings`.
 */
export function AdminTeamPanel() {
  const allowlistedEmails = getVendorAdminNotifyRecipients();

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-8">
      <div className="max-w-[720px] border border-rule bg-bone px-6 py-6">
        <span className="eyebrow">
          Team <PartyBadge type="committee" />
        </span>
        <h2 className="mt-2 font-serif text-[20px] font-semibold text-ink">
          Admin roles &amp; capabilities
        </h2>
        <p className="mt-1 font-sans text-[13px] text-muted">
          Read-only. Roles and capabilities are fixed in code (lib/admin-roles.ts); who holds
          which role is a Firebase custom-claim assigned by hand, not editable here.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <caption className="sr-only">Role to capability mapping</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="whitespace-nowrap border-b border-rule px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-muted"
                >
                  Capability
                </th>
                {ROLE_NAMES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="whitespace-nowrap border-b border-rule px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-muted"
                  >
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((capability) => (
                <tr key={capability}>
                  <th
                    scope="row"
                    className="whitespace-nowrap border-b border-rule-soft px-3 py-2 text-left font-sans text-[13px] font-medium text-ink"
                  >
                    {capability}
                  </th>
                  {ROLE_NAMES.map((role) => (
                    <td
                      key={role}
                      className="whitespace-nowrap border-b border-rule-soft px-3 py-2 font-sans text-[13px] text-ink"
                    >
                      {ROLE_TO_CAPABILITIES[role].has(capability) ? 'Yes' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 font-serif text-[16px] font-semibold text-ink">
          Allowlisted admin emails
        </h3>
        {allowlistedEmails.length === 0 ? (
          <p className="mt-1 font-sans text-[13px] text-muted">
            No admin emails are currently allowlisted.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {allowlistedEmails.map((email) => (
              <li key={email} className="font-mono text-[13px] text-ink">
                {email}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
