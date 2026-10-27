# F7 — targets (TG-1) and scrollbar gutter (SG-1)

## Specification
1. TG-1. Each of these standalone links becomes `inline-flex min-h-11 items-center` (44px) with NO visual size, colour or underline change
   (measured against goldens/f7-visual-baseline.json, recorded on the unchanged tree): keep every existing class, add the two layout classes.
   - components/societies/SocietyFacts.tsx:68 (email), :80 (phone)
   - components/societies/SocietyAbout.tsx:37 (website), :47 (Facebook), :57 (Instagram); the wrapper there is `flex flex-wrap gap-x-6 gap-y-2`,
     so the links' own height gives the 44px target; keep the gap values
   - components/home/EventsStrip.tsx:49-53 ("Full calendar →", currently min-h-6)
   - app/(marketing)/contact/page.tsx:107 (the info@ mailto link in the direct-contacts list)
   Inline prose links stay exempt: SocietyDetailsCallout's council@ link, `inline-link` anchors in paragraphs. "← All events" on event pages is F5; the
   /events/submit inputs are F6. Not in scope: footer, header, any NOS page.
2. TG-1 inputs. app/(marketing)/societies/SocietiesClient.tsx:113 — the search input is 40.8px tall inside a min-h-11 row. Make the input itself >=44px
   (`min-h-11` on the input, keep the row), no visual change otherwise.
3. SG-1. app/globals.css: add `html { scrollbar-gutter: stable; }` (one rule, unconditional). It covers both hosts because both load globals.css;
   the check reads the computed value on localhost and nos.localhost. No other global rule changes.
4. Docs: docs/polish-wave-f7-targets.md.

## Checks
`grep -q "scrollbar-gutter: stable" app/globals.css` and f7-targets-rendered.mjs: crawls up to 30 live society pages, requires each link kind to occur at least once,
asserts height >=44 and unchanged font-size/colour/underline vs the recorded baseline, the home and contact links, the search input, and the gutter on both hosts,
at 390@3, 768, 1280 and 1440@2. Baseline red on every item. The baseline file is a QA input; do not edit it.
