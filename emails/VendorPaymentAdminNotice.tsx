import EmailShell, {
  ShellButton,
  ShellDetailRow,
  ShellHeading,
  ShellText,
} from './_shared/EmailShell';

interface VendorPaymentAdminNoticeProps {
  businessName: string;
  contactPersonName: string;
  standOrderRef: string;
  reviewUrl: string;
}

/**
 * Admin-facing notice, fired when a vendor's stand payment settles as 'paid' (mission
 * vendor-flow-notifications, G1). Chrome: EmailShell family C (mission email-shell). Links to
 * the existing flat admin list page, never a per-id detail page -- see the golden README's
 * "The review-link judgement call".
 */
export default function VendorPaymentAdminNotice({
  businessName,
  contactPersonName,
  standOrderRef,
  reviewUrl,
}: VendorPaymentAdminNoticeProps) {
  return (
    <EmailShell family="C" preview="Vendor stand payment received — SAOC">
      <ShellHeading>Vendor Stand Payment Received</ShellHeading>
      <ShellText>
        <strong>{businessName}</strong> ({contactPersonName}) has paid for their stand at the
        National Orchid Show.
      </ShellText>
      <ShellDetailRow label="Stand order reference:">{standOrderRef}</ShellDetailRow>
      <div style={{ height: '24px' }} />
      <ShellButton href={reviewUrl}>Review vendors</ShellButton>
    </EmailShell>
  );
}
