import EmailShell, { ShellDetailRow, ShellHeading } from './_shared/EmailShell';
import { formatAdminDateTime } from '@/lib/admin-format';
import { SHOW_TITLE } from '@/lib/show-title';
import type { Site } from '@/lib/site-hosts';

interface ContactSubmissionAdminNoticeProps {
  submissionId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: Date;
  site?: Site;
}

/**
 * Admin-facing notice, fired once when a contact message is stored. Chrome: EmailShell family C,
 * same shell as emails/SponsorEnquiryAdminNotice.tsx. No button or link: no admin page for
 * contact messages exists. Every value is escaped by React.
 */
export default function ContactSubmissionAdminNotice({
  submissionId,
  name,
  email,
  subject,
  message,
  submittedAt,
  site,
}: ContactSubmissionAdminNoticeProps) {
  return (
    <EmailShell family="C" preview="New contact message — SAOC">
      <ShellHeading>New contact message</ShellHeading>
      <ShellDetailRow label="Submission ID:">{submissionId}</ShellDetailRow>
      {site === 'nos' ? <ShellDetailRow label="Site:">{SHOW_TITLE}</ShellDetailRow> : null}
      <ShellDetailRow label="Name:">{name}</ShellDetailRow>
      <ShellDetailRow label="Email address:">{email}</ShellDetailRow>
      <ShellDetailRow label="Subject:">{subject}</ShellDetailRow>
      <ShellDetailRow label="Message:">
        <div style={{ whiteSpace: 'pre-wrap' }}>{message}</div>
      </ShellDetailRow>
      <ShellDetailRow label="Submitted:">{`${formatAdminDateTime(submittedAt)} SAST`}</ShellDetailRow>
    </EmailShell>
  );
}
