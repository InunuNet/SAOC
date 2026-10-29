// =============================================================
// NOS — components/show/ShowJumpChips.tsx
// Server Component — the one wrapping row of in-page jump chips (R52). The FAQ category
// chips and the exhibitor "On this page" chips are the same control, so the class string
// lives here and nowhere else.
// =============================================================

export interface ShowJumpChip {
  href: string;
  label: string;
}

export interface ShowJumpChipsProps {
  label: string;
  items: ShowJumpChip[];
  className?: string;
  // Appended to each chip link when given; omitted, the rendered class string is unchanged.
  linkClassName?: string;
}

export function ShowJumpChips({
  label,
  items,
  className = 'mb-10',
  linkClassName,
}: ShowJumpChipsProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className={`inline-flex min-h-[44px] items-center rounded-[length:var(--radius-pill)] border-[length:var(--border-primary)] border-primary bg-transparent px-3 font-sans text-[14px] font-semibold tracking-normal text-ink hover:bg-bone motion-safe:transition-[color,background-color] motion-safe:duration-150 focus-visible:bg-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]${linkClassName ? ` ${linkClassName}` : ''}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
