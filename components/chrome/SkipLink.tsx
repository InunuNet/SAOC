// =============================================================
// SAOC — components/chrome/SkipLink.tsx
// Server Component — first tab stop on every marketing route.
// A plain <a> (not next/link) so the browser performs the hash focus
// handling and moves focus to <main id="main-content" tabIndex={-1}>.
// Off-screen until focused; colours are existing :root tokens only.
// =============================================================

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-4 z-[100] inline-flex min-h-11 min-w-11 -translate-y-[300%] items-center bg-primary px-6 font-sans text-[14px] font-medium text-ivory focus:translate-y-0 focus:outline-2 focus:outline-solid focus:outline-primary focus:outline-offset-[3px]"
    >
      Skip to main content
    </a>
  );
}
