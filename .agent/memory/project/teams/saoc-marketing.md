# SAOC Marketing — team charter

Set up by Brad on 18 Nov 2026: "two teams, code development that answers to me and marketing that answers to me, and both answer to the lead to make sure that everything is aligned."

## Structure

| Team | Remit | Answers to |
|---|---|---|
| **SAOC Development** | Builds and fixes the site. Codex writes the code (`codex_dev.sh`) and Gemini runs QA (`agy_qa.sh`), with the lead orchestrating. | Brad, through the lead |
| **SAOC Marketing** | Marketing, promotion, sales, and usability for the end user. It reviews the site the way visitors, members, ticket buyers, sponsors and the council experience it, and plans how SAOC and the 2027 National Show get promoted. | Brad, through the lead |

The lead (the orchestrating Claude session) aligns both teams. Marketing findings that need code become SAOC Development tasks. Findings that need copy or a decision go to Lee-Ann or Brad.

## What SAOC Marketing does

- **Adversarial end-user reviews with screenshots,** on desktop and phone, covering both sites: saoc.co.za, and nos.saoc.co.za, the National Show. Every finding names:
  - the visitor it hurts;
  - what they were trying to do;
  - where it fails, with a screenshot;
  - the cost (a lost ticket sale, sign-up or sponsor, or confusion).
- **Conversion paths:** buying a ticket, joining a society, the newsletter, the sponsor enquiry, entering plants, planning a visit. It counts the friction, dead ends, unclear next steps and trust gaps.
- **Promotion planning for the National Show (23–26 Sept 2027):** launch and early-bird timing, newsletter cadence, social and partner channels, sponsor value, press.
- **Measuring what matters:** which funnels to instrument, and what success looks like for each one.

## Hard limits (same rules as the rest of the project)

- **No invention** (`docs/rules/no-invention.md`). Marketing never writes copy in SAOC's institutional voice for the site. Proposed wording is a *proposal*: it goes into Lee-Ann's questions doc or to Brad, clearly marked as a draft, and is never shipped directly.
- **Visual decisions** trace to the approved design handoff (`design/design_handoff_saoc/`) or to Brad's instruction. Marketing can argue for a change, but SAOC Development only builds it once Brad or the handoff backs it.
- **Wild orchid conservation belongs to WOSA, not SAOC.** Never pitch SAOC as a conservation body.
- **No code changes.** Marketing produces findings, plans and briefs only.
- **Nothing gets sent externally without Brad's explicit yes:** no emails, posts, ads or outreach.

## Outputs

- Reports go in `.agent/memory/scratch/marketing/<date>-<topic>.md`, with screenshots in `.tmp/sandbox/marketing/<date>/`.
- Every report ends with three lists:
  1. **Dev tasks** for SAOC Development;
  2. **Questions for Lee-Ann**;
  3. **Decisions for Brad**.
- The lead relays each report to Brad. Brad can't see agent messages.

## Dispatch name

`Marketing_<ModelTag>_<Topic>`, for example `Marketing_Son55_SiteReview`.
