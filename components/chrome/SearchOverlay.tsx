'use client';

// =============================================================
// SAOC — components/chrome/SearchOverlay.tsx
// Global search overlay. Triggered by:
//   - Cmd+K (mac) / Ctrl+K (win/linux)
//   - "/" key when no input/textarea is focused
//   - Header search button (via `open` prop from parent)
// Closes on Esc, backdrop click, or close button.
// Live-filters societies (by name + province) from @/lib/data.
// =============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { societies } from '@/lib/data';
import type { Society } from '@/types';
import { nosUrl } from '@/lib/site-hosts';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface SocietyResult {
  kind: 'society';
  item: Society;
  href: string;
}

const SUGGESTIONS: ReadonlyArray<{ label: string; href: string; crossSite?: boolean }> = [
  { label: 'About SAOC', href: '/about' },
  { label: 'Find a society', href: '/societies' },
  { label: 'National Show', href: nosUrl('/'), crossSite: true },
  { label: 'Events calendar', href: '/events' },
  { label: 'Contact the council', href: '/contact' },
];

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset the query when the overlay opens. Adjusted during render (rather
  // than in an effect) per https://react.dev/learn/you-might-not-need-an-effect
  // — avoids the extra commit a setState-in-effect would otherwise trigger.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setQ('');
  }

  // Focus the input when opened — a real external-system side effect (DOM
  // focus), so it stays in an effect; it does not call setState.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  // Global keyboard listener: Esc closes when open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Live filter
  const societyResults = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length === 0) return [] as SocietyResult[];

    return societies
      .filter((s) => s.name.toLowerCase().includes(term) || s.province.toLowerCase().includes(term))
      .slice(0, 5)
      .map((item): SocietyResult => ({ kind: 'society', item, href: '/societies' }));
  }, [q]);

  if (!open) return null;

  const totalResults = societyResults.length;
  const hasQuery = q.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search SAOC"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 backdrop-blur-[3px] pt-[10vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[680px] rounded-sm border border-rule bg-parchment shadow-float">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-rule px-5 py-4">
          <Search size={20} strokeWidth={1.5} className="text-muted shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search societies, shows, classes, awards..."
            className="flex-1 bg-transparent font-sans text-[16px] text-ink placeholder:text-muted outline-none"
            aria-label="Search query"
          />
          <kbd className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted border border-rule rounded-sm px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {!hasQuery && (
            <>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted mb-3">
                Try
              </div>
              <ul className="flex flex-col gap-1">
                {SUGGESTIONS.map((s) => {
                  const SuggestionLink = s.crossSite ? 'a' : Link;
                  return (
                    <li key={s.href}>
                      <SuggestionLink
                        href={s.href}
                        onClick={onClose}
                        className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-bone text-ink"
                      >
                        <span>{s.label}</span>
                        <span aria-hidden className="text-muted">
                          →
                        </span>
                      </SuggestionLink>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {hasQuery && totalResults === 0 && (
            <div className="font-sans text-[14px] text-muted py-2">
              No matches for &ldquo;{q}&rdquo;. Try &ldquo;Cape&rdquo;, &ldquo;Durban&rdquo;, or
              &ldquo;judging&rdquo;.
            </div>
          )}

          {hasQuery && societyResults.length > 0 && (
            <section className="mb-4">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted mb-2">
                Societies
              </div>
              <ul className="flex flex-col gap-1">
                {societyResults.map((r) => (
                  <li key={`s-${r.item.name}`}>
                    <Link
                      href={r.href}
                      onClick={onClose}
                      className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-bone text-ink"
                    >
                      <span>
                        <span className="block">{r.item.name}</span>
                        <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                          {r.item.province} · {r.item.city}
                        </span>
                      </span>
                      <span aria-hidden className="text-muted">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
