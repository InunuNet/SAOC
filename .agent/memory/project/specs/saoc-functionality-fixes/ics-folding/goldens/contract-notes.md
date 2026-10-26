# ics-folding goldens

RFC 5545 section 3.1: no content line longer than 75 octets excluding the CRLF; fold by inserting CRLF + one space.
Octets, not characters: fold on UTF-8 byte length, never inside a multibyte sequence (break at code-point boundaries;
keeping an `\n`-style escape pair intact is optional). Continuation lines carry the leading space, so each holds at most 74 octets of content.
Every content line is folded (UID, SUMMARY, DESCRIPTION, LOCATION), applied in buildVEvent so buildVCalendar inherits it.
escapeIcsText: a bare `\r` is treated as a line break and escapes to `\n` (`/\r\n|\r|\n/`).
Unchanged: lines of <= 75 octets are byte-identical to today; the all-day exclusive DTEND logic (23-26 Sept => DTEND 20270927).
