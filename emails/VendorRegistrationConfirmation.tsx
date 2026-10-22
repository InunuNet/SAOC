import EmailShell, { ShellButton, ShellHeading, ShellText } from './_shared/EmailShell';

interface VendorRegistrationConfirmationProps {
  businessName: string;
  contactPersonName: string;
  photoUploadUrl?: string;
}

/**
 * Acknowledgement copy. Chrome: EmailShell family B (mission email-shell). F9's non-verification
 * note is below.
 */
export default function VendorRegistrationConfirmation({
  businessName,
  contactPersonName,
  photoUploadUrl,
}: VendorRegistrationConfirmationProps) {
  return (
    <EmailShell family="B" preview="We received your vendor registration — SAOC">
      <ShellHeading>Vendor registration received</ShellHeading>
      <ShellText>Dear {contactPersonName},</ShellText>
      <ShellText>
        Thank you for registering <strong>{businessName}</strong> as a vendor for the National Orchid Show. We have received your submission.
      </ShellText>
      <ShellText>Our team will review your registration and be in touch.</ShellText>
      {photoUploadUrl && (
        <>
          <ShellText>
            Your registration is not complete until you have uploaded all 3 required product
            photos. You can do this at any time using the link below.
          </ShellText>
          <ShellButton href={photoUploadUrl}>Upload your product photos</ShellButton>
        </>
      )}
      <ShellText size="small">
        Any phytosanitary/import permit, CITES permit, or food-handling certificate numbers
        you supplied are recorded as submitted and are not verified by SAOC. Ensuring their
        validity remains your own legal responsibility as the vendor.
      </ShellText>
    </EmailShell>
  );
}
