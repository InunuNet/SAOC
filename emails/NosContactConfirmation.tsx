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

import { SHOW_TITLE } from '@/lib/show-title';
import { nosOrigin } from '@/lib/site-hosts';

interface NosContactConfirmationProps {
  name: string;
  subject: string;
}

/**
 * The National Orchid Show's contact acknowledgement: the council acknowledgement's copy verbatim
 * (emails/ContactConfirmation.tsx) with the entity and the origin substituted. Its response-time
 * sentence is dropped, not replaced: the show inbox has no stated response time (docs/nos-contact.md, G4).
 */
export default function NosContactConfirmation({ name, subject }: NosContactConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>{`We received your message — ${SHOW_TITLE}`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Message Received
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Dear {name},
          </Text>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            {`Thank you for contacting ${SHOW_TITLE}. We have received your message regarding `}
            <strong>{subject}</strong>.
          </Text>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
            {`${SHOW_TITLE} — ${new URL(nosOrigin()).host}`}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
