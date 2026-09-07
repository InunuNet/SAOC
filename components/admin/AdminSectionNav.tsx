'use client';

// =============================================================
// SAOC — components/admin/AdminSectionNav.tsx
//
// F14 (nos-design-system M5) — Level 2 sub-nav, per
// goldens/m5-admin-ia.golden.md §2: "A section with more than one stage renders a sub-nav
// beneath the bar. A section with one stage renders none." Vendors (Submissions /
// Applications) and Visitors (Overview / Tickets) each have two stages; Exhibitors, Door,
// Settings and the top-level Overview have one and render no instance of this component.
//
// Presentation-only, same as AdminNav — no import of getAdminSession or hasCapability. The
// same focus-ring token is reused; this is not a new focus vocabulary.
// =============================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2';

interface AdminSectionNavLink {
  label: string;
  href: string;
}

interface AdminSectionNavProps {
  ariaLabel: string;
  links: AdminSectionNavLink[];
}

export function AdminSectionNav({ ariaLabel, links }: AdminSectionNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="border-b border-rule bg-ivory">
      <div className="mx-auto flex max-w-[1280px] flex-wrap gap-2 px-4 py-2.5 sm:px-8">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'rounded-sm px-3 py-1.5 font-sans text-[13px] text-ink transition-colors duration-150 hover:text-primary',
                active ? 'bg-primary-100 font-semibold text-primary' : '',
                FOCUS_RING,
              ].join(' ')}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
