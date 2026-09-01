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

interface SupporterRegistrationConfirmationProps {
  firstName: string | null;
  confirmUrl: string;
}

/**
 * Plain acknowledgement copy only -- modelled on emails/VendorRegistrationConfirmation.tsx, no
 * invented brand colours/typography (project rule). This is Brad's literal no-share/no-sell ask
 * made a property of the shipped email, not just of the /privacy page copy -- see
 * .agent/memory/project/specs/public-supporter-registration/goldens/README.md.
 */
export default function SupporterRegistrationConfirmation({
  firstName,
  confirmUrl,
}: SupporterRegistrationConfirmationProps) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  return (
    <Html>
      <Head />
      <Preview>Confirm your SAOC supporter registration</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Confirm your registration
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>{greeting}</Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Thank you for registering with the South African Orchid Council for early access to
            promos, events, and newsletters. Please confirm your email address to complete your
            registration.
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <Link href={confirmUrl} style={{ color: '#1a1a1a' }}>
              Confirm my registration
            </Link>
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            This confirmation link will expire and is only valid for a limited time. If you did
            not request this, you can safely ignore this email.
          </Text>
          <Text style={{ fontSize: '14px', color: '#555' }}>
            We will not share or sell your information. It is used only to send you the updates
            you have asked for.
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
