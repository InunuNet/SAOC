import { PageShell } from './PageHeader';

const SKELETON_BLOCK = 'animate-pulse rounded-[2px] bg-bone';
const SKELETON_CARD_COUNT = 4;
const SKELETON_ROW_COUNT = 8;

interface AdminSkeletonProps {
  variant: 'dashboard' | 'table' | 'page';
}

/** Loading state for admin routes: bone blocks in the shape of the page, never a lone spinner. */
export function AdminSkeleton({ variant }: AdminSkeletonProps) {
  return (
    <PageShell>
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        <div className={`mb-6 h-9 w-56 ${SKELETON_BLOCK}`} />
        {variant === 'dashboard' ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1280px]:grid-cols-4">
              {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                <div key={i} className={`h-[104px] ${SKELETON_BLOCK}`} />
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 min-[1280px]:grid-cols-2">
              <div className={`h-56 ${SKELETON_BLOCK}`} />
              <div className={`h-56 ${SKELETON_BLOCK}`} />
            </div>
          </>
        ) : null}
        {variant === 'table' ? (
          <>
            <div className={`mb-4 h-11 ${SKELETON_BLOCK}`} />
            <div className="flex flex-col gap-1">
              {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                <div key={i} className={`h-12 ${SKELETON_BLOCK}`} />
              ))}
            </div>
          </>
        ) : null}
        {variant === 'page' ? <div className={`h-64 max-w-[520px] ${SKELETON_BLOCK}`} /> : null}
      </div>
    </PageShell>
  );
}
