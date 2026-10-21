import EmailShell, { ShellHeading, ShellText } from './_shared/EmailShell';

interface VendorApplicationConfirmationProps {
  businessName: string;
  contactPersonName: string;
}

/**
 * Acknowledgement copy. Chrome: EmailShell family B (mission email-shell). No permit
 * non-verification note here -- that belongs to the full registration confirmation, not the
 * short application-received email (mission vendor-flow-notifications, G1).
 */
export default function VendorApplicationConfirmation({
  businessName,
  contactPersonName,
}: VendorApplicationConfirmationProps) {
  return (
    <EmailShell family="B" preview="We received your vendor application — SAOC">
      <ShellHeading>Vendor Application Received</ShellHeading>
      <ShellText>Dear {contactPersonName},</ShellText>
      <ShellText>
        Thank you for applying to be a vendor at the National Orchid Show as{' '}
        <strong>{businessName}</strong>. We have received your application.
      </ShellText>
      <ShellText>Our team will review your application and be in touch.</ShellText>
    </EmailShell>
  );
}
