'use client';

// =============================================================
// SAOC — components/chrome/SearchOverlay.tsx
// Global search overlay. Triggered by:
//   - Cmd+K (mac) / Ctrl+K (win/linux)
//   - "/" key when no input/textarea is focused
//   - Header search button (via `open` prop from parent)
// Closes on Esc, backdrop click, or close button.
// Live-searches the listed societies via /api/societies/search (Sanity, `listed != false`).
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { nosUrl } from '@/lib/site-hosts';
import { ArrowIcon } from '@/components/ui/ArrowIcon';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface SocietyHit {
  name: string;
  slug: string;
  province: string | null;
  region: string | null;
}

interface SocietyResult {
  kind: 'society';
  item: SocietyHit;
  href: string;
}

const SEARCH_DEBOUNCE_MS = 150;

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

  // Live search: listed societies only, from the server (never a hardcoded list).
  const [hits, setHits] = useState<SocietyHit[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/societies/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: SocietyHit[]) => setHits(Array.isArray(data) ? data : []))
        .catch(() => {
          if (!controller.signal.aborted) setHits([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const societyResults: SocietyResult[] =
    q.trim().length === 0
      ? []
      : hits.map((item) => ({ kind: 'society', item, href: `/societies/${item.slug}` }));

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
                          <ArrowIcon />
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
                  <li key={`s-${r.item.slug}`}>
                    <Link
                      href={r.href}
                      onClick={onClose}
                      className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-bone text-ink"
                    >
                      <span>
                        <span className="block">{r.item.name}</span>
                        <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                          {[r.item.province, r.item.region].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span aria-hidden className="text-muted">
                        <ArrowIcon />
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
