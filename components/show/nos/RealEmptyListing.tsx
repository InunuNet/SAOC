// =============================================================
// components/show/nos/RealEmptyListing.tsx
// Server Component — the "real empty listing" M4/F14 requires for
// /national-show/sa-exhibitors, /international-guests and /sponsors while zero records
// exist. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §5.
//
// An empty listing is a PAGE, not a shrug: it shows the shape of the card that is
// coming (the field labels the real record will carry) and states the absence in
// words — what will appear here, and when it is expected, in relative terms only (this
// project never invents a date). It never says "no results", and never says
// "coming soon" as its only statement.
// =============================================================

export interface RealEmptyListingProps {
  /** The field labels the eventual record card will carry, in display order. */
  fieldLabels: readonly string[];
  /** What will appear here, stated in words. Never "no results" or a bare "coming soon". */
  absenceStatement: string;
}

export function RealEmptyListing({ fieldLabels, absenceStatement }: RealEmptyListingProps) {
  return (
    <div className="border-[length:var(--border-primary)] border-dashed border-rule bg-parchment p-8">
      <p className="font-sans text-[15px] leading-relaxed text-ink/80">{absenceStatement}</p>

      <div className="mt-6 border-[length:var(--border-primary)] border-rule bg-white p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Each entry will show
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {fieldLabels.map((label) => (
            <div key={label} className="min-w-[7rem]">
              <dt className="font-sans text-[13px] font-medium text-ink/70">{label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
