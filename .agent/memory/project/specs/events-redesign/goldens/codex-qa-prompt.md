You are an adversarial reviewer for the SAOC /events redesign (branch feat/events-redesign, worktree .tmp/sandbox/wt-events). Review `git diff origin/main...HEAD` only. Read the spec first: .agent/memory/project/specs/events-redesign/goldens/ev-spec.md, nos-design-ruling-ev.md (EV-1..EV-6, FINAL: do not argue the design, only check the code obeys it), goldens/event-row.golden.md, goldens/copy.json, and docs/rules/no-invention.md.

Try to break these, and report each as FAIL with file:line and a concrete reproducing input, or confirm it holds:
1. Public/preview gate: any path where an AI placeholder event (lib/data/placeholder-events.ts) reaches the PUBLIC build: list rows, JSON-LD, .ics, sitemap, home strip, client bundle props of EventsList. The only switch is withholdPlaceholderProse().
2. Awaiting-copy marker (ConfirmationBadge) or any "no events" sentence reaching the public build, including the zero-listed state and the empty eventsPage.intro state.
3. The National Show shown twice on /events (band + list), under any title or isFeatured combination; and the National Show MISSING from the home strip or /events (the date-only GROQ bug: dateTime("2027-09-23") is null). Check the new upcomingEventsQuery filter and upcomingEventsParams for a regression on datetime values, offsets, an event ending today in SAST, and an event with no endDate.
4. Controls threshold: Kind chips and the Month select render iff the listed (non-featured) event count is >= 6; filtering never leaves an empty page without recovery; chips come only from data.
5. Month grouping: h2 per month in the South African calendar (an instant at 00:30 SAST on the 1st belongs to that month), ascending, no duplicate groups, heading order h1 -> h2 only.
6. Event row: one link per row, 44px minimum, no nested interactive element, hover/focus = title underline + 2px left accent, no ring/box; placeholder rows unlinked. Keyboard focus visible.
7. COPY GAP: EVENTS_CALENDAR_SUBSCRIBE_LABEL is null and the /api/events.ics button does not render; no "Subscribe ..." string exists anywhere in code, alt text, aria-label, metadata or docs-as-UI.
8. No new copy: every user-visible string is pre-existing or listed in goldens/copy.json with a source. Check aria-labels and title attributes too.
9. ShowBand: the home page output is unchanged (default hrefs and labels identical); detailsHref only overrides "Show details".
10. eventsPage schema is isolated: one file + registrations, no content written, no other consumer.
11. Scope: no file outside goldens/footprint.json changed; no dependency added; no `any`, no unexplained type assertion; the Admin SDK is not imported into a client component; EventsList receives only serialisable props.

Output: first line exactly PASS or FAIL. On FAIL, one finding per line: `<severity> <file>:<line> <what breaks> <input that shows it>`.
