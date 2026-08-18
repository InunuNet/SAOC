// Route-level Suspense fallback while the Sanity vendor nursery content loads.
// Sage & Paper tokens only, no new colours — same pattern as exhibitors/loading.tsx.
export default function VendorsLoading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-8 py-16" aria-busy="true" aria-live="polite">
      <div className="h-[420px] animate-pulse bg-bone" aria-hidden="true" />
      <div className="h-40 animate-pulse border border-rule bg-bone" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-56 animate-pulse border border-rule bg-bone" aria-hidden="true" />
        <div className="h-56 animate-pulse border border-rule bg-bone" aria-hidden="true" />
        <div className="h-56 animate-pulse border border-rule bg-bone" aria-hidden="true" />
      </div>
      <span className="sr-only">Loading exhibiting nurseries…</span>
    </div>
  );
}
