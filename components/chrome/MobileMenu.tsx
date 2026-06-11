'use client';

// =============================================================
// SAOC — components/chrome/MobileMenu.tsx
// Full-screen overlay with right-sliding panel.
// Rendered by Header; receives the same NAV array.
// =============================================================

import Link from 'next/link';
import { X } from 'lucide-react';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  nav: ReadonlyArray<{ id: string; label: string; href: string; disabled?: boolean }>;
}

export function MobileMenu({ open, onClose, nav }: MobileMenuProps) {
  if (!open) return null;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/45"
      onClick={handleBackdrop}
    >
      <aside
        className="ml-auto h-full w-full max-w-[360px] bg-parchment p-6"
        style={{ animation: 'slideInFromRight 250ms cubic-bezier(0.4,0,0.2,1) both' }}
      >
        {/* Top row: wordmark + close */}
        <div className="flex items-center justify-between mb-8">
          <span className="font-serif text-[18px] font-medium text-ink">SAOC</span>
          <button
            type="button"
            aria-label="Close menu"
            className="p-2 text-ink hover:text-primary transition-colors duration-150"
            onClick={onClose}
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobile primary">
          <ul className="flex flex-col gap-1">
            {nav.map((n) => {
              if (n.disabled) {
                return (
                  <li key={n.id}>
                    <span
                      aria-disabled="true"
                      className="flex items-center justify-between px-3 py-3 font-sans text-[15px] text-muted/60 cursor-not-allowed"
                    >
                      {n.label}
                      <span className="rounded-full bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={onClose}
                    className="flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150"
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer meta */}
        <div className="mt-8 pt-6 border-t border-rule flex flex-col gap-1">
          <a
            href="mailto:council@saoc.co.za"
            className="font-mono text-[12px] text-muted hover:text-primary transition-colors duration-150"
          >
            council@saoc.co.za
          </a>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted/55">
            Est. 1968
          </span>
        </div>
      </aside>

      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
