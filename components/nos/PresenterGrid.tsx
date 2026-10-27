'use client';

import { type ReactNode, useState } from 'react';

// PR-1 / IG-G1: the role filter of the guest list. It is rendered only when the listed guests span at
// least two roles, as a ruled text row in the sub-nav style (underline marks the current one), and it
// narrows the list with a data attribute the stylesheet reads. Without script every guest shows.
const MIN_ROLES = 2;
const ALL_ROLES = 'All';

export function GuestRoleFilter({
  roles,
  children,
}: {
  roles: readonly string[];
  children: ReactNode;
}) {
  const [current, setCurrent] = useState<string>(ALL_ROLES);
  if (roles.length < MIN_ROLES) return <>{children}</>;

  return (
    <>
      <div data-guest-filter="" className="nos-pr-filter" role="group" aria-label="Filter by role">
        {[ALL_ROLES, ...roles].map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={current === role}
            onClick={() => setCurrent(role)}
          >
            {role}
          </button>
        ))}
      </div>
      <div data-role-filter={current === ALL_ROLES ? undefined : current}>{children}</div>
    </>
  );
}
