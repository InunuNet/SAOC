import {
  TICKETING_TEST_BANNER_HEADLINE,
  TICKETING_TEST_BANNER_SUBLINE,
  isTicketingTestMode,
} from '@/lib/ticketing-test-mode';

// NOS Design ruling TB3: the testing notice directly above the Pay / checkout submit button.
export function TicketingTestPayNotice() {
  if (!isTicketingTestMode()) return null;
  return (
    <div className="w-full border-2 border-[#14110A] bg-[#F2C230] px-4 py-3 text-center font-sans text-[#14110A]">
      <p className="m-0 text-[15px] font-bold uppercase leading-tight tracking-[0.08em]">
        {TICKETING_TEST_BANNER_HEADLINE}
      </p>
      <p className="m-0 text-[14px] leading-tight">{TICKETING_TEST_BANNER_SUBLINE}</p>
    </div>
  );
}
