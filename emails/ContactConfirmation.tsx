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

interface ContactConfirmationProps {
  name: string;
  subject: string;
}

export default function ContactConfirmation({ name, subject }: ContactConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>We received your message — SAOC</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Message Received
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Dear {name},
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Thank you for contacting the South African Orchid Council. We have received your
            message regarding <strong>{subject}</strong>.
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            We aim to respond within 2 business days.
          </Text>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
            South African Orchid Council — saoc.co.za
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
