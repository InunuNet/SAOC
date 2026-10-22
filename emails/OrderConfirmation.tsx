import { Img } from '@react-email/components';

import EmailShell, {
  ShellCard,
  ShellDetailRow,
  ShellFootnote,
  ShellHeading,
  ShellLink,
  ShellPill,
  ShellQrTile,
  ShellSubheading,
  ShellText,
} from './_shared/EmailShell';

/**
 * F11 (ticketing-foundation) — multi-position confirmation email (spec §6). Separate from the
 * existing, unused, single-position emails/TicketConfirmation.tsx — that file is left untouched.
 *
 * One salutation for the ORDER's buyer; one card per POSITION, each carrying its own QR
 * (rendered as a Resend CID-referenced inline attachment, embedded in the email payload itself
 * rather than fetched/proxied — see contracts/golden/ticket-confirmation-email-qr-fix-f1/README.md
 * for why this replaced the earlier data: URI, which Gmail renders as a broken image) and its
 * bookingRef as visible text, so a client that fails to render the inline image at all still
 * leaves the buyer/door-volunteer able to use the reference directly.
 *
 * Chrome: EmailShell family A (mission email-shell). The visit details come from
 * lib/order-visit-info.ts, the same confirmed-only Sanity data the ticket PDF prints.
 */

export interface OrderConfirmationPosition {
  bookingRef: string;
  attendeeName: string;
  ticketType: string;
  qrContentId: string;
}

export interface OrderConfirmationOpeningTime {
  label: string;
  value: string | null;
}

/** Every field null means "not confirmed yet" and renders as the "To be confirmed" pill. */
export interface OrderConfirmationVisit {
  pendingLabel: string | null;
  venueName: string | null;
  venueAddress: string | null;
  showDates: string | null;
  openingTimes: OrderConfirmationOpeningTime[] | null;
}

export interface OrderConfirmationProps {
  buyerName: string;
  positions: OrderConfirmationPosition[];
  recoveryUrl: string | null;
  visit?: OrderConfirmationVisit | null;
}

const QR_SIZE = 200;
const DEFAULT_PENDING_LABEL = 'To be confirmed';

function VisitDetails({ visit }: { visit: OrderConfirmationVisit | null | undefined }) {
  const pill = <ShellPill>{visit?.pendingLabel ?? DEFAULT_PENDING_LABEL}</ShellPill>;
  const times = visit?.openingTimes ?? [];

  return (
    <>
      <ShellSubheading>Your visit</ShellSubheading>
      <ShellDetailRow label="The venue">
        {visit?.venueName || visit?.venueAddress ? (
          <>
            {visit.venueName ? <strong>{visit.venueName}</strong> : null}
            {visit.venueName && visit.venueAddress ? <br /> : null}
            {visit.venueAddress}
          </>
        ) : (
          pill
        )}
      </ShellDetailRow>
      <ShellDetailRow label="Show dates">{visit?.showDates ?? pill}</ShellDetailRow>
      <ShellDetailRow label="Opening times">
        {times.length > 0
          ? times.map((entry) => (
              <div key={entry.label}>
                {entry.label ? `${entry.label}: ` : ''}
                {entry.value ?? pill}
              </div>
            ))
          : pill}
      </ShellDetailRow>
      <div style={{ height: '24px' }} />
    </>
  );
}

export default function OrderConfirmation({
  buyerName,
  positions,
  recoveryUrl,
  visit,
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
        <ShellCard key={position.bookingRef}>
          <ShellDetailRow label="Attendee:">{position.attendeeName}</ShellDetailRow>
          <ShellDetailRow label="Ticket type:">{position.ticketType}</ShellDetailRow>
          <ShellDetailRow label="Booking reference:">{position.bookingRef}</ShellDetailRow>
          <ShellQrTile>
            <Img
              src={`cid:${position.qrContentId}`}
              alt={`QR code for booking reference ${position.bookingRef}`}
              width={QR_SIZE}
              height={QR_SIZE}
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
            />
          </ShellQrTile>
        </ShellCard>
      ))}
      <VisitDetails visit={visit} />
      <ShellText size="small">Present this ticket at the door for check in.</ShellText>
      {recoveryUrl !== null && (
        <ShellText size="small">
          Lost this email?{' '}
          <ShellLink href={recoveryUrl}>Recover your tickets</ShellLink>
        </ShellText>
      )}
      <ShellFootnote>
        In an emergency: 10111 Police (national) · 10177 Ambulance and fire (national) · 112 All
        emergencies, from a mobile phone · On-site first aid and show duty contact{' '}
        <ShellPill>{visit?.pendingLabel ?? DEFAULT_PENDING_LABEL}</ShellPill>
      </ShellFootnote>
    </EmailShell>
  );
}
