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
 * brand colours/typography (project rule). F9's non-verification note is below.
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
          <Text style={{ fontSize: '14px', color: '#555' }}>
            Any phytosanitary/import permit, CITES permit, or food-handling certificate numbers
            you supplied are recorded as submitted and are not verified by SAOC. Ensuring their
            validity remains your own legal responsibility as the vendor.
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
