# Registration form: Brad's dev review corrections (16 Nov 2026)

PR #195 (head a7fbd5f3) is NOT approved. Rework against this list, dev first.
Screenshots: img-60.png to img-69.png in this folder.
Other verdicts on the same day: #194 Foreword APPROVED (merge on resume). #196 early bird was not mentioned, so it is still awaiting review.

## Corrections

1. **Sunset Cocktails dropdown doesn't work** (img-60). This is the "National Show booking options" field. It is pre-filled from the ticket and locked, so it renders as a greyed, dead dropdown. Brad reads that as broken. Fix: make it clearly not a broken control. Confirm with Brad what he expects before choosing (plain read-only text, or a working select).
2. **Membership as a compact multi-select dropdown** (img-61). The 27 checkboxes take too much space. Use a multi-select dropdown labelled "Select all that apply".
3. **Membership combinations must make sense** (img-67). Today any mix can be ticked. Brad questions these:
   - Affiliated society plus None is already blocked. Keep that.
   - Overseas visitor together with a South African affiliated society: does it make sense?
   - Society member together with Independent Member: does it make sense?
   **Open:** the exclusivity rules need an answer from Lee-Ann or Brad. Do not invent them. Put the question in Lee-Ann's questions doc.
4. **Country defaults to South Africa** (img-62). The province field then shows by default.
5. **Dropdown chevrons sit too far right and look squashed** (img-63). Every select needs proper right padding for the arrow.
6. **Accredited judge becomes one dropdown** (img-64, img-68). Merge "Are you an accredited Orchid Judge" and "With which Orchid Organisation" into one field:
   - one "Yes, with <organisation>" option for each organisation on the existing list (e.g. "Yes, with NOS", "Yes, with AOS");
   - one "No" option.
   "No" and "Not applicable" are the same answer, so drop "Not applicable". This also removes the impossible "Yes" + "Not applicable" combination.
7. **Show-judge availability uses checkboxes** (img-65, img-69). Merge "Will you be available as a Show Judge" and "Which date". One checkbox reads "Available as a show judge". When it is ticked, the date checkboxes appear. When it is not ticked, the dates are hidden and cleared. This removes the impossible "No" + "22 & 23 Sept" combination.
8. **Default to None** (img-66). Where a field has both "Select..." and a None/No option (dietary and the like), preselect None and let the person change it.
9. **Dietary requirements gets "Other"**, with a free-text input for anything not listed.
10. **Compact and smart.** Brad wants the whole form shorter and smarter: hide what does not apply and combine related questions.
11. **Validate every field's data.** That means the email format, the mobile number format, required selections, and the cross-field rules above. Check both in the browser and again on the server in `validateRegistrationGroup`.

## Notes for the rework
- The field list and options still come from Lee-Ann's sheet. The merges above change how a question is asked, not what is collected. The admin drawer and CSV keep the same answers, with the judge fields now derived from the combined controls.
- Use the offload route: architect spec, then codex_dev or agy_dev, then a cross-vendor QA.

## Brad's decisions (16 Nov, second pass): build these
1. Booking option field: if a field is not user-editable, hide it. The form is already overwhelming. The value is still stored from the ticket.
2. Membership multi-select dropdown: APPROVED.
3. Membership combination rules: ASK LEE-ANN (question added to her doc 16 Nov). Until she answers, keep only today's rule: None excludes everything else.
4. Country defaults to South Africa: APPROVED.
5. Chevron padding: APPROVED.
6. Merged judge dropdown: APPROVED (Brad's own spec).
7. Availability checkbox with dates shown only when ticked: APPROVED (Brad's own spec; not re-mentioned in the second pass, treated as approved).
8. None preselected: APPROVED.
9. Dietary "Other": show the free-text field ONLY when Other is selected; it is required then.
10. Compact and smart: APPROVED.
11. Validate every field, client and server: APPROVED.
