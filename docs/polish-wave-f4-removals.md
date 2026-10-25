# Polish wave F4 — removals only

1. `components/judging/JudgesDirectory.tsx`: the "Log in through your affiliated society" clause is
   removed. The paragraph now reads "The full accredited judges directory is available to SAOC
   members. Get in touch with the council directly." Every word was already on the page.
2. `TicketSection` gains `hideHeading` (default false): no `<h2>`, no `aria-labelledby`, and
   `aria-label={title}` on the section. Only `/national-show/programme` passes it, because its H1
   already says "Programme".
3. `/sponsors`: the "Our sponsors" eyebrow is removed. In the "Become a sponsor" card the body is
   left-aligned (`items-start`, `text-left`, no `mx-auto`) while the heading stays centred.
4. YearbookStrip is excluded (handled by the leeann-content-build mission).

## COPY GAP
The judging fallback still says "available to SAOC members", which implies a members area that does
not exist yet. Lee-Ann must supply what members can actually do. Not fixable by removal; raise it in
her Google Doc.
