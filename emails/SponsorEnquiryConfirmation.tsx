import EmailShell, { ShellHeading, ShellText } from './_shared/EmailShell';
import {
  ENQUIRY_ACK_BODY,
  ENQUIRY_ACK_FOLLOW_UP,
  ENQUIRY_ACK_HEADING,
} from '@/lib/sponsor-enquiry-copy';

interface SponsorEnquiryConfirmationProps {
  name: string;
  preview: string;
}

/**
 * Acknowledgement to the person who sent a sponsorship enquiry. Chrome: EmailShell family B, same
 * shape as emails/VendorApplicationConfirmation.tsx. The wording is a copy gap (G5) awaiting
 * committee text; see lib/sponsor-enquiry-copy.ts.
 */
export default function SponsorEnquiryConfirmation({ name, preview }: SponsorEnquiryConfirmationProps) {
  return (
    <EmailShell family="B" preview={preview}>
      <ShellHeading>{ENQUIRY_ACK_HEADING}</ShellHeading>
      <ShellText>Dear {name},</ShellText>
      <ShellText>{ENQUIRY_ACK_BODY}</ShellText>
      <ShellText>{ENQUIRY_ACK_FOLLOW_UP}</ShellText>
    </EmailShell>
  );
}
