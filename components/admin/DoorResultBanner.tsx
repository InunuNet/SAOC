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

// lib/checkin.ts's refusal copy for a repeat scan (server-only module, so mirrored here).
// A second scan of a used ticket is "already used", not "invalid": the door staff reads them
// differently.
export const ALREADY_CHECKED_IN_ERROR = 'Already checked in';

type BannerKind = 'valid' | 'already-used' | 'invalid';

const BANNER_BASE = 'flex min-h-[72px] items-center gap-4 rounded-[2px] border-2 px-4 py-3';

// Every state carries an icon and text as well as colour, so none relies on colour alone.
const BANNER_STYLES: Record<BannerKind, string> = {
  valid: 'border-primary bg-primary text-white',
  'already-used': 'border-accent bg-accent text-primary-800',
  invalid: 'border-error bg-error text-white',
};

const BANNER_ICONS: Record<BannerKind, string> = {
  valid: '✓',
  'already-used': '⚠',
  invalid: '✕',
};

function bannerKind(result: CheckInResult): BannerKind {
  if (result.success) return 'valid';
  return result.error === ALREADY_CHECKED_IN_ERROR ? 'already-used' : 'invalid';
}

interface DoorResultBannerProps {
  result: CheckInResult;
}

// In-flow result under the camera, at least 72px tall so it is readable at arm's length.
// Valid: primary, ✓, the attendee's name. Already used: brass, a warning icon. Invalid: error
// red, ✕, the refusal reason. The check-in API returns no first-check-in time, so the
// already-used state names the refusal only.
export function DoorResultBanner({ result }: DoorResultBannerProps) {
  const kind = bannerKind(result);

  return (
    <div
      role={kind === 'valid' ? 'status' : 'alert'}
      className={`${BANNER_BASE} ${BANNER_STYLES[kind]}`}
    >
      <span className="text-[32px] leading-none" aria-hidden="true">
        {BANNER_ICONS[kind]}
      </span>
      {result.success ? (
        <div className="min-w-0">
          <p className="break-words font-sans text-[18px] font-bold leading-tight">
            {result.ticket.attendeeName}
          </p>
          <p className="mt-0.5 break-words font-mono text-[13px] tracking-[0.04em]">
            Checked in · {result.ticket.ticketType} · {result.ticket.bookingRef}
          </p>
        </div>
      ) : (
        <div className="min-w-0">
          <p className="font-sans text-[18px] font-bold leading-tight">
            {kind === 'already-used' ? 'Already used' : 'Not checked in'}
          </p>
          <p className="mt-0.5 break-words font-sans text-[14px] font-medium">{result.error}</p>
        </div>
      )}
    </div>
  );
}
