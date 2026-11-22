// One shared shape for "exactly one email address" on every public form that sends an
// acknowledgement to the address typed in. The old pattern (anything without whitespace or `@`
// around one `@` and a dot) accepted `a@b.co,c@d.co`, which an email API can treat as two
// recipients, turning an acknowledgement into mail sent to addresses the submitter chose.
// `\s` already covers space, tab, CR and LF; the rest of the class is the list separators,
// angle brackets and quotes used in `Name <a@b.co>` and `"a,b"@c.co` display forms.

const FORBIDDEN = String.raw`\s@,;<>"`;

export const SINGLE_EMAIL_PATTERN = new RegExp(
  `^[^${FORBIDDEN}]+@[^${FORBIDDEN}]+\\.[^${FORBIDDEN}]+$`,
);
