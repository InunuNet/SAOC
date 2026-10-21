import { Img } from '@react-email/components';

import EmailShell, {
  ShellDetailRow,
  ShellFootnote,
  ShellHeading,
  ShellLink,
  ShellPill,
  ShellRule,
  ShellText,
} from './_shared/EmailShell';

/**
 * F11 (ticketing-foundation) — multi-position confirmation email (spec §6). Separate from the
 * existing, unused, single-position emails/TicketConfirmation.tsx — that file is left untouched.
 *
 * One salutation for the ORDER's buyer; one section per POSITION, each carrying its own QR
 * (rendered as a Resend CID-referenced inline attachment, embedded in the email payload itself
 * rather than fetched/proxied — see contracts/golden/ticket-confirmation-email-qr-fix-f1/README.md
 * for why this replaced the earlier data: URI, which Gmail renders as a broken image) and its
 * bookingRef as visible text, so a client that fails to render the inline image at all still
 * leaves the buyer/door-volunteer able to use the reference directly.
 *
 * Chrome: EmailShell family A (mission email-shell).
 */

export interface OrderConfirmationPosition {
  bookingRef: string;
  attendeeName: string;
  ticketType: string;
  qrContentId: string;
}

export interface OrderConfirmationProps {
  buyerName: string;
  positions: OrderConfirmationPosition[];
  recoveryUrl: string | null;
}

const QR_SIZE = 200;

export default function OrderConfirmation({
  buyerName,
  positions,
  recoveryUrl,
}: OrderConfirmationProps) {
  return (
    <EmailShell family="A" preview="Your National Orchid Show order is confirmed">
      <ShellHeading>Order confirmation</ShellHeading>
      <ShellText>Dear {buyerName},</ShellText>
      <ShellText>
        Thank you for your order. Your ticket{positions.length > 1 ? 's are' : ' is'} confirmed —
        each ticket below has its own QR code for door check-in.
      </ShellText>
      {positions.map((position) => (
        <div key={position.bookingRef}>
          <ShellRule />
          <ShellDetailRow label="Attendee:">{position.attendeeName}</ShellDetailRow>
          <ShellDetailRow label="Ticket type:">{position.ticketType}</ShellDetailRow>
          <ShellDetailRow label="Booking reference:">{position.bookingRef}</ShellDetailRow>
          <Img
            src={`cid:${position.qrContentId}`}
            alt={`QR code for booking reference ${position.bookingRef}`}
            width={QR_SIZE}
            height={QR_SIZE}
            style={{ display: 'block', marginTop: '16px' }}
          />
        </div>
      ))}
      <ShellRule />
      <ShellText size="small">
        Present this ticket at the door for check in.
      </ShellText>
      {recoveryUrl !== null && (
        <ShellText size="small">
          Lost this email?{' '}
          <ShellLink href={recoveryUrl}>Recover your tickets</ShellLink>
        </ShellText>
      )}
      <ShellFootnote>
        In an emergency: 10111 Police (national) · 10177 Ambulance and fire (national) · 112 All
        emergencies, from a mobile phone · On-site first aid and show duty contact{' '}
        <ShellPill>To be confirmed</ShellPill>
      </ShellFootnote>
    </EmailShell>
  );
}
