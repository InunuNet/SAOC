import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';

interface TicketConfirmationProps {
  bookingRef: string;
  ticketType: string;
  attendeeName: string;
  showName: string;
  showDate: string;
  showVenue: string;
}

export default function TicketConfirmation({
  bookingRef,
  ticketType,
  attendeeName,
  showName,
  showDate,
  showVenue,
}: TicketConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your ticket for {showName} — Booking {bookingRef}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Ticket Confirmation
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Dear {attendeeName},
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Thank you for registering for <strong>{showName}</strong>. Your booking is confirmed.
          </Text>
          <Hr />
          <Text style={{ fontSize: '14px', color: '#555' }}>
            <strong>Booking reference:</strong> {bookingRef}
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            <strong>Ticket type:</strong> {ticketType}
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            <strong>Show:</strong> {showName}
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            <strong>Date:</strong> {showDate}
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            <strong>Venue:</strong> {showVenue}
          </Text>
          <Hr />
          <Text style={{ fontSize: '14px', color: '#555' }}>
            Present this email at the door. Your booking reference <strong>{bookingRef}</strong> will
            be used to check you in. A PDF ticket with QR code will be available in a future update.
          </Text>
          <Text style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
            South African Orchid Council — saoc.co.za
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
