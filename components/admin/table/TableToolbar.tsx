'use client';

import { FOCUS_RING, BUTTON_SECONDARY } from '@/components/admin/tokens';

export interface FilterOption {
  value: string;
  label: string;
}

interface TableToolbarProps {
  searchLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  filterLabel?: string;
  filterOptions?: readonly FilterOption[];
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  countText: string;
  csvHref?: string;
}

/** Search, a segmented status filter, a count, and CSV where one exists. */
export function TableToolbar({
  searchLabel,
  search,
  onSearchChange,
  filterLabel,
  filterOptions,
  filterValue,
  onFilterChange,
  countText,
  csvHref,
}: TableToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        aria-label={searchLabel}
        placeholder={searchLabel}
        autoComplete="off"
        className={`h-11 min-w-0 flex-1 basis-[220px] rounded-[2px] border border-rule bg-ivory px-3 font-sans text-[14px] text-ink placeholder:text-muted ${FOCUS_RING}`}
      />
      {filterOptions && onFilterChange ? (
        <div
          role="group"
          aria-label={filterLabel}
          className="inline-flex max-w-full flex-wrap overflow-hidden rounded-[2px] border border-rule"
        >
          {filterOptions.map((option) => {
            const pressed = option.value === filterValue;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={pressed}
                onClick={() => onFilterChange(option.value)}
                className={`min-h-[44px] px-2.5 font-sans text-[13px] font-medium sm:px-3 ${
                  pressed ? 'bg-primary text-ivory' : 'bg-ivory text-ink hover:bg-bone'
                } ${FOCUS_RING}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <p className="font-sans text-[13px] text-muted" aria-live="polite">
        {countText}
      </p>
      {csvHref ? (
        <a href={csvHref} className={BUTTON_SECONDARY}>
          Download CSV
        </a>
      ) : null}
    </div>
  );
}
