import EmailShell, {
  ShellButton,
  ShellCodeBlock,
  ShellDetailRow,
  ShellHeading,
  ShellText,
} from './_shared/EmailShell';

interface VendorPaymentConfirmationProps {
  businessName: string;
  boothSize: 1 | 2 | 3;
  amount: number;
  standOrderRef: string;
  showDetailsUrl: string;
}

/**
 * Vendor-facing receipt, fired when a vendor's stand payment settles as 'paid' (mission
 * vendor-payment-confirmation, F1). Chrome: EmailShell family A (mission email-shell). The link
 * is received as a prop and never constructed or hardcoded here -- see
 * contracts/golden/vendor-payment-confirmation/README.md "The link judgement call".
 */
export default function VendorPaymentConfirmation({
  businessName,
  boothSize,
  amount,
  standOrderRef,
  showDetailsUrl,
}: VendorPaymentConfirmationProps) {
  return (
    <EmailShell family="A" preview="Your National Orchid Show stand payment is confirmed">
      <ShellHeading>Stand Payment Confirmed</ShellHeading>
      <ShellText>
        Thank you -- <strong>{businessName}</strong>&rsquo;s stand payment for the National Orchid Show has been received.
      </ShellText>
      <ShellDetailRow label="Booth size:">{boothSize}</ShellDetailRow>
      <ShellDetailRow label="Amount paid:">R{amount.toFixed(2)}</ShellDetailRow>
      <div style={{ height: '16px' }} />
      <ShellCodeBlock label="Booking reference">{standOrderRef}</ShellCodeBlock>
      <ShellText size="small">
        Please quote this reference if you contact the show office about your stand.
      </ShellText>
      <ShellButton href={showDetailsUrl}>View the National Show</ShellButton>
    </EmailShell>
  );
}
