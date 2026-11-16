# Ticket registration forms

The SAOC Symposium, WOSA Conference and Sunset Cocktails tickets collect one full registration per ticket. Each attendee supplies a title, legal and preferred names, email, mobile, country and (for South Africa) province, society membership, judges event answers and dietary requirements. On attendee 2 onward, contact and membership may be copied from attendee 1 with separate “Same as above” controls. The booking choice is derived from the ticket slug and is not shown.

| Form control | Stored registration fields |
| --- | --- |
| Accreditation: No | `judgeAccredited: No`, `judgeOrganisation: Not applicable` |
| Accreditation: Yes, with SAOC/AOS | `judgeAccredited: Yes`, `judgeOrganisation: SAOC/AOS` |
| Availability unticked | `judgeAvailable: No`, `judgeDate: None` |
| Availability ticked, 22-Sep and/or 23-Sep | `judgeAvailable: Yes`, `judgeDate: 22-Sep`, `23-Sep` or `22 & 23 Sept` |
| Judges Communication and Judges Forum | `judgeCommunication` and `judgeForum`: Yes or No |
| Dietary Other and text | `dietary: Other`, `dietaryOther: <trimmed text>`; otherwise `dietaryOther: null` |

The browser and checkout route use `validateRegistrationGroup` in `lib/registration.ts`. Names and Other dietary text are required and limited to 100 characters. Email uses one `@`, a local part of at most 64 characters without leading, trailing or doubled dots, valid domain labels and at most 254 characters overall. Mobile accepts South African local numbers or an international prefix with a country code; `+27` numbers require nine national digits. Society membership needs at least one selection, with None exclusive. Judge field combinations follow the table above, independently of accreditation. Same as above values are copied again by the server.

The registration is stored on each ticket. The admin ticket drawer and CSV export show the answers; dietary Other is displayed as `Other: <text>`. The door screen, confirmation email and ticket PDF do not show dietary or mobile details.
