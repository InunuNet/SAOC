import EmailShell, { ShellButton, ShellHeading, ShellText } from './_shared/EmailShell';

interface VendorStandPaymentReadyProps {
  businessName: string;
  contactPersonName: string;
  paymentUrl: string;
}

/**
 * M3 (vendor-gated-registration-flow, F28) -- sent as a SECOND, non-blocking post-commit step
 * after the existing approval confirmation email, once a submission's status transitions to
 * 'approved'. Chrome: EmailShell family B (mission email-shell). See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Approval triggers the mint".
 */
export default function VendorStandPaymentReady({
  businessName,
  contactPersonName,
  paymentUrl,
}: VendorStandPaymentReadyProps) {
  return (
    <EmailShell family="B" preview="Pay for your National Orchid Show stand">
      <ShellHeading>Time to pay for your stand</ShellHeading>
      <ShellText>Dear {contactPersonName},</ShellText>
      <ShellText>
        <strong>{businessName}</strong>&rsquo;s vendor registration for the National Orchid Show has been approved. The next step is to select your stand size and complete
        payment.
      </ShellText>
      <ShellButton href={paymentUrl}>Select your stand and pay</ShellButton>
    </EmailShell>
  );
}
