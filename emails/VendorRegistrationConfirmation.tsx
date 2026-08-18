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

interface VendorRegistrationConfirmationProps {
  businessName: string;
  contactPersonName: string;
}

/**
 * Plain acknowledgement copy only -- modelled on emails/ContactConfirmation.tsx, no invented
 * brand colours/typography (project rule), no regulatory permit non-verification note (that is
 * F9's later edit to this same file, see contracts/golden/vendor-f5-register-route/README.md).
 */
export default function VendorRegistrationConfirmation({
  businessName,
  contactPersonName,
}: VendorRegistrationConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>We received your vendor registration — SAOC</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Vendor Registration Received
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Dear {contactPersonName},
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Thank you for registering <strong>{businessName}</strong> as a vendor for the SAOC
            National Show. We have received your submission.
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Our team will review your registration and be in touch.
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
