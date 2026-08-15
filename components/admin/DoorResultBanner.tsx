import type { TicketType } from '@/types/index';

export type CheckInResult =
  | {
      success: true;
      ticket: {
        attendeeName: string;
        ticketType: TicketType;
        bookingRef: string;
      };
    }
  | { success: false; error: string };

interface DoorResultBannerProps {
  result: CheckInResult;
}

/**
 * Must be readable at arm's length in under a second — success is a solid dark-sage
 * fill (unmistakably "go"), failure is a heavy-bordered light panel with the same
 * primary-800 error-text treatment app/admin/login uses (never text-accent on a light
 * background — that combination measures 2.94:1 and fails WCAG AA, see login's fix).
 */
export function DoorResultBanner({ result }: DoorResultBannerProps) {
  if (result.success) {
    return (
      <div
        role="status"
        className="border-2 border-primary bg-primary px-5 py-6 text-center text-ivory"
      >
        <p className="font-sans text-[22px] font-bold leading-tight sm:text-[26px]">
          ✓ Checked in
        </p>
        <p className="mt-2 font-sans text-[18px] font-semibold">{result.ticket.attendeeName}</p>
        <p className="mt-1 font-mono text-[13px] tracking-[0.08em] text-ivory/85">
          {result.ticket.ticketType} — {result.ticket.bookingRef}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="border-2 border-primary-800 bg-bone px-5 py-6 text-center text-primary-800"
    >
      <p className="font-sans text-[22px] font-bold leading-tight sm:text-[26px]">✕ Not checked in</p>
      <p className="mt-2 font-sans text-[16px] font-medium">{result.error}</p>
    </div>
  );
}
