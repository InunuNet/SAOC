import EmailShell, { ShellButton, ShellHeading, ShellText } from './_shared/EmailShell';

interface SupporterRegistrationConfirmationProps {
  firstName: string | null;
  confirmUrl: string;
}

/**
 * Acknowledgement copy. This is Brad's literal no-share/no-sell ask made a property of the
 * shipped email, not just of the /privacy page copy -- see
 * .agent/memory/project/specs/public-supporter-registration/goldens/README.md.
 *
 * Chrome: EmailShell, provisionally family B. Supporter may move to family D (Council) once
 * Codi specs it; this is the ONE place the family is named, so that move is a one-line change.
 */
export default function SupporterRegistrationConfirmation({
  firstName,
  confirmUrl,
}: SupporterRegistrationConfirmationProps) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  return (
    <EmailShell family="B" preview="Confirm your SAOC supporter registration">
      <ShellHeading>Confirm your registration</ShellHeading>
      <ShellText>{greeting}</ShellText>
      <ShellText>
        Thank you for registering with the South African Orchid Council for early access to
        promos, events, and newsletters. Please confirm your email address to complete your
        registration.
      </ShellText>
      <ShellButton href={confirmUrl}>Confirm my registration</ShellButton>
      <ShellText size="small">
        This confirmation link will expire and is only valid for a limited time. If you did
        not request this, you can safely ignore this email.
      </ShellText>
      <ShellText size="small">
        We will not share or sell your information. It is used only to send you the updates
        you have asked for.
      </ShellText>
    </EmailShell>
  );
}
