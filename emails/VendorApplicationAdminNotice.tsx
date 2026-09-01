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

interface VendorApplicationAdminNoticeProps {
  businessName: string;
  contactPersonName: string;
  applicationId: string;
  reviewUrl: string;
}

/**
 * Admin-facing notice, fired when a new vendor application is submitted (mission
 * vendor-flow-notifications, G1). Plain copy only, modelled on
 * emails/VendorApprovalConfirmation.tsx -- no invented brand colours/typography (project rule).
 * Links to the existing flat admin list page, never a per-id detail page -- see the golden
 * README's "The review-link judgement call".
 */
export default function VendorApplicationAdminNotice({
  businessName,
  contactPersonName,
  applicationId,
  reviewUrl,
}: VendorApplicationAdminNoticeProps) {
  return (
    <Html>
      <Head />
      <Preview>New vendor application submitted — SAOC</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            New Vendor Application Submitted
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <strong>{businessName}</strong> ({contactPersonName}) has submitted a new vendor
            application for the SAOC National Show.
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            Application ID: {applicationId}
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <Link href={reviewUrl} style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              Review vendor applications
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
