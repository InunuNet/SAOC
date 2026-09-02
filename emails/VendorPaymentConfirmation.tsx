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

interface VendorPaymentConfirmationProps {
  businessName: string;
  boothSize: 1 | 2 | 3;
  amount: number;
  standOrderRef: string;
  showDetailsUrl: string;
}

/**
 * Vendor-facing receipt, fired when a vendor's stand payment settles as 'paid' (mission
 * vendor-payment-confirmation, F1). Plain copy only, modelled on
 * emails/VendorPaymentAdminNotice.tsx and emails/VendorStandPaymentReady.tsx's structure -- no
 * invented brand colours/typography (project rule). The link is received as a prop and never
 * constructed or hardcoded here -- see contracts/golden/vendor-payment-confirmation/README.md
 * "The link judgement call".
 */
export default function VendorPaymentConfirmation({
  businessName,
  boothSize,
  amount,
  standOrderRef,
  showDetailsUrl,
}: VendorPaymentConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your SAOC National Show stand payment is confirmed</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Stand Payment Confirmed
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Thank you -- <strong>{businessName}</strong>&rsquo;s stand payment for the SAOC
            National Show has been received.
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            Booth size: {boothSize}
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            Amount paid: R{amount.toFixed(2)}
          </Text>
          <Text style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>
            <strong>Booking reference</strong>
          </Text>
          <Text
            style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: '#1a1a1a',
              letterSpacing: '0.5px',
              wordBreak: 'break-all',
              marginTop: '0',
            }}
          >
            {standOrderRef}
          </Text>
          <Text style={{ fontSize: '12px', color: '#777' }}>
            Please quote this reference if you contact the show office about your stand.
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <Link href={showDetailsUrl} style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              View the National Show
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
