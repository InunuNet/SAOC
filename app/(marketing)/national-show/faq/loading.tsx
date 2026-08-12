// Route-level Suspense fallback while the Sanity FAQ documents load.
// Sage & Paper tokens only, no new colours.
export default function ShowFaqLoading() {
  return (
    <div className="mx-auto max-w-[900px] px-8 py-16 space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-[420px] animate-pulse bg-bone" aria-hidden="true" />
      <div className="space-y-3 pt-4">
        <div className="h-14 animate-pulse border-b border-rule bg-bone" aria-hidden="true" />
        <div className="h-14 animate-pulse border-b border-rule bg-bone" aria-hidden="true" />
        <div className="h-14 animate-pulse border-b border-rule bg-bone" aria-hidden="true" />
        <div className="h-14 animate-pulse border-b border-rule bg-bone" aria-hidden="true" />
      </div>
      <span className="sr-only">Loading questions…</span>
    </div>
  );
}
