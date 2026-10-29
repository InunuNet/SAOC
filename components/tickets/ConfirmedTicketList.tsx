import { DownloadTicketButton } from '@/components/tickets/DownloadTicketButton';
import type { ConfirmedOrderDisplay } from '@/lib/orders';

export function ConfirmedTicketList({
  confirmedOrder,
  downloadTicketButtonLabel,
}: {
  confirmedOrder: ConfirmedOrderDisplay;
  downloadTicketButtonLabel: string;
}) {
  const { positions } = confirmedOrder;

  return (
    <div className="mt-8 space-y-10">
      {positions.map((position) => (
        <div
          key={position.bookingRef}
          className="border-t border-rule pt-8 first:border-t-0 first:pt-0"
        >
          <img
            src={position.qrDataUri}
            alt={`QR code for booking reference ${position.bookingRef} — scan at the door for check-in`}
            width={240}
            height={240}
            className="mx-auto"
          />

          <div className="mt-6 space-y-1">
            <p className="font-serif text-[18px] font-medium text-ink">
              {position.attendeeName}
            </p>
            <p className="font-sans text-[14px] text-ink/80">
              {position.ticketType} · R{position.amount.toFixed(2)}
            </p>
            <p className="font-sans text-[13px] text-muted">
              Booking ref: {position.bookingRef}
            </p>
          </div>

          <div className="mt-6">
            <DownloadTicketButton
              orderReference={confirmedOrder.reference}
              bookingRef={position.bookingRef}
              attendeeName={position.attendeeName}
              label={downloadTicketButtonLabel}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
