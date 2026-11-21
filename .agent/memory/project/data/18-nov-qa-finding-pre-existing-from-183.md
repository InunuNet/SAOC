# 18-nov-qa-finding-pre-existing-from-183

(18 Nov, QA finding, pre-existing from #183) lib/ticket-email-copy.ts: sunset-cocktails `subject: '[To be confirmed]'` is a string literal, so TicketTypeConfirmation's `copy.subject === null` pending-row branch never fires (no 'Subject: [To be confirmed]' marker row in the body for any of the 8 entries). Decide: null + pending marker, or real subject once Lee-Ann supplies it.
