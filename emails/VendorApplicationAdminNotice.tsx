import EmailShell, {
  ShellButton,
  ShellDetailRow,
  ShellHeading,
  ShellText,
} from './_shared/EmailShell';

interface VendorApplicationAdminNoticeProps {
  businessName: string;
  contactPersonName: string;
  applicationId: string;
  reviewUrl: string;
}

/**
 * Admin-facing notice, fired when a new vendor application is submitted (mission
 * vendor-flow-notifications, G1). Chrome: EmailShell family C (mission email-shell). Links to
 * the existing flat admin list page, never a per-id detail page -- see the golden README's
 * "The review-link judgement call".
 */
export default function VendorApplicationAdminNotice({
  businessName,
  contactPersonName,
  applicationId,
  reviewUrl,
}: VendorApplicationAdminNoticeProps) {
  return (
    <EmailShell family="C" preview="New vendor application submitted — SAOC">
      <ShellHeading>New Vendor Application Submitted</ShellHeading>
      <ShellText>
        <strong>{businessName}</strong> ({contactPersonName}) has submitted a new vendor
        application for the National Orchid Show.
      </ShellText>
      <ShellDetailRow label="Application ID:">{applicationId}</ShellDetailRow>
      <div style={{ height: '24px' }} />
      <ShellButton href={reviewUrl}>Review vendor applications</ShellButton>
    </EmailShell>
  );
}
