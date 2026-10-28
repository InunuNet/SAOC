import EmailShell, { ShellDetailRow, ShellHeading } from './_shared/EmailShell';
import { ENQUIRY_ADMIN_HEADING } from '@/lib/sponsor-enquiry-copy';

const NOT_GIVEN = 'Not given';

interface SponsorEnquiryAdminNoticeProps {
  enquiryId: string;
  siteLabel: string;
  contactName: string;
  organisation: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  levelLabel: string | null;
  message: string;
}

/**
 * Admin-facing notice, fired once when a sponsorship enquiry is stored. Chrome: EmailShell family
 * C, same shell as emails/VendorApplicationAdminNotice.tsx. No review button: no admin page for
 * enquiries exists, they are read in the Firebase console. Every value is escaped by React.
 */
export default function SponsorEnquiryAdminNotice({
  enquiryId,
  siteLabel,
  contactName,
  organisation,
  email,
  phone,
  website,
  levelLabel,
  message,
}: SponsorEnquiryAdminNoticeProps) {
  return (
    <EmailShell family="C" preview={`New sponsorship enquiry — ${siteLabel}`}>
      <ShellHeading>{ENQUIRY_ADMIN_HEADING}</ShellHeading>
      <ShellDetailRow label="Enquiry ID:">{enquiryId}</ShellDetailRow>
      <ShellDetailRow label="Site:">{siteLabel}</ShellDetailRow>
      <ShellDetailRow label="Name:">{contactName}</ShellDetailRow>
      <ShellDetailRow label="Organisation:">{organisation ?? NOT_GIVEN}</ShellDetailRow>
      <ShellDetailRow label="Email address:">{email}</ShellDetailRow>
      <ShellDetailRow label="Phone number:">{phone ?? NOT_GIVEN}</ShellDetailRow>
      <ShellDetailRow label="Website:">{website ?? NOT_GIVEN}</ShellDetailRow>
      <ShellDetailRow label="Sponsorship level:">{levelLabel ?? NOT_GIVEN}</ShellDetailRow>
      <ShellDetailRow label="Message:">
        <div style={{ whiteSpace: 'pre-wrap' }}>{message}</div>
      </ShellDetailRow>
    </EmailShell>
  );
}
