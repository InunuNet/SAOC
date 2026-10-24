'use client';

import { useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

import { SocietiesGrid } from '@/components/societies';
import type { SanitySociety } from '@/components/societies';
import {
  allSocietiesHaveProvince,
  effectiveProvinceFilter,
  provinceCounts,
} from '@/lib/societies-view';
import type { Province } from '@/types';

// The search string lives here once: it is both the placeholder and the accessible name.
const SEARCH_PLACEHOLDER = 'Search by name or region…';

export interface SocietiesClientProps {
  societies: SanitySociety[];
  /** Province filter chips, sourced from the Sanity `province` documents. */
  provinces: Province[];
}

export function SocietiesClient({ societies, provinces }: SocietiesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Chips stay hidden until every listed society has a province (NOS Design ruling SO-3).
  const chipsVisible = allSocietiesHaveProvince(societies);
  const province = effectiveProvinceFilter(
    (searchParams.get('province') ?? 'ALL').toUpperCase(),
    chipsVisible,
  );
  const q = searchParams.get('q') ?? '';

  function setParam(key: 'province' | 'q', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const isDefault =
      (key === 'province' && (value === 'ALL' || value === '')) ||
      (key === 'q' && value.trim() === '');
    if (isDefault) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const counts = useMemo(() => provinceCounts(societies, provinces), [societies, provinces]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return societies.filter((s) => {
      const provinceOk = province === 'ALL' || (s.province ?? '').toUpperCase() === province;
      const textOk =
        term.length === 0 ||
        s.name.toLowerCase().includes(term) ||
        (s.region ?? '').toLowerCase().includes(term);
      return provinceOk && textOk;
    });
  }, [societies, province, q]);

  return (
    <div className="space-y-8">
      {/* One filters row: province chips left, search right (golden .filters). */}
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-rule pb-6">
        {chipsVisible ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by province">
            {[ALL_CHIP, ...provinces].map((p) => {
              const active = province === p.code;
              const count = counts[p.code] ?? 0;
              const disabled = count === 0;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={disabled ? undefined : () => setParam('province', p.code)}
                  aria-pressed={active}
                  aria-disabled={disabled || undefined}
                  aria-label={`${p.name}, ${count}`}
                  className={
                    disabled
                      ? 'inline-flex min-h-11 min-w-11 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-rule bg-parchment px-3.5 py-1.5 font-sans text-[14px] text-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-2'
                      : active
                        ? 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-3.5 py-1.5 font-sans text-[14px] text-ivory transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-2'
                        : 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-rule bg-parchment px-3.5 py-1.5 font-sans text-[14px] text-ink transition-colors duration-150 hover:border-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-2'
                  }
                >
                  {/* Full name from 481px up, abbreviation at 480px and below; the accessible name
                    (aria-label) is the full name and count at every width. */}
                  <span aria-hidden="true" className="min-[481px]:hidden">
                    {p.code === 'ALL' ? 'All' : p.code}
                  </span>
                  <span aria-hidden="true" className="hidden min-[481px]:inline">
                    {p.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`font-mono text-[10.5px] ${active ? 'opacity-85' : 'opacity-70'}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="ml-auto flex min-h-11 min-w-[260px] items-center gap-2 rounded-sm border border-rule bg-parchment px-3 text-muted focus-within:outline-2 focus-within:outline-solid focus-within:outline-primary focus-within:outline-offset-2">
          <Search size={16} aria-hidden />
          <input
            id="societies-search"
            type="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            aria-label={SEARCH_PLACEHOLDER}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 font-sans text-[16px] text-ink placeholder:text-muted outline-none"
          />
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {filtered.length} {filtered.length === 1 ? 'society' : 'societies'}
      </p>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="py-8 font-sans text-[15px] text-muted">
          No societies match your filters. Clear the search or pick &ldquo;All&rdquo;.
        </p>
      ) : (
        <div>
          {filtered.some((s) => s.foundedPlaceholder || s.memberCountPlaceholder) ? (
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Founding years and member counts marked (estimated) are our own estimates,
              pending confirmation from each society.
            </p>
          ) : null}
          <SocietiesGrid societies={filtered} />
        </div>
      )}
    </div>
  );
}

// The "All" chip is a UI affordance, not a province document: it is synthesised here so no editor
// can delete it and break filtering. Declared below the component, read only at render.
const ALL_CHIP: Province = { code: 'ALL', name: 'All provinces' };
