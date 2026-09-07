// =============================================================
// NOS — components/nos/SectionNav.tsx
// Server Component. Sticky in-page anchor nav for long-form NOS pages
// (landing, plan-your-visit, etc.). Jost, wide-tracked, small — the eyebrow
// register, never the headline register.
// =============================================================

export interface NosSectionNavItem {
  href: string;
  label: string;
}

export interface NosSectionNavProps {
  items: NosSectionNavItem[];
  className?: string;
}

export function SectionNav({ items, className = '' }: NosSectionNavProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Section navigation"
      className={[
        'sticky top-[64px] z-30 border-b-[length:var(--border-hairline)] border-[var(--rule)] bg-parchment/95 backdrop-blur',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ul className="mx-auto flex max-w-[1280px] flex-wrap gap-x-6 gap-y-2 overflow-x-auto px-8 py-3">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="font-sans text-[12px] font-medium uppercase tracking-[0.2em] text-muted transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
