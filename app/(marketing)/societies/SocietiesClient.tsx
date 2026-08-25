'use client';

import { useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

import { SocietyCard } from '@/components/societies';
import type { SanitySociety } from '@/components/societies';
import type { Province } from '@/types';

// The "All" chip is a UI affordance, not a province document — it is synthesised here
// so no editor can delete it and break filtering.
const ALL_CHIP: Province = { code: 'ALL', name: 'All provinces' };

export interface SocietiesClientProps {
  societies: SanitySociety[];
  /** Province filter chips, sourced from the Sanity `province` documents. */
  provinces: Province[];
}

export function SocietiesClient({ societies, provinces }: SocietiesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const province = (searchParams.get('province') ?? 'ALL').toUpperCase();
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
      {/* Search input */}
      <div>
        <input
          type="search"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="Search by name or region…"
          aria-label="Search societies"
          className="w-full max-w-md rounded-sm border border-rule bg-parchment px-4 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none focus:border-ink/40"
        />
      </div>

      {/* Province chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by province">
        {[ALL_CHIP, ...provinces].map((p) => {
          const active = province === p.code;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => setParam('province', p.code)}
              aria-pressed={active}
              aria-label={p.name}
              className={
                active
                  ? 'rounded-full border border-ink bg-ink px-3.5 py-1.5 font-mono text-[11px] tracking-[0.16em] text-ivory'
                  : 'rounded-full border border-rule bg-parchment px-3.5 py-1.5 font-mono text-[11px] tracking-[0.16em] text-muted hover:border-ink/40'
              }
            >
              {p.code === 'ALL' ? 'All' : p.code}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="py-8 font-sans text-[15px] text-muted">
          No societies match your filters. Clear the search or pick &ldquo;All&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SocietyCard key={s._id} society={s} />
          ))}
        </div>
      )}
    </div>
  );
}
