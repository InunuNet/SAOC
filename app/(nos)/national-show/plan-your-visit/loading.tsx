// Route-level Suspense fallback while the Sanity visitor-information content loads.
// Sage & Paper tokens only, no new colours.
export default function PlanYourVisitLoading() {
  return (
    <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-[420px] animate-pulse bg-bone" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-3">
        <div className="h-40 animate-pulse border border-rule bg-bone" aria-hidden="true" />
        <div className="h-40 animate-pulse border border-rule bg-bone" aria-hidden="true" />
        <div className="h-40 animate-pulse border border-rule bg-bone" aria-hidden="true" />
      </div>
      <span className="sr-only">Loading visit information…</span>
    </div>
  );
}
