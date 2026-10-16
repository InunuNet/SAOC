// =============================================================
// NOS — components/nos/NosBreadcrumb.tsx
// Server Component. The breadcrumb trail on a NOS page body: every crumb but the
// last is a link, the last is the unlinked current page (`aria-current="page"`).
// Karla at the label size (12px, 600, .14em, uppercase), solid ink-700 for the
// current crumb so it clears 4.5:1 without the muted/alpha treatment (ruling
// 2026-10-16 #7).
//
// Used by /national-show/archive/[year], where it carries the edition label that the
// hero eyebrow used to ("Show history — Edition XVIII · 2024", ruling 2026-10-16 #6).
// This is the NOS trail, deliberately not components/chrome/Breadcrumb.tsx (SAOC
// chrome: mono 10.5px, "Home" root, byte-identical for the SAOC routes).
// =============================================================

import Link from 'next/link';

export interface NosBreadcrumbItem {
  label: string;
  /** Omit on the last item: it is the current page and renders unlinked. */
  href?: string;
}

export interface NosBreadcrumbProps {
  items: NosBreadcrumbItem[];
}

export function NosBreadcrumb({ items }: NosBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="border-b border-rule py-2">
      <ol
        data-nos-wrap=""
        className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-700)]"
      >
        {items.map(({ label, href }, index) => (
          <li key={label} className="flex items-center gap-3">
            {index > 0 ? <span aria-hidden="true">—</span> : null}
            {href ? (
              <Link
                href={href}
                className="inline-flex min-h-[44px] items-center text-primary underline decoration-[var(--olive)] decoration-[1.5px] underline-offset-4 hover:decoration-[var(--primary)]"
              >
                {label}
              </Link>
            ) : (
              <span aria-current="page">{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
