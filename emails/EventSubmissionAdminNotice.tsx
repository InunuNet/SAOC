import EmailShell, { ShellDetailRow, ShellHeading } from './_shared/EmailShell';
import { formatAdminDateTime } from '@/lib/admin-format';

const NOT_GIVEN = 'Not given';

interface EventSubmissionAdminNoticeProps {
  eventDraftId: string;
  title: string;
  kind: string;
  date: string;
  endDate: string | null;
  venue: string;
  location: string;
  description: string;
  hostSocietyId: string | null;
  submittedByUid: string;
  submittedAt: Date;
}

/**
 * Admin-facing notice, fired once when a society event submission is written as a Sanity draft.
 * Chrome: EmailShell family C. No button or link: no admin listing for event drafts exists.
 * Every value is escaped by React.
 */
export default function EventSubmissionAdminNotice({
  eventDraftId,
  title,
  kind,
  date,
  endDate,
  venue,
  location,
  description,
  hostSocietyId,
  submittedByUid,
  submittedAt,
}: EventSubmissionAdminNoticeProps) {
  return (
    <EmailShell family="C" preview="New event submission — SAOC">
      <ShellHeading>New event submission</ShellHeading>
      <ShellDetailRow label="Draft ID:">{eventDraftId}</ShellDetailRow>
      <ShellDetailRow label="Title:">{title}</ShellDetailRow>
      <ShellDetailRow label="Kind:">{kind}</ShellDetailRow>
      <ShellDetailRow label="Start date:">{date}</ShellDetailRow>
      <ShellDetailRow label="End date:">{endDate ?? NOT_GIVEN}</ShellDetailRow>
      <ShellDetailRow label="Venue:">{venue}</ShellDetailRow>
      <ShellDetailRow label="Location:">{location}</ShellDetailRow>
      <ShellDetailRow label="Description:">
        <div style={{ whiteSpace: 'pre-wrap' }}>{description}</div>
      </ShellDetailRow>
      <ShellDetailRow label="Host society ID:">{hostSocietyId ?? NOT_GIVEN}</ShellDetailRow>
      <ShellDetailRow label="Submitted by (user ID):">{submittedByUid}</ShellDetailRow>
      <ShellDetailRow label="Submitted:">{`${formatAdminDateTime(submittedAt)} SAST`}</ShellDetailRow>
    </EmailShell>
  );
}
