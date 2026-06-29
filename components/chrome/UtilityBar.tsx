// =============================================================
// SAOC — components/chrome/UtilityBar.tsx
// Server Component — no interactivity needed.
// Dark sage bar above the main header: email left, tagline centre,
// CTA pills right.
// =============================================================

import Link from 'next/link';

export function UtilityBar() {
  return (
    <div className="bg-primary-800 text-ivory">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-8 py-2">
        {/* Left: contact email */}
        <a
          href="mailto:council@saoc.co.za"
          className="flex items-center gap-1.5 font-mono text-[14px] text-ivory opacity-90 hover:opacity-100 transition-colors duration-150"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          council@saoc.co.za
        </a>

        {/* Right: action pills */}
        <div className="flex items-center gap-2">
          <Link
            href="/national-show"
            className="hidden min-[900px]:inline-block border border-ivory/30 text-ivory rounded-full px-3 py-1 text-[13px] font-sans hover:border-ivory/60 transition-colors duration-150"
          >
            19th National Show · Sep 2027
          </Link>
          <Link
            href="/societies"
            className="bg-accent text-primary rounded-full px-3 py-1 text-[13px] font-sans font-medium hover:bg-accent-soft transition-colors duration-150"
          >
            Join a society
          </Link>
        </div>
      </div>
    </div>
  );
}
