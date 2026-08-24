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
  onDismiss: () => void;
}

/**
 * Renders as a fixed, full-viewport overlay (not in-flow content) so it is visible
 * without scrolling regardless of how tall the scanner box + manual-entry form render
 * above it. Must be readable at arm's length in under a second — success is a solid
 * dark-sage fill (unmistakably "go"), failure is a heavy-bordered light panel with the
 * same primary-800 error-text treatment app/admin/login uses (never text-accent on a
 * light background — that combination measures 2.94:1 and fails WCAG AA, see login's fix).
 *
 * Failure has no auto-dismiss timer (see golden spec), so it carries an explicit
 * `onDismiss` control — without one the operator is locked out of manual entry/retry
 * until the next scan happens to overwrite it.
 */
export function DoorResultBanner({ result, onDismiss }: DoorResultBannerProps) {
  if (result.success) {
    return (
      <div
        role="status"
        className="fixed inset-0 z-50 flex min-h-dvh min-w-dvw flex-col items-center justify-center border-2 border-primary bg-primary px-6 py-10 text-center text-ivory"
      >
        <p className="text-[80px] leading-none" aria-hidden="true">
          ✓
        </p>
        <p className="mt-4 font-sans text-[26px] font-bold leading-tight sm:text-[30px]">
          Checked in
        </p>
        <p className="mt-3 font-sans text-[22px] font-semibold">{result.ticket.attendeeName}</p>
        <p className="mt-1 font-mono text-[13px] tracking-[0.08em] text-ivory/85">
          {result.ticket.ticketType} — {result.ticket.bookingRef}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex min-h-dvh min-w-dvw flex-col items-center justify-center border-2 border-primary-800 bg-bone px-6 py-10 text-center text-primary-800"
    >
      <p className="text-[64px] leading-none" aria-hidden="true">
        ✕
      </p>
      <p className="mt-4 font-sans text-[22px] font-bold leading-tight sm:text-[26px]">
        Not checked in
      </p>
      <p className="mt-2 font-sans text-[16px] font-medium">{result.error}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="mt-6 min-h-[44px] w-full max-w-[280px] rounded-sm border-2 border-primary-800 bg-bone px-6 py-3 font-sans text-[16px] font-bold text-primary-800 transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
      >
        Dismiss
      </button>
    </div>
  );
}
