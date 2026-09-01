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

interface VendorPaymentAdminNoticeProps {
  businessName: string;
  contactPersonName: string;
  standOrderRef: string;
  reviewUrl: string;
}

/**
 * Admin-facing notice, fired when a vendor's stand payment settles as 'paid' (mission
 * vendor-flow-notifications, G1). Plain copy only, modelled on
 * emails/VendorApplicationAdminNotice.tsx. Links to the existing flat admin list page, never a
 * per-id detail page -- see the golden README's "The review-link judgement call".
 */
export default function VendorPaymentAdminNotice({
  businessName,
  contactPersonName,
  standOrderRef,
  reviewUrl,
}: VendorPaymentAdminNoticeProps) {
  return (
    <Html>
      <Head />
      <Preview>Vendor stand payment received — SAOC</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Vendor Stand Payment Received
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <strong>{businessName}</strong> ({contactPersonName}) has paid for their stand at the
            SAOC National Show.
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            Stand order reference: {standOrderRef}
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <Link href={reviewUrl} style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              Review vendors
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
