import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components';

interface VendorStandPaymentReadyProps {
  businessName: string;
  contactPersonName: string;
  paymentUrl: string;
}

/**
 * M3 (vendor-gated-registration-flow, F28) -- sent as a SECOND, non-blocking post-commit step
 * after the existing approval confirmation email, once a submission's status transitions to
 * 'approved'. Plain acknowledgement copy only, modelled on emails/VendorApprovalConfirmation.tsx
 * -- no invented brand colours/typography (project rule). See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Approval triggers the mint".
 */
export default function VendorStandPaymentReady({
  businessName,
  contactPersonName,
  paymentUrl,
}: VendorStandPaymentReadyProps) {
  return (
    <Html>
      <Head />
      <Preview>Pay for your SAOC National Show stand</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Time to pay for your stand
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Dear {contactPersonName},
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <strong>{businessName}</strong>&rsquo;s vendor registration for the SAOC National
            Show has been approved. The next step is to select your stand size and complete
            payment.
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <Link href={paymentUrl} style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              Select your stand and pay
            </Link>
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
