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

interface VendorApplicationConfirmationProps {
  businessName: string;
  contactPersonName: string;
}

/**
 * Plain acknowledgement copy only -- modelled on emails/VendorRegistrationConfirmation.tsx, no
 * invented brand colours/typography (project rule). No permit non-verification note here --
 * that belongs to the full registration confirmation, not the short application-received email
 * (mission vendor-flow-notifications, G1).
 */
export default function VendorApplicationConfirmation({
  businessName,
  contactPersonName,
}: VendorApplicationConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>We received your vendor application — SAOC</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Vendor Application Received
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Dear {contactPersonName},
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Thank you for applying to be a vendor at the SAOC National Show as{' '}
            <strong>{businessName}</strong>. We have received your application.
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Our team will review your application and be in touch.
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
