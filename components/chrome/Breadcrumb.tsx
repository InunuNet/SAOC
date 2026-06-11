// =============================================================
// SAOC — components/chrome/Breadcrumb.tsx
// Server Component — parchment breadcrumb trail for interior pages.
// =============================================================

import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="bg-parchment border-b border-rule">
      <div className="mx-auto flex max-w-[1280px] items-center flex-wrap gap-0 px-8 py-3">
        <Link
          href="/"
          className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted hover:text-primary transition-colors duration-150"
        >
          Home
        </Link>
        {items.map((item, index) => (
          <span key={index} className="flex items-center">
            <span className="font-mono text-[10.5px] text-muted mx-1.5">/</span>
            {item.href ? (
              <Link
                href={item.href}
                className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted hover:text-primary transition-colors duration-150"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted"
              >
                {item.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
