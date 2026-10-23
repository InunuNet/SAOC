# Official show title

Constants live in `lib/show-title.ts`; every surface imports them, so there is one place to change.

| Form | Value | Where it applies |
|------|-------|------------------|
| Short | The National Orchid Show | Everywhere by default: the hub `<h1>`, the `%s \| The National Orchid Show` title suffix, the OG `site_name` on the NOS host, the retired "South African National Orchid Show" phrasing, the checkout item label |
| Expanded | The National Orchid Show - Western Cape 2027 | The NOS home `<title>`, the hub metadata title, the JSON-LD Event name, the header and footer lockup alt, the email lockup alt, and the About heading (the "Western Cape 2027" sub-line is half size, weight 300, with a screen-reader-only " - " separator) |

SAOC-host titles and `site_name` are unchanged. The NOS host drops "| SAOC".

## Ticket type title

The ticket email and the PDF print the Sanity ticket type name, never the stored slug. When Sanity has
no name for the stored type the fallback is the presentation product name (VIP is "VIP Ticket", from
Lee-Ann's ticketing document), then the generic "Ticket". The PDF show link is the NOS host.

## NOS email sender

Customer-facing NOS mail (ticket confirmation, sponsor, supporter and vendor confirmations and
notices) is sent as "The National Orchid Show" with Reply-To `show@saoc.co.za`. Admin notices, the
reconciliation alert and the SAOC contact form stay on the SAOC sender.

| Variable | Default |
|----------|---------|
| `RESEND_FROM_TICKETS_NOS` | `The National Orchid Show <tickets@tickets.saoc.co.za>` |
| `RESEND_FROM_FORMS_NOS` | `The National Orchid Show <noreply@forms.saoc.co.za>` |
| `RESEND_REPLY_TO_NOS` | `show@saoc.co.za` |

All three are `RUNTIME` entries in `apphosting.yaml`. A blank value falls back to the default.
They reuse the existing sending domains, so no DNS change is needed.
