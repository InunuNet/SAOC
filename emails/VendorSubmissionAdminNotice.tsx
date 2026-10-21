import EmailShell, {
  ShellButton,
  ShellDetailRow,
  ShellHeading,
  ShellText,
} from './_shared/EmailShell';

interface VendorSubmissionAdminNoticeProps {
  businessName: string;
  contactPersonName: string;
  vendorSubmissionId: string;
  reviewUrl: string;
}

/**
 * Admin-facing notice, fired when a full vendor registration is submitted (mission
 * vendor-flow-notifications, G1). Chrome: EmailShell family C (mission email-shell). Links to
 * the existing flat admin list page, never a per-id detail page -- see the golden README's
 * "The review-link judgement call".
 */
export default function VendorSubmissionAdminNotice({
  businessName,
  contactPersonName,
  vendorSubmissionId,
  reviewUrl,
}: VendorSubmissionAdminNoticeProps) {
  return (
    <EmailShell family="C" preview="New vendor registration submitted — SAOC">
      <ShellHeading>New Vendor Registration Submitted</ShellHeading>
      <ShellText>
        <strong>{businessName}</strong> ({contactPersonName}) has submitted a full vendor
        registration for the National Orchid Show.
      </ShellText>
      <ShellDetailRow label="Vendor submission ID:">{vendorSubmissionId}</ShellDetailRow>
      <div style={{ height: '24px' }} />
      <ShellButton href={reviewUrl}>Review vendor registrations</ShellButton>
    </EmailShell>
  );
}
