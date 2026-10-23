import {
  TICKETING_TEST_BANNER_HEADLINE,
  TICKETING_TEST_BANNER_SUBLINE,
} from '@/lib/ticketing-test-mode';

// NOS Design ruling TB2: amber ground #F2C230, ink #14110A, deliberately outside both palettes.
// Sticky above the header (z above the .nh z-index 60); 48px at 768+ and 44px below, growing if
// the text wraps. The header is offset by the bar height in components/nos-chrome/nos-chrome.css.
const STRIPE_CAP_STYLE = {
  backgroundImage: 'repeating-linear-gradient(135deg, #14110A 0 8px, #F2C230 8px 16px)',
} as const;

export function TicketingTestBarView() {
  return (
    <aside
      aria-label="Testing only, not live"
      data-ticketing-test-bar="true"
      className="sticky top-0 z-[70] flex min-h-[44px] w-full items-stretch bg-[#F2C230] text-[#14110A] md:min-h-[48px]"
    >
      <span aria-hidden="true" className="w-[16px] shrink-0 md:w-[24px]" style={STRIPE_CAP_STYLE} />
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-2 py-1 text-center font-sans">
        <p className="m-0 text-[15px] font-bold uppercase leading-tight tracking-[0.08em]">
          {TICKETING_TEST_BANNER_HEADLINE}
        </p>
        <p className="m-0 text-[14px] leading-tight">{TICKETING_TEST_BANNER_SUBLINE}</p>
      </div>
      <span aria-hidden="true" className="w-[16px] shrink-0 md:w-[24px]" style={STRIPE_CAP_STYLE} />
    </aside>
  );
}
