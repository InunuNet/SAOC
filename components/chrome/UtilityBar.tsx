// =============================================================
// SAOC — components/chrome/UtilityBar.tsx
// Server Component — no interactivity needed.
// Dark sage bar above the main header: email left, tagline centre,
// CTA pills right.
// =============================================================

export function UtilityBar() {
  return (
    <div className="bg-primary-800 text-ivory">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-8 py-2">
        {/* Left: contact email */}
        <a
          href="mailto:council@saoc.co.za"
          className="font-mono text-[14px] text-ivory opacity-90 hover:opacity-100 transition-colors duration-150"
        >
          council@saoc.co.za
        </a>

        {/* Centre: tagline */}
        <span className="hidden min-[900px]:inline-block font-sans text-[14px] opacity-90">
          Making a difference since 1968
        </span>

        {/* Right: action pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden min-[900px]:inline-block border border-ivory/30 text-ivory rounded-full px-3 py-1 text-[13px] font-sans hover:border-ivory/60 transition-colors duration-150"
          >
            Become a member
          </button>
          <a
            href="/contact"
            className="bg-accent text-ivory rounded-full px-3 py-1 text-[13px] font-sans hover:bg-accent-soft transition-colors duration-150"
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
