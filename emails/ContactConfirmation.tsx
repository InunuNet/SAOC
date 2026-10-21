import EmailShell, { ShellHeading, ShellText } from './_shared/EmailShell';

interface ContactConfirmationProps {
  name: string;
  subject: string;
}

/** Chrome: EmailShell family D, SAOC Council (mission email-shell). */
export default function ContactConfirmation({ name, subject }: ContactConfirmationProps) {
  return (
    <EmailShell family="D" preview="We received your message — SAOC">
      <ShellHeading>Message Received</ShellHeading>
      <ShellText>Dear {name},</ShellText>
      <ShellText>
        Thank you for contacting the South African Orchid Council. We have received your
        message regarding <strong>{subject}</strong>.
      </ShellText>
      <ShellText>We aim to respond within 2 business days.</ShellText>
    </EmailShell>
  );
}
