import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from '@react-email/components';

/**
 * F11 (ticketing-foundation) — multi-position confirmation email (spec §6). Separate from the
 * existing, unused, single-position emails/TicketConfirmation.tsx — that file is left untouched.
 *
 * One salutation for the ORDER's buyer; one section per POSITION, each carrying its own QR
 * (rendered inline as a data URI, never re-hosted or attached — spec §6's explicit
 * "reintroduces the guessable-URL problem" rationale) and its bookingRef as visible text, so a
 * client that strips `data:` images (see the golden README's "Inline data-URI vs. attachment")
 * still leaves the buyer/door-volunteer able to use the reference directly.
 */

export interface OrderConfirmationPosition {
  bookingRef: string;
  attendeeName: string;
  ticketType: string;
  qrDataUri: string;
}

export interface OrderConfirmationProps {
  buyerName: string;
  positions: OrderConfirmationPosition[];
  recoveryUrl: string | null;
}

export default function OrderConfirmation({
  buyerName,
  positions,
  recoveryUrl,
}: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your SAOC National Show order is confirmed</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>Order Confirmation</Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>Dear {buyerName},</Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Thank you for your order. Your ticket{positions.length > 1 ? 's are' : ' is'} confirmed —
            each ticket below has its own QR code for door check-in.
          </Text>
          {positions.map((position) => (
            <div key={position.bookingRef}>
              <Hr />
              <Text style={{ fontSize: '14px', color: '#555' }}>
                <strong>Attendee:</strong> {position.attendeeName}
              </Text>
              <Text style={{ fontSize: '14px', color: '#555' }}>
                <strong>Ticket type:</strong> {position.ticketType}
              </Text>
              <Text style={{ fontSize: '14px', color: '#555' }}>
                <strong>Booking reference:</strong> {position.bookingRef}
              </Text>
              <Img
                src={position.qrDataUri}
                alt={`QR code for booking reference ${position.bookingRef}`}
                width="200"
                height="200"
              />
            </div>
          ))}
          <Hr />
          <Text style={{ fontSize: '14px', color: '#555' }}>
            Present this email — or just the booking reference — at the door for check-in.
          </Text>
          {recoveryUrl !== null && (
            <Text style={{ fontSize: '14px', color: '#555' }}>
              Lost this email?{' '}
              <Link href={recoveryUrl}>Click here to recover your tickets</Link>
            </Text>
          )}
          <Text style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
            South African Orchid Council — saoc.co.za
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
