import Link from 'next/link';

// Static, no props. Zero nurseries is the normal starting state for this page (no vendor
// has registered yet), not an error — see contracts/golden/vendor-f3-showcase-page/README.md.
// Wording modelled on sponsors/page.tsx's own inline empty-state block.
export function VendorEmptyState() {
  return (
    <section className="border border-rule bg-bone p-10 text-center">
      <h2 className="font-serif text-[26px] font-medium text-ink">
        Nurseries will be announced soon
      </h2>
      <p className="mx-auto mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-ink/70">
        No nurseries have been confirmed for the South African Exhibitors Pavilion yet.
        Check back closer to the show for the full list of exhibiting nurseries.
      </p>
      <Link
        href="/contact"
        className="mt-6 inline-block bg-ink px-6 py-3 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-ink/85"
      >
        Get in Touch
      </Link>
    </section>
  );
}
