// =============================================================
// components/show/nos/NosHubGroup.tsx
// Server Component — one of the /national-show hub's four IA groups (Visit,
// Programme, Exhibit & Trade, The Show). See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/hub-groups.golden.md.
//
// H2 — a real landmark: a <section> whose accessible name (aria-labelledby) matches its
// own heading, with the heading ahead of its links in document order. A group that is
// only a styled <div> is invisible to a screen-reader user navigating by heading, and on
// this subsection the hub is the whole navigation.
//
// R13 — column count is DERIVED from the member count via lib/grid-columns.ts, never a
// hardcoded class (G2/G3b). No hardcoded column-count utility below lg: mobile and tablet stack
// via flex-col.
// =============================================================

import Link from 'next/link';

import { COLUMN_CLASS, resolveGridLayout } from '@/lib/grid-columns';

export interface NosHubGroupMember {
  href: string;
  label: string;
}

export interface NosHubGroupProps {
  id: string;
  label: string;
  members: readonly NosHubGroupMember[];
}

export function NosHubGroup({ id, label, members }: NosHubGroupProps) {
  const headingId = `nos-hub-group-${id}`;
  const { columns } = resolveGridLayout(members.length);

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="font-serif text-[22px] font-medium text-ink">
        {label}
      </h3>
      <ul className={`mt-5 flex flex-col gap-3 lg:grid ${COLUMN_CLASS[columns]}`}>
        {members.map(({ href, label: memberLabel }) => (
          <li key={href}>
            <Link
              href={href}
              className="block border border-rule bg-parchment px-5 py-4 font-sans text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-parchment/60"
            >
              {memberLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
